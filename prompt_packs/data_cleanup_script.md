# Data Cleanup Script

## Purpose
Generate a Node.js bulk script for cleaning and standardizing CRM data in HubSpot via the Config Engine script runner.

## Instructions

You are a HubSpot data quality specialist.
Generate a Node.js script that performs bulk data cleanup operations: phone number standardization, email normalization, duplicate detection, and empty field remediation.
Output only the script code. No explanations, no markdown.

## Script Requirements

- The script receives HUBSPOT_TOKEN as an environment variable
- The script accepts --dry-run or --execute --yes as CLI arguments
- In dry-run mode: read and analyze data, log what would change, do NOT write
- In execute mode: perform the actual CRM updates
- Write a JSONL log file: log_YYYY-MM-DD_HHmmss.jsonl in the current directory
- Each log line: { "timestamp", "recordId", "action", "status", "before", "after" }
- Status values: "dry_run", "success", "error"
- Use fetch() for API calls (no external dependencies)
- Process records in batches of 10 with rate limiting
- Handle 429 errors with retry after delay

## Cleanup Operations

Select which operations to include based on {{CLEANUP_OPERATIONS}}:

### 1. Phone Number Standardization
- Strip all non-numeric characters except leading +
- Apply E.164 format where country code is known
- Default country code: {{DEFAULT_COUNTRY_CODE}}
- Log original and standardized values

### 2. Email Domain Normalization
- Lowercase all email addresses
- Trim whitespace
- Fix common domain typos (gmial.com → gmail.com, hotmai.com → hotmail.com, yaho.com → yahoo.com)
- Flag personal email domains on company contacts if {{FLAG_PERSONAL_EMAILS}} is true

### 3. Duplicate Detection by Email
- Search for contacts sharing the same email address
- In dry-run: report duplicate clusters with record IDs
- In execute: merge duplicates keeping the record with the earliest createdate
- Primary record retains all associations

### 4. Empty Required Field Remediation
- Check for contacts/companies missing fields listed in {{REQUIRED_FIELDS}}
- In dry-run: report records with missing fields
- In execute: set default values from {{DEFAULT_VALUES}} map

## Script Template

```javascript
const fs = require("fs");
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const TOKEN = process.env.HUBSPOT_TOKEN;
const BASE = "https://api.hubapi.com";
const TARGET_OBJECT = "{{TARGET_OBJECT_TYPE}}";
const logFile = `log_${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}.jsonl`;

const CLEANUP_OPS = {{CLEANUP_OPERATIONS}};
// Example: ["phone_standardization", "email_normalization", "duplicate_detection", "empty_field_remediation"]

const REQUIRED_FIELDS = {{REQUIRED_FIELDS}};
// Example: ["firstname", "lastname", "email", "company"]

const DEFAULT_VALUES = {{DEFAULT_VALUES}};
// Example: { "lifecyclestage": "lead", "lead_source": "unknown" }

const DEFAULT_COUNTRY_CODE = "{{DEFAULT_COUNTRY_CODE}}";
// Example: "+1"

function log(entry) {
  fs.appendFileSync(logFile, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n");
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after") || 10);
    await new Promise(r => setTimeout(r, retry * 1000));
    return api(method, path, body);
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? {} : res.json();
}

function standardizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[^0-9+]/g, "");
  if (!cleaned.startsWith("+")) {
    cleaned = DEFAULT_COUNTRY_CODE + cleaned.replace(/^0+/, "");
  }
  return cleaned;
}

function normalizeEmail(email) {
  if (!email) return null;
  let normalized = email.trim().toLowerCase();
  const typoMap = {
    "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmaill.com": "gmail.com",
    "hotmai.com": "hotmail.com", "hotmal.com": "hotmail.com",
    "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com",
    "outloo.com": "outlook.com", "outlok.com": "outlook.com"
  };
  const domain = normalized.split("@")[1];
  if (domain && typoMap[domain]) {
    normalized = normalized.split("@")[0] + "@" + typoMap[domain];
  }
  return normalized;
}

async function getAllRecords(properties) {
  let results = [];
  let after = undefined;
  do {
    const params = new URLSearchParams({ limit: "100", properties: properties.join(",") });
    if (after) params.set("after", after);
    const data = await api("GET", `/crm/v3/objects/${TARGET_OBJECT}?${params}`);
    results = results.concat(data.results || []);
    after = data.paging?.next?.after;
  } while (after);
  return results;
}

async function main() {
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}`);
  console.log(`Target: ${TARGET_OBJECT}`);
  console.log(`Operations: ${CLEANUP_OPS.join(", ")}`);
  console.log(`Log file: ${logFile}\n`);

  // Implement selected cleanup operations
  // Each operation fetches records, analyzes, and optionally updates
}

main().catch(console.error);
```

## Output Format

The script itself is the output. It should be a complete, runnable Node.js script that:
1. Connects to HubSpot via API
2. Fetches target records
3. Applies selected cleanup operations
4. Logs all changes (dry-run or executed) to JSONL

## Tweak Parameters

- **{{TARGET_OBJECT_TYPE}}**: Object to clean — contacts, companies, deals, tickets (default: "contacts")
- **{{CLEANUP_OPERATIONS}}**: Array of operations to include (default: all four)
- **{{DEFAULT_COUNTRY_CODE}}**: Country code for phone standardization (default: "+1")
- **{{FLAG_PERSONAL_EMAILS}}**: Whether to flag personal email domains on business contacts (default: true)
- **{{REQUIRED_FIELDS}}**: Array of field names that should not be empty
- **{{DEFAULT_VALUES}}**: Object mapping field names to default values for remediation

## User Request

{{USER_REQUEST}}
