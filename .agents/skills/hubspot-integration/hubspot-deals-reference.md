# HubSpot Deals API v3 Reference

The Deals API manages sales opportunities through their lifecycle. Deals live inside pipelines and move through stages. Always use internal IDs (not display names) for pipeline and stage values.

## Required Scopes

| Scope | Purpose |
|-------|---------|
| `crm.objects.deals.read` | Read deals |
| `crm.objects.deals.write` | Create, update, archive deals |
| `crm.schemas.deals.read` | Read deal pipelines/stages |
| `crm.schemas.deals.write` | Create/update pipelines/stages |

## Endpoints

### CRUD Operations

| Method | Path | Summary |
|--------|------|---------|
| POST | `/crm/v3/objects/deals` | Create a deal |
| GET | `/crm/v3/objects/deals/{dealId}` | Get deal by ID |
| GET | `/crm/v3/objects/deals` | List deals (paginated, max 100 per page) |
| PATCH | `/crm/v3/objects/deals/{dealId}` | Update a deal |
| DELETE | `/crm/v3/objects/deals/{dealId}` | Archive deal (moves to recycle bin) |
| POST | `/crm/v3/objects/deals/search` | Search deals with filters |

### Batch Operations (max 100 records per call)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/crm/v3/objects/deals/batch/create` | Batch create |
| POST | `/crm/v3/objects/deals/batch/read` | Batch read |
| POST | `/crm/v3/objects/deals/batch/update` | Batch update |
| POST | `/crm/v3/objects/deals/batch/upsert` | Batch upsert (requires `idProperty`) |
| POST | `/crm/v3/objects/deals/batch/archive` | Batch archive |

### Pipeline & Stage Management

| Method | Path | Summary |
|--------|------|---------|
| GET | `/crm/v3/pipelines/deals` | List all deal pipelines |
| POST | `/crm/v3/pipelines/deals` | Create pipeline |
| GET | `/crm/v3/pipelines/deals/{pipelineId}` | Get pipeline |
| PATCH | `/crm/v3/pipelines/deals/{pipelineId}` | Update pipeline |
| DELETE | `/crm/v3/pipelines/deals/{pipelineId}` | Delete pipeline |
| GET | `/crm/v3/pipelines/deals/{pipelineId}/stages` | List stages |
| POST | `/crm/v3/pipelines/deals/{pipelineId}/stages` | Create stage |
| GET | `/crm/v3/pipelines/deals/{pipelineId}/stages/{stageId}` | Get stage |
| PATCH | `/crm/v3/pipelines/deals/{pipelineId}/stages/{stageId}` | Update stage |
| DELETE | `/crm/v3/pipelines/deals/{pipelineId}/stages/{stageId}` | Delete stage |

### Association Endpoints

| Method | Path | Summary |
|--------|------|---------|
| PUT | `/crm/v3/objects/deals/{dealId}/associations/{toObjectType}/{toObjectId}/{associationTypeId}` | Create association |
| DELETE | `/crm/v3/objects/deals/{dealId}/associations/{toObjectType}/{toObjectId}/{associationTypeId}` | Remove association |

## Required Properties for Creation

| Property | Required | Notes |
|----------|----------|-------|
| `dealname` | Always | Deal name/title |
| `dealstage` | Always | Internal stage ID (not display name) |
| `pipeline` | When multiple pipelines exist | Internal pipeline ID; defaults to `default` if only one pipeline |

### Create Deal Example

```json
{
  "properties": {
    "dealname": "Enterprise renewal",
    "amount": "48000.00",
    "closedate": "2025-12-15T00:00:00.000Z",
    "pipeline": "default",
    "dealstage": "contractsent",
    "hubspot_owner_id": "910901",
    "deal_currency_code": "USD"
  }
}
```

### Create Deal with Associations

```json
{
  "properties": {
    "dealname": "New deal",
    "pipeline": "default",
    "dealstage": "contractsent",
    "amount": "1500.00"
  },
  "associations": [
    {
      "to": { "id": 201 },
      "types": [{ "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 3 }]
    },
    {
      "to": { "id": 301 },
      "types": [{ "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 341 }]
    }
  ]
}
```

## Pipeline and Stage Management

### Create Pipeline with Stages

