"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Could not start Google sign-in. Check OAuth configuration.",
  OAuthCallback: "Google sign-in failed during callback.",
  OAuthCreateAccount: "Could not create account from Google profile.",
  AccessDenied: "Access denied. Your email may not be on the allowlist.",
  Verification: "Token verification failed. Try again.",
  Default: "An authentication error occurred. Try again.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorMessage = error
    ? ERROR_MESSAGES[error] || ERROR_MESSAGES.Default
    : null;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <section className="card" style={{ width: "100%", maxWidth: 560 }}>
        <h1 className="page-title">Sign In</h1>
        <div className="accent-stripe" />
        <p className="page-subtitle">
          This tool is restricted to internal users. Sign in with Google Workspace (verodigital.co) to access the dashboard, then connect client portals for operation.
        </p>
        {errorMessage && (
          <div style={{ marginTop: 14, background: "rgba(220, 38, 38, 0.15)", borderLeft: "3px solid #ef4444", borderRadius: 8, padding: 12, color: "#fca5a5", fontSize: 13 }}>
            {errorMessage}
          </div>
        )}
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => signIn("google", { callbackUrl })}>Sign in with Google</button>
        <div style={{ marginTop: 14, background: "var(--bg-raised)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, color: "var(--ink-secondary)", fontSize: 13 }}>
          If you see an access error after signing in, ask an admin to add your email to the allowlist.
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
        <section className="card" style={{ width: "100%", maxWidth: 560 }}>
          <h1 className="page-title">Sign In</h1>
          <div className="accent-stripe" />
          <p className="page-subtitle">Loading...</p>
        </section>
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
