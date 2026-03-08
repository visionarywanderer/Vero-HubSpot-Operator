# 16 — Production Readiness: Complete Fix & Finish List

## Context
The scaffold compiles and builds. Backend modules exist. Frontend is a skeleton. This document is the **exhaustive, ordered punch list** of everything that must be fixed, finished, or added before the Vero HubSpot Operator can go live with real client portals. Every item references the exact spec it comes from, the exact file that needs work, and the exact code the developer must write or change.

**Nothing is optional. If it's in this document, it ships before go-live.**

---

# PRIORITY TIER 1: BLOCKERS (Fix First — App Broken Without These)

These 8 items prevent the app from functioning correctly. Fix them in order.

---

## 1.1 — Middleware Breaks API Routes

**Problem**: `middleware.ts` redirects ALL unauthenticated requests to `/login`, including `/api/*` routes. When the frontend `fetch('/api/...')` call hits an expired session, it receives an HTML redirect (302 → `/login` page HTML) instead of a JSON `401`. This causes `JSON.parse` to throw, breaking every client-side API call silently.

**Spec Reference**: 15-frontend-dashboard.md, Part 5 (API Routes)

**File**: `middleware.ts`

**Fix**: Exempt all `/api/*` routes from the redirect. Return JSON 401 instead.

```typescript
// middleware.ts
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    // API routes: return JSON 401, never redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Session expired. Please sign in again.' },
        { status: 401 }
      );
    }
    // Page routes: redirect to login
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|icons|logo).*)'],
};
```

**Also add**: The OAuth callback route `/api/portals/callback` must also be in `PUBLIC_PATHS` since HubSpot redirects there before a portal-specific session exists.

**Test**: Sign out → open browser console → run `fetch('/api/portals').then(r => r.json())` → should return `{ error: "Unauthorized" }` as JSON, not an HTML page.

---

## 1.2 — Settings PATCH Contract Mismatch

**Problem**: The Settings page (`app/settings/page.tsx` line ~47) sends a `PATCH` request with `{ updates: { key: value, key: value } }` — a flat object of all changed fields. The backend API route (`app/api/portal-config/[portalId]/route.ts` line ~24) expects `{ path: "safety.maxBulkRecords", value: 5000 }` — a single dotted path + single value. Only one field saves per request, and the shape is wrong.

**Spec Reference**: 11-portal-config.md — `update(portalId, path, value)` interface

**Files**: `app/settings/page.tsx` AND `app/api/portal-config/[portalId]/route.ts`

**Fix — Option A (change the backend to accept batch updates, recommended)**:

```typescript
// app/api/portal-config/[portalId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { portalConfigStore } from '@/lib/portal-config';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { portalId: string } }
) {
  const { portalId } = params;
  const body = await req.json();

  // Support both single { path, value } and batch { updates: { path: value } }
  if (body.updates && typeof body.updates === 'object') {
    // Batch mode: apply each key-value pair
    for (const [path, value] of Object.entries(body.updates)) {
      await portalConfigStore.update(portalId, path, value);
    }
    const updated = await portalConfigStore.load(portalId);
    return NextResponse.json({ success: true, config: updated });
  }

  // Single mode: original contract
  if (body.path && body.value !== undefined) {
    await portalConfigStore.update(portalId, body.path, body.value);
    const updated = await portalConfigStore.load(portalId);
    return NextResponse.json({ success: true, config: updated });
  }

  return NextResponse.json(
    { error: 'Invalid body. Send { updates: { path: value } } or { path, value }' },
    { status: 400 }
  );
}
```

**Test**: Open Settings → change "Max Bulk Records" to 2000 → toggle "Allow Deletes" on → click Save → refresh page → values must persist.

---

## 1.3 — Chat Confirmation Cannot Confirm High-Risk Operations

**Problem**: The chat page (`app/chat/page.tsx` line ~51) sends `{ planId, confirmation: "confirm" }` for all confirmations. But the orchestrator (`lib/orchestrator.ts` line ~285) checks: if `risk === 'high'`, the confirmation value must be the **exact record/workflow ID** (e.g., `"1734596242"`), not the word `"confirm"`. This means all delete and high-risk operations silently fail with "Confirmation does not match required ID."

**Spec Reference**: 04-orchestrator.md — Confirmation Flow; 13-safety-rules.md — Rule 4

**Files**: `app/chat/page.tsx` (the confirm handler) AND the `PlanPreview` component

**Fix**: When `risk === 'high'`, render a text input inside the plan preview card where the user must type the exact ID. Pass that typed value as the confirmation.

