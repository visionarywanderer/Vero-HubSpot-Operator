import type { NextAuthOptions, Session } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getEnv } from "@/lib/env";
import { appSettingsStore } from "@/lib/app-settings-store";

/**
 * Convenience wrapper: returns the current session via next-auth.
 * All API routes should use this instead of calling getServerSession directly.
 */
export async function requireSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  hd?: string;
};

const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    })
  ],
  pages: {
    signIn: "/login"
  },
  // Debug mode in production to diagnose issues (remove once login works)
  debug: process.env.NEXTAUTH_DEBUG === "true",
  // Explicit cookie config — avoid __Host-/__Secure- prefixes behind Railway proxy
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: {
        sameSite: "lax" as const,
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return false;
      }

      const env = getEnv();
      const googleProfile = (profile ?? {}) as GoogleProfile;
      const email = googleProfile.email?.toLowerCase();
      const isVerified = googleProfile.email_verified === true;
      const hostedDomain = googleProfile.hd?.toLowerCase();
      const allowedDomain = env.ALLOWED_GOOGLE_DOMAIN.toLowerCase();

      if (!email || !isVerified) {
        return false;
      }

      const emailDomainAllowed = email.endsWith(`@${allowedDomain}`);
      const hdAllowed = hostedDomain === allowedDomain;

      if (!emailDomainAllowed || !hdAllowed) {
        return false;
      }

      const envAllowlist = (env.ALLOWED_GOOGLE_EMAILS || "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

      let dbAllowlist: string[] = [];
      try {
        const settings = await appSettingsStore.load();
        dbAllowlist = settings.usersAllowlist.map((entry) => entry.trim().toLowerCase()).filter(Boolean);
      } catch {
        dbAllowlist = [];
      }

      const effectiveAllowlist = dbAllowlist.length > 0 ? dbAllowlist : envAllowlist;
      if (effectiveAllowlist.length > 0 && !effectiveAllowlist.includes(email)) {
        return false;
      }

      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    }
  },
  session: {
    strategy: "jwt"
  }
};
