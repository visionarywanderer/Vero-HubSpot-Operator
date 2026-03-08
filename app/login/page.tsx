"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <section className="card" style={{ width: "100%", maxWidth: 560 }}>
        <h1 className="page-title">Sign In</h1>
        <div className="accent-stripe" />
        <p className="page-subtitle">
          This tool is restricted to internal users. Sign in with Google Workspace (verodigital.co) to access the dashboard, then connect client portals for operation.
        </p>
        <button className="btn btn-primary" onClick={() => signIn("google", { callbackUrl: "/" })}>Sign in with Google</button>
        <div className="card" style={{ marginTop: 14, background: "#f7f9fc", borderRadius: 12, padding: 12 }}>
          If you see an access error after signing in, ask an admin to add your email to the allowlist.
        </div>
      </section>
    </main>
  );
}
