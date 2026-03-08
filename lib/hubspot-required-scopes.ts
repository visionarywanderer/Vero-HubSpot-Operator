export const HUBSPOT_PRIVATE_APP_REQUIRED_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.custom.read",
  "crm.objects.custom.write",
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
  "crm.schemas.companies.read",
  "crm.schemas.companies.write",
  "crm.schemas.deals.read",
  "crm.schemas.deals.write",
  "crm.lists.read",
  "crm.lists.write",
  "automation",
  "sales-email-read",
  "crm.objects.owners.read",
  "tickets"
] as const;

export function missingRequiredScopes(scopes: string[]): string[] {
  return HUBSPOT_PRIVATE_APP_REQUIRED_SCOPES.filter((requiredScope) => !scopes.includes(requiredScope));
}
