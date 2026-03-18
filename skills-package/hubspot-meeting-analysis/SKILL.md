---
description: "Analyse client meeting notes and generate a detailed HubSpot implementation plan. Use when: user pastes meeting notes, call notes, discovery notes, client requirements, CRM planning notes, or asks to analyse a client conversation for HubSpot setup."
---

# HubSpot Meeting Notes Analyst

When the user pastes meeting notes or client requirements, analyse them deeply and produce a structured implementation plan that chains directly into the other HubSpot skills for execution.

**This skill is the entry point. It produces the plan. The other skills execute it.**

---

## What This Skill Does

```
Meeting Notes → Analysis → Structured Plan → Chained Skill Execution
                                                ├── save_property_draft
                                                ├── save_pipeline_draft
                                                ├── save_workflow_draft
                                                ├── save_list_draft
                                                ├── save_script_draft
                                                └── save_template_draft
```

---

## Phase 1: Extract & Classify

Read the meeting notes and extract every actionable item into these categories:

### 1.1 Business Context
- **Company type**: SaaS, Agency, E-commerce, Services, Marketplace, etc.
- **Team size**: How many people will use HubSpot
- **Current tools**: What CRM/tools they're migrating from (if any)
- **HubSpot tier**: Free, Starter, Professional, Enterprise (affects available features)
- **Pain points**: What's broken or missing today
- **Goals**: What success looks like (revenue targets, process improvements, etc.)

### 1.2 Data Model Requirements
Extract mentions of:
- **Custom fields/properties** — "we need to track X", "we want a field for Y", "we store Z"
- **Object types** — contacts, companies, deals, tickets, custom objects
- **Relationships** — "linked to", "associated with", "related to"
- **Data types** — dates, numbers, dropdowns, checkboxes, text, phone numbers
- **Existing data** — CSV imports, migration from another CRM, data cleanup needs

### 1.3 Process Requirements
Extract mentions of:
- **Sales stages** — "our process goes from X to Y to Z", "we have N stages"
- **Support flow** — "tickets go through...", "our support process is..."
- **Win/loss criteria** — what defines a won or lost deal
- **Handoff points** — marketing → sales, sales → CS, etc.

### 1.4 Automation Requirements
Extract mentions of:
- **Triggers** — "when X happens, do Y", "automatically..."
- **Notifications** — "alert the team when...", "notify manager if..."
- **Property updates** — "set status to X when...", "mark as Y after..."
- **Task creation** — "create a follow-up task when..."
- **Email sends** — "send an email when..."
- **Delays** — "wait N days then...", "after N hours..."

### 1.5 Segmentation Requirements
Extract mentions of:
- **Audiences** — "we want a list of...", "segment by...", "filter for..."
- **Criteria** — property values, date ranges, activity-based
- **Dynamic vs static** — "always up to date" = DYNAMIC, "one-time" = MANUAL
- **Use cases** — email campaigns, reporting, ABM, suppression

### 1.6 Bulk Operations
Extract mentions of:
- **Data cleanup** — "fix formatting", "deduplicate", "normalize"
- **Mass updates** — "update all contacts where...", "set X for everyone who..."
- **Migration** — "import from Salesforce", "move data from spreadsheet"
- **Backfill** — "fill in missing values", "calculate and set"

---

## Phase 2: Gap Analysis & Recommendations

After extraction, analyse what's **missing** or **risky**:

### 2.1 Dependency Check
For each requirement, identify prerequisites:
- Properties needed before workflows can reference them
- Property groups needed before properties
- Pipelines needed before deal-stage workflows
- Lists needed before list-based enrollment workflows

### 2.2 Tier Feasibility
Flag requirements that need a higher tier:
- Custom objects → Enterprise only
- Calculated properties → Professional+
- ABM tools → Enterprise only
- Custom code in workflows → Operations Hub Professional+
- Labeled associations → Enterprise only

### 2.3 Missing Requirements
Identify things the client probably needs but didn't mention:
- **If they mentioned a sales pipeline** → they probably need Closed Won/Lost stages, probability metadata
- **If they mentioned lifecycle stages** → they probably need stage-based segmentation
- **If they mentioned lead scoring** → they probably need score properties + threshold workflows
- **If they mentioned onboarding** → they probably need a welcome workflow + onboarding stage
- **If they mentioned reporting** → they probably need calculated/rollup properties
- **If they track revenue** → they probably need MRR/ARR properties on contacts and companies
- **If they mentioned multi-select** → suggest enumeration + checkbox vs multiple boolean properties
- **If they mentioned phone numbers** → use string + phonenumber fieldType
- **If they mentioned dates** → clarify date vs datetime (date-only or include time?)