```json
{
  "label": "Enterprise Sales",
  "displayOrder": 1,
  "stages": [
    {
      "label": "Qualification",
      "displayOrder": 0,
      "metadata": {
        "probability": "0.1",
        "isClosed": "false"
      }
    },
    {
      "label": "Proposal",
      "displayOrder": 1,
      "metadata": {
        "probability": "0.5",
        "isClosed": "false"
      }
    },
    {
      "label": "Closed Won",
      "displayOrder": 2,
      "metadata": {
        "probability": "1.0",
        "isClosed": "true"
      }
    },
    {
      "label": "Closed Lost",
      "displayOrder": 3,
      "metadata": {
        "probability": "0.0",
        "isClosed": "true"
      }
    }
  ]
}
```

### Stage Metadata (Deals)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `probability` | String | Yes | `"0.0"` to `"1.0"` — must be a **string** for deals |
| `isClosed` | String | No | `"true"` or `"false"` — marks stage as closed |

Every deal pipeline **must** have at least one stage with `isClosed: "true"` (Closed Won and/or Closed Lost).

## Deal Stage Change Rules

- **Pipeline moves:** When moving a deal to a different pipeline, you **must** also set `dealstage` to a valid stage in the target pipeline. Setting only `pipeline` without `dealstage` will error.
- **Closed Won:** Setting a deal to a Closed Won stage auto-sets `hs_closed_won_date` and `closedate` (if not already set). `hs_is_closed_won` becomes `true`.
- **Closed Lost:** Setting to Closed Lost auto-sets `closedate`. `hs_is_closed_won` becomes `false`. `hs_is_closed` becomes `true`.
- **Reopening:** Moving a deal from a closed stage back to an open stage clears `hs_is_closed` and `hs_is_closed_won`.
- **Forecast category:** Auto-assigned based on stage probability unless manually overridden. See Forecasting Properties below.
- **Stage history:** Use `propertiesWithHistory: ["dealstage"]` in batch read to track stage transitions for pipeline velocity.

## Search Filters

**Endpoint:** `POST /crm/v3/objects/deals/search`

### Filter Operators

| Operator | Description |
|----------|-------------|
| `EQ` | Equal to |
| `NEQ` | Not equal to |
| `LT` | Less than |
| `LTE` | Less than or equal to |
| `GT` | Greater than |
| `GTE` | Greater than or equal to |
| `BETWEEN` | Between two values (use `highValue` and `value`) |
| `IN` | In list of values (use `values` array) |
| `NOT_IN` | Not in list of values |
| `HAS_PROPERTY` | Property is known/set |
| `NOT_HAS_PROPERTY` | Property is not set |
| `CONTAINS_TOKEN` | Contains token (tokenized text search) |
| `NOT_CONTAINS_TOKEN` | Does not contain token |

### Search Limits

