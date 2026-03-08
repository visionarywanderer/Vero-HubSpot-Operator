import { authManager } from "@/lib/auth-manager";

export async function getHubSpotHeadersForActivePortal(): Promise<Record<string, string>> {
  await authManager.ensureValidatedForSession();
  const token = authManager.getToken();

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}
