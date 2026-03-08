import { z } from "zod";

const envSchema = z.object({
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ALLOWED_GOOGLE_DOMAIN: z.string().default("verodigital.co"),
  ALLOWED_GOOGLE_EMAILS: z.string().optional(),
  HUBSPOT_OAUTH_CLIENT_ID: z.string().optional(),
  HUBSPOT_OAUTH_CLIENT_SECRET: z.string().optional(),
  HUBSPOT_OAUTH_REDIRECT_URI: z.string().url().optional(),
  HUBSPOT_TOKEN: z.string().min(1).optional(),
  HUBSPOT_MCP_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
  DATABASE_PATH: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}