- Max **10,000 results** total per search query
- Max **200 results** per page (`limit` param)
- Max **5 filter groups** (OR'd together)
- Max **6 filters** per group (AND'd together)
- Sorts by `createdate` desc by default; only one sort allowed

### Search Example

```json
{
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "dealstage", "operator": "EQ", "value": "closedwon" },
        { "propertyName": "amount", "operator": "GTE", "value": "10000" }
      ]
    }
  ],
  "properties": ["dealname", "amount", "closedate", "pipeline"],
  "limit": 50,
  "after": 0
}
```

## Batch Operation Formats

**All batch endpoints: max 100 records per call.**

### Batch Create

```json
{
  "inputs": [
    {
      "properties": {
        "dealname": "Deal A",
        "pipeline": "default",
        "dealstage": "appointmentscheduled",
        "amount": "5000"
      }
    },
    {
      "properties": {
        "dealname": "Deal B",
        "pipeline": "default",
        "dealstage": "qualifiedtobuy",
        "amount": "12000"
      }
    }
  ]
}
```

### Batch Update

```json
{
  "inputs": [
    { "id": "123", "properties": { "dealstage": "closedwon" } },
    { "id": "456", "properties": { "amount": "25000" } }
  ]
}
```

### Batch Upsert (requires idProperty)

```json
{
  "inputs": [
    {
      "idProperty": "external_deal_id",
      "id": "EXT-001",
      "properties": {
        "dealname": "Upserted Deal",
        "pipeline": "default",
        "dealstage": "appointmentscheduled",
        "external_deal_id": "EXT-001"
      }
    }
  ]
}
```

### Batch Read with History

```json
{
  "propertiesWithHistory": ["dealstage"],
  "inputs": [
    { "id": "7891023" },
    { "id": "987654" }
  ]
}
```

### Batch Archive

```json
{
  "inputs": [
    { "id": "123" },
    { "id": "456" }
  ]
}
```

## Association Patterns

### Default Association Type IDs

| From | To | Type ID | Reverse Type ID |
|------|----|---------|-----------------|
| Contact | Deal | 4 | 3 (deal → contact) |
| Company | Deal | 342 | 341 (deal → company) |
| Deal | Line Item | 19 | 20 (line item → deal) |
| Deal | Quote | 63 | 64 (quote → deal) |
| Deal | Ticket | 27 | 28 (ticket → deal) |

### Associate Contact to Deal

```
PUT /crm/v3/objects/deals/{dealId}/associations/contacts/{contactId}/3
```

### Associate Company to Deal

```
PUT /crm/v3/objects/deals/{dealId}/associations/companies/{companyId}/341
```

## Forecasting Properties

| Property | Description |
|----------|-------------|
| `hs_forecast_category` | Forecast category: `OMIT`, `PIPELINE`, `BEST_CASE`, `COMMIT`, `CLOSED` |
| `hs_forecast_probability` | Manual override of stage probability for forecasting |
| `hs_deal_stage_probability` | Auto-set from stage metadata `probability` |
| `hs_projected_amount` | Weighted amount (amount x probability) |
| `hs_is_closed` | `true` when deal is in any closed stage |
| `hs_is_closed_won` | `true` only for Closed Won stages |
| `hs_closed_won_date` | Auto-set when deal moves to Closed Won |

Forecast category is auto-assigned based on stage probability unless manually set:
- `probability < 0.5` → `PIPELINE`
- `probability >= 0.5 and < 0.9` → `BEST_CASE`
- `probability >= 0.9 and < 1.0` → `COMMIT`
- `probability = 1.0` (closed won) → `CLOSED`
- `probability = 0.0` (closed lost) → `OMIT`

## Currency Handling

| Property | Description |
|----------|-------------|
| `deal_currency_code` | ISO 4217 currency code (e.g., `USD`, `EUR`, `GBP`) |
| `amount` | Deal amount in the deal's currency |
| `amount_in_home_currency` | Auto-calculated based on exchange rate |
| `hs_exchange_rate` | Exchange rate used for conversion |

### Currency Rules

- If multi-currency is enabled, set `deal_currency_code` on creation. Defaults to portal's home currency if omitted.
- `amount_in_home_currency` is auto-calculated using HubSpot's exchange rates.
- **Exchange rate locks on close:** When a deal moves to a closed stage, the exchange rate is frozen. Reopening the deal does not unlock it — you must manually update `hs_exchange_rate` if needed.
- Changing `deal_currency_code` on an existing deal recalculates `amount_in_home_currency`.

## Key Notes and Gotchas

- **Internal IDs only:** Always use internal IDs for `pipeline` and `dealstage` — display names silently fail or error.
- **Pipeline required:** When the account has multiple pipelines, you **must** specify `pipeline`. Omitting it causes unpredictable assignment.
- **Pipeline + stage together:** When changing pipeline, always set both `pipeline` and `dealstage` in the same update.
- **Batch limit:** 100 records per batch call. Exceeding returns 400 error.
- **Deletion:** Archived deals move to recycle bin; restorable from HubSpot UI within 90 days.
- **Associations in batch/read:** Not supported. Use the Associations v4 API for batch association reads.
- **Collaborators:** Set `hs_all_collaborator_owner_ids` as semicolon-delimited owner IDs (e.g., `;12345;67890;`).
- **Custom unique identifiers:** Enable lookup by external system IDs via `idProperty` parameter on upsert and read.
- **Date properties:** `closedate` and date filters use ISO 8601 / epoch millisecond format. Dates are stored as midnight UTC.
- **Amount as string:** The `amount` property is sent as a string, not a number.
- **Rate limits:** 100 requests/10 seconds (OAuth) or 110 requests/10 seconds (private apps) across all API endpoints.

## Cross-Reference: Workflow Automation

To automate deal operations (create deals from contacts, update stages, notify on pipeline changes), see `hubspot-workflows-reference.md` and `hubspot-workflow-templates.md`. Use `PLATFORM_FLOW` with `objectTypeId: "0-3"` for deal-based workflows. **ALWAYS read these before creating workflows.**
