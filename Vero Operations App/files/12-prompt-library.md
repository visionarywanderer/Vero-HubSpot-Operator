# 12 — Prompt Library

## Purpose
Pre-built, tested prompts for every common operation. Users can trigger these by name or keyword instead of writing prompts from scratch. Each prompt maps to a specific module and execution layer.

## Priority: P2 | Dependencies: 04-orchestrator

---

## Structure

Each prompt entry:

```json
{
  "id": "audit-data-quality",
  "name": "Data Quality Audit",
  "category": "audit",
  "module": "A1",
  "layer": "mcp",
  "description": "Scan contacts for missing required fields",
  "prompt": "...",
  "parameters": [
    { "name": "objectType", "default": "contacts", "options": ["contacts", "companies", "deals"] }
  ],
  "tags": ["audit", "data quality", "contacts"]
}
```

---

## Prompt Categories

### Category 1: Portal Audit (Read-Only)

**audit-data-quality**
```
Search all {objectType} and check for records missing these critical fields:
- Contacts: email, firstname, lastname, lifecyclestage, hubspot_owner_id
- Companies: name, domain, industry
- Deals: dealname, amount, closedate, pipeline, dealstage, hubspot_owner_id

For each field, report: total records, records with value, records missing value, fill rate %.
Flag any field with < 80% fill rate as needing attention.
Sort results by fill rate ascending (worst first).
```

**audit-pipeline-health**
```
Get all deals grouped by pipeline and stage. For each pipeline report:
- Total deals and total value per stage
- Average days in each stage
- Deals stuck > 30 days in any stage (list them)
- Deals with close date in the past but still in open stage
- Deals with amount = 0 or null

Provide a health score for each pipeline: Green (no issues), Yellow (minor issues), Red (critical issues).
```

**audit-owner-distribution**
```
Get all {objectType} grouped by hubspot_owner_id. For each owner report:
- Number of assigned records
- Number with recent activity (last 30 days)
- Number with no activity (> 30 days)

Flag owners with > 200 assigned contacts or > 50 assigned deals as overloaded.
Flag records with no owner.
```

**audit-association-gaps**
```
Find all contacts that have a non-empty 'company' text property but no associated company record.
Find all deals with no associated contact.
Find all deals with no associated company.

Report counts and list the first 20 of each for review.
```

**audit-lifecycle-stages**
```
Get all contacts grouped by lifecycle stage. Report:
- Count per stage
- Contacts in 'subscriber' with activity in last 30 days (should be upgraded)
- Contacts in 'lead' or 'MQL' with an associated closed-won deal (should be 'customer')
- Contacts with no lifecycle stage set

Provide recommendations for stage corrections.
```

**audit-property-usage**
```
List all custom properties for {objectType}. For each:
- Name, label, type
- Fill rate (% of records that have a value)
- Last time any record had this property updated

Flag properties with < 5% fill rate as deletion candidates.
Flag properties with > 50% fill rate that are not used in any workflow or list as under-utilized.
```

---

### Category 2: CRM Write Operations

**crm-create-followup-tasks**
```
For each {objectType} that matches this criteria: {criteria}
Create a task assigned to the record owner:
- Subject: "{taskPrefix}{subject}"
- Body: "{body}"
- Due date: {dueDays} days from now
- Priority: {priority}

Before creating, show me the count of records that match and the list of owners who will receive tasks. Wait for my confirmation.
```

**crm-fix-missing-associations**
```
Find contacts with a non-empty 'company' property but no company association.
For each, search companies by exact name match.
- If exactly 1 match: create the association. Log it.
- If 0 matches: log as 'no company found'.
- If 2+ matches: log as 'ambiguous — manual review needed'.

Show summary before executing. Wait for confirmation.
```

**crm-update-lifecycle-stages**
```
Find contacts matching: {criteria}
Update their lifecycle stage to: {newStage}

Show the count and a sample of 5 records before executing.
Wait for confirmation. Log every change with before/after values.
```

---

### Category 3: Workflow Generation

**workflow-lead-routing**
```
Workflow: Lead Routing - {formName}
Object: contact
Trigger: Contact submits form {formId}
Actions:
  1. Set property lifecyclestage = lead
  2. Create task for default owner: "Route new lead from {formName}"
  3. Send internal notification to sales manager: "New lead submitted {formName}"

Deploy disabled. Use portal config for owner IDs and form IDs.
```

