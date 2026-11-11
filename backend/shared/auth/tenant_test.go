package auth

import (
	"context"
	"testing"
	"time"
)

func TestUserSession_Validate(t *testing.T) {
	tests := []struct {
		name    string
		session UserSession
		wantErr bool
	}{
		{
			name: "valid session",
			session: UserSession{
				SessionID: "sess_123",
				UserID:    "user_456",
				TenantID:  "tenant_789",
				Email:     "finance@company.com",
				CreatedAt: time.Now(),
				ExpiresAt: time.Now().Add(time.Hour),
			},
			wantErr: false,
		},
		{
			name: "missing session id",
			session: UserSession{
				UserID:   "user_456",
				TenantID: "tenant_789",
				Email:    "finance@company.com",
			},
			wantErr: true,
		},
		{
			name: "missing user id",
			session: UserSession{
				SessionID: "sess_123",
				TenantID:  "tenant_789",
				Email:     "finance@company.com",
			},
			wantErr: true,
		},
		{
			name: "missing tenant id",
			session: UserSession{
				SessionID: "sess_123",
				UserID:    "user_456",
				Email:     "finance@company.com",
			},
			wantErr: true,
		},
		{
			name: "missing email",
			session: UserSession{
				SessionID: "sess_123",
				UserID:    "user_456",
				TenantID:  "tenant_789",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.session.Validate(); (err != nil) != tt.wantErr {
				t.Errorf("UserSession.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestContextHelpers(t *testing.T) {
	ctx := context.Background()

	// Empty context should fail
	_, err := SessionFromContext(ctx)
	if err != ErrMissingSession {
		t.Errorf("SessionFromContext(empty) error = %v, want %v", err, ErrMissingSession)
	}

	_, err = TenantIDFromContext(ctx)
	if err != ErrMissingTenantID {
		t.Errorf("TenantIDFromContext(empty) error = %v, want %v", err, ErrMissingTenantID)
	}

	// Valid session in context
	validSession := UserSession{
		SessionID: "sess_999",
		UserID:    "usr_888",
		TenantID:  "ten_777",
		Email:     "ops@deltix.io",
	}

	withSessionCtx := WithUserSession(ctx, validSession)

	retrievedSession, err := SessionFromContext(withSessionCtx)
	if err != nil {
		t.Fatalf("SessionFromContext() error = %v", err)
	}
	if retrievedSession.SessionID != validSession.SessionID {
		t.Errorf("got session ID %q, want %q", retrievedSession.SessionID, validSession.SessionID)
	}

	tenantID, err := TenantIDFromContext(withSessionCtx)
	if err != nil {
		t.Fatalf("TenantIDFromContext() error = %v", err)
	}
	if tenantID != "ten_777" {
		t.Errorf("got tenant ID %q, want 'ten_777'", tenantID)
	}
}