```typescript
// In the PlanPreview component (components/chat/PlanPreview.tsx)
// Add state for high-risk confirmation input

interface PlanPreviewProps {
  plan: OrchestratorResult;
  onConfirm: (confirmation: string) => void;
  onCancel: () => void;
}

export function PlanPreview({ plan, onConfirm, onCancel }: PlanPreviewProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const isHighRisk = plan.risk === 'high';

  const borderColor = {
    none: 'border-gray-200',
    low: 'border-gray-300',
    medium: 'border-yellow-400',
    high: 'border-red-500',
  }[plan.risk];

  const handleConfirm = () => {
    if (isHighRisk) {
      onConfirm(confirmInput); // send the typed ID
    } else {
      onConfirm('confirm');    // send generic confirm
    }
  };

  return (
    <div className={`border-2 ${borderColor} rounded-xl p-4 bg-white`}>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-500" />
        <span className="font-semibold text-sm">OPERATION PLAN</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          plan.risk === 'high' ? 'bg-red-100 text-red-700' :
          plan.risk === 'medium' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {plan.risk} risk
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-2">{plan.intent}</p>

      <div className="space-y-1 mb-3">
        {plan.steps.map((step, i) => (
          <div key={i} className="text-xs text-gray-500 flex items-center gap-2">
            <span className="text-gray-400">{i + 1}.</span>
            <span>{step.action}</span>
            <span className="ml-auto text-gray-300">{step.tool}</span>
          </div>
        ))}
      </div>

      {plan.preview && (
        <p className="text-xs text-gray-500 mb-3">
          Records affected: {plan.preview}
        </p>
      )}

      {isHighRisk && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700 font-medium mb-2">
            ⚠️ This is a destructive operation. Type the exact ID to confirm:
          </p>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="Type the record/workflow ID here"
            className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={handleConfirm}
          disabled={isHighRisk && confirmInput.trim() === ''}
          className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${
            isHighRisk ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
          }`}>
          {isHighRisk ? 'Confirm Deletion' : 'Confirm & Execute'}
        </button>
      </div>
    </div>
  );
}
```

**In the chat page**: update the confirm handler to pass the value from the PlanPreview:

```typescript
// app/chat/page.tsx — in the confirm handler
const handleConfirm = async (planId: string, confirmation: string) => {
  const res = await fetch('/api/chat/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, confirmation }),  // confirmation is now the typed ID for high-risk
  });
  // ... handle response
};
```

**Test**: In chat, type "Delete workflow 1734596242" → Plan preview appears with red border → text input visible → type wrong ID → button stays disabled → type correct ID → confirm works.

---

## 1.4 — Dashboard Stats Hub ID Ignored + Deals Not Filtered

**Problem**: `app/api/stats/[hubId]/route.ts` (line ~31) doesn't use the `hubId` route parameter to select the correct portal token. It uses whatever the global active portal is. Also, open deals are not filtered (returns ALL deals), and pipeline value is hardcoded to `0`.

**Spec Reference**: 15-frontend-dashboard.md — PAGE 1: Dashboard

**File**: `app/api/stats/[hubId]/route.ts`

**Fix**:

```typescript
// app/api/stats/[hubId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authManager } from '@/lib/auth-manager';
import { apiClient } from '@/lib/api-client';

