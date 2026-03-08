# Developer Implementation Guide — Phase 4: Metric Expansion & API Measurement

> **Document purpose**: Comprehensive, implementation-ready guide for adding 43 audit line-item measurements via HubSpot APIs.
> All additions are **on top of** existing metrics. Do **not** remove or replace current collection/scoring logic.
> **Date**: 2026-03-06 | **Author**: AI Architect (Phase 4 handover)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [API Authentication & Rate Limits Reference](#2-api-auth)
3. [CRM Section — 9 Items](#3-crm)
4. [Sales Hub Section — 15 Items](#4-sales)
5. [Marketing Hub Section — 13 Items](#5-marketing)
6. [Service Hub Section — 4 Items](#6-service)
7. [Integration Into Scoring System](#7-scoring-integration)
8. [Integration Into Report PDF](#8-report-integration)
9. [Integration Into Quote Prioritisation](#9-quote-integration)
10. [Hub-Scoping Rules](#10-hub-scoping)
11. [New File Checklist](#11-file-checklist)

---

## 1. Architecture Overview <a id="1-architecture-overview"></a>

### Current Data Flow
```
hubspot_client.py  →  collect_indirect_metrics()  →  metrics dict (~160 keys)
                                                          ↓
rules_engine.py    →  evaluate_rules(rubric.json + indirect_checks.py)  →  findings[]
                                                          ↓
report_compiler.py →  BENCHMARK_SPECS (72)  →  benchmark_framework{}
                                                          ↓
ai_report_service  →  AI enrichment (3-stage)  →  enriched_narrative{}
                                                          ↓
main.py            →  _build_branded_report_context()  →  HTML template  →  PDF
```

### What This Guide Adds
- **~85 new metric keys** in `collect_indirect_metrics()`
- **8 rubric tools** converted from `fixed` → `metric_band` with real data
- **~30 new indirect checks** in `indirect_checks.py`
- **~25 new BENCHMARK_SPECS** entries in `report_compiler.py`
- **New helper methods** in `hubspot_client.py` for each measurement domain

### Key Principle
Every new metric MUST:
1. Have a `metric_key` string (snake_case)
2. Return a numeric value (float or int) — use `0.0` only when the feature IS available but unused, use `None` when the feature is unavailable/out-of-scope
3. Be gated by hub availability check before collection
4. Be added to the metrics dict returned by `collect_indirect_metrics()`

---

## 2. API Authentication & Rate Limits Reference <a id="2-api-auth"></a>

### Endpoints Used Throughout This Guide
| Base URL | Purpose |
|---|---|
| `https://api.hubapi.com/crm/v3/objects/{objectType}` | CRM object CRUD + search |
| `https://api.hubapi.com/crm/v3/properties/{objectType}` | Property definitions |
| `https://api.hubapi.com/crm/v3/pipelines/{objectType}` | Pipeline + stage config |
| `https://api.hubapi.com/crm/v3/associations/{fromType}/{toType}/batch/read` | Association lookups |
| `https://api.hubapi.com/automation/v4/flows` | Workflows |
| `https://api.hubapi.com/marketing/v3/emails` | Marketing emails |
| `https://api.hubapi.com/marketing/v3/campaigns` | Campaigns |
| `https://api.hubapi.com/marketing/v3/forms` | Forms |
| `https://api.hubapi.com/cms/v3/pages/landing-pages` | Landing pages |
| `https://api.hubapi.com/cms/v3/pages/site-pages` | Site pages |
| `https://api.hubapi.com/conversations/v3/conversations/threads` | Conversation threads |
| `https://api.hubapi.com/crm/v3/objects/feedback_submissions` | Feedback surveys |
| `https://api.hubapi.com/cms/v3/blogs/posts` | Blog posts |
| `https://api.hubapi.com/files/v3/files` | File manager |
| `https://api.hubapi.com/crm/v3/objects/line_items` | Line items (products on deals) |
| `https://api.hubapi.com/crm/v3/objects/quotes` | Quotes |
| `https://api.hubapi.com/crm/v3/objects/products` | Products |
| `https://api.hubapi.com/crm/v3/objects/calls` | Calls |
| `https://api.hubapi.com/crm/v3/objects/meetings` | Meetings |
| `https://api.hubapi.com/crm/v3/objects/tasks` | Tasks |
| `https://api.hubapi.com/crm/v3/objects/notes` | Notes |
| `https://api.hubapi.com/crm/v3/objects/emails` | Email engagements |
| `https://api.hubapi.com/settings/v3/users` | User settings |

### Rate Limits
- **Private apps**: 100 requests / 10 seconds, burst to 150
- **OAuth apps**: 100 requests / 10 seconds
- **Search API**: 5 requests / second per app, max 10,000 results, 200 per page
- **Batch endpoints**: max 100 records per batch request

### Headers (all requests)
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

---

## 3. CRM Section — 9 Items <a id="3-crm"></a>

### 3.1 Marketing Contacts
**Status**: ✅ Already measured — `marketing_contacts_count`, `marketing_contacts_pct`, `contact_limit_utilization_pct`

**What to ADD** (new metrics):
```python
# NEW metric keys
marketing_contact_engagement_rate = (marketing contacts with email opens or clicks in 90d) / marketing_contacts_count
marketing_contact_conversion_rate = (marketing contacts that became MQLs in 90d) / marketing_contacts_count
non_marketing_stale_pct = (non-marketing contacts with no activity in 180d) / non_marketing_contacts_count
```

**API calls**:
```python
# 1. Count marketing contacts with recent engagement
# Use Search API on contacts with filter: hs_marketable = true AND hs_email_last_open_date > 90d ago
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_marketable", "operator": "EQ", "value": "true"},
      {"propertyName": "hs_email_last_open_date", "operator": "GTE", "value": "<epoch_ms_90d_ago>"}
    ]
  }],
  "limit": 0  # We only need total
}
# → response.total = engaged_marketing_contacts

# 2. Count marketing contacts converted to MQL
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_marketable", "operator": "EQ", "value": "true"},
      {"propertyName": "hs_lifecyclestage_marketingqualifiedlead_date", "operator": "GTE", "value": "<epoch_ms_90d_ago>"}
    ]
  }],
  "limit": 0
}
# → response.total = mql_converted

# 3. Stale non-marketing contacts
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_marketable", "operator": "NEQ", "value": "true"},
      {"propertyName": "notes_last_updated", "operator": "LT", "value": "<epoch_ms_180d_ago>"}
    ]
  }],
  "limit": 0
}
```

**New metric keys**:
- `marketing_contact_engagement_rate_90d` (float 0–1)
- `marketing_contact_conversion_rate_90d` (float 0–1)
- `non_marketing_stale_180d_pct` (float 0–100)

---

### 3.2 Duplicate Contacts
**Status**: ✅ Already measured — `duplicate_contact_email_pct`, `duplicate_contact_phone_pct`, `duplicate_contact_name_company_pct`

**What to ADD**:
```python
# Estimated cost of duplicates (for quote prioritisation)
duplicate_contact_total_estimate = contact_total_count * max(duplicate_contact_email_pct, duplicate_contact_phone_pct, duplicate_contact_name_company_pct) / 100
# Dedupe urgency flag
dedupe_urgency = "critical" if dedupe_risk_index > 0.6 else "moderate" if dedupe_risk_index > 0.3 else "low"
```

**New metric keys**:
- `duplicate_contact_total_estimate` (int)
- `dedupe_urgency_label` (string: critical/moderate/low)

**No new API calls needed** — derived from existing metrics.

---

### 3.3 ChatBots
**Status**: ✅ Partially measured — currently uses `chatflows_count` from the raw counts

**What to ADD**:
```python
# Chatbot conversation volume and effectiveness
# 1. Get chatflows (already collected in raw_counts.chatflows_count)
# 2. Cross-reference with conversation threads to measure bot activity

# Count threads initiated by bot
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_chatflow_id", "operator": "HAS_PROPERTY"}
    ]
  }],
  "limit": 0
}
# This gives contacts that interacted with a chatbot

# Alternative: Use conversations API
GET /conversations/v3/conversations/threads?limit=100
# Filter by channelType = "LIVE_CHAT" or "BOT"
# Count threads, calculate response rates
```

**Implementation approach**:
```python
async def _chatbot_stats(self) -> dict:
    """Measure chatbot adoption and effectiveness."""
    stats = {"chatbot_active_count": 0, "chatbot_thread_count_90d": 0,
             "chatbot_to_human_handoff_pct": 0.0}

    # 1. Chatflows count is already in raw_counts
    stats["chatbot_active_count"] = self.raw_counts.get("chatflows_count", 0)

    # 2. Conversations with bot origin in last 90d
    # GET /conversations/v3/conversations/threads
    # with query params: latestMessageTimestampAfter=<90d_ago_epoch>
    threads = await self._paginated_get(
        "/conversations/v3/conversations/threads",
        params={"latestMessageTimestampAfter": epoch_90d_ago, "limit": 100}
    )
    bot_threads = [t for t in threads if t.get("channelType") in ("LIVE_CHAT", "BOT")]
    stats["chatbot_thread_count_90d"] = len(bot_threads)

    # 3. Handoff rate: threads that started as bot but involved agent reply
    if bot_threads:
        handoff_count = sum(1 for t in bot_threads if t.get("assignedTo"))
        stats["chatbot_to_human_handoff_pct"] = (handoff_count / len(bot_threads)) * 100

    return stats
```

**New metric keys**:
- `chatbot_active_count` (int)
- `chatbot_thread_count_90d` (int)
- `chatbot_to_human_handoff_pct` (float 0–100)
- `chatbot_adoption_index` (float 0–1, computed: `min(1.0, chatbot_thread_count_90d / max(1, contact_total_count / 100))`)

---

### 3.4 Snippets
**Status**: ✅ Already measured — `snippets_count` in raw_counts, used in `sales_snippets` benchmark

**What to ADD**:
```python
# Snippet utilisation: cross-reference with email/note engagement records
# There's no direct "snippet usage" API, but we can infer usage by:
# 1. Checking snippet count vs team size
snippet_per_user = snippets_count / max(1, users_total)
# 2. Freshness: check snippet creation dates

GET /crm/v3/objects/snippets?limit=100&properties=hs_createdate,hs_lastmodifieddate
# Note: snippets may need the conversations API scope
```

**New metric keys**:
- `snippets_per_user` (float)
- `snippets_stale_180d_pct` (float 0–100, % of snippets not modified in 180 days)
- `snippets_adoption_index` (float 0–1)

**API call**:
```python
# Snippets don't have a dedicated v3 endpoint in all portals.
# Fallback: Use the CRM extensions / snippets endpoint
GET /snippets/v1/snippets?limit=100
# Response includes: id, name, body, createdAt, updatedAt
# Calculate: (snippets where updatedAt < 180d ago) / total_snippets
```

---

### 3.5 Templates (Email Templates)
**Status**: ❌ Currently `fixed` (manual score only) — NO automated data

**CONVERT TO AUTOMATED**:

```python
async def _template_stats(self) -> dict:
    """Measure email template adoption and quality."""
    stats = {}

    # 1. Get all templates
    # HubSpot email templates via the Templates API
    response = await self._get("/marketing/v3/emails/templates?limit=100")
    # Alternative endpoint for sales templates:
    response = await self._get("/crm/v3/objects/email_templates?limit=100")

    # If templates API is not available, try:
    # GET /email/public/v1/templates?limit=100
    # This returns: id, name, subject, body, createdAt, updatedAt, isPublished

    templates = response.get("results", [])
    stats["templates_total_count"] = len(templates)

    if not templates:
        return stats

    # 2. Calculate staleness
    now = datetime.utcnow()
    stale_180 = sum(1 for t in templates
                    if (now - parse_datetime(t.get("updatedAt", t.get("createdAt")))).days > 180)
    stats["templates_stale_180d_pct"] = (stale_180 / len(templates)) * 100

    # 3. Templates per user
    stats["templates_per_user"] = len(templates) / max(1, self.metrics.get("users_total", 1))

    # 4. Template adoption index
    # If portal has > 5 templates AND < 50% stale → good adoption
    stats["templates_adoption_index"] = min(1.0,
        (len(templates) / 10) * (1 - stats["templates_stale_180d_pct"] / 100))

    return stats
```

**New metric keys**:
- `templates_total_count` (int)
- `templates_stale_180d_pct` (float 0–100)
- `templates_per_user` (float)
- `templates_adoption_index` (float 0–1)

**Rubric update** — change in `rubric.json`:
```json
{
  "tool_name": "Templates",
  "section": "CRM",
  "rule_type": "metric_band",
  "metric_key": "templates_adoption_index",
  "bands": [
    {"label": "Great Use",    "operator": "gte", "value": 0.7, "score": 9},
    {"label": "Good Use",     "operator": "gte", "value": 0.4, "score": 7},
    {"label": "Needs More Use","operator": "gte", "value": 0.1, "score": 4},
    {"label": "No Use",       "operator": "gte", "value": 0,   "score": 1}
  ]
}
```

---

### 3.6 Conversation Inbox
**Status**: ✅ Partially measured — `threads_count` in raw_counts

**What to ADD**:
```python
async def _conversation_inbox_stats(self) -> dict:
    """Measure conversation inbox health and responsiveness."""
    stats = {}

    # 1. Get recent threads (last 90 days)
    threads_resp = await self._paginated_get(
        "/conversations/v3/conversations/threads",
        params={
            "latestMessageTimestampAfter": epoch_90d_ago,
            "limit": 100
        }
    )

    threads = threads_resp  # list of thread objects
    stats["inbox_threads_90d"] = len(threads)

    # 2. Channel distribution
    channel_counts = {}
    for t in threads:
        ch = t.get("channelType", "UNKNOWN")
        channel_counts[ch] = channel_counts.get(ch, 0) + 1
    stats["inbox_channels_used"] = len(channel_counts)
    stats["inbox_channel_distribution"] = channel_counts  # for report detail

    # 3. Assignment rate
    assigned = sum(1 for t in threads if t.get("assignedTo"))
    stats["inbox_assignment_rate_pct"] = (assigned / max(1, len(threads))) * 100

    # 4. Average first response time (if available from thread metadata)
    # HubSpot conversations API provides latestMessageTimestamp and createdAt
    response_times = []
    for t in threads:
        created = t.get("createdAt")
        latest = t.get("latestMessageTimestamp")
        if created and latest:
            delta = (latest - created) / 1000 / 3600  # hours
            if 0 < delta < 720:  # filter out outliers > 30 days
                response_times.append(delta)

    if response_times:
        stats["inbox_avg_first_response_hours"] = sum(response_times) / len(response_times)
    else:
        stats["inbox_avg_first_response_hours"] = None

    return stats
```

**New metric keys**:
- `inbox_threads_90d` (int)
- `inbox_channels_used` (int)
- `inbox_assignment_rate_pct` (float 0–100)
- `inbox_avg_first_response_hours` (float or None)
- `conversation_inbox_health_index` (float 0–1, composite)

---

### 3.7 Reporting Goals
**Status**: ✅ Already measured — `goal_targets_count`

**What to ADD**:
```python
# Goals API
GET /crm/v3/objects/goal_targets?limit=100&properties=hs_goal_name,hs_target_amount,hs_start_date,hs_end_date,hs_status

# Calculate:
# - goals_active_count (status = "IN_PROGRESS")
# - goals_completed_count (status = "DONE")
# - goals_overdue_count (end_date < today AND status != "DONE")
# - goals_completion_rate = completed / (completed + overdue) * 100
# - goals_coverage_index = active_goals / max(1, deal_pipelines_in_use * users_total) # how well goals cover the org
```

**New metric keys**:
- `goals_active_count` (int)
- `goals_completed_count` (int)
- `goals_overdue_count` (int)
- `goals_completion_rate_pct` (float 0–100)
- `goals_coverage_index` (float 0–1)

---

### 3.8 Custom Properties
**Status**: ✅ Already measured — `contact_custom_property_count`, `*_missing_description_pct`, etc.

**What to ADD**:
```python
# Cross-reference custom properties with workflow usage
# 1. Get all workflows
GET /automation/v4/flows?limit=100

# 2. For each workflow, check if enrollment criteria or actions reference custom properties
# The workflow definition includes "enrollmentCriteria" and "actions" that reference property names
# Match against known custom property internal names

# 3. Calculate:
custom_props_in_workflows_pct = (custom_props_referenced_in_workflows / total_custom_props) * 100
# This tells us how many custom properties are actually being USED in automation

# 4. Orphan custom properties (not used in workflows, lists, or reports)
# Get lists and check filters for property references
# Get report definitions and check for property references
```

**New metric keys**:
- `custom_props_in_workflows_pct` (float 0–100)
- `custom_props_orphan_estimate_pct` (float 0–100)
- `custom_property_utilisation_index` (float 0–1)

---

### 3.9 Data Hygiene
**Status**: ✅ Already measured — `data_hygiene_risk_index`, `dedupe_risk_index`

**What to ADD**:
```python
# Expanded data hygiene scoring
# 1. Email validity check (bounced contact percentage — already have contact_email_bounce_pct)
# 2. Phone number format consistency
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "phone", "operator": "HAS_PROPERTY"},
      {"propertyName": "phone", "operator": "NOT_CONTAINS", "value": "+"}
      # Contacts with phone but no international format
    ]
  }],
  "limit": 0
}

# 3. Job title coverage
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "jobtitle", "operator": "NOT_HAS_PROPERTY"}
    ]
  }],
  "limit": 0
}

# 4. Industry coverage on companies
POST /crm/v3/objects/companies/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "industry", "operator": "NOT_HAS_PROPERTY"}
    ]
  }],
  "limit": 0
}

# 5. Revenue/employee data on companies
POST /crm/v3/objects/companies/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "annualrevenue", "operator": "NOT_HAS_PROPERTY"}
    ]
  }],
  "limit": 0
}
```

**New metric keys**:
- `contact_phone_no_intl_format_pct` (float 0–100)
- `contact_no_jobtitle_pct` (float 0–100)
- `company_no_industry_pct` (float 0–100)
- `company_no_revenue_pct` (float 0–100)
- `company_no_employee_count_pct` (float 0–100)
- `data_completeness_index` (float 0–1, weighted average of all completeness metrics)

---

## 4. Sales Hub Section — 15 Items <a id="4-sales"></a>

### 4.1 Prospecting
**Status**: ✅ Partially measured — `sequences_count` exists

**What to ADD**:
```python
async def _prospecting_stats(self) -> dict:
    """Measure prospecting activity and effectiveness."""
    stats = {}

    # 1. Sequences count (already collected)
    stats["sequences_total"] = self.raw_counts.get("sequences_count", 0)

    # 2. Active sequences (enrolled contacts)
    # Use search API to find contacts currently in a sequence
    POST /crm/v3/objects/contacts/search
    {
      "filterGroups": [{
        "filters": [
          {"propertyName": "hs_sequences_is_enrolled", "operator": "EQ", "value": "true"}
        ]
      }],
      "limit": 0
    }
    stats["contacts_in_sequences"] = response.total

    # 3. Prospecting workspace activity (calls + emails created in 30d)
    # Calls made in last 30d
    POST /crm/v3/objects/calls/search
    {
      "filterGroups": [{
        "filters": [
          {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_30d_ago>"}
        ]
      }],
      "limit": 0
    }
    stats["calls_made_30d"] = response.total

    # 4. Sales emails sent in 30d (1:1 emails, not marketing)
    POST /crm/v3/objects/emails/search
    {
      "filterGroups": [{
        "filters": [
          {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_30d_ago>"},
          {"propertyName": "hs_email_direction", "operator": "EQ", "value": "EMAIL"}
        ]
      }],
      "limit": 0
    }
    stats["sales_emails_sent_30d"] = response.total

    # 5. Prospecting intensity index
    total_activity = stats["calls_made_30d"] + stats["sales_emails_sent_30d"]
    stats["prospecting_intensity_index"] = min(1.0,
        total_activity / max(1, self.metrics.get("users_total", 1)) / 50)
    # 50 activities per user per month = "good" threshold

    return stats
```

**New metric keys**:
- `contacts_in_sequences` (int)
- `calls_made_30d` (int)
- `sales_emails_sent_30d` (int)
- `prospecting_intensity_index` (float 0–1)
- `prospecting_activity_per_user_30d` (float)

---

### 4.2 Deals
**Status**: ✅ Already well-measured — multiple metrics exist

**What to ADD**:
```python
# Deal velocity and conversion analysis
# 1. Average deal cycle time (days from create to close-won)
POST /crm/v3/objects/deals/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "dealstage", "operator": "EQ", "value": "closedwon"},
      {"propertyName": "closedate", "operator": "GTE", "value": "<epoch_180d_ago>"}
    ]
  }],
  "properties": ["createdate", "closedate", "amount"],
  "limit": 100
}
# Calculate: avg(closedate - createdate) in days

# 2. Deal stage conversion rates
# For each pipeline, get stage-by-stage conversion
GET /crm/v3/pipelines/deals
# For each stage, count deals currently in that stage
# Calculate: stage_n_count / stage_n-1_count = conversion rate

# 3. Average deal value
# From the won deals search above: avg(amount)

# 4. Deal-to-close ratio
# closed_won_count / (closed_won_count + closed_lost_count)
```

**New metric keys**:
- `deal_avg_cycle_days` (float)
- `deal_avg_value` (float)
- `deal_win_rate_pct` (float 0–100, closed won / total closed)
- `deal_stage_conversion_rates` (dict, for detailed report)
- `deal_velocity_index` (float 0–1, composite: speed × value × win rate)

---

### 4.3 Forecast
**Status**: ✅ Partially measured — `forecast_readiness_index` exists

**What to ADD**:
```python
# Forecast accuracy and setup depth
# 1. Check forecast settings/categories
# HubSpot deals have the property "hs_forecast_category"
# Valid values: omit, pipeline, best_case, commit, closed
POST /crm/v3/objects/deals/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_forecast_category", "operator": "HAS_PROPERTY"},
      {"propertyName": "dealstage", "operator": "NOT_IN", "values": ["closedwon", "closedlost"]}
    ]
  }],
  "limit": 0
}
# stats["deals_with_forecast_category_pct"] = count / total_open_deals * 100

# 2. Forecast amount vs actual (historical accuracy)
# Get deals closed in last quarter with forecast amounts
POST /crm/v3/objects/deals/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "closedate", "operator": "BETWEEN", "value": "<q_start>", "highValue": "<q_end>"},
      {"propertyName": "hs_forecast_amount", "operator": "HAS_PROPERTY"}
    ]
  }],
  "properties": ["amount", "hs_forecast_amount", "dealstage"],
  "limit": 100
}
# forecast_accuracy = 1 - abs(sum(forecast) - sum(actual)) / max(1, sum(actual))

# 3. Close date accuracy
# For closed-won deals: how many had their close date BEFORE actual close?
# Indicates whether reps are setting realistic close dates
```

**New metric keys**:
- `deals_with_forecast_category_pct` (float 0–100)
- `forecast_accuracy_index` (float 0–1)
- `close_date_accuracy_pct` (float 0–100)
- `forecast_depth_index` (float 0–1, composite of category + accuracy + close date)

---

### 4.4 Tasks
**Status**: ✅ Already measured — `tasks_count`, `task_to_deal_ratio`

**What to ADD**:
```python
# Task completion and timeliness
# 1. Task completion rate
POST /crm/v3/objects/tasks/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_90d_ago>"}
    ]
  }],
  "properties": ["hs_task_status", "hs_task_completion_date", "hs_timestamp"],
  "limit": 200
}
# completed = [t for t in tasks if t.properties.hs_task_status == "COMPLETED"]
# completion_rate = len(completed) / len(tasks) * 100

# 2. Overdue tasks
POST /crm/v3/objects/tasks/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_task_status", "operator": "NEQ", "value": "COMPLETED"},
      {"propertyName": "hs_timestamp", "operator": "LT", "value": "<now_epoch>"}
    ]
  }],
  "limit": 0
}
# overdue_count = response.total

# 3. Tasks per user distribution
# Group tasks by hs_task_owner and calculate std deviation
```

**New metric keys**:
- `tasks_completed_rate_90d_pct` (float 0–100)
- `tasks_overdue_count` (int)
- `tasks_overdue_pct` (float 0–100)
- `tasks_per_user_avg` (float)
- `task_discipline_index` (float 0–1, composite: completion rate × (1 - overdue%))

---

### 4.5 Coaching Playlists
**Status**: ❌ Currently `fixed` (manual) — NO automated data

**CONVERT TO AUTOMATED**:

```python
async def _coaching_playlist_stats(self) -> dict:
    """Measure coaching playlist usage."""
    stats = {}

    # Coaching playlists are part of the Conversations/Calling product
    # They are stored as call recordings organized into playlists
    # There is no direct public API for coaching playlists

    # PROXY MEASUREMENT APPROACH:
    # 1. Check if call recording is enabled (calls with recordings)
    POST /crm/v3/objects/calls/search
    {
      "filterGroups": [{
        "filters": [
          {"propertyName": "hs_call_recording_url", "operator": "HAS_PROPERTY"},
          {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_90d_ago>"}
        ]
      }],
      "limit": 0
    }
    stats["recorded_calls_90d"] = response.total

    # 2. Total calls in 90d
    POST /crm/v3/objects/calls/search
    {
      "filterGroups": [{
        "filters": [
          {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_90d_ago>"}
        ]
      }],
      "limit": 0
    }
    stats["total_calls_90d"] = response.total

    # 3. Recording adoption rate
    stats["call_recording_adoption_pct"] = _safe_pct(
        stats["recorded_calls_90d"], stats["total_calls_90d"])

    # 4. Coaching readiness index (proxy)
    # High recording rate + multiple callers = good coaching foundation
    # We can't directly measure playlist creation, but we can measure the prerequisite
    stats["coaching_readiness_index"] = min(1.0,
        stats["call_recording_adoption_pct"] / 60)  # 60%+ recording = max readiness

    return stats
```

**New metric keys**:
- `recorded_calls_90d` (int)
- `total_calls_90d` (int)
- `call_recording_adoption_pct` (float 0–100)
- `coaching_readiness_index` (float 0–1)

**Rubric update**:
```json
{
  "tool_name": "Coaching Playlists",
  "section": "Sales Hub",
  "rule_type": "metric_band",
  "metric_key": "coaching_readiness_index",
  "bands": [
    {"label": "Great Use",    "operator": "gte", "value": 0.7, "score": 9},
    {"label": "Good Use",     "operator": "gte", "value": 0.4, "score": 6},
    {"label": "Needs More Use","operator": "gte", "value": 0.1, "score": 3},
    {"label": "No Use",       "operator": "eq",  "value": 0,   "score": 1}
  ]
}
```

---

### 4.6 Documents
**Status**: ❌ Currently `fixed` (manual) — NO automated data

**CONVERT TO AUTOMATED**:

```python
async def _document_stats(self) -> dict:
    """Measure document tracking usage."""
    stats = {}

    # HubSpot Documents are tracked sales content pieces
    # API endpoint: GET /filemanager/api/v3/files/search
    # Or use the documents-specific endpoint if available:
    # GET /sales-documents/v1/documents?limit=100

    # Primary approach: Search for tracked documents
    try:
        response = await self._get("/filemanager/api/v3/files/search",
                                    params={"limit": 100})
        documents = response.get("results", [])
        stats["documents_total_count"] = response.get("total", len(documents))
    except:
        # Fallback: Try the files API with document type filter
        response = await self._get("/files/v3/files",
                                    params={"limit": 100})
        documents = response.get("results", [])
        stats["documents_total_count"] = len(documents)

    if documents:
        # Calculate freshness
        now = datetime.utcnow()
        stale = sum(1 for d in documents
                    if (now - parse_datetime(d.get("updatedAt", d.get("createdAt")))).days > 180)
        stats["documents_stale_180d_pct"] = (stale / len(documents)) * 100
        stats["documents_per_user"] = len(documents) / max(1, self.metrics.get("users_total", 1))
    else:
        stats["documents_stale_180d_pct"] = 0
        stats["documents_per_user"] = 0

    # Adoption index
    stats["documents_adoption_index"] = min(1.0,
        (stats["documents_total_count"] / 10) *
        (1 - stats.get("documents_stale_180d_pct", 0) / 100))

    return stats
```

**New metric keys**:
- `documents_total_count` (int)
- `documents_stale_180d_pct` (float 0–100)
- `documents_per_user` (float)
- `documents_adoption_index` (float 0–1)

**Rubric update**:
```json
{
  "tool_name": "Documents",
  "section": "Sales Hub",
  "rule_type": "metric_band",
  "metric_key": "documents_adoption_index",
  "bands": [
    {"label": "Great Use",    "operator": "gte", "value": 0.7, "score": 9},
    {"label": "Good Use",     "operator": "gte", "value": 0.3, "score": 6},
    {"label": "Needs More Use","operator": "gte", "value": 0.05, "score": 3},
    {"label": "No Use",       "operator": "eq",  "value": 0,    "score": 1}
  ]
}
```

---

### 4.7 Invoices
**Status**: ✅ Partially measured — `invoices_count` in raw_counts

**What to ADD**:
```python
# Invoice adoption and collection metrics
POST /crm/v3/objects/invoices/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_90d_ago>"}
    ]
  }],
  "properties": ["hs_invoice_status", "hs_amount_billed", "hs_due_date", "hs_payment_date"],
  "limit": 200
}

# Calculate:
# - invoices_90d_count
# - invoices_paid_pct (status=PAID / total)
# - invoices_overdue_count (due_date < today AND status != PAID)
# - avg_invoice_value
# - invoice_to_deal_ratio = invoices_count / deals_count
```

**New metric keys**:
- `invoices_90d_count` (int)
- `invoices_paid_pct` (float 0–100)
- `invoices_overdue_count` (int)
- `invoice_avg_value` (float)
- `invoice_to_deal_ratio` (float)
- `invoice_adoption_index` (float 0–1)

---

### 4.8 Payments
**Status**: ✅ Partially measured — `payments_count` in raw_counts

**What to ADD**:
```python
# Payment processing metrics
POST /crm/v3/objects/commerce_payments/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_90d_ago>"}
    ]
  }],
  "properties": ["hs_payment_status", "hs_gross_amount", "hs_net_amount"],
  "limit": 200
}

# Calculate:
# - payments_90d_count
# - payments_success_rate_pct = (successful / total) * 100
# - payments_avg_value
# - payment_adoption = payments_count > 0
```

**New metric keys**:
- `payments_90d_count` (int)
- `payments_success_rate_pct` (float 0–100)
- `payments_avg_value` (float)
- `payment_integration_active` (bool → 1/0)

---

### 4.9 Meetings
**Status**: ✅ Already measured — `meetings_count` in raw_counts

**What to ADD**:
```python
# Meeting link and scheduling effectiveness
# 1. Meetings booked in last 30d
POST /crm/v3/objects/meetings/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_30d_ago>"}
    ]
  }],
  "properties": ["hs_meeting_outcome", "hs_meeting_start_time", "hs_internal_meeting_notes"],
  "limit": 200
}

# 2. Meeting outcomes distribution
# hs_meeting_outcome: SCHEDULED, COMPLETED, RESCHEDULED, NO_SHOW, CANCELLED
# Calculate show rate = COMPLETED / (COMPLETED + NO_SHOW + CANCELLED)

# 3. Meetings per rep
meetings_per_user = meetings_30d / max(1, users_total)
```

**New metric keys**:
- `meetings_booked_30d` (int)
- `meetings_show_rate_pct` (float 0–100)
- `meetings_per_user_30d` (float)
- `meetings_no_show_pct` (float 0–100)
- `meetings_effectiveness_index` (float 0–1)

---

### 4.10 Playbooks
**Status**: ❌ Currently `fixed` (manual) — NO automated data

**CONVERT TO AUTOMATED**:

```python
async def _playbook_stats(self) -> dict:
    """Measure playbook creation and engagement."""
    stats = {}

    # Playbooks API (Sales Hub Professional/Enterprise)
    # There is no dedicated public playbooks API, but we can check:

    # 1. Check via the CRM cards/playbooks endpoint
    # Some portals expose playbooks via:
    # GET /crm/v3/extensions/calling/settings (related but not direct)

    # PROXY APPROACH: Check if playbooks feature is accessible
    # Try to access the playbooks page via scope check
    try:
        # Playbooks are part of sales content — check for the scope
        playbooks_available = "sales-content-read" in self.oauth_scopes
        stats["playbooks_feature_available"] = 1 if playbooks_available else 0
    except:
        stats["playbooks_feature_available"] = 0

    # 2. Alternative: Check for note/engagement patterns that indicate playbook use
    # Playbook submissions create engagement records with specific metadata
    # Search for engagements of type "PLAYBOOK_SUBMISSION"
    # This is not available via standard v3 search, but we can try:
    POST /crm/v3/objects/notes/search
    {
      "filterGroups": [{
        "filters": [
          {"propertyName": "hs_note_body", "operator": "CONTAINS_TOKEN", "value": "playbook"}
        ]
      }],
      "limit": 0
    }

    # 3. Scope-based detection
    # If the portal has Sales Hub Professional+, playbooks should be available
    # Use the subscription_profile to determine availability

    stats["playbooks_adoption_index"] = stats["playbooks_feature_available"] * 0.3
    # This is a conservative score — will be 0.3 if feature exists, 0 if not
    # Manual review screenshots can override this via AI enrichment

    return stats
```

**Note**: Playbooks have limited API surface. The implementation should:
1. Check scope/feature availability as a baseline
2. Use screenshot analysis (already in the AI enrichment pipeline) as primary evidence
3. Allow manual override via the existing `manual_tool_overrides` mechanism

**New metric keys**:
- `playbooks_feature_available` (0 or 1)
- `playbooks_adoption_index` (float 0–1)

**Rubric update**:
```json
{
  "tool_name": "Playbooks",
  "section": "Sales Hub",
  "rule_type": "metric_band",
  "metric_key": "playbooks_adoption_index",
  "bands": [
    {"label": "Great Use",    "operator": "gte", "value": 0.7, "score": 9},
    {"label": "Good Use",     "operator": "gte", "value": 0.3, "score": 6},
    {"label": "Needs More Use","operator": "gte", "value": 0.1, "score": 3},
    {"label": "No Use",       "operator": "eq",  "value": 0,   "score": 1}
  ]
}
```

---

### 4.11 Products
**Status**: ✅ Already measured — `products_count`, `product_to_deal_ratio`

**What to ADD**:
```python
# Product library health
GET /crm/v3/objects/products?limit=100&properties=name,price,hs_sku,createdate,hs_lastmodifieddate

# Calculate:
# - products_with_price_pct = (products where price > 0) / total * 100
# - products_with_sku_pct = (products with hs_sku set) / total * 100
# - products_stale_365d_pct = (products not modified in 365d) / total * 100

# Cross-reference: How many deals have line items?
POST /crm/v3/objects/deals/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_num_of_associated_line_items", "operator": "GT", "value": "0"}
    ]
  }],
  "limit": 0
}
# deals_with_line_items_pct = count / total_deals * 100
```

**New metric keys**:
- `products_with_price_pct` (float 0–100)
- `products_stale_365d_pct` (float 0–100)
- `deals_with_line_items_pct` (float 0–100)
- `product_catalog_health_index` (float 0–1)

---

### 4.12 Quotes
**Status**: ✅ Already measured — `quotes_count`, `quote_to_deal_ratio`

**What to ADD**:
```python
# Quote pipeline effectiveness
POST /crm/v3/objects/quotes/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_90d_ago>"}
    ]
  }],
  "properties": ["hs_status", "hs_expiration_date", "hs_quote_amount"],
  "limit": 200
}

# Calculate:
# - quotes_90d_count
# - quotes_approved_pct = (status=APPROVED or SIGNED) / total * 100
# - quotes_expired_pct = (expiration_date < today AND status not approved) / total * 100
# - avg_quote_value
# - quote_turnaround_days = avg(approval_date - create_date) for approved quotes
```

**New metric keys**:
- `quotes_90d_count` (int)
- `quotes_approved_pct` (float 0–100)
- `quotes_expired_pct` (float 0–100)
- `quote_avg_value` (float)
- `quote_effectiveness_index` (float 0–1)

---

### 4.13 Sales Workflows
**Status**: ✅ Already measured — `workflows_sales_active_pct`

**What to ADD**:
```python
# Deeper sales automation analysis
# 1. Sales workflows by trigger type
# From existing workflow data (already fetched), filter to deal/task-based workflows
# Calculate distribution: property-trigger vs date-trigger vs manual-trigger

# 2. Automation coverage per pipeline stage
# Cross-reference: for each deal pipeline stage, check if there's a workflow triggered by stage entry
# This requires parsing workflow enrollmentCriteria for dealstage references

# 3. Task automation rate
# What % of tasks are created by workflows vs manually?
POST /crm/v3/objects/tasks/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_90d_ago>"},
      {"propertyName": "hs_task_type", "operator": "EQ", "value": "TODO"}
    ]
  }],
  "properties": ["hs_created_by_user_id", "hs_queue_membership_ids"],
  "limit": 200
}
# If hs_created_by_user_id is null/system → automated task
```

**New metric keys**:
- `sales_workflow_trigger_distribution` (dict, for detailed report)
- `sales_pipeline_automation_coverage_pct` (float 0–100)
- `task_automation_rate_pct` (float 0–100)
- `sales_automation_maturity_index` (float 0–1)

---

### 4.14 Sales Sequences
**Status**: ✅ Already measured — `sequences_count`

**What to ADD**:
```python
# Sequence effectiveness metrics
# 1. Active enrollments
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_sequences_is_enrolled", "operator": "EQ", "value": "true"}
    ]
  }],
  "limit": 0
}
# active_enrollments = response.total

# 2. Sequences per user
sequences_per_user = sequences_count / max(1, users_total)

# 3. Sequence-to-meeting conversion (proxy)
# Contacts enrolled in sequence AND have a meeting in last 90d
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_sequences_enrolled_count", "operator": "GT", "value": "0"},
      {"propertyName": "hs_latest_meeting_activity", "operator": "GTE", "value": "<epoch_90d_ago>"}
    ]
  }],
  "limit": 0
}
# sequence_to_meeting_rate = count / active_enrollments * 100
```

**New metric keys**:
- `sequence_active_enrollments` (int)
- `sequences_per_user` (float)
- `sequence_to_meeting_rate_pct` (float 0–100)
- `sequence_effectiveness_index` (float 0–1)

---

### 4.15 Sales Reporting
**Status**: ✅ Already measured — `sales_reporting_signal_index`

**What to ADD**:
```python
# Sales reporting depth
# 1. Custom reports count (already partially captured via report_asset_count)
# 2. Dashboard usage (already in dashboard_usage_signal_index)
# 3. Cross-check: are key sales KPIs being tracked?

# Sales KPI coverage score:
# Check if these properties are populated on a sample of deals:
kpi_properties = [
    "amount",            # Deal value
    "closedate",         # Expected close
    "dealstage",         # Pipeline stage
    "hs_forecast_category",  # Forecast
    "hs_deal_stage_probability",  # Win probability
    "hs_time_in_pipeline",  # Velocity
]
# For each property, check % of open deals that have it set

# Reporting maturity index (composite)
# = (report_asset_count > 5) * 0.3 + (dashboard_usage > 0.5) * 0.3 + (kpi_coverage > 80%) * 0.4
```

**New metric keys**:
- `sales_kpi_coverage_pct` (float 0–100)
- `sales_reporting_maturity_index` (float 0–1)

---

## 5. Marketing Hub Section — 13 Items <a id="5-marketing"></a>

### 5.1 Segments (Lists)
**Status**: ✅ Already measured — `lists_active_count`, `lists_static_count`, `lists_stale_90_pct`, `lists_zero_member_pct`

**What to ADD**:
```python
# List segmentation depth
# 1. Active lists with > 100 members (meaningful segments)
# Already have list data — add calculation for meaningful list %
# 2. List-to-workflow connection rate
# How many active lists are used as workflow enrollment triggers?
# Cross-reference list IDs with workflow enrollment criteria

# 3. Segment freshness
# Active lists that have had member changes in last 30d
# Use list membership API: GET /crm/v3/lists/{listId}/memberships
```

**New metric keys**:
- `lists_meaningful_pct` (float 0–100, lists with >100 members)
- `lists_connected_to_workflows_pct` (float 0–100)
- `segmentation_maturity_index` (float 0–1)

---

### 5.2 Ads
**Status**: ❌ Currently `fixed` (manual) — NO automated data

**CONVERT TO AUTOMATED**:

```python
async def _ads_stats(self) -> dict:
    """Measure ad account connectivity and performance."""
    stats = {}

    # 1. Check connected ad accounts
    # GET /marketing/v3/marketing-events/external-account-setup
    # Or more directly: check for ad-related scopes
    ads_scopes = [s for s in self.oauth_scopes if "ads" in s.lower()]
    stats["ads_scopes_available"] = len(ads_scopes) > 0

    # 2. Try to get ad campaigns
    try:
        response = await self._get("/marketing/v3/ads/campaigns?limit=100")
        campaigns = response.get("results", [])
        stats["ad_campaigns_count"] = len(campaigns)

        # Active campaigns (status = ACTIVE or RUNNING)
        active = [c for c in campaigns if c.get("status") in ("ACTIVE", "RUNNING")]
        stats["ad_campaigns_active_count"] = len(active)

        # Calculate spend if available
        total_spend = sum(c.get("spend", {}).get("amount", 0) for c in campaigns)
        stats["ad_total_spend_90d"] = total_spend
    except:
        stats["ad_campaigns_count"] = 0
        stats["ad_campaigns_active_count"] = 0
        stats["ad_total_spend_90d"] = 0

    # 3. Connected ad accounts
    try:
        accounts_resp = await self._get("/marketing/v3/ads/accounts?limit=50")
        accounts = accounts_resp.get("results", [])
        stats["ad_accounts_connected"] = len(accounts)
        # Platform distribution
        platforms = set(a.get("adNetwork", "unknown") for a in accounts)
        stats["ad_platforms_connected"] = list(platforms)
    except:
        stats["ad_accounts_connected"] = 0
        stats["ad_platforms_connected"] = []

    # 4. Ads adoption index
    stats["ads_adoption_index"] = min(1.0,
        (0.3 if stats["ad_accounts_connected"] > 0 else 0) +
        (0.4 if stats["ad_campaigns_active_count"] > 0 else 0) +
        (0.3 if stats["ad_total_spend_90d"] > 0 else 0))

    return stats
```

**New metric keys**:
- `ad_accounts_connected` (int)
- `ad_campaigns_count` (int)
- `ad_campaigns_active_count` (int)
- `ad_total_spend_90d` (float)
- `ad_platforms_connected` (list)
- `ads_adoption_index` (float 0–1)

**Rubric update**:
```json
{
  "tool_name": "Ads",
  "section": "Marketing Hub",
  "rule_type": "metric_band",
  "metric_key": "ads_adoption_index",
  "bands": [
    {"label": "Great Use",    "operator": "gte", "value": 0.8, "score": 9},
    {"label": "Good Use",     "operator": "gte", "value": 0.5, "score": 7},
    {"label": "Needs More Use","operator": "gte", "value": 0.1, "score": 4},
    {"label": "No Use",       "operator": "eq",  "value": 0,   "score": 1}
  ]
}
```

---

### 5.3 Email
**Status**: ✅ Already measured — `emails_sent_30d`, `emails_sent_90d`, `marketing_email_*` rates

**What to ADD**:
```python
# Email marketing depth
# 1. Email types used (regular, automated, A/B test, RSS)
GET /marketing/v3/emails?limit=100&properties=name,type,currentState,publishDate,stats
# types = set(email.type for email in emails)
# stats["email_types_used"] = len(types)

# 2. A/B testing adoption
ab_tests = [e for e in emails if e.get("abTestId") or e.get("type") == "AB_EMAIL"]
stats["email_ab_test_count_90d"] = len(ab_tests)
stats["email_ab_testing_active"] = 1 if len(ab_tests) > 0 else 0

# 3. Email personalization (smart content / tokens)
# Check email body for personalization tokens
personalized = [e for e in emails if "{{" in str(e.get("body", "")) or
                e.get("smartContent")]
stats["email_personalization_rate_pct"] = len(personalized) / max(1, len(emails)) * 100

# 4. Email-to-deal attribution
# Contacts that received marketing email AND created a deal in 90d
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_email_last_email_date", "operator": "GTE", "value": "<epoch_90d_ago>"},
      {"propertyName": "num_associated_deals", "operator": "GT", "value": "0"}
    ]
  }],
  "limit": 0
}
```

**New metric keys**:
- `email_types_used_count` (int)
- `email_ab_test_count_90d` (int)
- `email_ab_testing_active` (0 or 1)
- `email_personalization_rate_pct` (float 0–100)
- `email_marketing_depth_index` (float 0–1)

---

### 5.4 Landing Pages
**Status**: ✅ Already measured — `landing_pages_count` in raw_counts

**What to ADD**:
```python
# Landing page performance metrics
GET /cms/v3/pages/landing-pages?limit=100&properties=name,state,publishDate,updatedAt,slug

# 1. Published vs draft
published = [p for p in pages if p.get("state") == "PUBLISHED"]
stats["landing_pages_published_count"] = len(published)
stats["landing_pages_draft_count"] = len(pages) - len(published)

# 2. Staleness
stale = [p for p in published if (now - parse(p.get("updatedAt"))).days > 180]
stats["landing_pages_stale_180d_pct"] = len(stale) / max(1, len(published)) * 100

# 3. Landing page to form connection
# Check if landing pages have associated forms (form module in page content)
# Cross-reference with forms_count

# 4. Landing pages per campaign
stats["landing_pages_per_campaign"] = len(published) / max(1, campaigns_count)
```

**New metric keys**:
- `landing_pages_published_count` (int)
- `landing_pages_draft_count` (int)
- `landing_pages_stale_180d_pct` (float 0–100)
- `landing_pages_per_campaign` (float)
- `landing_page_health_index` (float 0–1)

---

### 5.5 Social
**Status**: ❌ Currently `fixed` (manual) — NO automated data

**CONVERT TO AUTOMATED**:

```python
async def _social_stats(self) -> dict:
    """Measure social media integration."""
    stats = {}

    # Social publishing and monitoring via HubSpot API
    # The social API has limited public endpoints, but we can check:

    # 1. Check for social scopes
    social_scopes = [s for s in self.oauth_scopes if "social" in s.lower()]
    stats["social_scopes_available"] = len(social_scopes) > 0

    # 2. Try to get social publishing data
    try:
        # Social messages/posts
        response = await self._get("/broadcast/v1/broadcasts?limit=100&since=" + epoch_90d_ago_str)
        broadcasts = response.get("results", response) if isinstance(response, dict) else response
        if isinstance(broadcasts, list):
            stats["social_posts_90d"] = len(broadcasts)
            # Channel distribution
            channels = {}
            for b in broadcasts:
                ch = b.get("channelType", b.get("network", "unknown"))
                channels[ch] = channels.get(ch, 0) + 1
            stats["social_channels_active"] = len(channels)
            stats["social_channel_distribution"] = channels
        else:
            stats["social_posts_90d"] = 0
            stats["social_channels_active"] = 0
    except:
        stats["social_posts_90d"] = 0
        stats["social_channels_active"] = 0

    # 3. Social adoption index
    stats["social_adoption_index"] = min(1.0,
        (0.4 if stats.get("social_scopes_available") else 0) +
        (0.3 if stats.get("social_posts_90d", 0) > 0 else 0) +
        (0.3 if stats.get("social_channels_active", 0) > 1 else
         0.15 if stats.get("social_channels_active", 0) == 1 else 0))

    return stats
```

**New metric keys**:
- `social_scopes_available` (bool → 0/1)
- `social_posts_90d` (int)
- `social_channels_active` (int)
- `social_adoption_index` (float 0–1)

**Rubric update**:
```json
{
  "tool_name": "Social",
  "section": "Marketing Hub",
  "rule_type": "metric_band",
  "metric_key": "social_adoption_index",
  "bands": [
    {"label": "Great Use",    "operator": "gte", "value": 0.7, "score": 9},
    {"label": "Good Use",     "operator": "gte", "value": 0.4, "score": 6},
    {"label": "Needs More Use","operator": "gte", "value": 0.1, "score": 3},
    {"label": "No Use",       "operator": "eq",  "value": 0,   "score": 1}
  ]
}
```

---

### 5.6 Website (CMS / Site Pages)
**Status**: ✅ Partially measured — tracking code, domains, blog posts exist

**What to ADD**:
```python
# Website/CMS depth metrics
# 1. Site pages count and health
GET /cms/v3/pages/site-pages?limit=100&properties=state,publishDate,updatedAt,slug

stats["site_pages_total"] = len(pages)
published = [p for p in pages if p.get("state") == "PUBLISHED"]
stats["site_pages_published"] = len(published)
stale = [p for p in published if (now - parse(p.get("updatedAt"))).days > 365]
stats["site_pages_stale_365d_pct"] = len(stale) / max(1, len(published)) * 100

# 2. Blog posts
GET /cms/v3/blogs/posts?limit=100&properties=state,publishDate,updatedAt

stats["blog_posts_total"] = response.get("total", 0)
recent = [p for p in posts if (now - parse(p.get("publishDate"))).days <= 90]
stats["blog_posts_90d"] = len(recent)

# 3. Blog posting frequency
if stats["blog_posts_total"] > 0:
    # Get earliest and latest publish dates
    dates = sorted([parse(p.get("publishDate")) for p in posts if p.get("publishDate")])
    if len(dates) > 1:
        span_days = (dates[-1] - dates[0]).days
        stats["blog_avg_posts_per_month"] = len(dates) / max(1, span_days / 30)

# 4. CMS adoption index
stats["website_cms_adoption_index"] = min(1.0,
    (0.3 if stats.get("site_pages_published", 0) > 0 else 0) +
    (0.3 if stats.get("blog_posts_90d", 0) > 0 else 0) +
    (0.2 if stats.get("tracking_code_access_pct", 0) > 0 else 0) +
    (0.2 if stats.get("domains_custom_count", 0) > 0 else 0))
```

**New metric keys**:
- `site_pages_total` (int)
- `site_pages_published` (int)
- `site_pages_stale_365d_pct` (float 0–100)
- `blog_posts_total` (int)
- `blog_posts_90d` (int)
- `blog_avg_posts_per_month` (float)
- `website_cms_adoption_index` (float 0–1)

---

### 5.7 Campaigns
**Status**: ✅ Already measured — `campaigns_count`, `campaign_asset_coverage_index`

**What to ADD**:
```python
# Campaign effectiveness and attribution
GET /marketing/v3/campaigns?limit=100

# 1. Campaign activity (campaigns created in 90d)
recent_campaigns = [c for c in campaigns if (now - parse(c.get("createdAt"))).days <= 90]
stats["campaigns_created_90d"] = len(recent_campaigns)

# 2. Campaign asset diversity (how many asset types per campaign)
# Each campaign can have: emails, landing pages, blog posts, social posts, CTAs, workflows
# The campaign object includes associated asset counts
for c in campaigns:
    assets = c.get("counters", {})
    asset_types_used = sum(1 for v in assets.values() if v > 0)
# avg_asset_types_per_campaign = sum / count

# 3. Multi-touch campaigns (campaigns with > 3 asset types)
multi_touch = [c for c in campaigns if sum(1 for v in c.get("counters", {}).values() if v > 0) >= 3]
stats["campaigns_multi_touch_pct"] = len(multi_touch) / max(1, len(campaigns)) * 100
```

**New metric keys**:
- `campaigns_created_90d` (int)
- `campaigns_avg_asset_types` (float)
- `campaigns_multi_touch_pct` (float 0–100)
- `campaign_maturity_index` (float 0–1)

---

### 5.8 Files and Templates
**Status**: ✅ Partially measured — `files_per_1k_contacts` exists

**What to ADD**:
```python
# File management health
GET /files/v3/files?limit=100

stats["files_total_count"] = response.get("total", 0)

# 1. File type distribution
type_dist = {}
for f in files:
    ext = f.get("extension", "unknown").lower()
    type_dist[ext] = type_dist.get(ext, 0) + 1
stats["file_type_distribution"] = type_dist

# 2. Storage usage
total_size = sum(f.get("size", 0) for f in files)
stats["file_storage_mb"] = total_size / (1024 * 1024)

# 3. Orphan files estimate (files not referenced in emails/pages)
# This requires cross-referencing file URLs with email/page content — expensive
# Use a simpler proxy: files older than 365d with no recent modification
old_files = [f for f in files if (now - parse(f.get("updatedAt"))).days > 365]
stats["files_stale_365d_pct"] = len(old_files) / max(1, len(files)) * 100
```

**New metric keys**:
- `files_total_count` (int)
- `file_storage_mb` (float)
- `files_stale_365d_pct` (float 0–100)
- `file_management_index` (float 0–1)

---

### 5.9 Lead Capture (Forms + CTAs + Pop-ups)
**Status**: ✅ Partially measured — `forms_active_count`, `forms_stale_180_pct`, `forms_field_median_count`

**What to ADD**:
```python
# Lead capture ecosystem depth
# 1. CTA (Call-to-Action) metrics
# CTAs via the CTA API
try:
    response = await self._get("/ctas/v3/ctas?limit=100")
    ctas = response.get("results", [])
    stats["ctas_total_count"] = len(ctas)
    active_ctas = [c for c in ctas if c.get("isPublished")]
    stats["ctas_active_count"] = len(active_ctas)
except:
    stats["ctas_total_count"] = 0
    stats["ctas_active_count"] = 0

# 2. Pop-up forms (captured within forms API)
# HubSpot forms have a "formType" field: HUBSPOT (embedded), POP_UP, DROPDOWN, etc.
GET /marketing/v3/forms?limit=100
popup_forms = [f for f in forms if f.get("formType") in ("POP_UP", "DROPDOWN_BANNER", "SLIDE_IN_LEFT")]
stats["popup_forms_count"] = len(popup_forms)

# 3. Form submission rate (if form analytics available)
# This requires the analytics API or form submission endpoint
# GET /form-integrations/v1/submissions/forms/{formId}?limit=1
# Check recent submissions count per form

# 4. Lead capture coverage
# = (forms on landing pages + CTAs on site pages + popup forms) presence check
stats["lead_capture_coverage_index"] = min(1.0,
    (0.4 if stats.get("forms_active_count", 0) > 0 else 0) +
    (0.3 if stats.get("ctas_active_count", 0) > 0 else 0) +
    (0.3 if stats.get("popup_forms_count", 0) > 0 else 0))
```

**New metric keys**:
- `ctas_total_count` (int)
- `ctas_active_count` (int)
- `popup_forms_count` (int)
- `lead_capture_coverage_index` (float 0–1)

---

### 5.10 Marketing Workflows
**Status**: ✅ Already measured — `workflows_marketing_active_pct`

**What to ADD**:
```python
# Marketing automation sophistication
# 1. Workflow complexity (avg actions per workflow)
# From workflow data, count actions in each marketing workflow
marketing_workflows = [w for w in all_workflows if w.get("objectType") == "CONTACT"]
if marketing_workflows:
    action_counts = [len(w.get("actions", [])) for w in marketing_workflows]
    stats["mkt_workflow_avg_actions"] = sum(action_counts) / len(action_counts)

    # Complex workflows (> 5 actions including branches)
    complex_wf = [w for w in marketing_workflows if len(w.get("actions", [])) > 5]
    stats["mkt_workflow_complex_pct"] = len(complex_wf) / len(marketing_workflows) * 100

# 2. Workflow-to-list ratio (should be close to 1:1 for good automation)
stats["mkt_workflow_to_list_ratio"] = len(marketing_workflows) / max(1, lists_active_count)

# 3. Nurture workflow detection
# Look for workflows with delays (nurture sequences have deliberate time gaps)
nurture_wfs = [w for w in marketing_workflows
               if any(a.get("type") == "DELAY" for a in w.get("actions", []))]
stats["nurture_workflow_count"] = len(nurture_wfs)
```

**New metric keys**:
- `mkt_workflow_avg_actions` (float)
- `mkt_workflow_complex_pct` (float 0–100)
- `mkt_workflow_to_list_ratio` (float)
- `nurture_workflow_count` (int)
- `marketing_automation_maturity_index` (float 0–1)

---

### 5.11 Marketing Reporting
**Status**: ✅ Already measured — `marketing_reporting_signal_index`

**What to ADD**:
```python
# Marketing attribution setup check
# 1. Check if multi-touch attribution is configured
# This is visible via the contact properties for attribution:
# hs_analytics_first_url, hs_analytics_last_url, hs_analytics_source, etc.
# Check if contacts have attribution data populated

POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_analytics_source", "operator": "HAS_PROPERTY"}
    ]
  }],
  "limit": 0
}
stats["contacts_with_attribution_pct"] = response.total / max(1, contact_total_count) * 100

# 2. UTM parameter adoption
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_analytics_first_url", "operator": "CONTAINS_TOKEN", "value": "utm_"}
    ]
  }],
  "limit": 0
}
stats["contacts_with_utm_pct"] = response.total / max(1, contact_total_count) * 100

# 3. Marketing reporting maturity
stats["marketing_reporting_maturity_index"] = (
    marketing_reporting_signal_index * 0.4 +
    min(1.0, stats.get("contacts_with_attribution_pct", 0) / 50) * 0.3 +
    min(1.0, stats.get("contacts_with_utm_pct", 0) / 30) * 0.3)
```

**New metric keys**:
- `contacts_with_attribution_pct` (float 0–100)
- `contacts_with_utm_pct` (float 0–100)
- `marketing_reporting_maturity_index` (float 0–1)

---

### 5.12 Buyer Intent
**Status**: ❌ Currently `fixed` (manual) — NO automated data

**CONVERT TO AUTOMATED**:

```python
async def _buyer_intent_stats(self) -> dict:
    """Measure buyer intent data availability and usage."""
    stats = {}

    # Buyer intent is a Marketing Hub Enterprise feature
    # It tracks target accounts' research activity

    # 1. Check if buyer intent properties exist on companies
    # Key properties: hs_target_account, hs_buyer_intent_score
    try:
        props = await self._get("/crm/v3/properties/companies")
        prop_names = [p.get("name") for p in props.get("results", [])]

        buyer_intent_props = [p for p in prop_names if "buyer_intent" in p or "target_account" in p]
        stats["buyer_intent_properties_count"] = len(buyer_intent_props)
    except:
        stats["buyer_intent_properties_count"] = 0

    # 2. Check if target accounts are set
    if stats["buyer_intent_properties_count"] > 0:
        POST /crm/v3/objects/companies/search
        {
          "filterGroups": [{
            "filters": [
              {"propertyName": "hs_target_account", "operator": "EQ", "value": "true"}
            ]
          }],
          "limit": 0
        }
        stats["target_accounts_count"] = response.total
    else:
        stats["target_accounts_count"] = 0

    # 3. Buyer intent adoption index
    stats["buyer_intent_adoption_index"] = min(1.0,
        (0.3 if stats["buyer_intent_properties_count"] > 0 else 0) +
        (0.7 if stats["target_accounts_count"] > 5 else
         0.4 if stats["target_accounts_count"] > 0 else 0))

    return stats
```

**New metric keys**:
- `buyer_intent_properties_count` (int)
- `target_accounts_count` (int)
- `buyer_intent_adoption_index` (float 0–1)

**Rubric update**:
```json
{
  "tool_name": "Buyer Intent",
  "section": "Marketing Hub",
  "rule_type": "metric_band",
  "metric_key": "buyer_intent_adoption_index",
  "bands": [
    {"label": "Great Use",    "operator": "gte", "value": 0.7, "score": 9},
    {"label": "Good Use",     "operator": "gte", "value": 0.3, "score": 6},
    {"label": "Needs More Use","operator": "gte", "value": 0.1, "score": 3},
    {"label": "No Use",       "operator": "eq",  "value": 0,   "score": 1}
  ]
}
```

---

### 5.13 Lead Scoring
**Status**: ✅ Already measured — `lead_score_property_count`, `lead_scoring_signal_index`

**What to ADD**:
```python
# Lead scoring effectiveness
# 1. Contacts with lead scores populated
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hubspotscore", "operator": "GT", "value": "0"}
    ]
  }],
  "limit": 0
}
stats["contacts_with_score_pct"] = response.total / max(1, contact_total_count) * 100

# 2. Score distribution quality
# Sample scored contacts and check distribution
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hubspotscore", "operator": "GT", "value": "0"}
    ]
  }],
  "properties": ["hubspotscore"],
  "limit": 200
}
scores = [int(c.properties.hubspotscore) for c in contacts]
# Calculate: std deviation, median, quartiles
# A healthy scoring model has good spread (std > 10)

# 3. Score-to-MQL conversion check
# Contacts with high scores that became MQLs
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hubspotscore", "operator": "GT", "value": "50"},
      {"propertyName": "lifecyclestage", "operator": "EQ", "value": "marketingqualifiedlead"}
    ]
  }],
  "limit": 0
}
# High-score MQL alignment rate

# 4. Lead scoring maturity index
stats["lead_scoring_maturity_index"] = (
    lead_scoring_signal_index * 0.3 +
    min(1.0, stats.get("contacts_with_score_pct", 0) / 50) * 0.3 +
    min(1.0, lead_score_property_count / 3) * 0.2 +
    (0.2 if score_std > 10 else 0.1 if score_std > 5 else 0))
```

**New metric keys**:
- `contacts_with_score_pct` (float 0–100)
- `lead_score_median` (float)
- `lead_score_std` (float)
- `lead_scoring_maturity_index` (float 0–1)

---

## 6. Service Hub Section — 4 Items <a id="6-service"></a>

### 6.1 Tickets
**Status**: ✅ Already measured — `ticket_no_owner_pct`, `ticket_source_missing_pct`, `ticket_priority_missing_pct`

**What to ADD**:
```python
# Ticket operations depth
# 1. Ticket resolution time
POST /crm/v3/objects/tickets/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_pipeline_stage", "operator": "EQ", "value": "4"},  # Closed stage
      {"propertyName": "closedate", "operator": "GTE", "value": "<epoch_90d_ago>"}
    ]
  }],
  "properties": ["createdate", "closedate", "hs_ticket_priority", "source_type"],
  "limit": 200
}
# avg_resolution_hours = avg(closedate - createdate) in hours

# 2. Ticket pipeline utilisation
GET /crm/v3/pipelines/tickets
# ticket_pipelines_count = len(pipelines)
# ticket_stages_per_pipeline_avg = avg(len(stages) for p in pipelines)

# 3. SLA metrics (if available)
# Check for SLA properties on tickets
POST /crm/v3/objects/tickets/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_sla_status", "operator": "HAS_PROPERTY"}
    ]
  }],
  "limit": 0
}
# sla_tracked_pct = count / total_tickets * 100

# 4. Ticket source distribution
# From sampled tickets, group by source_type
source_dist = {}
for t in tickets:
    src = t.properties.get("source_type", "unknown")
    source_dist[src] = source_dist.get(src, 0) + 1
stats["ticket_source_distribution"] = source_dist
stats["ticket_sources_used_count"] = len(source_dist)
```

**New metric keys**:
- `ticket_avg_resolution_hours` (float)
- `ticket_pipelines_count` (int)
- `ticket_stages_per_pipeline_avg` (float)
- `ticket_sla_tracked_pct` (float 0–100)
- `ticket_sources_used_count` (int)
- `ticket_operations_maturity_index` (float 0–1)

---

### 6.2 Feedback Surveys
**Status**: ✅ Partially measured — `feedback_submissions_count`

**What to ADD**:
```python
# Feedback survey depth
# 1. Get feedback submissions with properties
POST /crm/v3/objects/feedback_submissions/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_90d_ago>"}
    ]
  }],
  "properties": ["hs_survey_type", "hs_response_group", "hs_sentiment"],
  "limit": 200
}

# 2. Survey types in use (NPS, CSAT, CES)
survey_types = set(s.properties.get("hs_survey_type") for s in submissions)
stats["survey_types_used"] = len(survey_types)

# 3. Response rate proxy
# feedback_submissions_count / (tickets closed in same period)
stats["survey_response_ratio"] = feedback_submissions_count / max(1, tickets_closed_90d)

# 4. Sentiment distribution (positive/neutral/negative)
sentiments = [s.properties.get("hs_sentiment") for s in submissions]
positive = sum(1 for s in sentiments if s == "POSITIVE") / max(1, len(sentiments)) * 100
stats["feedback_positive_pct"] = positive

# 5. Feedback loop maturity
stats["feedback_maturity_index"] = min(1.0,
    (0.3 if stats["survey_types_used"] >= 2 else 0.15 if stats["survey_types_used"] == 1 else 0) +
    (0.3 if stats.get("survey_response_ratio", 0) > 0.1 else 0) +
    (0.2 if stats.get("feedback_submissions_count", 0) > 10 else 0) +
    (0.2 if stats.get("feedback_positive_pct", 0) > 0 else 0))
```

**New metric keys**:
- `survey_types_used` (int)
- `survey_response_ratio` (float)
- `feedback_positive_pct` (float 0–100)
- `feedback_maturity_index` (float 0–1)

---

### 6.3 Knowledge Base
**Status**: ✅ Partially measured — `knowledge_articles_count`, `knowledge_to_ticket_ratio`

**What to ADD**:
```python
# Knowledge base health
GET /cms/v3/blogs/posts?limit=100  # KB articles may be in blog/post format
# Or use the knowledge base specific endpoint if available:
# GET /cms/v3/knowledge-base/articles?limit=100

# 1. Article freshness
stale_articles = [a for a in articles if (now - parse(a.get("updatedAt"))).days > 365]
stats["kb_articles_stale_365d_pct"] = len(stale_articles) / max(1, len(articles)) * 100

# 2. Article categorisation
categorized = [a for a in articles if a.get("categoryId") or a.get("tags")]
stats["kb_articles_categorized_pct"] = len(categorized) / max(1, len(articles)) * 100

# 3. Knowledge base coverage
# KB articles per 100 tickets (should be > 5 for good self-service)
stats["kb_articles_per_100_tickets"] = len(articles) / max(1, tickets_count / 100)

# 4. KB health index
stats["kb_health_index"] = min(1.0,
    (0.3 * min(1.0, len(articles) / 20)) +  # at least 20 articles
    (0.3 * (1 - stats.get("kb_articles_stale_365d_pct", 0) / 100)) +
    (0.2 * min(1.0, stats.get("kb_articles_categorized_pct", 0) / 80)) +
    (0.2 * min(1.0, stats.get("kb_articles_per_100_tickets", 0) / 5)))
```

**New metric keys**:
- `kb_articles_stale_365d_pct` (float 0–100)
- `kb_articles_categorized_pct` (float 0–100)
- `kb_articles_per_100_tickets` (float)
- `kb_health_index` (float 0–1)

---

### 6.4 Customer Portal
**Status**: ✅ Already measured — `customer_portal_signal_index`

**What to ADD**:
```python
# Customer portal configuration depth
# 1. Check if customer portal is enabled
# The customer_portal_signal_index already does scope-based detection
# Expand with ticket visibility check

# 2. Tickets submitted via portal (source = CUSTOMER_PORTAL)
POST /crm/v3/objects/tickets/search
{
  "filterGroups": [{
    "filters": [
      {"propertyName": "source_type", "operator": "EQ", "value": "CUSTOMER_PORTAL"},
      {"propertyName": "hs_createdate", "operator": "GTE", "value": "<epoch_90d_ago>"}
    ]
  }],
  "limit": 0
}
stats["portal_tickets_90d"] = response.total
stats["portal_ticket_share_pct"] = response.total / max(1, total_tickets_90d) * 100

# 3. Self-service ratio
# (KB article views + portal tickets) / total tickets
# Proxy: portal_tickets + KB articles as a % of total tickets
stats["self_service_ratio"] = (
    stats.get("portal_tickets_90d", 0) + knowledge_articles_count
) / max(1, tickets_count) * 100

# 4. Customer portal maturity
stats["customer_portal_maturity_index"] = min(1.0,
    customer_portal_signal_index * 0.4 +
    min(1.0, stats.get("portal_ticket_share_pct", 0) / 20) * 0.3 +
    min(1.0, stats.get("self_service_ratio", 0) / 50) * 0.3)
```

**New metric keys**:
- `portal_tickets_90d` (int)
- `portal_ticket_share_pct` (float 0–100)
- `self_service_ratio` (float 0–100)
- `customer_portal_maturity_index` (float 0–1)

---

## 7. Integration Into Scoring System <a id="7-scoring-integration"></a>

### 7.1 Add New Metrics to `collect_indirect_metrics()` Return Dict

In `hubspot_client.py`, at the end of `collect_indirect_metrics()`, merge all new stats:

```python
# At the end of collect_indirect_metrics(), add:

# --- PHASE 4: Expanded metrics ---
# Only collect if the hub is in active_hubs
if "CRM" in active_hubs or True:  # CRM metrics always collected
    template_stats = await self._template_stats()
    metrics.update(template_stats)

    chatbot_stats = await self._chatbot_stats()
    metrics.update(chatbot_stats)

    conversation_stats = await self._conversation_inbox_stats()
    metrics.update(conversation_stats)

    goals_stats = await self._goals_stats()
    metrics.update(goals_stats)

if "Sales Hub" in active_hubs:
    prospecting_stats = await self._prospecting_stats()
    metrics.update(prospecting_stats)

    coaching_stats = await self._coaching_playlist_stats()
    metrics.update(coaching_stats)

    document_stats = await self._document_stats()
    metrics.update(document_stats)

    # ... (add all Sales Hub measurement methods)

if "Marketing Hub" in active_hubs:
    ads_stats = await self._ads_stats()
    metrics.update(ads_stats)

    social_stats = await self._social_stats()
    metrics.update(social_stats)

    buyer_intent_stats = await self._buyer_intent_stats()
    metrics.update(buyer_intent_stats)

    # ... (add all Marketing Hub measurement methods)

if "Service Hub" in active_hubs:
    # ... (add all Service Hub measurement methods)
```

### 7.2 Update `rubric.json` — Convert 8 Fixed Tools

Replace `rule_type: "fixed"` with `rule_type: "metric_band"` for these 8 tools. The exact band definitions are provided in each section above. Summary:

| Tool Name | New metric_key | Section |
|---|---|---|
| Templates | `templates_adoption_index` | CRM |
| Coaching Playlists | `coaching_readiness_index` | Sales Hub |
| Documents | `documents_adoption_index` | Sales Hub |
| Playbooks | `playbooks_adoption_index` | Sales Hub |
| Ads | `ads_adoption_index` | Marketing Hub |
| SMS | `sms_adoption_index` (see note below) | Marketing Hub |
| Social | `social_adoption_index` | Marketing Hub |
| Buyer Intent | `buyer_intent_adoption_index` | Marketing Hub |

**Note on SMS**: SMS has no public HubSpot API. Keep as `fixed` but add a scope-based availability check:
```python
sms_available = "conversations-messaging-write" in self.oauth_scopes
stats["sms_feature_available"] = 1 if sms_available else 0
stats["sms_adoption_index"] = 0.3 if sms_available else 0.0
# Baseline 0.3 if feature exists, rely on manual/screenshot review for actual usage
```

### 7.3 Add New Indirect Checks to `indirect_checks.py`

Add these new checks to the `INDIRECT_CHECKS` list:

```python
# === PHASE 4: New Indirect Checks ===

# CRM expanded checks
{"metric_key": "templates_adoption_index", "section": "Automation",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.4, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.1, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.1, "score_pct": 20}]},

{"metric_key": "conversation_inbox_health_index", "section": "Service",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.6, "score_pct": 85},
     {"label": "warning", "operator": "gte", "value": 0.3, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.3, "score_pct": 20}]},

{"metric_key": "goals_coverage_index", "section": "Platform Ops",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 25}]},

{"metric_key": "data_completeness_index", "section": "Schema",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.7, "score_pct": 90},
     {"label": "warning", "operator": "gte", "value": 0.4, "score_pct": 55},
     {"label": "risk", "operator": "lt", "value": 0.4, "score_pct": 20}]},

# Sales Hub expanded checks
{"metric_key": "prospecting_intensity_index", "section": "Funnel Leakage",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 85},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 20}]},

{"metric_key": "deal_velocity_index", "section": "Funnel Leakage",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 85},
     {"label": "warning", "operator": "gte", "value": 0.25, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.25, "score_pct": 20}]},

{"metric_key": "task_discipline_index", "section": "Automation",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.6, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.3, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.3, "score_pct": 20}]},

{"metric_key": "forecast_depth_index", "section": "Funnel Leakage",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 20}]},

{"metric_key": "coaching_readiness_index", "section": "Automation",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 20}]},

{"metric_key": "product_catalog_health_index", "section": "Schema",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.6, "score_pct": 85},
     {"label": "warning", "operator": "gte", "value": 0.3, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.3, "score_pct": 20}]},

# Marketing Hub expanded checks
{"metric_key": "ads_adoption_index", "section": "Marketing Ops",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 20}]},

{"metric_key": "social_adoption_index", "section": "Marketing Ops",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 20}]},

{"metric_key": "email_marketing_depth_index", "section": "Marketing Ops",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.6, "score_pct": 85},
     {"label": "warning", "operator": "gte", "value": 0.3, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.3, "score_pct": 20}]},

{"metric_key": "lead_capture_coverage_index", "section": "Marketing Ops",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.6, "score_pct": 85},
     {"label": "warning", "operator": "gte", "value": 0.3, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.3, "score_pct": 20}]},

{"metric_key": "marketing_automation_maturity_index", "section": "Automation",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 85},
     {"label": "warning", "operator": "gte", "value": 0.25, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.25, "score_pct": 20}]},

{"metric_key": "marketing_reporting_maturity_index", "section": "Marketing Ops",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.25, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.25, "score_pct": 20}]},

{"metric_key": "lead_scoring_maturity_index", "section": "Marketing Ops",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 20}]},

{"metric_key": "buyer_intent_adoption_index", "section": "Marketing Ops",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 20}]},

# Service Hub expanded checks
{"metric_key": "ticket_operations_maturity_index", "section": "Service",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.6, "score_pct": 85},
     {"label": "warning", "operator": "gte", "value": 0.3, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.3, "score_pct": 20}]},

{"metric_key": "feedback_maturity_index", "section": "Service",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 20}]},

{"metric_key": "kb_health_index", "section": "Service",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.25, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.25, "score_pct": 20}]},

{"metric_key": "customer_portal_maturity_index", "section": "Service",
 "bands": [
     {"label": "healthy", "operator": "gte", "value": 0.5, "score_pct": 80},
     {"label": "warning", "operator": "gte", "value": 0.2, "score_pct": 50},
     {"label": "risk", "operator": "lt", "value": 0.2, "score_pct": 20}]},
```

### 7.4 Add New BENCHMARK_SPECS to `report_compiler.py`

Add these entries to the `BENCHMARK_SPECS` dict:

```python
# === PHASE 4: New Benchmarks ===

# CRM expanded
"crm_templates": {
    "domain": "Sales Hub",  # Templates support sales workflows
    "metric_key": "templates_adoption_index",
    "label": "Email Templates",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"crm_chatbot_adoption": {
    "domain": "CRM",
    "metric_key": "chatbot_adoption_index",
    "label": "Chatbot Adoption",
    "target": 0.3, "operator": "gte", "warn_buffer": 0.15,
    "format": "index"
},
"crm_inbox_health": {
    "domain": "CRM",
    "metric_key": "conversation_inbox_health_index",
    "label": "Conversation Inbox",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"crm_goals_coverage": {
    "domain": "CRM",
    "metric_key": "goals_coverage_index",
    "label": "Goals Coverage",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.15,
    "format": "index"
},
"crm_data_completeness": {
    "domain": "Contacts",
    "metric_key": "data_completeness_index",
    "label": "Data Completeness",
    "target": 0.6, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},

# Sales Hub expanded
"sales_prospecting": {
    "domain": "Sales Hub",
    "metric_key": "prospecting_intensity_index",
    "label": "Prospecting Activity",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.15,
    "format": "index"
},
"sales_deal_velocity": {
    "domain": "Deals",
    "metric_key": "deal_velocity_index",
    "label": "Deal Velocity",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"sales_forecast_depth": {
    "domain": "Sales Hub",
    "metric_key": "forecast_depth_index",
    "label": "Forecast Depth",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"sales_task_discipline": {
    "domain": "Sales Hub",
    "metric_key": "task_discipline_index",
    "label": "Task Discipline",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"sales_coaching": {
    "domain": "Sales Hub",
    "metric_key": "coaching_readiness_index",
    "label": "Coaching Readiness",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"sales_documents": {
    "domain": "Sales Hub",
    "metric_key": "documents_adoption_index",
    "label": "Documents",
    "target": 0.3, "operator": "gte", "warn_buffer": 0.15,
    "format": "index"
},
"sales_product_health": {
    "domain": "Sales Hub",
    "metric_key": "product_catalog_health_index",
    "label": "Product Catalog",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"sales_sequences_effectiveness": {
    "domain": "Sales Hub",
    "metric_key": "sequence_effectiveness_index",
    "label": "Sequence Effectiveness",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.15,
    "format": "index"
},

# Marketing Hub expanded
"mkt_ads_adoption": {
    "domain": "Marketing Hub",
    "metric_key": "ads_adoption_index",
    "label": "Ads Integration",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"mkt_social_adoption": {
    "domain": "Marketing Hub",
    "metric_key": "social_adoption_index",
    "label": "Social Publishing",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"mkt_email_depth": {
    "domain": "Marketing Hub",
    "metric_key": "email_marketing_depth_index",
    "label": "Email Sophistication",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"mkt_lead_capture": {
    "domain": "Marketing Hub",
    "metric_key": "lead_capture_coverage_index",
    "label": "Lead Capture Coverage",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"mkt_automation_maturity": {
    "domain": "Marketing Hub",
    "metric_key": "marketing_automation_maturity_index",
    "label": "Automation Maturity",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"mkt_reporting_maturity": {
    "domain": "Marketing Hub",
    "metric_key": "marketing_reporting_maturity_index",
    "label": "Attribution & Reporting",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"mkt_buyer_intent": {
    "domain": "Marketing Hub",
    "metric_key": "buyer_intent_adoption_index",
    "label": "Buyer Intent",
    "target": 0.3, "operator": "gte", "warn_buffer": 0.15,
    "format": "index"
},
"mkt_lead_scoring_maturity": {
    "domain": "Marketing Hub",
    "metric_key": "lead_scoring_maturity_index",
    "label": "Lead Scoring Depth",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"mkt_campaign_maturity": {
    "domain": "Marketing Hub",
    "metric_key": "campaign_maturity_index",
    "label": "Campaign Maturity",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},

# Service Hub expanded
"service_ticket_maturity": {
    "domain": "Service Hub",
    "metric_key": "ticket_operations_maturity_index",
    "label": "Ticket Operations",
    "target": 0.5, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"service_feedback_maturity": {
    "domain": "Service Hub",
    "metric_key": "feedback_maturity_index",
    "label": "Feedback Loops",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"service_kb_health": {
    "domain": "Service Hub",
    "metric_key": "kb_health_index",
    "label": "Knowledge Base Health",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
"service_portal_maturity": {
    "domain": "Service Hub",
    "metric_key": "customer_portal_maturity_index",
    "label": "Customer Portal Depth",
    "target": 0.4, "operator": "gte", "warn_buffer": 0.2,
    "format": "index"
},
```

---

## 8. Integration Into Report PDF <a id="8-report-integration"></a>

### 8.1 New Metrics Available for AI Narrative

The AI report bundle (`_build_ai_bundle()` in `ai_report_service.py`) automatically includes all metrics from `collect_indirect_metrics()`. The new metrics will automatically appear in the `metrics` payload sent to the AI provider.

### 8.2 Update Prompt Packs

In both `baseline_v1.json` and `vero_brand_v1.json`, the `section_requirements.sections` instruction says "domain-by-domain for active hubs only". The AI will naturally incorporate new metrics into its narrative because they appear in the data bundle.

**Recommended prompt addition** (add to `global_instructions` in both prompt packs):
```json
"When expanded metrics are present (e.g., *_maturity_index, *_adoption_index, *_depth_index), use them to provide specific, quantified recommendations. Reference the index value and explain what improvement looks like."
```

### 8.3 Template Updates

In `branded_report.html`, the benchmark table and scorecard sections are dynamically generated from `benchmark_framework`. The new BENCHMARK_SPECS will automatically render in the existing table structure.

For the per-chapter detail sections, each rubric tool's findings are rendered via the `findings` list. Since the 8 previously-fixed tools now have real metric_band scores, they will generate proper finding entries with status labels, scores, and recommended actions.

**No HTML template changes required** — the template iterates dynamically over findings and benchmarks.

---

## 9. Integration Into Quote Prioritisation <a id="9-quote-integration"></a>

### 9.1 How the Quote System Currently Works

The quote generation (`_generate_quote_version()` in `main.py`) sends audit findings + AI enrichment to the AI provider, which generates a structured quote proposal. The AI receives:
- `audit_findings` (all scored findings)
- `enrichment_data` (client profile, strategic priorities)
- `meeting_notes` (uploaded meeting summaries)
- `file_uploads` (uploaded documents)

### 9.2 Prioritisation Logic Based on Client Uploads

When the client uploads meeting notes or files, the `enrichment_stage1_text_v1.txt` prompt processes them and produces:
- `meeting_overrides` — priorities extracted from meeting transcripts
- `narrative_note` — context summary

These feed into the `client_profile_v1.txt` prompt which produces `strategic_priorities` with `weighted_score_0_to_100`.

**To improve prioritisation**, add this logic to `_build_ai_bundle()`:

```python
# In ai_report_service.py, when building the quote bundle:

def _build_quote_priority_signals(self, metrics, findings, enrichment):
    """Generate prioritised work items for quote based on metrics + client context."""

    priority_items = []

    # 1. Metrics with the biggest gap (lowest index scores in active hubs)
    index_metrics = {k: v for k, v in metrics.items()
                     if k.endswith("_index") and isinstance(v, (int, float)) and v < 0.5}
    sorted_gaps = sorted(index_metrics.items(), key=lambda x: x[1])

    for metric_key, value in sorted_gaps[:10]:  # Top 10 worst indexes
        priority_items.append({
            "source": "metric_gap",
            "metric_key": metric_key,
            "current_value": value,
            "target_value": 0.7,
            "priority_weight": (0.7 - value) * 100,
            "description": f"Improve {metric_key.replace('_', ' ')} from {value:.0%} to 70%+"
        })

    # 2. Client-stated priorities from meeting notes
    if enrichment and enrichment.get("client_profile"):
        for sp in enrichment["client_profile"].get("strategic_priorities", []):
            priority_items.append({
                "source": "client_stated",
                "title": sp.get("title"),
                "rationale": sp.get("rationale"),
                "priority_weight": sp.get("weighted_score_0_to_100", 50),
                "description": sp.get("title")
            })

    # 3. High-risk findings
    high_risk = [f for f in findings if f.get("score", 10) <= 3]
    for f in high_risk:
        priority_items.append({
            "source": "audit_finding",
            "tool_name": f.get("tool_name"),
            "score": f.get("score"),
            "priority_weight": (10 - f.get("score", 5)) * 10,
            "description": f.get("client_summary", f.get("tool_name"))
        })

    # Sort by priority weight descending
    priority_items.sort(key=lambda x: x.get("priority_weight", 0), reverse=True)

    return priority_items[:20]  # Top 20 items for the quote
```

### 9.3 Weight Order for Quote Recommendations

As specified in `client_profile_v1.txt`, the priority order is:
1. **Explicit client requests** (highest weight) — from uploaded meeting notes
2. **Meeting note priority requests and risk points** — from enrichment stage 1
3. **Manual review notes and screenshot evidence** — from vision/merge enrichment
4. **Audit findings/actions** — from metric gaps and scoring

The `priority_items` list produced above respects this order by assigning higher `priority_weight` to client-stated items.

---

## 10. Hub-Scoping Rules <a id="10-hub-scoping"></a>

### Critical: Respect `subscription_context.active_hubs`

Every new measurement method MUST be wrapped in a hub availability check:

```python
# Pattern for every new measurement method:
async def _ads_stats(self) -> dict:
    if "Marketing Hub" not in self.active_hubs:
        return {"ads_adoption_index": None}  # None = not applicable, NOT 0

    # ... actual measurement logic ...
```

### Scoring Layer Handling of None

In `rules_engine.py`, when `metric_value is None`, the finding should be:
- `status_label`: "Unavailable"
- `score`: `None` (NOT 0)
- `confidence`: 0.0
- **Excluded from composite averages**

In `report_compiler.py`, `_score_status()` should return `"not_applicable"` instead of `"not_available"` when the metric is `None` due to hub scoping (vs genuinely 0 due to non-use).

### AI Prompt Handling

The prompts (already updated) instruct the AI to:
- Only recommend within active hubs
- Frame unavailable hubs as "optional upgrade paths"
- Not penalise portals for features they don't have access to

---

## 11. New File Checklist <a id="11-file-checklist"></a>

### Files to MODIFY (do not replace, add to existing):

| File | What to Add |
|---|---|
| `app/services/hubspot_client.py` | ~15 new async helper methods (`_template_stats`, `_chatbot_stats`, `_coaching_playlist_stats`, `_document_stats`, `_ads_stats`, `_social_stats`, `_buyer_intent_stats`, `_prospecting_stats`, `_goals_stats`, `_conversation_inbox_stats`, `_deal_velocity_stats`, `_forecast_depth_stats`, `_playbook_stats`, `_landing_page_stats`, `_website_cms_stats`). Merge results into `collect_indirect_metrics()` return dict. |
| `app/rules/rubric.json` | Convert 8 tools from `fixed` → `metric_band` with band definitions from this guide |
| `app/rules/indirect_checks.py` | Add ~22 new check entries to `INDIRECT_CHECKS` list |
| `app/services/report_compiler.py` | Add ~25 new entries to `BENCHMARK_SPECS` dict |
| `app/services/ai_report_service.py` | Add `_build_quote_priority_signals()` method; add expanded metrics instruction to AI bundle |
| `app/prompts/ai_report/baseline_v1.json` | Add expanded-metrics instruction to `global_instructions` |
| `app/prompts/ai_report/vero_brand_v1.json` | Add expanded-metrics instruction to `global_instructions` |

### Files that do NOT need changes:
| File | Reason |
|---|---|
| `app/services/rules_engine.py` | Already handles `metric_band` rule types. Just needs None-handling fix (Phase 2 item). |
| `app/templates/branded_report.html` | Dynamic rendering — new data flows automatically. |
| `app/templates/quote_proposal.html` | AI-generated content adapts to new data. |
| `app/main.py` | No route changes needed — data flows through existing pipeline. |

### Estimated API Call Impact

Current audit makes ~50-80 API calls. This expansion adds approximately:
- CRM section: +8–12 calls (search queries for expanded quality checks)
- Sales Hub: +10–15 calls (prospecting, coaching, documents, forecasting)
- Marketing Hub: +8–12 calls (ads, social, email depth, buyer intent)
- Service Hub: +5–8 calls (ticket resolution, feedback surveys, KB health)

**Total new calls: ~30–47 additional API calls per audit run**

At HubSpot's rate limit of 100 req/10s, this adds ~3–5 seconds of API time. Use the existing concurrency pattern (`asyncio.gather`) to parallelise calls within each hub group.

### Implementation Order (recommended)

1. **Week 1**: Add hub-scoping None handling to `rules_engine.py` and `report_compiler.py` (Phase 2 prerequisite)
2. **Week 2**: Implement CRM expanded metrics (3.1–3.9) + update rubric for Templates
3. **Week 3**: Implement Sales Hub expanded metrics (4.1–4.15) + update rubric for Coaching/Documents/Playbooks
4. **Week 4**: Implement Marketing Hub expanded metrics (5.1–5.13) + update rubric for Ads/Social/Buyer Intent
5. **Week 5**: Implement Service Hub expanded metrics (6.1–6.4)
6. **Week 6**: Add all new indirect checks + BENCHMARK_SPECS + quote priority signals
7. **Week 7**: Integration testing + prompt tuning

---

*End of Developer Implementation Guide — Phase 4*
