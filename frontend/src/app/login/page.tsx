"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Building2,
  Terminal,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useDelTixStore } from "@/lib/store";

const PRESET_WORKSPACES = [
  { id: "org_prod_442", label: "org_prod_442 (Primary Operations)" },
  { id: "ten_finance_ops", label: "ten_finance_ops (Finance Desk)" },
  { id: "ten_dev_workspace", label: "ten_dev_workspace (Dev Sandbox)" },
];

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google sign-in was cancelled before granting permission.",
  OAUTH_DENIED: "Google OAuth consent was cancelled.",
  INVALID_OAUTH_CALLBACK: "OAuth callback was missing state or authorization code.",
  INVALID_OAUTH_STATE: "OAuth state token expired or did not match. Please try signing in again.",
  OAUTH_EXCHANGE_FAILED: "Failed to exchange Google authorization code with API Gateway.",
  USER_PERSISTENCE_FAILED: "Authenticated with Google, but failed to persist user/tenant in database.",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, refreshSession } = useDelTixStore();

  const initialTenant = searchParams.get("tenant_id") || "org_prod_442";
  const nextPath = searchParams.get("next") || "/dashboard";
  const oauthErrParam = searchParams.get("error");

  const [tenantId, setTenantId] = useState(initialTenant);
  const [error, setError] = useState<string | null>(
    oauthErrParam ? OAUTH_ERROR_MESSAGES[oauthErrParam] || `OAuth error: ${oauthErrParam}` : null
  );
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isDevSigningIn, setIsDevSigningIn] = useState(false);

  const allowDevAuth = process.env.NEXT_PUBLIC_ALLOW_DEV_AUTH === "true";

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const handleGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsRedirecting(true);

    try {
      const authUrl = await api.getGoogleLoginUrl(tenantId);
      window.location.assign(authUrl);
    } catch (err: any) {
      setError(err?.message || "Unable to start Google OAuth flow.");
      setIsRedirecting(false);
    }
  };

  const handleDevBypass = async () => {
    setError(null);
    setIsDevSigningIn(true);
    try {
      await api.enableDevSession(tenantId);
      await refreshSession();
      router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch (err: any) {
      setError(err?.message || "Developer sandbox bypass is disabled on API Gateway.");
      setIsDevSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-app text-slate-12 flex flex-col justify-between p-6">
      {/* Top Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-slate-10 hover:text-slate-12 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to DelTix Overview</span>
        </Link>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-2 border border-slate-5 text-[11px] font-mono text-slate-10">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span>SANDBOX GATEWAY</span>
        </div>
      </div>

      {/* Centered OAuth Sign-In Card */}
      <div className="max-w-md w-full mx-auto my-10">
        <div className="rounded-xl border border-slate-5 bg-panel p-7 shadow-xl space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-slate-12 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 22h20L12 2zm0 5.8L17.5 19H6.5L12 7.8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-12">
                  Sign in to DelTix
                </h1>
                <p className="text-xs text-slate-10">
                  Tenant-isolated Google OAuth session console
                </p>
              </div>
            </div>
          </div>

          {/* Already Authenticated Banner */}
          {session && (
            <div className="rounded-lg border border-green-6 bg-green-2/60 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-green-10 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-green-11 truncate">
                    Signed in as {session.name || session.email}
                  </div>
                  <div className="text-[11px] font-mono text-slate-10 truncate">
                    {session.email} &middot; {session.tenant_id}
                  </div>
                </div>
              </div>
              <Link href={nextPath.startsWith("/") ? nextPath : "/dashboard"}>
                <Button size="sm" variant="primary" className="text-xs shrink-0">
                  Continue
                </Button>
              </Link>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="rounded-lg border border-red-6 bg-red-2/60 p-3 flex items-start gap-2.5 text-xs text-red-11">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Workspace Tenant + Google OAuth Form */}
          <form onSubmit={handleGoogleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="tenant-id"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-11"
              >
                <Building2 className="h-3.5 w-3.5 text-slate-9" />
                <span>Workspace / Tenant ID</span>
              </label>
              <input
                id="tenant-id"
                type="text"
                required
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="org_prod_442"
                className="w-full px-3 py-2 rounded-md bg-slate-1 border border-slate-5 text-sm font-mono text-slate-12 placeholder:text-slate-8 focus:outline-none focus:border-blue-8"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_WORKSPACES.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setTenantId(ws.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                      tenantId === ws.id
                        ? "bg-blue-3 border-blue-7 text-blue-11"
                        : "bg-slate-2 border-slate-5 text-slate-10 hover:text-slate-12"
                    }`}
                  >
                    {ws.id}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2.5"
              disabled={isRedirecting || !tenantId.trim()}
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Redirecting to Google OAuth...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </Button>
          </form>

          {/* Optional explicit Dev Sandbox bypass when enabled */}
          {allowDevAuth && (
            <div className="pt-2 space-y-3 border-t border-slate-5">
              <div className="flex items-center justify-between text-[11px] text-slate-9">
                <span>Local Development Bypass</span>
                <span className="font-mono">GATEWAY_ALLOW_DEV_AUTH</span>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full text-xs flex items-center justify-center gap-2"
                onClick={handleDevBypass}
                disabled={isDevSigningIn || isRedirecting}
              >
                {isDevSigningIn ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Terminal className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span>Use Dev Sandbox Session ({tenantId.trim() || "ten_dev_workspace"})</span>
              </Button>
            </div>
          )}

          {/* Security Footer */}
          <div className="pt-2 flex items-start gap-2 text-[11px] text-slate-9 leading-relaxed">
            <ShieldCheck className="h-3.5 w-3.5 text-green-10 shrink-0 mt-0.5" />
            <span>
              Sessions are stored in Upstash Redis as HttpOnly SameSite cookies; tenant identity is verified server-side on API Gateway.
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl w-full mx-auto text-center text-[11px] text-slate-9 font-mono">
        DELTIX AUTHENTICATION GATEWAY &middot; OAUTH2 + REDIS SESSION STORE
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-app text-slate-10 flex items-center justify-center text-sm font-mono">
          Loading authentication console...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