export async function GET(
  req: NextRequest,
  { params }: { params: { hubId: string } }
) {
  const { hubId } = params;

  try {
    // 1. Get token for THIS specific portal, not the globally active one
    const token = await authManager.getToken(hubId);
    const client = apiClient.withToken(token);

    // 2. Fetch counts in parallel
    const [contacts, companies, deals] = await Promise.all([
      client.get('/crm/v3/objects/contacts?limit=0'),
      client.get('/crm/v3/objects/companies?limit=0'),
      // 3. Filter to open deals only (exclude closedwon and closedlost)
      client.post('/crm/v3/objects/deals/search', {
        filterGroups: [{
          filters: [
            {
              propertyName: 'dealstage',
              operator: 'NOT_IN',
              values: ['closedwon', 'closedlost']
            }
          ]
        }],
        properties: ['amount'],
        limit: 0,  // just need total
      }),
    ]);

    // 4. Calculate total pipeline value from open deals
    // Note: search with limit=0 returns total but no results.
    // To get value, we need to fetch deals with amounts.
    // Use a separate search with limit=100 and aggregate.
    // For MVP, do a search with limit=100 and sum amounts:
    const dealsWithAmounts = await client.post('/crm/v3/objects/deals/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'dealstage',
          operator: 'NOT_IN',
          values: ['closedwon', 'closedlost']
        }]
      }],
      properties: ['amount'],
      limit: 100,
    });

    const totalPipelineValue = (dealsWithAmounts.data?.results || []).reduce(
      (sum: number, deal: any) => sum + (parseFloat(deal.properties?.amount) || 0),
      0
    );

    // 5. Get today's change count from logger
    const today = new Date().toISOString().split('T')[0];
    const { changeLogger } = await import('@/lib/change-logger');
    const todayLogs = await changeLogger.getLog(hubId, {
      dateFrom: `${today}T00:00:00Z`,
      dateTo: `${today}T23:59:59Z`,
    });

    return NextResponse.json({
      contacts: contacts.data?.total || 0,
      companies: companies.data?.total || 0,
      openDeals: deals.data?.total || 0,
      pipelineValue: totalPipelineValue,
      todayChanges: todayLogs.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error.message },
      { status: 500 }
    );
  }
}
```

**Test**: Connect a portal with known data → Dashboard shows correct contact/company/deal counts that match HubSpot UI → Pipeline value is non-zero for portals with deals that have amounts.

---

## 1.5 — Global Portal State Race Condition

**Problem**: `lib/auth-manager.ts` (line ~31) stores `activePortalId` in a single encrypted JSON file on the filesystem (`~/.vero/portals.enc`). If two team members use the app at the same time (even on the same Render instance), one person switching portals overwrites the other's active context. Person A is operating on Acme Corp, Person B switches to TechStart, and suddenly Person A's next operation hits TechStart.

**Spec Reference**: 01-auth-deployment-costs.md — PortalRecord schema; 15-frontend-dashboard.md — PortalContext

**Files**: `lib/auth-manager.ts`, `contexts/PortalContext.tsx`

**Fix**: Remove global `activePortalId` from the server-side store entirely. Active portal is a **client-side concern only**, stored in React context (already specified in 15-frontend-dashboard.md). Every API call must receive the `hubId` as a parameter — never read from global state.

**Step 1 — Backend**: Remove `activePortalId` from the portal store file. Every API route already receives `hubId` as a route parameter or request body field. The `authManager.getActivePortal()` method should be deleted. Replace all usages with explicit `hubId` parameter passing.

```typescript
// lib/auth-manager.ts — REMOVE these methods:
// setActivePortal(hubId: string): void    ← DELETE
// getActivePortal(): PortalRecord          ← DELETE

// KEEP these methods (they take hubId explicitly):
// getToken(hubId: string): Promise<string>
// listPortals(): Promise<PortalSummary[]>
// getScopes(hubId: string): string[]
// hasScope(hubId: string, scope: string): boolean
```

**Step 2 — Frontend**: The `PortalContext` (already in spec 15) handles active portal client-side:

```typescript
// contexts/PortalContext.tsx
'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Portal {
  hubId: string;
  name: string;
  environment: 'sandbox' | 'production';
  status: 'connected' | 'disconnected';
}

interface PortalContextType {
  activePortal: Portal | null;
  setActivePortal: (portal: Portal) => void;
  portals: Portal[];
  refreshPortals: () => Promise<void>;
}

const PortalContext = createContext<PortalContextType | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [activePortal, setActivePortalState] = useState<Portal | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);

  const setActivePortal = (portal: Portal) => {
    setActivePortalState(portal);
    // Persist in localStorage so it survives page refresh
    localStorage.setItem('vero_active_portal', JSON.stringify(portal));
  };

  const refreshPortals = async () => {
    const res = await fetch('/api/portals');
    if (res.ok) {
      const data = await res.json();
      setPortals(data.portals || []);
    }
  };

  useEffect(() => {
    // Restore from localStorage on mount
    const saved = localStorage.getItem('vero_active_portal');
    if (saved) {
      try { setActivePortalState(JSON.parse(saved)); } catch {}
    }
    refreshPortals();
  }, []);

  return (
    <PortalContext.Provider value={{ activePortal, setActivePortal, portals, refreshPortals }}>
      {children}
    </PortalContext.Provider>
  );
}

export const usePortal = () => {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used within PortalProvider');
  return ctx;
};
```

**Step 3 — Every API call from the frontend**: Always include `hubId` from context:

```typescript
// Example: chat page sending a prompt
const { activePortal } = usePortal();

