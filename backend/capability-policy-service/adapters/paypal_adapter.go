package adapters

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	sharedmodels "github.com/deltix/shared/models"
)

var (
	ErrMissingPayPalCredentials = errors.New("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured")
	ErrMissingEndpointTemplate  = errors.New("capability contract has no endpoint_path configured in capability_registry")
	pathPlaceholderRe           = regexp.MustCompile(`\{([a-zA-Z0-9_]+)\}`)
)

// PayPalProvider executes live PayPal REST API calls dynamically driven by CapabilityContract metadata.
type PayPalProvider interface {
	ExecuteCapability(
		ctx context.Context,
		contract sharedmodels.CapabilityContract,
		idempotencyKey string,
		parameters map[string]interface{},
	) (map[string]interface{}, string, error)
}

type PayPalSandboxAdapter struct {
	baseURL      string
	clientID     string
	clientSecret string
	httpClient   *http.Client
	breaker      *CircuitBreaker

	tokenMu     sync.Mutex
	cachedToken string
	tokenExpiry time.Time
}

func NewPayPalSandboxAdapter(
	baseURL string,
	clientID string,
	clientSecret string,
	httpClient *http.Client,
	breaker *CircuitBreaker,
) *PayPalSandboxAdapter {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}
	if breaker == nil {
		breaker = NewCircuitBreaker(5, 30*time.Second)
	}
	return &PayPalSandboxAdapter{
		baseURL:      strings.TrimRight(baseURL, "/"),
		clientID:     strings.TrimSpace(clientID),
		clientSecret: strings.TrimSpace(clientSecret),
		httpClient:   httpClient,
		breaker:      breaker,
	}
}

func (a *PayPalSandboxAdapter) ExecuteCapability(
	ctx context.Context,
	contract sharedmodels.CapabilityContract,
	idempotencyKey string,
	parameters map[string]interface{},
) (map[string]interface{}, string, error) {
	if !a.breaker.Allow() {
		return nil, "", ErrCircuitOpen
	}
	if a.clientID == "" || a.clientSecret == "" {
		return nil, "", ErrMissingPayPalCredentials
	}

	endpointTemplate := strings.TrimSpace(contract.EndpointPath)
	if endpointTemplate == "" {
		return nil, "", fmt.Errorf("%w: %s", ErrMissingEndpointTemplate, contract.CapabilityID)
	}

	token, err := a.getOrFetchAccessToken(ctx)
	if err != nil {
		a.breaker.RecordFailure()
		return nil, "", fmt.Errorf("paypal oauth2 authentication failed: %w", err)
	}

	res, resourceID, callErr := a.dispatchDynamicRESTCall(ctx, token, contract, endpointTemplate, idempotencyKey, parameters)
	if callErr != nil {
		a.breaker.RecordFailure()
		return nil, "", callErr
	}

	a.breaker.RecordSuccess()
	return res, resourceID, nil
}

