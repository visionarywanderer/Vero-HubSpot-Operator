# 15 — Frontend Dashboard Specification

## Purpose
The complete web interface for the Vero HubSpot Operator. Every backend module (01–13) surfaces through this dashboard. This is the only thing team members interact with — no CLI, no code, no HubSpot portal access needed.

## Priority: Phase 6 (after all backend modules) | Dependencies: All specs (01–13)

---

# PART 1: Design System & Branding

## Reference
Match the existing VeroHub Audit tool at `hubspot-audit-tool-production.up.railway.app`.

## Extracted Brand Tokens (from the live audit tool CSS)

```css
:root {
  --bg: #efefef;                /* Page background — light warm gray */
  --card: #ffffff;              /* Card/panel backgrounds */
  --ink: #0b0b0d;               /* Primary text — near-black */
  --muted: #5f6672;             /* Secondary text — gray */
  --line: #d8dce2;              /* Borders, dividers */
  --accent: #ff7a59;            /* HubSpot orange — accent stripe, badges, alerts */
  --primary: #61ace8;           /* Vero blue — buttons, links, active states */
  --success: #00bda5;           /* Green — connected states, success badges */
  --warning: #f5c26b;           /* Yellow — warning states, pending */
  --danger: #f2545b;            /* Red — errors, disconnect, high-risk */
  --sidebar-bg: #1a1e2e;        /* Dark navy sidebar */
  --sidebar-text: #c8cdd5;      /* Light gray sidebar text */
  --sidebar-active: #ffffff;    /* White — active sidebar item */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --shadow-card: 0 1px 8px rgba(0,0,0,0.09);
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Cascadia Code", monospace;
}
```

## Design Patterns (Matching Live Tool)

| Pattern | Implementation |
|---|---|
| Cards | White background, 1px `--line` border, `border-radius: 18px`, `box-shadow: 0 1px 8px rgba(0,0,0,0.09)`, `padding: 18px` |
| Accent stripe | 62px wide × 4px tall, `--accent` (HubSpot orange), `border-radius: 999px`, placed below headings |
| Buttons (primary) | `--primary` background, white text, `font-weight: 900`, `font-size: 14px`, `border-radius: 12px`, `padding: 12px 14px` |
| Buttons (danger) | `--danger` background, same structure |
| Buttons (ghost) | Transparent background, `--primary` text, `1px solid --line` border |
| Info boxes | `background: #f7f9fc`, `border: 1px solid #e3e8f0`, `border-radius: 12px`, `padding: 12px` |
| Code blocks | `background: #f1f4f8`, `border: 1px solid #e3e8f0`, `border-radius: 8px`, `font-family: var(--font-mono)`, `font-size: 12px` |
| Headings | `font-size: 28px`, `letter-spacing: -0.2px`, `margin: 0 0 8px 0` |
| Body text (muted) | `color: var(--muted)`, `font-size: 13px`, `line-height: 1.45` |

## Typography Scale

| Element | Size | Weight | Color |
|---|---|---|---|
| Page title | 28px | 700 | `--ink` |
| Section heading | 20px | 700 | `--ink` |
| Card title | 16px | 600 | `--ink` |
| Body | 14px | 400 | `--ink` |
| Caption/meta | 13px | 400 | `--muted` |
| Badge | 11px | 700 | white on colored bg |
| Monospace | 12px | 400 | `--ink` on `#f1f4f8` |

## Status Badges