### 2.4 Alternative Solutions
For each requirement, consider whether there's a simpler approach:

| Requirement | Complex Solution | Simpler Alternative |
|---|---|---|
| Lead scoring | Calculated properties | Enumeration property with workflow-set values |
| Multi-object tracking | Custom object | Properties on existing objects + associations |
| Complex conditional logic | Multi-branch workflow | Multiple simple workflows with list enrollment |
| Real-time sync | Webhook + custom code | Scheduled bulk script |
| Data validation | Custom code workflow action | Required properties + enumeration constraints |
| Owner routing | Custom rotation algorithm | Built-in 0-11 rotate-to-owner action |

---

## Phase 3: Structured Plan Output

Present the plan in this exact format so it chains into execution:

### Plan Header

```markdown
# HubSpot Implementation Plan
**Client**: [name from notes]
**Date**: [today]
**Estimated HubSpot Tier Required**: [Free/Starter/Professional/Enterprise]
**Estimated Resources**: X properties, Y pipelines, Z workflows, W lists, N scripts
```

### Section A: Property Groups & Properties

For each property, output a ready-to-execute spec:

```markdown
#### Property Group: [group_name]
- **Object**: contacts/companies/deals/tickets
- **Group Name**: lowercase_snake_case
- **Label**: Human Readable Name

#### Properties in this group:
| # | Name | Label | Type | FieldType | Options (if enum) | Notes |
|---|------|-------|------|-----------|-------------------|-------|
| 1 | field_name | Field Label | string | text | — | Why this is needed |
| 2 | status_field | Status | enumeration | select | option_a, option_b | From meeting: "we track status as..." |
```

**Validation checkpoint**: For each property, confirm:
- [ ] Name is lowercase snake_case, ≤64 chars
- [ ] Name doesn't start with `hs_` or `hubspot_`
- [ ] Type/fieldType match per matrix
- [ ] Enum options are lowercase with underscores
- [ ] groupName exists or will be created first

### Section B: Pipelines

For each pipeline:

```markdown
#### Pipeline: [Label]
- **Object**: deals/tickets
- **Stages**:

| # | Stage | Probability | Closed? | Notes |
|---|-------|-------------|---------|-------|
| 0 | Discovery | 0.1 | No | From meeting: "first we qualify" |
| 1 | Proposal | 0.5 | No | |
| ... | | | | |
| N | Closed Won | 1.0 | Yes (Won) | Required |
| N+1 | Closed Lost | 0.0 | Yes (Lost) | Required |
```

**Validation checkpoint**:
- [ ] Deal pipelines have Closed Won AND Closed Lost
- [ ] All stages have probability (0.1 increments, strings)
- [ ] All metadata values are strings
- [ ] Stage labels are unique within pipeline
- [ ] Within tier pipeline limit

### Section C: Workflows

For each workflow:

```markdown
#### Workflow: [Name]
- **Object**: contacts (CONTACT_FLOW) / deals/companies/tickets (PLATFORM_FLOW)
- **Trigger**: [what starts it]
- **Actions**:

| Step | Action | actionTypeId | Details |
|------|--------|-------------|---------|
| 1 | Set property | 0-5 | Set hs_lead_status = "NEW" |
| 2 | Delay | 0-1 | Wait 1 day |
| 3 | Create task | 0-3 | "Follow up with lead" |
```

**Validation checkpoint**:
- [ ] Using numeric actionTypeId (0-X), not names
- [ ] objectTypeId matches flow type
- [ ] isEnabled = false
- [ ] All referenced properties exist (or will be created first)

### Section D: Lists & Segments

For each list:

```markdown
#### List: [Name]
- **Object**: contacts (0-1) / companies (0-2) / deals (0-3)
- **Type**: DYNAMIC / MANUAL / SNAPSHOT
- **Logic**: [human-readable filter description]
- **Filters**:

| # | Property | Operator | Value | operationType |
|---|----------|----------|-------|---------------|
| 1 | lifecyclestage | IS_ANY_OF | ["lead"] | ENUMERATION |
| 2 | createdate | IS_BETWEEN | last 30 days | TIME_RANGED |
```

**AND/OR structure**: [describe which filters are AND'd and which are OR'd]

**Validation checkpoint**:
- [ ] operationType matches property type (ENUMERATION for dropdowns, MULTISTRING for text, etc.)
- [ ] Root is OR, children are AND
- [ ] Dynamic lists have filterBranch, manual lists don't

### Section E: Bulk Operations (if needed)

```markdown
#### Script: [Description]
- **Object**: contacts/deals/etc.
- **Action**: Update/Cleanup/Migrate
- **Filter**: What records to target
- **Change**: What to modify
- **Estimated records**: ~N
- **Safety**: Dry-run first, JSONL logging
```