const handleSend = async (prompt: string) => {
  if (!activePortal) {
    showToast('Select a portal first');
    return;
  }
  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt, portalId: activePortal.hubId }),
  });
};
```

**Step 4 — Audit every API route**: Ensure none of them call `authManager.getActivePortal()`. They must all read `portalId` / `hubId` from the request params or body. Search the codebase:

```bash
grep -rn "getActivePortal\|activePortalId" lib/ app/api/ --include="*.ts" --include="*.tsx"
```

Replace every hit with explicit parameter passing.

**Test**: Open two browser tabs → Tab A selects Acme Corp → Tab B selects TechStart → run an operation in Tab A → it must hit Acme Corp, not TechStart.

---

## 1.6 — OAuth Callback Flow Missing

**Problem**: The `/portals` page currently has a manual token input field where you paste a Private App token. The spec (01-auth-deployment-costs.md) requires a full OAuth flow: click "Connect" → opens HubSpot authorization → HubSpot redirects back to `/api/portals/callback` → app exchanges code for tokens → portal appears in list. The connect URL helper exists (`app/api/portals/connect/route.ts` line ~5) but the callback handler that exchanges the code is missing.

**Spec Reference**: 01-auth-deployment-costs.md — OAuth Callback Handler

**Files to create/modify**:
- `app/api/portals/callback/route.ts` — NEW: the OAuth callback handler
- `app/api/portals/connect/route.ts` — verify it generates the correct URL
- `app/portals/page.tsx` — replace manual token input with OAuth flow UI

**Callback handler** (new file):

```typescript
// app/api/portals/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { authManager } from '@/lib/auth-manager';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/portals?error=no_code', req.url));
  }

  try {
    // 1. Exchange code for tokens
    const tokenResp = await axios.post(
      'https://api.hubapi.com/oauth/v1/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
        code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenResp.data;

    // 2. Identify portal
    const infoResp = await axios.get(
      `https://api.hubapi.com/oauth/v1/access-tokens/${access_token}`
    );
    const { hub_id, user, scopes } = infoResp.data;

    // 3. Store in portal store
    await authManager.handleCallback({
      hubId: String(hub_id),
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      scopes,
      installedBy: user,
    });

    // 4. Redirect back to portals page with success
    return NextResponse.redirect(
      new URL(`/portals?connected=${hub_id}`, req.url)
    );
  } catch (error: any) {
    console.error('OAuth callback error:', error?.response?.data || error.message);
    return NextResponse.redirect(
      new URL(`/portals?error=oauth_failed&details=${encodeURIComponent(error.message)}`, req.url)
    );
  }
}
```

**Also add to middleware.ts PUBLIC_PATHS**: `'/api/portals/callback'` — HubSpot redirects here before any session exists for that portal.

**Test**: Click "Connect New Portal" → opens HubSpot in new tab → approve scopes → redirected back to `/portals?connected=12345` → portal appears in list.

---

## 1.7 — Missing npm Dependencies

**Problem**: `package.json` does not include the libraries specified in spec 15 that are required for the frontend to work.

**Spec Reference**: 15-frontend-dashboard.md — Part 5: Technical Stack

**File**: `package.json`

**Fix**: Run these installs:

```bash
# Core UI
npm install swr recharts react-markdown remark-gfm

# Syntax highlighting for code blocks
npm install prism-react-renderer

# shadcn/ui setup (if not already done)
npx shadcn-ui@latest init
npx shadcn-ui@latest add dialog dropdown-menu tabs table badge toast skeleton separator accordion

# Icons (should already be present but verify)
npm install lucide-react

# Markdown support in chat
npm install react-markdown remark-gfm

# Dev
npm install --save-dev @types/react-dom
```

**Verify after install**:
```bash
npm run build
```

Must pass with zero errors.

---

## 1.8 — No Error Handling on Frontend API Calls

**Problem**: Multiple pages (Dashboard quick actions at `app/page.tsx` line ~87, Bulk execute at `app/bulk/page.tsx` line ~35) call `fetch()` without checking response status or catching errors. If any API call fails, the UI shows nothing — no error message, no feedback, just silence.

**Fix**: Create a shared API helper that handles errors consistently:

```typescript
// lib/api.ts
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    // Session expired — redirect to login
    window.location.href = '/login';
    throw new ApiError('Session expired', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || body.message || 'Request failed', res.status);
  }

  return res.json();
}
```

**Then replace every raw `fetch()` call in all page files** with `apiFetch()`. Search for:

```bash
grep -rn "await fetch(" app/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v "api/"
```

Every hit must be replaced. Every call must have `.catch()` or `try/catch` that shows a toast or error state.

---

# PRIORITY TIER 2: MAJOR MISSING FEATURES (Build Next — Core UX Incomplete)

These features are specified in the specs but not yet implemented. The app is usable without them but unprofessional and limited.

---

## 2.1 — Chat Streaming (SSE)

**Current state**: `/api/chat/route.ts` (line ~15) is a simple request/response POST. No streaming.

**Spec Reference**: 15-frontend-dashboard.md — Part 5: Streaming for Chat

**What to build**:

The `/api/chat` endpoint must use Server-Sent Events to stream orchestrator progress. The frontend must consume the stream and render progressive updates.

**Backend** (`app/api/chat/route.ts`):

```typescript
import { NextRequest } from 'next/server';
import { orchestrator } from '@/lib/orchestrator';

