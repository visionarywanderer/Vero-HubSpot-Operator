# 07 — Property Manager

## Purpose
Create, read, update, and delete HubSpot properties on any object type. Audit property usage.

## Priority: P1 | Dependencies: 02-api-client, 04-orchestrator, 05-change-logger

---

## API

**Base**: `/crm/v3/properties/{objectType}`
**Scopes**: `crm.schemas.{objectType}.read`, `crm.schemas.{objectType}.write`

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/crm/v3/properties/{objectType}` | List all properties |
| POST | `/crm/v3/properties/{objectType}` | Create property |
| PATCH | `/crm/v3/properties/{objectType}/{propertyName}` | Update property |
| DELETE | `/crm/v3/properties/{objectType}/{propertyName}` | Delete property |

## Create Property Payload

```json
{
  "name": "lead_segment",
  "label": "Lead Segment",
  "type": "enumeration",
  "fieldType": "select",
  "groupName": "contactinformation",
  "options": [
    { "label": "Enterprise", "value": "enterprise", "displayOrder": 1 },
    { "label": "Mid-Market", "value": "mid_market", "displayOrder": 2 },
    { "label": "SMB", "value": "smb", "displayOrder": 3 }
  ]
}
```

## Property Types Reference

| type | fieldType | Use Case |
|------|-----------|----------|
| `string` | `text` | Short text |
| `string` | `textarea` | Long text |
| `number` | `number` | Numbers, scores |
| `enumeration` | `select` | Single dropdown |
| `enumeration` | `checkbox` | Multiple select |
| `date` | `date` | Date picker |
| `datetime` | `date` | Date + time |
| `bool` | `booleancheckbox` | Yes/no |

## Property Audit Function

```typescript
async function auditProperties(objectType: string): Promise<PropertyAudit[]> {
  // 1. Get all properties
  const properties = await apiClient.properties.list(objectType);
  
  // 2. Sample 200 records to check fill rates
  const records = await apiClient.crm.search(objectType, [], properties.map(p => p.name));
  
  // 3. For each property, calculate fill rate
  return properties.map(prop => ({
    name: prop.name,
    label: prop.label,
    type: prop.type,
    isCustom: !prop.hubspotDefined,
    fillRate: calculateFillRate(records, prop.name),
    recommendation: fillRate < 0.05 ? 'DELETE_CANDIDATE' : fillRate < 0.2 ? 'REVIEW' : 'OK'
  }));
}
```

## Exports

```typescript
interface PropertyManager {
  list(objectType: string): Promise<Property[]>;
  create(objectType: string, spec: PropertySpec): Promise<Property>;
  update(objectType: string, name: string, updates: Partial<PropertySpec>): Promise<Property>;
  delete(objectType: string, name: string): Promise<void>;
  audit(objectType: string): Promise<PropertyAudit[]>;
}
```