**workflow-stalled-deal-alert**
```
Workflow: Stalled Deal Alert
Object: deal
Trigger: Deal has been in same stage > {days} days
Actions:
  1. Send internal notification to deal owner: "Deal {dealname} has been in {stage} for {days}+ days"
  2. Create task for deal owner: "Review stalled deal {dealname}" due in 2 days

Deploy disabled.
```

**workflow-mql-followup**
```
Workflow: MQL Follow-Up Sequence
Object: contact
Trigger: Lifecycle stage becomes MQL
Actions:
  1. Create task for owner: "Follow up with new MQL" due in 1 day, high priority
  2. Delay 3 days
  3. If no meeting booked (hs_meetings_booked = 0):
     Send notification to sales manager: "MQL has not been contacted in 3 days"
  4. If meeting booked:
     Set property lead_status = "Connected"

Deploy disabled.
```

**workflow-customer-onboarding**
```
Workflow: Customer Onboarding
Object: deal
Trigger: Deal stage becomes Closed Won
Actions:
  1. Set associated contact lifecycle stage = customer
  2. Create task for CS owner: "Schedule onboarding call for {dealname}" due in 1 day
  3. Delay 7 days
  4. Create task for CS owner: "Check onboarding progress for {dealname}"
  5. Send notification to account manager: "Onboarding check for {dealname}"

Deploy disabled.
```

---

### Category 4: Bulk Operations

**bulk-name-standardization**
```
Fetch all contacts. For each contact:
- Capitalize first letter of firstname and lastname
- Trim whitespace from all text properties
- Lowercase email addresses

Generate a script with dry-run mode. Show count of affected records before executing.
```

**bulk-deal-cleanup**
```
Find all deals with:
- Amount = 0 or null → create task for owner: "Set deal amount for {dealname}"
- Close date in past + open stage → create task for owner: "Update close date or stage for {dealname}"
- No associated contact → log for manual review

Generate script. Run dry-run first.
```

**bulk-association-repair**
```
Find contacts with company text property but no company association.
Match by company name. Auto-associate exact matches.
Log ambiguous and no-match cases for manual review.

Generate script with dry-run. Show match statistics before executing.
```

**bulk-lifecycle-migration**
```
Update lifecycle stages based on activity and deal status:
- Subscriber + form submission in 90 days → Lead
- Lead + meeting booked → MQL
- MQL + associated open deal → SQL
- Any stage + associated closed-won deal → Customer

Generate script. Dry-run first. Log all transitions.
```

---

### Category 5: Property Management

**property-create-lead-scoring**
```
Create these contact properties in group "lead_scoring_custom":
1. lead_segment (enumeration, select): Enterprise, Mid-Market, SMB, Unknown
2. lead_source_detail (string, text): Free text for detailed source
3. lead_quality_score (number): 0-100 internal score
4. days_since_last_activity (number): Calculated field placeholder

Create the property group first if it doesn't exist.
```

**property-cleanup-audit**
```
List all custom properties for contacts. Find properties that:
- Have < 5% fill rate (deletion candidates)
- Have names containing 'test', 'temp', 'old', 'deprecated'
- Are duplicates (similar names or labels)

Output a table: name, label, type, fill rate, recommendation (keep/review/delete).
```

---

### Category 6: List & Segment Creation

**list-create-hot-leads**
```
Create smart list "Hot Leads - Active MQLs":
- Lifecycle stage = MQL
- Lead score > {threshold}
- Last activity within 7 days
- Has associated company
```

**list-create-at-risk**
```
Create smart list "At Risk Customers":
- Lifecycle stage = Customer
- No activity in 60 days
- Has open ticket with priority High
```

---

## Storage Format

Store prompts as individual `.md` files or a single `prompts.json`:

```
prompts/
  audit/
    data-quality.md
    pipeline-health.md
    owner-distribution.md
  crm/
    create-followup-tasks.md
    fix-associations.md
  workflows/
    lead-routing.md
    stalled-deal.md
  bulk/
    name-standardization.md
    lifecycle-migration.md
  properties/
    create-lead-scoring.md
  lists/
    hot-leads.md
```

## Exports

```typescript
interface PromptLibrary {
  list(category?: string): PromptEntry[];
  get(id: string): PromptEntry;
  search(query: string): PromptEntry[];
  execute(id: string, parameters?: Record<string, string>): Promise<void>;
  add(entry: PromptEntry): void;
  // Merges portal config values into prompt template
  resolve(id: string, portalConfig: PortalConfig): string;
}
```
