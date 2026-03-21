# HubSpot Associations API v4 Reference

The Associations v4 API manages relationships between CRM records. It supports labeled associations (e.g., "Billing contact", "Decision maker") and unlabeled default links. Use v4 for all new work — v3 is legacy.

## 1. Required Scopes

Scopes depend on the object types being associated:
- `crm.objects.contacts.read` / `.write`
- `crm.objects.companies.read` / `.write`
- `crm.objects.deals.read` / `.write`
- `crm.objects.tickets.read` / `.write`

## 2. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/crm/v4/objects/{from}/{fromId}/associations/default/{to}/{toId}` | Create single **unlabeled** association |
| PUT | `/crm/v4/objects/{from}/{fromId}/associations/{to}/{toId}` | Create single **labeled** association |
| POST | `/crm/v4/associations/{from}/{to}/batch/associate/default` | Batch create **unlabeled** (max 2,000) |
| POST | `/crm/v4/associations/{from}/{to}/batch/create` | Batch create **labeled** (max 2,000) |
| GET | `/crm/v4/objects/{from}/{fromId}/associations/{to}` | Read associations for one record |
| POST | `/crm/v4/associations/{from}/{to}/batch/read` | Batch read associations (max 1,000) |
| DELETE | `/crm/v4/objects/{from}/{fromId}/associations/{to}/{toId}` | Remove **all** associations between two records |
| POST | `/crm/v4/associations/{from}/{to}/batch/archive` | Batch delete associations |
| POST | `/crm/v4/associations/{from}/{to}/batch/labels/archive` | Remove specific labels only (keeps other labels) |
| GET | `/crm/v4/associations/{from}/{to}/labels` | List association type definitions / lookup type IDs |
| POST | `/crm/v4/associations/{from}/{to}/labels` | Create custom association label |
| PUT | `/crm/v4/associations/{from}/{to}/labels` | Update custom association label |
| DELETE | `/crm/v4/associations/{from}/{to}/labels/{associationTypeId}` | Delete custom association label |
| POST | `/crm/v4/associations/usage/high-usage-report/{userId}` | Email high-usage report |

## 3. Association Type ID Table

### Contact ↔ Company

| Direction | Type ID | Label |
|-----------|---------|-------|
| Contact → Company | 279 | Unlabeled |
| Company → Contact | 280 | Unlabeled |
| Contact → Company | 1 | Primary |
| Company → Contact | 2 | Primary |

### Contact ↔ Deal

| Direction | Type ID | Label |
|-----------|---------|-------|
| Contact → Deal | 4 | Unlabeled |
| Deal → Contact | 3 | Unlabeled |

### Company ↔ Deal

| Direction | Type ID | Label |
|-----------|---------|-------|
| Company → Deal | 342 | Unlabeled |
| Deal → Company | 341 | Unlabeled |
| Company → Deal | 6 | Primary |
| Deal → Company | 5 | Primary |

### Company ↔ Company (Hierarchy)

| Direction | Type ID | Label |
|-----------|---------|-------|
| Parent → Child | 13 | Parent to child |
| Child → Parent | 14 | Child to parent |

### Contact ↔ Ticket

| Direction | Type ID | Label |
|-----------|---------|-------|
| Contact → Ticket | 15 | Unlabeled |
| Ticket → Contact | 16 | Unlabeled |

### Company ↔ Ticket

| Direction | Type ID | Label |
|-----------|---------|-------|
| Company → Ticket | 340 | Unlabeled |
| Ticket → Company | 339 | Unlabeled |

### Deal ↔ Ticket

| Direction | Type ID | Label |
|-----------|---------|-------|
| Deal → Ticket | 27 | Unlabeled |
| Ticket → Deal | 28 | Unlabeled |

### Deal ↔ Line Item

| Direction | Type ID | Label |
|-----------|---------|-------|
| Deal → Line Item | 19 | Unlabeled |
| Line Item → Deal | 20 | Unlabeled |

### Activity Associations (Call, Email, Meeting, Note, Task)

| Activity | Activity → Contact | Contact → Activity | Activity → Company | Company → Activity | Activity → Deal | Deal → Activity | Activity → Ticket | Ticket → Activity |
|----------|-------------------|-------------------|-------------------|-------------------|-----------------|----------------|-------------------|-------------------|
| Call | 194 | 193 | 182 | 181 | 206 | 205 | 220 | 219 |
| Email | 198 | 197 | 186 | 185 | 210 | 209 | 224 | 223 |
| Meeting | 200 | 199 | 188 | 187 | 212 | 211 | 226 | 225 |
| Note | 202 | 201 | 190 | 189 | 214 | 213 | 228 | 227 |
| Task | 204 | 203 | 192 | 191 | 216 | 215 | 230 | 229 |