func (a *PayPalSandboxAdapter) getOrFetchAccessToken(ctx context.Context) (string, error) {
	a.tokenMu.Lock()
	if a.cachedToken != "" && time.Now().UTC().Before(a.tokenExpiry) {
		tok := a.cachedToken
		a.tokenMu.Unlock()
		return tok, nil
	}
	a.tokenMu.Unlock()

	form := url.Values{}
	form.Set("grant_type", "client_credentials")

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		a.baseURL+"/v1/oauth2/token",
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(a.clientID, a.clientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("paypal oauth2 returned %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var parsed struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", err
	}
	if parsed.AccessToken == "" {
		return "", errors.New("paypal oauth2 returned empty access_token")
	}

	ttl := time.Duration(parsed.ExpiresIn) * time.Second
	if ttl <= 60*time.Second {
		ttl = 5 * time.Minute
	} else {
		ttl -= 30 * time.Second
	}

	a.tokenMu.Lock()
	a.cachedToken = parsed.AccessToken
	a.tokenExpiry = time.Now().UTC().Add(ttl)
	a.tokenMu.Unlock()

	return parsed.AccessToken, nil
}

func (a *PayPalSandboxAdapter) dispatchDynamicRESTCall(
	ctx context.Context,
	accessToken string,
	contract sharedmodels.CapabilityContract,
	endpointTemplate string,
	idempotencyKey string,
	parameters map[string]interface{},
) (map[string]interface{}, string, error) {
	method := strings.ToUpper(strings.TrimSpace(contract.HTTPMethod))
	if method == "" {
		if contract.IsMutation {
			method = http.MethodPost
		} else {
			method = http.MethodGet
		}
	}

	// 1. Interpolate {placeholder} path variables from parameters and track consumed keys
	consumedKeys := make(map[string]bool)
	var missingErr error
	resolvedPath := pathPlaceholderRe.ReplaceAllStringFunc(endpointTemplate, func(match string) string {
		key := strings.TrimSuffix(strings.TrimPrefix(match, "{"), "}")
		consumedKeys[key] = true
		val, exists := parameters[key]
		if !exists || val == nil || fmt.Sprintf("%v", val) == "" {
			missingErr = fmt.Errorf("missing required path parameter %q for capability %s", key, contract.CapabilityID)
			return ""
		}
		return url.PathEscape(fmt.Sprintf("%v", val))
	})
	if missingErr != nil {
		return nil, "", missingErr
	}
	if !strings.HasPrefix(resolvedPath, "/") {
		resolvedPath = "/" + resolvedPath
	}

	// 2. Build remaining parameters for query string (GET/DELETE) or JSON body (POST/PUT/PATCH)
	bodyParams := make(map[string]interface{})
	for k, v := range parameters {
		if !consumedKeys[k] {
			bodyParams[k] = v
		}
	}

	fullURL := a.baseURL + resolvedPath
	var bodyReader io.Reader
	if method == http.MethodGet || method == http.MethodDelete {
		if len(bodyParams) > 0 {
			q := url.Values{}
			for k, v := range bodyParams {
				q.Set(k, fmt.Sprintf("%v", v))
			}
			fullURL += "?" + q.Encode()
		}
	} else {
		bodyBytes, err := buildPayPalRequestBody(bodyParams)
		if err != nil {
			return nil, "", err
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if idempotencyKey != "" {
		req.Header.Set("PayPal-Request-Id", idempotencyKey)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("paypal request to %s failed: %w", resolvedPath, err)
	}
	defer resp.Body.Close()

	rawResp, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, "", err
	}

	if resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("paypal api %s %s returned status %d: %s", method, resolvedPath, resp.StatusCode, strings.TrimSpace(string(rawResp)))
	}

	out := make(map[string]interface{})
	if len(bytes.TrimSpace(rawResp)) > 0 {
		if err := json.Unmarshal(rawResp, &out); err != nil {
			return nil, "", fmt.Errorf("decode paypal response json: %w", err)
		}
	}

	resID, _ := out["id"].(string)
	out["capability_id"] = contract.CapabilityID
	out["idempotency_key"] = idempotencyKey
	if resID != "" {
		out["provider_resource_id"] = resID
	}
	return out, resID, nil
}

// buildPayPalRequestBody formats body parameters cleanly; if payload is already structured for PayPal,
// it forwards it directly; if flat amount_usd/currency_code is passed, it formats standard PayPal Money object.
func buildPayPalRequestBody(bodyParams map[string]interface{}) ([]byte, error) {
	if len(bodyParams) == 0 {
		return []byte("{}"), nil
	}
	if rawPayload, ok := bodyParams["paypal_payload"].(map[string]interface{}); ok {
		return json.Marshal(rawPayload)
	}
	if amountUSD, hasAmount := bodyParams["amount_usd"].(float64); hasAmount && bodyParams["amount"] == nil && bodyParams["purchase_units"] == nil {
		currency, _ := bodyParams["currency_code"].(string)
		if currency == "" {
			currency = "USD"
		}
		moneyObj := map[string]string{
			"currency_code": currency,
			"value":         fmt.Sprintf("%.2f", amountUSD),
		}
		if intent, hasIntent := bodyParams["intent"].(string); hasIntent {
			return json.Marshal(map[string]interface{}{
				"intent": strings.ToUpper(intent),
				"purchase_units": []map[string]interface{}{
					{"amount": moneyObj},
				},
			})
		}
		payload := make(map[string]interface{}, len(bodyParams))
		for k, v := range bodyParams {
			if k != "amount_usd" && k != "currency_code" {
				payload[k] = v
			}
		}
		payload["amount"] = moneyObj
		return json.Marshal(payload)
	}
	return json.Marshal(bodyParams)
}
