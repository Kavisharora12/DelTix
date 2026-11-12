"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { useDelTixStore } from "@/lib/store";

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

  const tenantId = searchParams.get("tenant_id") || "org_prod_442";
  const nextPath = searchParams.get("next") || "/dashboard";
  const oauthErrParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthErrParam ? OAUTH_ERROR_MESSAGES[oauthErrParam] || `OAuth error: ${oauthErrParam}` : null
  );
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isDevSigningIn, setIsDevSigningIn] = useState(false);

  const allowDevAuth = process.env.NEXT_PUBLIC_ALLOW_DEV_AUTH === "true";

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const handleGoogleLogin = async () => {
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    // Route email sign-in through Google OAuth (with workspace tenant) or dev sandbox if enabled
    await handleGoogleLogin();
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
    <div className="min-h-screen bg-[#000000] text-white font-sans flex flex-col">
      {/* Top Navbar matching Sheryians screenshot */}
      <header className="w-full h-24 px-6 md:px-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/deltix-logo.svg" alt="DelTix" className="h-7 md:h-8 w-auto object-contain" />
        </Link>

        <nav className="hidden md:flex items-center gap-7 rounded-lg border border-white/15 bg-[#0C0C0C] px-7 py-2.5 text-[13.5px] font-normal text-[#E5E5E5]">
          <Link href="/" className="hover:text-[#E8602E] transition-colors">
            Home
          </Link>
          <Link href="/studio/new" className="hover:text-[#E8602E] transition-colors">
            Studio
          </Link>
          <Link href="/#platform" className="hover:text-[#E8602E] transition-colors">
            Sandbox
          </Link>
          <Link href="/dashboard" className="hover:text-[#E8602E] transition-colors">
            Console
          </Link>
        </nav>

        <div className="flex items-center gap-5">
          <Link
            href="/#faqs"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#4B1E0E] border border-[#E8602E]/40 px-4 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#5E2612] transition-colors"
          >
            <Phone className="h-3 w-3 text-[#E8602E]" />
            <span>Request Demo</span>
          </Link>
          <Link
            href="/login"
            className="text-[13.5px] font-normal text-white hover:text-[#E8602E] transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Centered Single-Column Form directly on #000000 */}
      <main className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-[430px] flex flex-col gap-3">
          {/* Heading & Subtitle */}
          <div>
            <h1 className="text-[36.73px] font-bold leading-[40.8px] tracking-tight text-white">
              {isSignUp ? "Create Account" : "Sign In"}
            </h1>
            <p className="mt-1.5 text-[19.58px] font-normal text-white/90">
              {isSignUp ? "Already have an account? " : "New user? "}
              <button
                type="button"
                onClick={() => setIsSignUp((prev) => !prev)}
                className="cursor-pointer text-[#E8602E] hover:underline transition-colors"
              >
                {isSignUp ? "Sign In" : "Create an account"}
              </button>
            </p>
          </div>

          {/* Already Authenticated Banner */}
          {session && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-emerald-200 truncate">
                    Signed in as {session.name || session.email}
                  </div>
                </div>
              </div>
              <Link
                href={nextPath.startsWith("/") ? nextPath : "/dashboard"}
                className="rounded-md bg-[#E8602E] px-3 py-1 text-xs font-semibold text-white hover:bg-[#d45222] transition-colors shrink-0"
              >
                Continue
              </Link>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Email Form */}
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2 mt-2">
            <label
              htmlFor="email"
              className="font-light text-[16.32px] leading-[32.64px] text-white/80"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address here"
              className="border border-[#232323] bg-[#000000] focus:border-[#A3A3A3] h-[42px] w-full rounded-lg px-4 text-[14.688px] text-white outline-none placeholder-[#898989] transition-colors"
            />
            {email.trim().length > 0 && (
              <button
                type="submit"
                disabled={isRedirecting}
                className="mt-2 w-full rounded-lg bg-[#E8602E] hover:bg-[#d45222] py-2.5 text-[14.688px] font-medium text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {isRedirecting ? "Redirecting..." : "Continue with Email"}
              </button>
            )}
          </form>

          {/* "Or" Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="h-[1px] flex-1 bg-[#232323]" />
            <span className="text-[13px] text-white/80">Or</span>
            <div className="h-[1px] flex-1 bg-[#232323]" />
          </div>

          {/* Continue with Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isRedirecting}
            className="border-[0.5px] border-[#4E4A48] bg-gradient-to-b from-[#171212] to-[#100B0B] hover:from-[#211A1A] hover:to-[#161010] text-[#979797] hover:text-white flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-center text-[14.688px] font-normal transition-all duration-500 disabled:opacity-50 cursor-pointer"
          >
            {isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#E8602E]" />
                <span>Redirecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Subtle Dev Sandbox option when enabled */}
          {allowDevAuth && (
            <button
              type="button"
              onClick={handleDevBypass}
              disabled={isDevSigningIn || isRedirecting}
              className="mt-2 text-center text-xs text-[#6B6B6B] hover:text-[#E8602E] transition-colors cursor-pointer"
            >
              {isDevSigningIn ? "Signing into Dev Sandbox..." : "Use Dev Sandbox Session"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000000] text-[#898989] flex items-center justify-center text-sm font-mono">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