## 4. Labeled vs Unlabeled — The `/default/` Endpoint Variant

- **Unlabeled (default):** Use the `/default/` path variant. No body needed for single PUT. Creates the generic association without any label.
- **Labeled:** Use the path **without** `/default/`. Body must include `associationCategory` and `associationTypeId`.

Single unlabeled — no body required:
```
PUT /crm/v4/objects/contacts/{contactId}/associations/default/companies/{companyId}
```

Single labeled — body is a **JSON array** `[]`:
```
PUT /crm/v4/objects/contacts/{contactId}/associations/companies/{companyId}
```

## 5. Association Categories

| Category | Meaning |
|----------|---------|
| `HUBSPOT_DEFINED` | Built-in labels (Primary, Parent/Child, etc.) |
| `USER_DEFINED` | Custom labels created by users in the HubSpot UI |
| `INTEGRATOR_DEFINED` | Custom labels created via the API by integrations |

## 6. Batch Limits

| Operation | Max inputs per call |
|-----------|-------------------|
| Batch create (labeled & unlabeled) | 2,000 |
| Batch read | 1,000 |
| Batch archive | 2,000 |
| Batch labels archive | 2,000 |

## 7. Creating Custom Labels

```
POST /crm/v4/associations/{fromType}/{toType}/labels
```

```json
{
  "name": "billing_contact",
  "label": "Billing Contact",
  "inverseLabel": "Billed By"
}
```

- `name`: internal name (snake_case)
- `label`: forward-direction display label
- `inverseLabel`: reverse-direction display label (optional but recommended)
- **Maximum 10 custom labels per object pair**
- Category will be `INTEGRATOR_DEFINED` when created via API

## 8. CRITICAL: Body Format Differences

**Single PUT labeled** — body is a **JSON array `[]`**:
```json
[
  {
    "associationCategory": "HUBSPOT_DEFINED",
    "associationTypeId": 1
  }
]
```

**Batch POST create** — body is an **object with `inputs` array**:
```json
{
  "inputs": [
    {
      "from": { "id": "12345" },
      "to": { "id": "67890" },
      "types": [
        {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": 1
        }
      ]
    }
  ]
}
```

**Batch POST create unlabeled** — body is an **object with `inputs` array** (no types needed):
```json
{
  "inputs": [
    { "from": { "id": "12345" }, "to": { "id": "67890" } }
  ]
}
```

**Batch POST read** — body is an **object with `inputs` array**:
```json
{
  "inputs": [
    { "id": "33451" },
    { "id": "29851" }
  ]
}
```

## 9. Association Type ID Lookup

To discover type IDs (including custom labels) for any object pair:

```
GET /crm/v4/associations/{fromObjectType}/{toObjectType}/labels
```

Response:
```json
{
  "results": [
    {
      "category": "HUBSPOT_DEFINED",
      "typeId": 1,
      "label": "Primary"
    },
    {
      "category": "HUBSPOT_DEFINED",
      "typeId": 279,
      "label": null
    },
    {
      "category": "USER_DEFINED",
      "typeId": 36,
      "label": "Billing Contact"
    }
  ]
}
```

Custom label type IDs are **account-specific** — always look them up before use.

## 10. Key Notes

- **Deleting unlabeled = deleting ALL:** Removing the unlabeled association (e.g., typeId 279/280) removes **every** association between those two records, including all labels.
- **250,000 association limit** per object type per record (e.g., a single contact can have at most 250,000 total associations).
- **Node.js SDK:** v9.0.0+ required for v4 associations support.
- **Directionality matters:** typeId 1 is Contact → Company (Primary). typeId 2 is Company → Contact (Primary). They are not interchangeable.
- **Updating labels:** When setting labels via PUT, include ALL labels you want retained — omitted labels are dropped.
- **Rate limits:**
  - Free/Starter: 100 requests/10s
  - Professional/Enterprise: 150 requests/10s
  - Daily cap: 500,000 association requests

## 11. Cross-Reference: Workflow Automation

To create associations via workflows (e.g., auto-associate contacts to companies on owner match), see `hubspot-workflows-reference.md`. The create association action (`actionTypeId: 0-63189541`) accepts `fields: {}` as a placeholder — configure the target object in the HubSpot UI. **ALWAYS read the workflow reference before creating workflows.**
