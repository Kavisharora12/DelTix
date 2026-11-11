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
	allowedProps := extractSchemaProperties(contract.ParametersSchema)
	isWriteOrder := method == http.MethodPost && (contract.CapabilityID == "paypal.orders.create" || resolvedPath == "/v2/checkout/orders")
	isWriteInvoice := method == http.MethodPost && (contract.CapabilityID == "paypal.invoice.create" || resolvedPath == "/v2/invoicing/invoices")
	bodyParams := make(map[string]interface{})
	for k, v := range parameters {
		if consumedKeys[k] {
			continue
		}
		if k == "paypal_payload" || len(allowedProps) == 0 || allowedProps[k] ||
			((isWriteOrder || isWriteInvoice) && isFlatPayPalInputKey(k)) ||
			(allowedProps["amount"] && (k == "amount_usd" || k == "currency_code" || k == "intent")) {
			bodyParams[k] = v
		}
	}

	// PayPal Reporting Transaction Search requires ISO-8601 start_date and end_date within a 31-day window.
	if contract.CapabilityID == "paypal.transaction.search" || endpointTemplate == "/v1/reporting/transactions" {
		now := time.Now().UTC()
		if v, ok := bodyParams["end_date"]; !ok || strings.TrimSpace(fmt.Sprintf("%v", v)) == "" {
			bodyParams["end_date"] = now.Format(time.RFC3339)
		}
		if v, ok := bodyParams["start_date"]; !ok || strings.TrimSpace(fmt.Sprintf("%v", v)) == "" {
			bodyParams["start_date"] = now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
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
		bodyBytes, err := buildPayPalRequestBody(contract.CapabilityID, resolvedPath, bodyParams)
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

func isFlatPayPalInputKey(k string) bool {
	switch k {
	case "amount_usd", "amount", "currency_code", "currency", "customer_email",
		"recipient_email", "item_name", "description", "invoice_id", "intent",
		"purchase_units", "items", "detail", "primary_recipients":
		return true
	default:
		return false
	}
}

func firstNonEmptyString(params map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := params[k]; ok && v != nil {
			if s := strings.TrimSpace(fmt.Sprintf("%v", v)); s != "" && s != "<nil>" {
				return s
			}
		}
	}
	return ""
}

func toFloat64(val interface{}) (float64, bool) {
	switch n := val.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	default:
		return 0, false
	}
}

func extractPositiveAmount(params map[string]interface{}) (float64, bool) {
	for _, k := range []string{"amount_usd", "amount"} {
		if v, ok := params[k]; ok {
			if f, okF := toFloat64(v); okF && f > 0 {
				return f, true
			}
		}
	}
	if rawItems, ok := params["items"].([]interface{}); ok && len(rawItems) > 0 {
		var total float64
		for _, item := range rawItems {
			m, okM := item.(map[string]interface{})
			if !okM {
				continue
			}
			if f, okF := toFloat64(m["item_total"]); okF && f > 0 {
				total += f
			} else if f, okF := toFloat64(m["item_cost"]); okF && f > 0 {
				qty := 1.0
				if q, okQ := toFloat64(m["quantity"]); okQ && q > 0 {
					qty = q
				}
				total += f * qty
			}
		}
		if total > 0 {
			return total, true
		}
	}
	return 0, false
}

// buildPayPalRequestBody formats body parameters cleanly for PayPal REST v1/v2 APIs,
// supporting both structured PayPal payloads and flat DelTix workflow inputs.
func buildPayPalRequestBody(capabilityID string, resolvedPath string, bodyParams map[string]interface{}) ([]byte, error) {
	if len(bodyParams) == 0 {
		return []byte("{}"), nil
	}
	if rawPayload, ok := bodyParams["paypal_payload"].(map[string]interface{}); ok {
		return json.Marshal(rawPayload)
	}

	currency := strings.ToUpper(firstNonEmptyString(bodyParams, "currency_code", "currency"))
	if currency == "" {
		currency = "USD"
	}
	itemDesc := firstNonEmptyString(bodyParams, "description", "item_name", "invoice_id")
	if itemDesc == "" {
		itemDesc = "DelTix Service"
	}

	if capabilityID == "paypal.orders.create" || resolvedPath == "/v2/checkout/orders" {
		intent := strings.ToUpper(firstNonEmptyString(bodyParams, "intent"))
		if intent == "" {
			intent = "CAPTURE"
		}
		if bodyParams["purchase_units"] != nil {
			return json.Marshal(map[string]interface{}{
				"intent":         intent,
				"purchase_units": bodyParams["purchase_units"],
			})
		}
		if amountUSD, ok := extractPositiveAmount(bodyParams); ok {
			return json.Marshal(map[string]interface{}{
				"intent": intent,
				"purchase_units": []map[string]interface{}{
					{
						"description": itemDesc,
						"amount": map[string]string{
							"currency_code": currency,
							"value":         fmt.Sprintf("%.2f", amountUSD),
						},
					},
				},
			})
		}
	}

	if (capabilityID == "paypal.invoice.create" || resolvedPath == "/v2/invoicing/invoices") && bodyParams["detail"] == nil {
		payload := map[string]interface{}{
			"detail": map[string]interface{}{"currency_code": currency},
		}
		if email := firstNonEmptyString(bodyParams, "recipient_email", "customer_email"); email != "" {
			payload["primary_recipients"] = []map[string]interface{}{
				{"billing_info": map[string]string{"email_address": email}},
			}
		}
		hasPayPalInvoiceItems := false
		if rawItems, ok := bodyParams["items"].([]interface{}); ok && len(rawItems) > 0 {
			if firstItem, okM := rawItems[0].(map[string]interface{}); okM && firstItem["unit_amount"] != nil {
				hasPayPalInvoiceItems = true
			}
		}
		if hasPayPalInvoiceItems {
			payload["items"] = bodyParams["items"]
		} else if amountUSD, ok := extractPositiveAmount(bodyParams); ok {
			payload["items"] = []map[string]interface{}{
				{
					"name":     itemDesc,
					"quantity": "1",
					"unit_amount": map[string]string{
						"currency_code": currency,
						"value":         fmt.Sprintf("%.2f", amountUSD),
					},
				},
			}
		}
		return json.Marshal(payload)
	}

	if amountUSD, hasAmount := bodyParams["amount_usd"].(float64); hasAmount && bodyParams["amount"] == nil && bodyParams["purchase_units"] == nil {
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

func extractSchemaProperties(schemaRaw json.RawMessage) map[string]bool {
	trimmed := bytes.TrimSpace(schemaRaw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("{}")) {
		return nil
	}
	var parsed struct {
		Properties map[string]interface{} `json:"properties"`
	}
	if err := json.Unmarshal(trimmed, &parsed); err != nil || len(parsed.Properties) == 0 {
		return nil
	}
	allowed := make(map[string]bool, len(parsed.Properties))
	for k := range parsed.Properties {
		allowed[k] = true
	}
	return allowed
}
