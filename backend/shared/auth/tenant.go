package auth

import (
	"context"
	"errors"
)

var (
	ErrMissingTenantID = errors.New("missing tenant id in context")
	ErrMissingSession  = errors.New("missing authenticated session in context")
)

type contextKey int

const (
	sessionContextKey contextKey = iota
)

// WithUserSession attaches a verified UserSession to the request context.
func WithUserSession(ctx context.Context, session UserSession) context.Context {
	return context.WithValue(ctx, sessionContextKey, session)
}

// SessionFromContext extracts the verified UserSession from the context.
func SessionFromContext(ctx context.Context) (UserSession, error) {
	session, ok := ctx.Value(sessionContextKey).(UserSession)
	if !ok || session.SessionID == "" {
		return UserSession{}, ErrMissingSession
	}
	return session, nil
}

// TenantIDFromContext extracts the authenticated TenantID from the context.
func TenantIDFromContext(ctx context.Context) (string, error) {
	session, err := SessionFromContext(ctx)
	if err != nil {
		return "", ErrMissingTenantID
	}
	if session.TenantID == "" {
		return "", ErrMissingTenantID
	}
	return session.TenantID, nil
}