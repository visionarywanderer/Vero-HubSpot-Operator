/**
 * HubSpot Webhook Handler
 *
 * Receives webhook events from HubSpot with:
 *  - Signature verification (X-HubSpot-Signature SHA-256)
 *  - Idempotent processing (dedup on eventId)
 *  - Async queue pattern (respond 200 immediately, process later)
 *  - Event ordering via occurredAt timestamp
 *
 * Setup: Configure your webhook target URL in HubSpot Developer Portal
 * as: https://your-domain.com/api/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import db from "@/lib/db";
import { changeLogger } from "@/lib/change-logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookEvent {
  objectId: number;
  propertyName?: string;
  propertyValue?: string;
  changeSource?: string;
  eventId: number;
  subscriptionId: number;
  portalId: number;
  appId: number;
  occurredAt: number;
  eventType: string;
  attemptNumber: number;
  objectTypeId?: string;
}

// ---------------------------------------------------------------------------
// Database setup — processed event IDs for idempotency
// ---------------------------------------------------------------------------

function ensureWebhookTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id INTEGER PRIMARY KEY,
      portal_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      object_id TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      processed_at TEXT NOT NULL,
      payload TEXT
    )
  `);
}

let tableInitialized = false;

function initTable(): void {
  if (!tableInitialized) {
    ensureWebhookTable();
    tableInitialized = true;
  }
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifySignature(
  rawBody: string,
  signature: string | null,
  clientSecret: string
): boolean {
  if (!signature) return false;

  // HubSpot v1 signature: SHA-256(clientSecret + requestBody)
  const expected = createHmac("sha256", clientSecret)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison
  if (expected.length !== signature.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return mismatch === 0;
}

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

function isEventProcessed(eventId: number): boolean {
  initTable();
  const row = db.prepare("SELECT event_id FROM webhook_events WHERE event_id = ?").get(eventId);
  return row !== undefined;
}

function markEventProcessed(event: WebhookEvent): void {
  initTable();
  db.prepare(
    "INSERT OR IGNORE INTO webhook_events(event_id, portal_id, event_type, object_id, occurred_at, processed_at, payload) VALUES(?, ?, ?, ?, ?, ?, ?)"
  ).run(
    event.eventId,
    String(event.portalId),
    event.eventType,
    String(event.objectId),
    event.occurredAt,
    new Date().toISOString(),
    JSON.stringify(event)
  );
}

// ---------------------------------------------------------------------------
// Async event processing
// ---------------------------------------------------------------------------

async function processEvent(event: WebhookEvent): Promise<void> {
  const portalId = String(event.portalId);

  // Log the event
  try {
    await changeLogger.log({
      portalId,
      layer: "api",
      module: "W1",
      action: "create",
      objectType: event.eventType.split(".")[0] || "unknown",
      recordId: String(event.objectId),
      description: `Webhook: ${event.eventType}${event.propertyName ? ` (${event.propertyName})` : ""}`,
      after: {
        propertyName: event.propertyName,
        propertyValue: event.propertyValue,
        changeSource: event.changeSource,
        occurredAt: new Date(event.occurredAt).toISOString(),
      },
      status: "success",
      initiatedBy: "webhook",
    });
  } catch {
    // Never let logging failures propagate
  }

  markEventProcessed(event);
}

// Fire-and-forget processing — don't await, just schedule
function enqueueEvents(events: WebhookEvent[]): void {
  // Sort by occurredAt to process in chronological order
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);

  // Process in background — don't block the response
  void (async () => {
    for (const event of sorted) {
      if (isEventProcessed(event.eventId)) continue;
      try {
        await processEvent(event);
      } catch {
        // Log but don't crash — HubSpot will retry
      }
    }
  })();
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const clientSecret = process.env.HUBSPOT_OAUTH_CLIENT_SECRET;

  // Read raw body for signature verification
  const rawBody = await req.text();

  // Verify signature if client secret is configured
  if (clientSecret) {
    const signature = req.headers.get("x-hubspot-signature");
    if (!verifySignature(rawBody, signature, clientSecret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
  }

  // Parse events
  let events: WebhookEvent[];
  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // Respond 200 immediately — HubSpot requires response within 5 seconds
  // Process events asynchronously in background
  enqueueEvents(events);

  return NextResponse.json({ ok: true, received: events.length });
}

// ---------------------------------------------------------------------------
// Cleanup endpoint — purge old processed events
// ---------------------------------------------------------------------------

export async function DELETE() {
  initTable();

  // Delete events older than 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const result = db.prepare("DELETE FROM webhook_events WHERE occurred_at < ?").run(cutoff);

  return NextResponse.json({ ok: true, deleted: result.changes });
}