| State | Background | Text | Border Radius |
|---|---|---|---|
| Connected | `--success` (#00bda5) | white | 999px (pill) |
| Disconnected | `--line` (#d8dce2) | `--muted` | 999px |
| Processing | `--warning` (#f5c26b) | `--ink` | 999px |
| Error | `--danger` (#f2545b) | white | 999px |
| Sandbox | `#e8d5ff` (light purple) | `#6b21a8` | 999px |
| Production | `#dbeafe` (light blue) | `#1e40af` | 999px |

---

# PART 2: Application Shell & Navigation

## Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  SIDEBAR (240px fixed)  │  MAIN CONTENT AREA             │
│                         │                                 │
│  ┌─────────────────┐    │  ┌─────────────────────────┐   │
│  │  VERO LOGO      │    │  │ TOP BAR                  │   │
│  │  HubSpot        │    │  │ Portal selector + user   │   │
│  │  Operator       │    │  └─────────────────────────┘   │
│  ├─────────────────┤    │                                 │
│  │  PORTAL PICKER  │    │  ┌─────────────────────────┐   │
│  │  [Acme Corp ▼]  │    │  │                          │   │
│  ├─────────────────┤    │  │  PAGE CONTENT             │   │
│  │                 │    │  │  (changes per route)      │   │
│  │  NAV ITEMS      │    │  │                          │   │
│  │  ─────────────  │    │  │                          │   │
│  │  Dashboard      │    │  │                          │   │
│  │  Chat           │    │  │                          │   │
│  │  Portals        │    │  │                          │   │
│  │  Audits         │    │  │                          │   │
│  │  Workflows      │    │  │                          │   │
│  │  Properties     │    │  │                          │   │
│  │  Lists          │    │  │                          │   │
│  │  Pipelines      │    │  │                          │   │
│  │  Bulk Ops       │    │  │                          │   │
│  │  Scripts        │    │  │                          │   │
│  │  ─────────────  │    │  │                          │   │
│  │  Activity Log   │    │  │                          │   │
│  │  Settings       │    │  └─────────────────────────┘   │
│  │                 │    │                                 │
│  └─────────────────┘    │                                 │
└──────────────────────────────────────────────────────────┘
```

## Sidebar: Exact Specification

Background: `--sidebar-bg` (#1a1e2e). Width: 240px fixed. Full viewport height. Sticky.

### Sidebar Header
- Vero logo (white version, 32px height) or text "VeroHub" in white 20px bold
- Subtitle: "HubSpot Operator" in `--sidebar-text` 12px
- Accent stripe (48px × 3px, `--accent`) below subtitle

### Portal Picker (Below Header)
- Dropdown with currently selected portal name
- Shows portal name + environment badge (sandbox/production)
- When clicked: dropdown list of all connected portals
- At bottom of dropdown: "+ Connect New Portal" link

### Navigation Groups

**Group 1: "OPERATE" (label in 10px uppercase, `--sidebar-text` at 50% opacity)**

| Nav Item | Icon | Route | Maps To Spec |
|---|---|---|---|
| Dashboard | `LayoutDashboard` | `/` | Overview of active portal |
| Chat | `MessageSquare` | `/chat` | 04-orchestrator (the main prompt interface) |

**Group 2: "MANAGE" (label)**

| Nav Item | Icon | Route | Maps To Spec |
|---|---|---|---|
| Portals | `Building2` | `/portals` | 01-auth (connect/disconnect/list) |
| Audits | `ClipboardCheck` | `/audits` | 12-prompt-library (audit category) |
| Workflows | `GitBranch` | `/workflows` | 06-workflow-engine |
| Properties | `Tags` | `/properties` | 07-property-manager |
| Lists & Segments | `Users` | `/lists` | 08-list-manager |
| Pipelines | `Kanban` | `/pipelines` | 09-pipeline-manager |
| Bulk Operations | `Layers` | `/bulk` | 10-script-engine + 12-prompt-library (bulk category) |

**Group 3: "SYSTEM" (label)**

| Nav Item | Icon | Route | Maps To Spec |
|---|---|---|---|
| Activity Log | `ScrollText` | `/activity` | 05-change-logger |
| Settings | `Settings` | `/settings` | 11-portal-config + app settings |

### Navigation States
- Default: `--sidebar-text`, no background
- Hover: `rgba(255,255,255,0.06)` background, white text
- Active: `rgba(255,255,255,0.1)` background, white text, 3px `--primary` left border

### Sidebar Footer
- User avatar (Google profile picture, 28px circle) + email truncated
- "Sign Out" small text link

---

## Top Bar

Height: 56px. Background: `--card`. Border-bottom: `1px solid --line`.

Contents (left to right):
1. **Breadcrumb**: Current section name (e.g., "Dashboard" or "Workflows > Lead Routing")
2. **Spacer**
3. **Active portal badge**: Portal name + environment badge (pill shape)
4. **Notification bell** (future: alerts from change logger)
5. **User avatar** (28px circle, Google profile)

---

# PART 3: Authentication

## Page: `/login`

This is the ONLY page visible to unauthenticated users.

### Layout
- Centered card (max-width: 560px) on `--bg` background
- Matches the existing VeroHub Audit login page exactly

### Contents
1. Heading: "Sign In" (28px, bold)
2. Accent stripe (62px × 4px, `--accent`)
3. Description: "This tool is restricted to internal users. Sign in with Google Workspace (verodigital.co) to access the dashboard, then connect client portals for operation." — `--muted`, 13px
4. Button: "Sign in with Google" — `--primary` background, white text, bold
5. Info box: "If you see an access error after signing in, ask an admin to add your email to the allowlist."

### Implementation
- Backend: Google OAuth with domain restriction (`hd: 'verodigital.co'`)
- Store session in HTTP-only cookie
- Allowlist of emails in env var or database
- Redirect to `/` on success, show error on failure

---

# PART 4: Page-by-Page Specification

---

## PAGE 1: Dashboard (`/`)

**Purpose**: At-a-glance status of the active portal. The first thing you see after login.

### Prerequisite
If no portals are connected, show an empty state with a large "Connect Your First Portal" button that links to `/portals`.

### Layout: 4-Column Top Stats + 3-Column Grid Below

#### Row 1: Stats Bar (4 cards in a row)

| Card | Value Source | Display |
|---|---|---|
| **Contacts** | `GET /crm/v3/objects/contacts?limit=0` (use `total` from response) | Large number + "Total Contacts" |
| **Companies** | Same pattern for companies | Large number + "Total Companies" |
| **Open Deals** | Deals with `dealstage != closedwon AND closedlost` | Large number + total pipeline value |
| **Today's Changes** | Count from change-logger for today | Large number + "Changes Made Today" |

Each stat card:
- White card, `--radius-lg`
- Value: 32px bold `--ink`
- Label: 13px `--muted`
- Small icon top-right in faded `--primary`

#### Row 2: Three-Column Grid

**Column 1: Recent Activity (spans ~50% width)**
- Card titled "Recent Activity"
- Lists last 10 entries from the change logger for this portal
- Each entry: icon (based on action type) + description + timestamp (relative: "2 min ago")
- Action types: create (green +), update (blue pencil), delete (red trash), workflow_deploy (purple zap)
- "View All" link → `/activity`

**Column 2: Portal Health (spans ~25% width)**
- Card titled "Portal Health"
- Quick metrics from the last audit run (if any):
  - Data quality score (0–100 with colored ring)
  - Pipeline health (green/yellow/red indicator)
  - Property fill rate (% bar)
  - Association coverage (% bar)
- "Run Full Audit" button → triggers audit-data-quality prompt
- "Last audited: March 7, 2026" footer text

**Column 3: Quick Actions (spans ~25% width)**
- Card titled "Quick Actions"
- Vertical stack of buttons, each triggers a prompt library entry:
  - "Run Data Quality Audit" → prompt: audit-data-quality
  - "Check Pipeline Health" → prompt: audit-pipeline-health
  - "Find Missing Associations" → prompt: audit-association-gaps
  - "Audit Property Usage" → prompt: audit-property-usage
  - "View All Prompts →" link → `/chat` with prompt library sidebar

---

## PAGE 2: Chat / Operator (`/chat`)

**Purpose**: The primary working interface. A chat window where the user types natural language prompts and the orchestrator (spec 04) processes them. This is the core of the app.

### Layout: Two-Panel

```
┌──────────────────────────────────────────────────────┐
│  PROMPT LIBRARY SIDEBAR     │  CHAT AREA              │
│  (280px, collapsible)       │  (remaining width)       │
│                             │                          │
│  [Search prompts...]        │  ┌──────────────────┐   │
│                             │  │ Message history   │   │
│  ▸ Audit (6)                │  │ scrolls here      │   │
│  ▸ CRM Operations (3)      │  │                    │   │
│  ▸ Workflows (4)            │  │                    │   │
│  ▸ Bulk Operations (4)      │  │                    │   │
│  ▸ Properties (2)           │  │                    │   │
│  ▸ Lists & Segments (2)     │  │                    │   │
│                             │  │                    │   │
│  Each prompt shows:         │  └──────────────────┘   │
│  - Name                     │                          │
│  - Description (1 line)     │  ┌──────────────────┐   │
│  - Tags as pills            │  │ [Type prompt...]  │   │
│  - Click to insert          │  │             [Send]│   │
│                             │  └──────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Prompt Library Sidebar (Left Panel)

- Width: 280px, collapsible via hamburger icon
- **Search bar**: filters prompts by name, description, tags
- **Categories**: collapsible accordion sections
- **Each prompt card**:
  - Name (14px bold)
  - Description (12px `--muted`, 1 line, truncated)
  - Tags as small pills (`--primary` border, 10px text)
  - Click → fills the chat input with the prompt text
  - Some prompts have parameters: clicking opens a small modal to fill them before inserting

### Chat Area (Right Panel)

#### Message History (scrollable area)
- Scrolls from bottom to top (newest at bottom)
- **User messages**: right-aligned, `--primary` background, white text, rounded corners (16px), max-width 70%
- **Assistant messages**: left-aligned, `--card` background, `--ink` text, rounded corners, max-width 85%

#### Assistant Message Types

The orchestrator produces structured responses. The frontend must render different content blocks:

**1. Text Block**
- Plain text paragraph with markdown rendering (bold, italic, links, code)
- Render with a simple markdown parser

**2. Plan Preview Block (requiresConfirmation = true)**
When the orchestrator returns a plan requiring confirmation:

```
┌──────────────────────────────────────────────┐
│  ⚡ OPERATION PLAN                            │
│                                               │
│  Intent: Update lifecycle stages for          │
│  contacts who submitted forms                 │
│                                               │
│  Steps:                                       │
│  1. Search contacts with form submission ─ MCP│
│  2. Filter to current subscribers ─────── MCP │
│  3. Update lifecycle stage to 'lead' ──── MCP │
│                                               │
│  Records affected: ~142                       │
│  Risk: ● Medium                               │
│                                               │
│  [Cancel]  [Confirm & Execute]                │
└──────────────────────────────────────────────┘
```

- Card with `1px solid --warning` border (for medium risk), `--danger` for high risk, `--line` for low
- Risk indicator: colored dot + word
- "Confirm & Execute" button is `--primary` for low/medium, `--danger` for high risk
- High risk operations show an additional text input: "Type the record ID to confirm"

**3. Results Table Block**
For audit results and search results:

```
┌──────────────────────────────────────────────┐
│  📊 Data Quality Audit Results                │
│                                               │
│  Field          │ Records │ Fill Rate │ Status│
│  ─────────────────────────────────────────── │
│  email          │ 4,521   │ 98.2%    │ ✅    │
│  firstname      │ 4,102   │ 89.1%    │ ✅    │
│  company        │ 2,890   │ 62.8%    │ ⚠️    │
│  phone          │ 1,201   │ 26.1%    │ ❌    │
│                                               │
│  [Export CSV]  [Create Tasks for Gaps]         │
└──────────────────────────────────────────────┘
```

- Rendered as a styled HTML table inside the chat
- Sortable columns (click header to sort)
- Status icons: ✅ (≥80%), ⚠️ (50–79%), ❌ (<50%)
- Action buttons below table: "Export CSV" and contextual follow-up actions

**4. Code/Script Block**
For generated scripts (spec 10):

```
┌──────────────────────────────────────────────┐
│  📝 Generated Script: name-standardization.js │
│  ┌────────────────────────────────────────┐   │
│  │ // Bulk Name Standardization           │   │
│  │ const hubspot = require('@hubspot/...')│   │
│  │ ...                                    │   │
│  └────────────────────────────────────────┘   │
│                                               │
│  [Copy]  [Download .js]  [Run Dry-Run]        │
└──────────────────────────────────────────────┘
```

- Syntax-highlighted code block (use highlight.js or Prism.js)
- Collapsible (shows first 15 lines, "Show more" to expand)
- Three buttons: Copy, Download, Run Dry-Run
- "Run Dry-Run" shows a secondary confirmation dialog before executing

**5. Workflow Spec Block**
For generated workflow JSON (spec 06):

```
┌──────────────────────────────────────────────┐
│  🔄 Workflow: Lead Routing - Demo Form        │
│                                               │
│  Type: CONTACT_FLOW                           │
│  Trigger: Form submission (Demo Request)      │
│  Actions:                                     │
│    1. Set lifecycle stage → Lead              │
│    2. Create task → "Route new lead"          │
│    3. Send notification → Sales Manager       │
│  Deploy state: DISABLED (safe)                │
│                                               │
│  [View Raw JSON]  [Deploy to HubSpot]         │
└──────────────────────────────────────────────┘
```

- Visual summary of the workflow (not raw JSON by default)
- "View Raw JSON" toggles to show the full v4 JSON in a code block
- "Deploy to HubSpot" button with confirmation modal:
  - "This will create a DISABLED workflow in {portal name}. You must enable it manually in HubSpot. Deploy?"
  - [Cancel] [Deploy Disabled]

**6. Progress Block**
For multi-step operations:

```
┌──────────────────────────────────────────────┐
│  ⏳ Executing: Full Portal Audit              │
│                                               │
│  ✅ Step 1/5: Search contacts missing email   │
│  ✅ Step 2/5: Search stale deals              │
│  ⏳ Step 3/5: Check association gaps...       │
│  ○ Step 4/5: Analyze findings                 │
│  ○ Step 5/5: Generate report                  │
│                                               │
│  [Cancel]                                     │
└──────────────────────────────────────────────┘
```

- Animated spinner on current step
- Checkmark on completed steps
- Empty circle on pending steps
- Cancel button stops the multi-step chain

**7. Error Block**
```
┌──────────────────────────────────────────────┐
│  ❌ Error                                     │
│                                               │
│  Failed to update contact 12345:              │
│  "Property 'custom_field' does not exist"     │
│                                               │
│  Portal: Acme Corp (hub_id: 12345678)         │
│  Module: A3 (Update via MCP)                  │
│                                               │
│  [Retry]  [View in Activity Log]              │
└──────────────────────────────────────────────┘
```

- Red-bordered card, `--danger` left border accent
- Shows error message, portal context, and which module failed
- Retry button re-sends the same operation

#### Chat Input Bar (Bottom, Sticky)

- Full-width text input, 48px height, `--radius-md`
- Placeholder: "Ask the operator anything... or pick a prompt from the library →"
- **Send button**: `--primary`, right side of input, icon only (arrow-up)
- **Keyboard**: Enter = send, Shift+Enter = newline
- Above input, when portal is selected: small pill showing "Operating on: Acme Corp (production)" with environment badge
- When no portal selected: yellow warning bar "Select a portal before running operations"

---

## PAGE 3: Portals (`/portals`)

**Purpose**: Manage all client portal connections. Connect, disconnect, configure.

### Layout

#### Top Section: Connected Portals List

A table/card-list of all connected portals:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Portals                                           [+ Connect New]   │
│  ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  🟢 Acme Corp                                                  │  │
│  │  Hub ID: 12345678 │ Production │ Connected Mar 1, 2026        │  │
│  │  Last active: 2 hours ago │ 47 changes this month             │  │
│  │                                                                │  │
│  │  [Open Dashboard]  [Configure]  [Activity Log]  [Disconnect]  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  🟢 TechStart Inc                                              │  │
│  │  Hub ID: 87654321 │ Sandbox │ Connected Feb 28, 2026          │  │
│  │  Last active: 5 days ago │ 12 changes this month              │  │
│  │                                                                │  │
│  │  [Open Dashboard]  [Configure]  [Activity Log]  [Disconnect]  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  │  ⚪ FreshBrew Co                                     ARCHIVED  │  │
│  │  Hub ID: 11112222 │ Production │ Disconnected Feb 15, 2026    │  │
│  │  34 total changes │ Engagement complete                       │  │
│  │                                                                │  │
│  │  [View History]  [Reconnect]  [Delete Record]                 │  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Per Portal Card Details

| Field | Source |
|---|---|
| Status indicator | 🟢 connected, ⚪ disconnected |
| Portal name | From portal store or auto-discovered |
| Hub ID | From OAuth callback `hub_id` |
| Environment badge | sandbox (purple) / production (blue) |
| Connected date | From `installedAt` in portal store |
| Last active | From `lastUsed` timestamp |
| Monthly changes | Count from change logger for current month |

#### Actions Per Portal

| Button | Behavior |
|---|---|
| Open Dashboard | Sets this as active portal, navigates to `/` |
| Configure | Navigates to `/settings?portal={hubId}` (portal config, spec 11) |
| Activity Log | Navigates to `/activity?portal={hubId}` |
| Disconnect | Opens confirmation modal (see below) |
| Reconnect (archived) | Opens OAuth install flow again |
| View History (archived) | Shows read-only activity log for this portal |
| Delete Record (archived) | Removes the portal record from local store (not HubSpot) |

#### Disconnect Confirmation Modal

```
┌──────────────────────────────────────────────────┐
│  ⚠️ Disconnect Acme Corp?                        │
│                                                   │
│  This will:                                       │
│  • Uninstall the Vero Operator from their portal │
│  • Revoke all access tokens                       │
│  • Send an email to their Super Admins            │
│  • Preserve the activity log locally              │
│                                                   │
│  You can reconnect later if needed.               │
│                                                   │
│  Type "Acme Corp" to confirm:                     │
│  [________________________]                       │
│                                                   │
│  [Cancel]  [Disconnect]                           │
└──────────────────────────────────────────────────┘
```

- User must type the exact portal name to confirm
- "Disconnect" button disabled until name matches
- Calls `DELETE /appinstalls/v3/external-install` + revokes tokens + marks disconnected in store

#### Connect New Portal Flow

"+ Connect New" button opens a modal:

```
┌──────────────────────────────────────────────────┐
│  Connect a New Client Portal                      │
│                                                   │
│  Client Name: [________________________]          │
│  Environment:  ◉ Sandbox  ○ Production            │
│                                                   │
│  Click below to authorize. The client portal's    │
│  Super Admin will need to approve the connection. │
│                                                   │
│  [Open HubSpot Authorization]                     │
│                                                   │
│  Or send this link to the client:                 │
│  ┌──────────────────────────────────────────┐    │
│  │ https://app.hubspot.com/oauth/autho...  │    │
│  │                                [Copy]    │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

- "Open HubSpot Authorization" opens the OAuth URL in a new tab
- Copy button copies the full OAuth URL to clipboard
- After OAuth callback completes, the portal appears in the list automatically (poll or websocket)

---

## PAGE 4: Audits (`/audits`)

**Purpose**: One-click portal audits. Each audit is a pre-built prompt from the audit category (spec 12).

### Layout: Grid of Audit Cards

```
┌──────────────────────────────────────────────────────────────┐
│  Portal Audits                                                │
│  Run comprehensive audits on the active portal                │
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐            │
│  │  📊 Data Quality     │  │  📈 Pipeline Health  │           │
│  │                      │  │                      │           │
│  │  Check all records   │  │  Analyze deal flow,  │           │
│  │  for missing fields, │  │  stuck deals, and    │           │
│  │  invalid data, and   │  │  stage distribution  │           │
│  │  fill rates          │  │                      │           │
│  │                      │  │  Last run: never     │           │
│  │  Last run: Mar 7     │  │                      │           │
│  │  Score: 74/100       │  │  [Run Audit]         │           │
│  │                      │  │                      │           │
│  │  [Run Audit] [View]  │  └─────────────────────┘           │
│  └─────────────────────┘                                      │
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐            │
│  │  👥 Owner            │  │  🔗 Association      │           │
│  │     Distribution     │  │     Gaps             │           │
│  │                      │  │                      │           │
│  │  Workload balance    │  │  Missing company     │           │
│  │  across reps and     │  │  associations, orphan│           │
│  │  activity tracking   │  │  deals, and contacts │           │
│  │                      │  │                      │           │
│  │  [Run Audit]         │  │  [Run Audit]         │           │
│  └─────────────────────┘  └─────────────────────┘            │
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐            │
│  │  🔄 Lifecycle Stage  │  │  🏷️ Property Usage   │           │
│  │     Accuracy         │  │     Audit            │           │
│  │                      │  │                      │           │
│  │  Contacts in wrong   │  │  Dead properties,    │           │
│  │  lifecycle stages    │  │  duplicates, and low │           │
│  │  based on activity   │  │  fill rate fields    │           │
│  │                      │  │                      │           │
│  │  [Run Audit]         │  │  [Run Audit]         │           │
│  └─────────────────────┘  └─────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

### Behavior
- "Run Audit" sends the corresponding prompt from the library to the orchestrator
- Results open in a sliding panel (right side, 60% width) showing the assistant response
- Or navigates to `/chat` with the prompt pre-filled and auto-sent
- **Preferred UX**: results appear inline below the card as an expandable section
- Previous audit results are cached and shown with "Last run" date + score
- "View" button (on previously-run audits) shows the cached results without re-running

---

## PAGE 5: Workflows (`/workflows`)

**Purpose**: Generate, view, and deploy HubSpot workflows. Maps to spec 06.

### Layout: Two Sections

#### Section 1: Existing Workflows (from the portal)

- List/table of all workflows fetched from `GET /automation/v4/flows`
- Columns: Name, Type (CONTACT_FLOW / PLATFORM_FLOW), Status (enabled/disabled), Created, Last Modified
- Filter/search bar at top
- Click a workflow row → expands to show details (trigger, actions summary, JSON spec toggle)

#### Section 2: Create New Workflow

```
┌──────────────────────────────────────────────────────────────┐
│  Create New Workflow                                          │
│                                                               │
│  Choose a template or describe what you need:                 │
│                                                               │
│  TEMPLATES                                                    │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │
│  │ Lead Routing   │ │ Stalled Deal  │ │ MQL Follow-Up │      │
│  │ Route form     │ │ Alert owners  │ │ Task + email  │      │
│  │ submissions    │ │ of stuck      │ │ sequence for  │      │
│  │ to owners      │ │ deals         │ │ new MQLs      │      │
│  │ [Use Template] │ │ [Use Template]│ │ [Use Template]│      │
│  └───────────────┘ └───────────────┘ └───────────────┘      │
│                                                               │
│  ┌───────────────┐                                           │
│  │ Customer       │                                           │
│  │ Onboarding     │                                           │
│  │ Post-close     │                                           │
│  │ automation     │                                           │
│  │ [Use Template] │                                           │
│  └───────────────┘                                           │
│                                                               │
│  OR describe your workflow:                                   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ When a contact submits the demo form, set their      │    │
│  │ lifecycle stage to MQL and create a task for the...  │    │
│  │                                            [Generate]│    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

- "Use Template" fills the text area with the template prompt and its parameters
- "Generate" sends to orchestrator → workflow engine → returns workflow spec block (same as chat)
- Below the spec preview: [Deploy Disabled] button with confirmation modal

---

## PAGE 6: Properties (`/properties`)

**Purpose**: View, create, audit properties. Maps to spec 07.

### Layout

#### Tab 1: Browse Properties
- Object type tabs: Contacts | Companies | Deals | Tickets
- Table: Internal Name, Label, Type, Group, Fill Rate (% bar), Last Updated
- Search/filter bar
- Fill rate bars: green (≥80%), yellow (50–79%), red (<50%)
- Click row → expands to show full property details + edit options

#### Tab 2: Create Property
- Form: Object Type, Group, Name, Label, Type (dropdown), Options (for enumerations)
- "Create" button with confirmation
- Or free-text: "Describe the properties you need" → sends to orchestrator

#### Tab 3: Audit
- Same as the property usage audit from the audits page
- Quick actions: "Flag dead properties", "Find duplicates"

---

## PAGE 7: Lists & Segments (`/lists`)

**Purpose**: View and create HubSpot lists. Maps to spec 08.

### Layout

#### Tab 1: Existing Lists
- Table: Name, Type (SMART/STATIC), Size, Created, Last Updated
- Filter by type
- Click row → shows filter criteria (for smart lists) or record count (for static)

#### Tab 2: Create List
- Templates: "Hot Leads", "At Risk Customers" (from prompt library)
- Free-text: "Describe the segment you want" → orchestrator generates list spec
- Preview of filter criteria before creation
- [Create List] button with confirmation

---

## PAGE 8: Pipelines (`/pipelines`)

**Purpose**: View and configure pipelines. Maps to spec 09.

### Layout

#### Visual Pipeline View
- Kanban-style horizontal display of stages
- Each stage shows: name, deal count, total value
- Color-coded by health (from pipeline audit data if available)

#### Pipeline Table (alternate view)
- Pipeline Name, Object Type, Stages (count), Total Deals, Total Value
- Click → expands to show stage details

#### Create Pipeline
- Form: Name, Object Type (deals/tickets), Stages (draggable list to reorder)
- Or free-text description → orchestrator generates

---

## PAGE 9: Bulk Operations (`/bulk`)

**Purpose**: Heavy operations on 50+ records. Maps to spec 10.

### Layout

#### Template Cards (like Audits page)
- "Name Standardization" — capitalize, trim, lowercase emails
- "Deal Cleanup" — fix amounts, dates, associations
- "Association Repair" — auto-link contacts to companies
- "Lifecycle Migration" — update stages based on activity

#### Custom Operation
- Free-text input: "Describe the bulk operation you need"
- Generates a script (rendered in code block with syntax highlighting)
- Three-button flow: [View Script] → [Dry Run] → [Execute]

#### Execution Panel
When a script runs:

```
┌──────────────────────────────────────────────────────────────┐
│  ▶ Running: name-standardization.js                           │
│                                                               │
│  Mode: DRY RUN                                                │
│  Progress: ████████████░░░░░░░░ 412/1,204 (34%)             │
│                                                               │
│  Results so far:                                              │
│  • 312 contacts would be updated                              │
│  • 100 contacts already correct (skipped)                     │
│  • 0 errors                                                   │
│                                                               │
│  [Stop]                                                       │
│                                                               │
│  ─────────────────────────────────────────────                │
│  Dry run complete. 312 changes pending.                       │
│                                                               │
│  [Download Report]  [Execute for Real]                        │
└──────────────────────────────────────────────────────────────┘
```

- Real-time progress bar
- Dry-run results summary
- "Execute for Real" only appears after dry-run completes
- Final confirmation modal before real execution

---

## PAGE 10: Activity Log (`/activity`)

**Purpose**: Full audit trail. Every change the app has made. Maps to spec 05.

### Layout

#### Filters Bar (top)
- Date range picker (from/to)
- Portal selector (if viewing across portals)
- Action type filter: All | Create | Update | Delete | Workflow Deploy | Script Execute
- Object type filter: All | Contact | Company | Deal | Ticket | Workflow | Property | List
- Status filter: All | Success | Error | Dry Run
- [Export CSV] button

#### Activity Table

| Timestamp | Action | Object | Record ID | Description | Status |
|---|---|---|---|---|---|
| Mar 8, 10:42am | update | contact | 12345 | Updated lifecycle stage: subscriber → lead | ✅ |
| Mar 8, 10:41am | create | task | 67890 | Created follow-up task for Sarah Jones | ✅ |
| Mar 8, 10:38am | script_execute | contact | bulk | Name standardization: 312 records updated | ✅ |

- Click any row → expands to show full details:
  - Before/after values (for updates)
  - Full prompt that triggered this
  - Module that handled it
  - Duration (ms)
  - Error details (if failed)

#### Summary Panel (right sidebar, collapsible)
- Total changes this session
- Breakdown by action type (pie chart or bars)
- Breakdown by object type
- Error count + list of errors

---

## PAGE 11: Settings (`/settings`)

**Purpose**: Per-portal configuration (spec 11) + app-wide settings.

### Tab 1: Portal Configuration

For the currently active portal. All fields from spec 11's `PortalConfig` schema:

**Section: Mappings**
- Lifecycle stage mappings (table: your label → HubSpot value)
- Deal stage mappings (select pipeline → table of stages)

**Section: Custom Properties**
- Key-value table: logical name → HubSpot internal name
- "Auto-Discover" button → runs discovery, populates fields

**Section: Owners**
- Owner table: Role (Sales Manager, Default Owner, etc.) → Owner name (dropdown from HubSpot owners)

**Section: Conventions**
- Task prefix, note prefix, workflow prefix (text inputs)

**Section: Forms & Templates**
- Form name → Form ID (key-value table)
- Email template name → Template ID

**Section: Safety**
- Max bulk records (number input, default 5000)
- Require dry run (toggle, default ON)
- Require confirmation (toggle, default ON)
- Allow deletes (toggle, default OFF)

### Tab 2: App Settings

- **LLM Model Selection**: Dropdown: Haiku 4.5 (cost-optimized) | Sonnet 4.6 (default) | Opus 4.6 (max quality)
- **Default model for routing**: Haiku (recommended)
- **Default model for generation**: Sonnet (recommended)
- **Prompt caching**: Toggle (default ON)
- **API Spend Limit**: Monthly budget alert threshold

### Tab 3: Users (Admin Only)
- Allowlist of Google Workspace emails that can access this app
- Add/remove users

---

# PART 5: Technical Stack

## Frontend

| Component | Technology | Reason |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | SSR for login, client components for dashboard |
| Styling | **Tailwind CSS** | Utility-first, fast iteration, matches card-based design |
| Components | **shadcn/ui** | Pre-built accessible components (dialogs, dropdowns, tables, tabs) |
| Icons | **Lucide React** | Clean line icons, same library as shadcn |
| Charts | **Recharts** | For audit scores, fill rate bars, pipeline visualizations |
| Code Highlighting | **Prism.js** or **highlight.js** | For script and JSON rendering |
| Markdown | **react-markdown** | For chat message rendering |
| State | **React Context** + **SWR** | Portal state in context, API data with SWR for caching/revalidation |
| Auth | **NextAuth.js** | Google OAuth provider with domain restriction |

## API Routes (Next.js)

The frontend communicates with the backend via Next.js API routes:

| Route | Method | Backend Module | Purpose |
|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth | Google OAuth login |
| `/api/portals` | GET | 01-auth | List all connected portals |
| `/api/portals/connect` | GET | 01-auth | Get OAuth install URL |
| `/api/portals/callback` | GET | 01-auth | Handle OAuth callback |
| `/api/portals/[hubId]/disconnect` | POST | 01-auth | Disconnect portal |
| `/api/portals/[hubId]/config` | GET/PUT | 11-portal-config | Read/update portal config |
| `/api/portals/[hubId]/discover` | POST | 11-portal-config | Run auto-discovery |
| `/api/chat` | POST | 04-orchestrator | Send prompt, get response (streaming) |
| `/api/chat/confirm` | POST | 04-orchestrator | Confirm a pending plan |
| `/api/chat/cancel` | POST | 04-orchestrator | Cancel a pending plan |
| `/api/workflows` | GET | 06-workflow-engine | List workflows for active portal |
| `/api/workflows/generate` | POST | 06-workflow-engine | Generate workflow from prompt |
| `/api/workflows/deploy` | POST | 06-workflow-engine | Deploy generated workflow |
| `/api/properties/[objectType]` | GET | 07-property-manager | List properties |
| `/api/properties` | POST | 07-property-manager | Create property |
| `/api/lists` | GET | 08-list-manager | List all lists |
| `/api/lists` | POST | 08-list-manager | Create list |
| `/api/pipelines` | GET | 09-pipeline-manager | List pipelines |
| `/api/pipelines` | POST | 09-pipeline-manager | Create pipeline |
| `/api/scripts/generate` | POST | 10-script-engine | Generate script |
| `/api/scripts/dry-run` | POST | 10-script-engine | Run script in dry-run mode |
| `/api/scripts/execute` | POST | 10-script-engine | Execute script for real |
| `/api/activity` | GET | 05-change-logger | Get activity log (with filters) |
| `/api/activity/export` | GET | 05-change-logger | Export activity as CSV |
| `/api/prompts` | GET | 12-prompt-library | List all prompts |
| `/api/stats/[hubId]` | GET | 02-api-client + MCP | Dashboard stats (record counts) |

## Streaming for Chat

The `/api/chat` endpoint should use **Server-Sent Events (SSE)** or **streaming response** to show the orchestrator's progress in real time:

```typescript
// Frontend: consume streaming response
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ prompt, portalId }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const events = chunk.split('\n').filter(Boolean).map(JSON.parse);
  
  for (const event of events) {
    switch (event.type) {
      case 'thinking':    // Show "Analyzing your request..." 
      case 'plan':        // Show plan preview block
      case 'step_start':  // Update progress block
      case 'step_complete':
      case 'result':      // Show final result block
      case 'error':       // Show error block
    }
  }
}
```

---

# PART 6: File Structure

```
vero-hubspot-operator/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout with sidebar
│   │   ├── page.tsx                  # Dashboard (/)
│   │   ├── login/
│   │   │   └── page.tsx              # Login page
│   │   ├── chat/
│   │   │   └── page.tsx              # Chat/operator interface
│   │   ├── portals/
│   │   │   └── page.tsx              # Portal management
│   │   ├── audits/
│   │   │   └── page.tsx              # Audit cards
│   │   ├── workflows/
│   │   │   └── page.tsx              # Workflow manager
│   │   ├── properties/
│   │   │   └── page.tsx              # Property manager
│   │   ├── lists/
│   │   │   └── page.tsx              # Lists & segments
│   │   ├── pipelines/
│   │   │   └── page.tsx              # Pipeline manager
│   │   ├── bulk/
│   │   │   └── page.tsx              # Bulk operations
│   │   ├── activity/
│   │   │   └── page.tsx              # Activity log
│   │   ├── settings/
│   │   │   └── page.tsx              # Settings (tabs)
│   │   └── api/                      # API routes
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts
│   │       ├── portals/
│   │       ├── chat/
│   │       ├── workflows/
│   │       ├── properties/
│   │       ├── lists/
│   │       ├── pipelines/
│   │       ├── scripts/
│   │       ├── activity/
│   │       ├── prompts/
│   │       └── stats/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Sidebar navigation
│   │   │   ├── TopBar.tsx            # Top bar with breadcrumb + portal badge
│   │   │   └── PortalPicker.tsx      # Portal dropdown in sidebar
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx        # Main chat area with message history
│   │   │   ├── ChatInput.tsx         # Input bar at bottom
│   │   │   ├── MessageBubble.tsx     # User/assistant message wrapper
│   │   │   ├── PlanPreview.tsx       # Operation plan confirmation card
│   │   │   ├── ResultsTable.tsx      # Audit/search results table
│   │   │   ├── CodeBlock.tsx         # Syntax-highlighted code block
│   │   │   ├── WorkflowSpec.tsx      # Workflow visual summary
│   │   │   ├── ProgressBlock.tsx     # Multi-step progress indicator
│   │   │   └── ErrorBlock.tsx        # Error display card
│   │   ├── prompts/
│   │   │   ├── PromptSidebar.tsx     # Prompt library sidebar in chat
│   │   │   ├── PromptCard.tsx        # Individual prompt entry
│   │   │   └── PromptParamsModal.tsx # Parameter fill-in modal
│   │   ├── portals/
│   │   │   ├── PortalCard.tsx        # Connected portal card
│   │   │   ├── ConnectModal.tsx      # Connect new portal flow
│   │   │   └── DisconnectModal.tsx   # Disconnect confirmation
│   │   ├── audits/
│   │   │   ├── AuditCard.tsx         # Audit template card
│   │   │   └── AuditResults.tsx      # Inline audit results display
│   │   ├── workflows/
│   │   │   ├── WorkflowList.tsx      # Existing workflows table
│   │   │   ├── WorkflowTemplates.tsx # Template cards
│   │   │   └── DeployModal.tsx       # Deploy confirmation
│   │   ├── properties/
│   │   │   ├── PropertyTable.tsx     # Properties with fill rate bars
│   │   │   └── CreatePropertyForm.tsx
│   │   ├── lists/
│   │   │   ├── ListTable.tsx
│   │   │   └── CreateListForm.tsx
│   │   ├── pipelines/
│   │   │   ├── PipelineKanban.tsx    # Visual pipeline view
│   │   │   └── PipelineTable.tsx
│   │   ├── bulk/
│   │   │   ├── BulkTemplateCard.tsx
│   │   │   ├── ScriptViewer.tsx      # Code view with actions
│   │   │   └── ExecutionPanel.tsx    # Progress + results
│   │   ├── activity/
│   │   │   ├── ActivityTable.tsx     # Filterable activity log
│   │   │   ├── ActivityFilters.tsx   # Filter bar
│   │   │   └── ActivityDetail.tsx    # Expanded row detail
│   │   ├── settings/
│   │   │   ├── PortalConfigForm.tsx
│   │   │   ├── AppSettingsForm.tsx
│   │   │   └── UserManagement.tsx
│   │   └── shared/
│   │       ├── StatusBadge.tsx       # Connected/disconnected/sandbox/production pills
│   │       ├── ConfirmModal.tsx      # Reusable confirmation dialog
│   │       ├── FillRateBar.tsx       # Percentage bar with color coding
│   │       └── EmptyState.tsx        # "No data" placeholder
│   ├── contexts/
│   │   ├── PortalContext.tsx          # Active portal state
│   │   └── ChatContext.tsx            # Chat message history
│   ├── hooks/
│   │   ├── usePortal.ts              # Portal operations
│   │   ├── useChat.ts                # Chat/streaming
│   │   └── useActivity.ts            # Activity log with filters
│   ├── lib/
│   │   ├── api.ts                    # API client helpers
│   │   ├── auth.ts                   # NextAuth config
│   │   └── constants.ts              # Route paths, status colors
│   └── styles/
│       └── globals.css               # CSS variables, Tailwind config
├── public/
│   ├── icons/
│   │   ├── favicon.svg
│   │   ├── favicon-32.png
│   │   └── apple-touch-icon.png
│   └── logo-white.svg               # Vero logo for sidebar
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

# PART 7: Build Order

This is the sequence the developer should follow. Each step has a testable deliverable.

## Phase 6A: Shell & Auth (3–4 days)

1. `npx create-next-app@latest vero-hubspot-operator --typescript --tailwind --app`
2. Install: `shadcn/ui`, `lucide-react`, `next-auth`, `swr`, `recharts`
3. Set up CSS variables in `globals.css` matching the design tokens above
4. Build `layout.tsx` with sidebar + top bar (hardcoded nav items, no functionality)
5. Build login page matching the existing VeroHub Audit login exactly
6. Configure NextAuth with Google provider + domain restriction (`verodigital.co`)
7. Add middleware to protect all routes except `/login`
8. **Test**: Can sign in with Google, see the sidebar layout, sign out

## Phase 6B: Portal Management (2–3 days)

1. Build `/portals` page with portal cards
2. Build `ConnectModal` with OAuth URL generation + copy button
3. Build `DisconnectModal` with name-confirmation input
4. Wire up to backend: `GET /api/portals`, `POST /api/portals/:hubId/disconnect`
5. Build `PortalPicker` in sidebar
6. Build `PortalContext` — tracks active portal across all pages
7. **Test**: Can connect a sandbox portal, see it in the list, switch between portals, disconnect

## Phase 6C: Chat Interface (4–5 days)

1. Build `ChatWindow` with message history + scroll-to-bottom
2. Build `ChatInput` with send button + keyboard shortcuts
3. Build `MessageBubble` for user and assistant messages
4. Wire up SSE streaming from `/api/chat`
5. Build all 7 assistant message block types:
   - TextBlock, PlanPreview, ResultsTable, CodeBlock, WorkflowSpec, ProgressBlock, ErrorBlock
6. Build `PromptSidebar` with categories, search, and click-to-insert
7. Build `PromptParamsModal` for prompts with parameters
8. **Test**: Can type a prompt, see streaming response, view formatted results, use prompt library

## Phase 6D: Dashboard (2 days)

1. Build `/` page with stat cards (fetch from `/api/stats/:hubId`)
2. Build recent activity feed (last 10 from change logger)
3. Build portal health card with score ring
4. Build quick actions card (links to prompt triggers)
5. Build empty state for no connected portals
6. **Test**: Dashboard shows real data from a connected portal

## Phase 6E: Feature Pages (5–7 days)

1. Build `/audits` page with audit template cards + inline results
2. Build `/workflows` page with list + templates + generate flow
3. Build `/properties` page with tabs (browse/create/audit)
4. Build `/lists` page with tabs (existing/create)
5. Build `/pipelines` page with kanban view + table view
6. Build `/bulk` page with template cards + execution panel with progress bar
7. **Test**: Each page loads data from the active portal and can trigger operations

## Phase 6F: Activity Log & Settings (2–3 days)

1. Build `/activity` page with filterable table + expandable rows
2. Build CSV export
3. Build `/settings` page with three tabs
4. Build portal config form with auto-discovery button
5. Build app settings form
6. Build user management (admin only)
7. **Test**: Activity log shows all changes, settings save and persist

## Phase 6G: Polish (2–3 days)

1. Loading states (skeleton screens for all pages)
2. Error boundaries
3. Mobile responsive sidebar (hamburger menu on mobile)
4. Keyboard shortcuts: `/` to focus chat input, `Esc` to close modals
5. Toast notifications for success/error
6. Favicon + meta tags + page titles
7. **Test**: Full end-to-end flow: login → connect portal → run audit → view results → disconnect

---

**Total frontend build time estimate: 20–27 days** (one developer, full-time)