### Section F: Execution Order

```markdown
## Execution Order (Dependency-Resolved)

1. **Property Groups** — Create all custom groups first
   → Chain to: hubspot-property-drafts skill (save_property_draft)

2. **Properties** — Create all custom properties
   → Chain to: hubspot-property-drafts skill (save_property_draft)

3. **Pipelines** — Create deal/ticket pipelines
   → Chain to: hubspot-pipeline-drafts skill (save_pipeline_draft)

4. **Lists** — Create segments (some workflows need lists)
   → Chain to: hubspot-list-drafts skill (save_list_draft)

5. **Workflows** — Create automations (reference properties, lists, pipelines)
   → Chain to: hubspot-workflow-drafts skill (save_workflow_draft)

6. **Bulk Scripts** — Run data cleanup/migration (after properties exist)
   → Chain to: hubspot-bulk-drafts skill (save_script_draft)

7. **[Optional] Full Template** — Bundle everything as a reusable template
   → Chain to: hubspot-template-drafts skill (save_template_draft)
```

---

## Phase 4: Execute the Plan

After the user approves the plan (or parts of it), execute by chaining into the appropriate skills:

### Execution Flow

```
1. For each property group → call save_property_draft with batch format
2. For each pipeline → call save_pipeline_draft
3. For each list → call save_list_draft
4. For each workflow → call save_workflow_draft
5. For each script → call save_script_draft
6. [Optional] Bundle all → call save_template_draft
```

### Execution Rules

1. **Always ask before executing** — Present the plan first, get approval
2. **Execute in dependency order** — Groups → Properties → Pipelines → Lists → Workflows → Scripts
3. **Batch where possible** — Use multi-property batch format for properties
4. **Flag uncertainties** — If a requirement is ambiguous, ask before assuming
5. **Track what's done** — Mark each resource as drafted after saving
6. **Tell user where to deploy** — Each draft deploys from its corresponding app page

---

## Phase 5: Post-Plan Review

After generating the plan, proactively check:

### Completeness Check
- [ ] Every mention of a custom field → has a property spec
- [ ] Every mention of a process → has a pipeline or workflow
- [ ] Every mention of a segment/audience → has a list spec
- [ ] Every mention of data cleanup → has a bulk script
- [ ] Every automation → references only properties/lists that exist or are in the plan

### Risk Assessment
- [ ] No reserved property names used (hs_, hubspot_)
- [ ] All enum option values are lowercase with underscores
- [ ] Deal pipelines have both closed stages
- [ ] Workflow action IDs are numeric (0-X format)
- [ ] No tier-gated features used beyond client's tier
- [ ] Property count within tier limits

### Client Communication Suggestions
After the plan, suggest:
- Questions to ask the client for clarification
- Features they might want but didn't mention
- Potential issues to flag early (e.g., data migration complexity)

---

## Example: Meeting Notes → Plan

**Input (meeting notes)**:
> "Spoke with Acme Corp. They're a B2B SaaS company, 15-person sales team. Using spreadsheets today.
> They want to track: lead source, product interest (multiple products), trial start date, MRR.
> Sales process: Discovery → Demo → Trial → Proposal → Negotiation → Won/Lost.
> They want automatic task creation when a trial starts. Need a list of all active trialists.
> They have 3000 contacts in a CSV that need importing. Some have bad phone number formatting."

**Output structure**:
1. **Business Context**: B2B SaaS, 15 sales reps, migrating from spreadsheets
2. **Tier recommendation**: Professional (15 users, workflows needed)
3. **Properties**: lead_source (enum/select), product_interest (enum/checkbox), trial_start_date (date/date), mrr_value (number/number) — in custom group `saas_metrics`
4. **Pipeline**: 8-stage deal pipeline with probabilities
5. **Workflow**: Trial start → create task (0-3), set lifecycle stage (0-5)
6. **List**: Active Trialists — DYNAMIC, trial_start_date IS_BETWEEN last 14 days
7. **Bulk Script**: Import + phone number cleanup
8. **Execution order**: group → properties → pipeline → list → workflow → bulk script

---

## Procedure

1. **Receive** meeting notes from user (pasted in chat)
2. **Extract** all actionable items using Phase 1 categories
3. **Analyse** gaps, dependencies, tier requirements using Phase 2
4. **Present** structured plan using Phase 3 format
5. **Ask** user to approve the plan (or specific sections)
6. **Execute** approved sections by chaining to the appropriate skills (Phase 4)
7. **Review** completeness and flag risks (Phase 5)
8. **Summarize** what was drafted and where to deploy each resource