export async function POST(req: NextRequest) {
  const { prompt, portalId } = await req.json();

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to write SSE events
  const sendEvent = async (type: string, data: any) => {
    const payload = JSON.stringify({ type, ...data });
    await writer.write(encoder.encode(`data: ${payload}\n\n`));
  };

  // Run orchestrator with callbacks
  (async () => {
    try {
      await sendEvent('thinking', { message: 'Analyzing your request...' });

      const plan = await orchestrator.processPrompt(prompt, portalId);

      await sendEvent('plan', {
        planId: plan.planId,
        intent: plan.intent,
        steps: plan.steps,
        risk: plan.risk,
        requiresConfirmation: plan.requiresConfirmation,
        preview: plan.preview,
      });

      // If no confirmation needed, execute immediately
      if (!plan.requiresConfirmation) {
        for (let i = 0; i < plan.steps.length; i++) {
          await sendEvent('step_start', {
            stepIndex: i,
            total: plan.steps.length,
            description: plan.steps[i].action,
          });

          const stepResult = await orchestrator.executeStep(plan.planId, i);

          await sendEvent('step_complete', {
            stepIndex: i,
            result: stepResult,
          });
        }

        await sendEvent('result', {
          success: true,
          summary: plan.preview,
        });
      }
      // If confirmation needed, the plan event is the final event.
      // The frontend will call /api/chat/confirm separately.
    } catch (error: any) {
      await sendEvent('error', {
        message: error.message,
        module: error.module || 'unknown',
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Frontend** (`hooks/useChat.ts`):

```typescript
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendPrompt = async (prompt: string, portalId: string) => {
    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setIsStreaming(true);

    // Create placeholder assistant message
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      blocks: [],
      isStreaming: true,
    }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, portalId }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));

          // Update the assistant message with new blocks
          setMessages(prev => prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, blocks: [...(msg.blocks || []), event] }
              : msg
          ));
        }
      }
    } catch (error: any) {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, blocks: [{ type: 'error', message: error.message }], isStreaming: false }
          : msg
      ));
    } finally {
      setIsStreaming(false);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId ? { ...msg, isStreaming: false } : msg
      ));
    }
  };

  return { messages, sendPrompt, isStreaming };
}
```

---

## 2.2 — All 7 Chat Block Renderers

**Current state**: Chat renders simple text message cards. No structured blocks.

**Spec Reference**: 15-frontend-dashboard.md — PAGE 2: Chat — Assistant Message Types (1–7)

**Create these components** in `components/chat/`:

| Component | Renders | Triggered by event type |
|---|---|---|
| `TextBlock.tsx` | Markdown-rendered text | `type: 'thinking'` or `type: 'result'` with text |
| `PlanPreview.tsx` | Operation plan with confirm/cancel (see 1.3 above) | `type: 'plan'` |
| `ResultsTable.tsx` | Sortable HTML table with status icons + Export CSV button | `type: 'result'` with `table` data |
| `CodeBlock.tsx` | Syntax-highlighted code with Copy/Download/DryRun buttons | `type: 'result'` with `code` data |
| `WorkflowSpec.tsx` | Visual workflow summary with View JSON toggle + Deploy button | `type: 'result'` with `workflow` data |
| `ProgressBlock.tsx` | Step-by-step progress (✅ / ⏳ / ○) with cancel button | `type: 'step_start'` / `type: 'step_complete'` |
| `ErrorBlock.tsx` | Red-bordered error card with retry + activity log link | `type: 'error'` |

**The MessageBubble component** must switch on block type:

```typescript
// components/chat/MessageBubble.tsx
function AssistantMessage({ blocks }: { blocks: ChatBlock[] }) {
  return (
    <div className="space-y-3 max-w-[85%]">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'thinking':     return <TextBlock key={i} text={block.message} />;
          case 'plan':         return <PlanPreview key={i} plan={block} onConfirm={...} onCancel={...} />;
          case 'step_start':
          case 'step_complete': return <ProgressBlock key={i} steps={...} currentStep={...} />;
          case 'result':
            if (block.table)    return <ResultsTable key={i} data={block.table} />;
            if (block.code)     return <CodeBlock key={i} code={block.code} filename={block.filename} />;
            if (block.workflow) return <WorkflowSpec key={i} spec={block.workflow} />;
            return <TextBlock key={i} text={block.summary || ''} />;
          case 'error':        return <ErrorBlock key={i} error={block} />;
          default:             return <TextBlock key={i} text={JSON.stringify(block)} />;
        }
      })}
    </div>
  );
}
```

Implement each component following the exact wireframe in spec 15, section PAGE 2.

---

## 2.3 — Prompt Library Sidebar in Chat

**Current state**: No prompt library sidebar. Users can only type free-form.

**Spec Reference**: 15-frontend-dashboard.md — PAGE 2: Prompt Library Sidebar

**Files to create**:
- `components/prompts/PromptSidebar.tsx` — collapsible 280px sidebar with search + categories
- `components/prompts/PromptCard.tsx` — individual prompt entry
- `components/prompts/PromptParamsModal.tsx` — parameter fill-in dialog for prompts with variables
- `app/api/prompts/route.ts` — serves prompt library from spec 12 JSON file

**Data**: Create `data/prompts.json` containing all 21 prompts from spec 12, structured as:

```json
[
  {
    "id": "audit-data-quality",
    "name": "Data Quality Audit",
    "category": "audit",
    "description": "Scan contacts for missing required fields and fill rates",
    "prompt": "Search all {objectType} and check for records missing...",
    "parameters": [
      { "name": "objectType", "label": "Object Type", "default": "contacts", "options": ["contacts", "companies", "deals"] }
    ],
    "tags": ["audit", "data quality"]
  }
]
```

**Behavior**: Click a prompt card → if it has parameters, open `PromptParamsModal` → user fills in values → filled prompt inserted into chat input → user hits send.

---

## 2.4 — Connect/Disconnect Modals on Portals Page

**Current state**: Basic portal list. No OAuth connect modal. No disconnect confirmation.

**Spec Reference**: 15-frontend-dashboard.md — PAGE 3: Portals

**Create**:
- `components/portals/ConnectModal.tsx` — contains client name input, environment selector, OAuth URL with copy button, "Open HubSpot Authorization" button
- `components/portals/DisconnectModal.tsx` — shows consequences, requires typing portal name to confirm, calls `DELETE /appinstalls/v3/external-install`
- `components/portals/PortalCard.tsx` — full card with status badge, hub ID, environment, dates, action buttons

Follow the exact wireframes in spec 15, PAGE 3.

---

## 2.5 — Activity Log Full Implementation

**Current state**: Basic table. No filters, no expandable rows, no export.

**Spec Reference**: 15-frontend-dashboard.md — PAGE 10: Activity Log

**Create/update**:
- `components/activity/ActivityFilters.tsx` — date range picker, action type filter, object type filter, status filter
- `components/activity/ActivityTable.tsx` — sortable columns, click-to-expand rows
- `components/activity/ActivityDetail.tsx` — expanded row showing before/after values, original prompt, module, duration
- `app/api/activity/export/route.ts` — returns CSV file download

**The filter bar sends query params to `/api/activity`:**

```
GET /api/activity?portalId=123&dateFrom=2026-03-01&dateTo=2026-03-08&action=update&objectType=contact&status=success
```

---

## 2.6 — Settings Page: All Three Tabs

**Current state**: Settings has placeholder text and only partial portal config form.

**Spec Reference**: 15-frontend-dashboard.md — PAGE 11: Settings

**Tab 1: Portal Configuration** — build the complete form matching spec 11-portal-config.md. Sections: Mappings (lifecycle + deal stage tables), Custom Properties, Owners (dropdown from HubSpot owners), Conventions (prefix inputs), Forms & Templates, Safety (toggles). Include "Auto-Discover" button that calls `POST /api/portals/{hubId}/discover`.

**Tab 2: App Settings** — LLM model selection dropdown (Haiku/Sonnet/Opus), default routing model, default generation model, prompt caching toggle, monthly spend limit input.

**Tab 3: Users (Admin)** — table of allowed emails. Add/remove. Store in env var or database.

---

# PRIORITY TIER 3: FEATURE COMPLETION (Build After Core Works)

These complete the full spec. Each maps directly to a spec page.

---

## 3.1 — Audits Page with Inline Results

**Spec**: 15-frontend-dashboard.md — PAGE 4

Build: 6 audit cards in a grid. Each has "Run Audit" button that sends the prompt and shows results inline below the card (expandable section). Cache previous results with "Last run" date.

## 3.2 — Workflows Page with Templates + Existing List

**Spec**: 15-frontend-dashboard.md — PAGE 5

Build: Tab 1 fetches `GET /automation/v4/flows` and displays in a table. Tab 2 shows 4 template cards + free-text input. "Generate" sends to orchestrator. Results render as WorkflowSpec block with Deploy button.

## 3.3 — Properties Page with Fill Rate Bars

**Spec**: 15-frontend-dashboard.md — PAGE 6

Build: Object type tabs (Contacts/Companies/Deals/Tickets). Each tab fetches `GET /crm/v3/properties/{objectType}`. Display with FillRateBar component (green/yellow/red). Create property form. Audit tab.

## 3.4 — Lists Page

**Spec**: 15-frontend-dashboard.md — PAGE 7

Build: Existing lists table. Create list tab with templates and free-text. Preview filter criteria before creation.

## 3.5 — Pipelines Kanban View

**Spec**: 15-frontend-dashboard.md — PAGE 8

Build: Horizontal kanban displaying stages with deal count + total value per stage. Alternate table view.

## 3.6 — Bulk Operations with Execution Panel

**Spec**: 15-frontend-dashboard.md — PAGE 9

Build: Template cards. Script viewer with syntax highlighting (Prism). Execution panel with real-time progress bar, dry-run mode, and "Execute for Real" button that only appears after dry-run.

---

# PRIORITY TIER 4: PRODUCTION HARDENING

---

## 4.1 — Move Storage from Filesystem to SQLite

**Problem**: Portal tokens, change logs, portal configs, and generated artifacts are stored as files in `~/.vero/`. This breaks on Render (filesystem resets on deploy) and doesn't support multiple instances.

**Fix**: Replace all file-based stores with SQLite using `better-sqlite3`:

```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

Create `lib/db.ts`:

```typescript
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'vero.db');
const db = new Database(DB_PATH);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS portals (
    hub_id TEXT PRIMARY KEY,
    name TEXT,
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    expires_at INTEGER,
    scopes TEXT,
    installed_by TEXT,
    installed_at TEXT,
    status TEXT DEFAULT 'connected',
    environment TEXT DEFAULT 'sandbox',
    last_used TEXT
  );

  CREATE TABLE IF NOT EXISTS change_log (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    portal_id TEXT NOT NULL,
    layer TEXT,
    module TEXT,
    action TEXT,
    object_type TEXT,
    record_id TEXT,
    description TEXT,
    before_value TEXT,
    after_value TEXT,
    status TEXT,
    error TEXT,
    initiated_by TEXT,
    prompt TEXT
  );

  CREATE TABLE IF NOT EXISTS portal_config (
    portal_id TEXT PRIMARY KEY,
    config TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL,
    type TEXT NOT NULL,
    filename TEXT,
    content TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    role TEXT DEFAULT 'operator',
    added_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_changelog_portal ON change_log(portal_id);
  CREATE INDEX IF NOT EXISTS idx_changelog_timestamp ON change_log(timestamp);
  CREATE INDEX IF NOT EXISTS idx_artifacts_portal ON artifacts(portal_id);
`);

export default db;
```

Then update `lib/auth-manager.ts`, `lib/change-logger.ts`, `lib/portal-config.ts` to use `db.prepare().get()` / `.run()` / `.all()` instead of `fs.readFileSync` / `fs.writeFileSync`.

**For Render**: Add a persistent disk (Render Disks, $0.25/GB/month) mounted at `/data`, or use Render's built-in PostgreSQL ($7/month). SQLite on persistent disk is the cheapest option for your scale.

---

## 4.2 — Token Encryption at Rest

**Spec Reference**: 01-auth-deployment-costs.md — Security Rules

Encrypt `refresh_token` in the database using AES-256-GCM with a key from the `ENCRYPTION_KEY` env var:

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encrypted] = data.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

Generate the key once: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` → add to `.env` as `ENCRYPTION_KEY`.

---

## 4.3 — Rate Limiter Enforcement

**Spec Reference**: 02-api-client.md; 13-safety-rules.md — Rule 6

Verify the API client enforces the token bucket rate limiter. The following must be true:

- Standard API: max 100 requests per 10 seconds
- Search API: max 4 requests per second (separate limiter)
- On HTTP 429: pause ALL requests for `Retry-After` seconds, log the pause
- Batch endpoints: max 10 records per request

**Test**: Run a script that makes 150 rapid requests → verify that requests 101+ are queued, not rejected or sent.

---

## 4.4 — Safety Rule Enforcement Audit

Go through every safety rule in spec 13 and verify enforcement. Use this checklist:

```
For each backend module (lib/*.ts):

□ Rule 1:  Sandbox check — does the module check portalConfig.environment 
           before writes?
□ Rule 2:  Dry-run — does the script engine enforce --dry-run first?
□ Rule 3:  Workflows disabled — does workflow engine reject isEnabled: true?
□ Rule 4:  Delete confirmation — does orchestrator require exact ID for 
           high-risk?
□ Rule 5:  Change logging — does every write operation call changeLogger.log()?
□ Rule 6:  Rate limiting — does every API call go through the rate-limited 
           client?
□ Rule 7:  Human review — is requiresConfirmation true for all write 
           operations?
□ Rule 8:  Scope check — does orchestrator check hasScope() before routing?
□ Rule 9:  No tokens in prompts — are LLM calls free of actual token values?
□ Rule 10: Artifact versioning — are generated specs/scripts saved with 
           timestamps?
```

**Every unchecked box is a bug to fix before go-live.**

---

## 4.5 — CSRF Protection for Mutation Routes

All POST/PATCH/DELETE API routes should verify the `Origin` header matches the app domain:

```typescript
// lib/csrf.ts
export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return false;
  const originHost = new URL(origin).host;
  return originHost === host;
}
```

Add to all mutation API routes:

```typescript
if (req.method !== 'GET' && !validateOrigin(req)) {
  return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
}
```

---

## 4.6 — Loading States & Skeletons

Every page that fetches data on load must show a skeleton while loading:

- Dashboard: 4 skeleton stat cards + skeleton activity list
- Portals: skeleton portal cards
- Activity: skeleton table rows
- Properties/Lists/Pipelines/Workflows: skeleton tables

Use shadcn's `<Skeleton />` component.

---

## 4.7 — Toast Notifications

Install and configure shadcn toast. Fire toasts for:
- Portal connected successfully
- Portal disconnected
- Operation confirmed and executed
- Operation failed (red toast with error message)
- Settings saved
- CSV exported

---

## 4.8 — Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `/` | Focus chat input |
| `Esc` | Close active modal |
| `Ctrl+K` | Open portal switcher |

Use `useEffect` with `keydown` listener in the layout component.

---

# PRIORITY TIER 5: PRE-LAUNCH CHECKLIST

Run through this the day before going live:

```
INFRASTRUCTURE
□ Render service running on at least Starter plan ($7/mo) for always-on
□ Persistent disk mounted at /data for SQLite
□ All env vars set in Render dashboard:
  □ HUBSPOT_CLIENT_ID
  □ HUBSPOT_CLIENT_SECRET
  □ HUBSPOT_REDIRECT_URI (matches Render URL exactly)
  □ ANTHROPIC_API_KEY
  □ NEXTAUTH_SECRET (generated: openssl rand -base64 32)
  □ NEXTAUTH_URL (full Render URL with https)
  □ GOOGLE_CLIENT_ID (for Google OAuth login)
  □ GOOGLE_CLIENT_SECRET
  □ ENCRYPTION_KEY (generated: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  □ ALLOWED_EMAILS (comma-separated verodigital.co emails)
  □ DATABASE_PATH=/data/vero.db
□ HubSpot OAuth app redirect URL updated to Render URL
□ Google OAuth consent screen redirect URL updated to Render URL
□ Anthropic spend limit set to $25/month

FUNCTIONAL
□ Can sign in with Google (verodigital.co only)
□ Non-verodigital.co email gets rejected
□ Can connect a sandbox portal via OAuth
□ Portal appears in list after OAuth callback
□ Can switch between portals
□ Can type a prompt in chat and get a streaming response
□ Plan preview shows for write operations
□ High-risk operations require ID confirmation
□ Can disconnect a portal (app removed from HubSpot, client gets email)
□ Activity log shows all changes with correct timestamps
□ Settings save and persist across page refreshes
□ Dashboard stats match HubSpot UI numbers

SAFETY
□ Sandbox-first check blocks writes on new production portals
□ Workflow deploy sets isEnabled: false
□ Bulk scripts require dry-run before execute
□ Delete operations require exact ID typed
□ Every write operation appears in activity log
□ Rate limiter prevents 429 errors under normal use
□ No tokens visible in any frontend network requests
□ No tokens in browser localStorage (only portal metadata, no secrets)

PERFORMANCE
□ Chat response starts streaming within 2 seconds
□ Dashboard loads within 3 seconds on warm server
□ Cold start (after sleep) completes within 60 seconds
□ No console errors in browser dev tools during normal use
```

---

**Total estimated work**: 15–20 developer days for Tiers 1–2 (must-have). 8–10 more days for Tiers 3–5 (complete).
