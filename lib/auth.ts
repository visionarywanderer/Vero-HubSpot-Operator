import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getEnv } from "@/lib/env";
import { appSettingsStore } from "@/lib/app-settings-store";

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  hd?: string;
};

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
