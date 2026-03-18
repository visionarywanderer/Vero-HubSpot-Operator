"use client";

import Link from "next/link";

/* ──────────────────────────────────────────────── */
/*  SVG Icons (Lucide-style, 24x24, stroke 1.5)    */
/* ──────────────────────────────────────────────── */

function Icon({ children, size = 20, color = "currentColor" }: { children: React.ReactNode; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconBrain({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2-1 2.7.6.7 1 1.6 1 2.7a4 4 0 0 1-2 3.4V20a2 2 0 0 1-4 0v-5.2A4 4 0 0 1 8 11.4c0-1.1.4-2 1-2.7C8.4 8 8 7.1 8 6a4 4 0 0 1 4-4z" /><path d="M12 2v4" /><path d="M12 10v2" /></Icon>;
}
function IconFileText({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></Icon>;
}
function IconRuler({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M21.7 3.3a1 1 0 0 0-1.4 0l-17 17a1 1 0 0 0 0 1.4l1 1a1 1 0 0 0 1.4 0l17-17a1 1 0 0 0 0-1.4l-1-1z" /><path d="m7.5 13.5 1 1" /><path d="m10.5 10.5 1 1" /><path d="m13.5 7.5 1 1" /><path d="m16.5 4.5 1 1" /></Icon>;
}
function IconDatabase({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></Icon>;
}
function IconMonitor({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></Icon>;
}
function IconShield({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>;
}
function IconBarChart({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Icon>;
}
function IconLink({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Icon>;
}
function IconZap({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Icon>;
}
function IconSearch({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>;
}
function IconTarget({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Icon>;
}
function IconPackage({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M16.5 9.4l-9-5.19" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></Icon>;
}
function IconTag({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></Icon>;
}
function IconGitBranch({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></Icon>;
}
function IconUsers({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
}
function IconCheckCircle({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Icon>;
}
function IconLock({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>;
}
function IconFlask({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><path d="M9 3h6" /><path d="M10 3v7.4a2 2 0 0 1-.6 1.4L4 17.2a2 2 0 0 0-.6 1.4V20a2 2 0 0 0 2 2h13.2a2 2 0 0 0 2-2v-1.4a2 2 0 0 0-.6-1.4l-5.4-5.4a2 2 0 0 1-.6-1.4V3" /></Icon>;
}
function IconRefresh({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" /></Icon>;
}
function IconGrid({ size = 20, color = "currentColor" }) {
  return <Icon size={size} color={color}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></Icon>;
}

/* ──────────────────────────────────────────────── */
/*  Reusable visual components                      */
/* ──────────────────────────────────────────────── */

function Connector({ height = 32, dashed }: { height?: number; dashed?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
      <svg width="2" height={height} viewBox={`0 0 2 ${height}`}>
        <line x1="1" y1="0" x2="1" y2={height}
          stroke="var(--line)" strokeWidth="1.5"
          strokeDasharray={dashed ? "4,4" : "none"} />
      </svg>
    </div>
  );
}

function ConnectorLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, padding: "4px 0" }}>
      <svg width="2" height="12"><line x1="1" y1="0" x2="1" y2="12" stroke="var(--line)" strokeWidth="1.5" /></svg>
      <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 0.5, textTransform: "uppercase", padding: "2px 0" }}>{label}</span>
      <svg width="2" height="12"><line x1="1" y1="0" x2="1" y2="12" stroke="var(--line)" strokeWidth="1.5" /></svg>
    </div>
  );
}

function FlowNode({ icon, title, subtitle, accent, small }: {
  icon: React.ReactNode; title: string; subtitle?: string; accent?: boolean; small?: boolean;
}) {
  return (
    <div style={{
      background: accent ? "var(--accent-dim)" : "var(--card)",
      border: `1px solid ${accent ? "var(--accent-border)" : "var(--line)"}`,
      borderRadius: "var(--radius-lg)",
      padding: small ? "10px 14px" : "14px 18px",
      textAlign: "center",
      minWidth: small ? 110 : 150,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    }}>
      <div style={{ color: accent ? "var(--accent)" : "var(--ink-secondary)" }}>{icon}</div>
      <div style={{
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        color: accent ? "var(--accent)" : "var(--ink)",
      }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: "var(--muted)" }}>{subtitle}</div>}
    </div>
  );
}

function HorizConnector() {
  return (
    <svg width="28" height="2" style={{ flexShrink: 0, opacity: 0.4 }}>
      <line x1="0" y1="1" x2="28" y2="1" stroke="var(--muted)" strokeWidth="1.5" />
    </svg>
  );
}

function StepCard({ number, title, description, children }: {
  number: number; title: string; description: string; children?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ position: "relative", paddingLeft: 60 }}>
      <div style={{
        position: "absolute", left: 16, top: 18,
        width: 28, height: 28, borderRadius: "50%",
        background: "var(--accent)", color: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700,
      }}>{number}</div>
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>{title}</h3>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.6 }}>{description}</p>
      {children}
    </div>
  );
}

function SkillBadge({ name, color }: { name: string; color: string }) {
  return (
    <span style={{
      display: "inline-block",
      fontSize: 11, fontWeight: 500,
      padding: "3px 10px",
      borderRadius: 6,
      background: "var(--bg-raised)",
      color: color,
      border: `1px solid ${color}`,
      opacity: 0.85,
    }}>{name}</span>
  );
}

function PageLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 12, color: "var(--accent)", textDecoration: "none",
    }}>
      {label} <span style={{ fontSize: 10 }}>&#8594;</span>
    </Link>
  );
}

/* ──────────────────────────────────────────────── */
/*  Main page                                        */
/* ──────────────────────────────────────────────── */

export default function HowItWorksPage() {
  return (
    <div className="stack" style={{ gap: 28, maxWidth: 900 }}>

      {/* ═══ HERO ═══ */}
      <div>
        <h1 className="page-title" style={{ fontSize: 26 }}>How It Works</h1>
        <p className="page-subtitle" style={{ fontSize: 14, maxWidth: 600 }}>
          From meeting notes to a fully configured HubSpot portal — in minutes, not days.
        </p>
        <div className="accent-stripe" />
      </div>

      {/* ═══ THREE-LAYER ARCHITECTURE ═══ */}
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, letterSpacing: -0.3 }}>
          Three-Layer Architecture
        </h2>

        {/* Layer 1: Claude */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12, flexWrap: "wrap", padding: "18px 16px",
          background: "var(--accent-dim)",
          border: "1px solid var(--accent-border)",
          borderRadius: "var(--radius-lg)",
        }}>
          <div style={{ width: "100%", textAlign: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--accent)", fontWeight: 600 }}>
              Layer 1 &mdash; AI Brain
            </span>
          </div>
          <FlowNode icon={<IconBrain size={22} />} title="Claude Code" subtitle="Your interface" accent />
          <HorizConnector />
          <FlowNode icon={<IconFileText size={18} />} title="Skills" subtitle="8 specialized" accent small />
          <HorizConnector />
          <FlowNode icon={<IconRuler size={18} />} title="Constraints" subtitle="Validation rules" accent small />
        </div>

        <ConnectorLabel label="Drafts via MCP" />

        {/* Layer 2: App */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12, flexWrap: "wrap", padding: "18px 16px",
          background: "var(--info-bg)",
          border: "1px solid rgba(126, 200, 232, 0.12)",
          borderRadius: "var(--radius-lg)",
        }}>
          <div style={{ width: "100%", textAlign: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--info)", fontWeight: 600 }}>
              Layer 2 &mdash; Vero App
            </span>
          </div>
          <FlowNode icon={<IconDatabase size={18} />} title="Draft Store" subtitle="SQLite" small />
          <HorizConnector />
          <FlowNode icon={<IconMonitor size={18} />} title="App UI" subtitle="Review & deploy" small />
          <HorizConnector />
          <FlowNode icon={<IconShield size={18} />} title="Safety Layer" subtitle="Governance" small />
        </div>

        <ConnectorLabel label="API calls" />

        {/* Layer 3: HubSpot */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12, flexWrap: "wrap", padding: "18px 16px",
          background: "var(--success-bg)",
          border: "1px solid rgba(126, 203, 160, 0.12)",
          borderRadius: "var(--radius-lg)",
        }}>
          <div style={{ width: "100%", textAlign: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--success)", fontWeight: 600 }}>
              Layer 3 &mdash; HubSpot
            </span>
          </div>
          <FlowNode icon={<IconBarChart size={18} />} title="CRM v3" subtitle="Properties, Objects" small />
          <HorizConnector />
          <FlowNode icon={<IconLink size={18} />} title="Associations v4" subtitle="Record links" small />
          <HorizConnector />
          <FlowNode icon={<IconZap size={18} />} title="Automation v4" subtitle="Workflows" small />
        </div>
      </div>

      {/* ═══ THE SKILL CHAIN ═══ */}
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, letterSpacing: -0.3 }}>
          The Skill Chain
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
          Paste meeting notes in Claude Code. The system analyses them and chains through each skill in dependency order.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center" }}>
          {/* Entry */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 520,
          }}>
            <div style={{ color: "var(--accent)", flexShrink: 0 }}><IconFileText size={22} /></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>Meeting Notes</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Paste client call notes, requirements, or CRM plans into Claude Code</div>
            </div>
          </div>

          <ConnectorLabel label="Analysis skill" />

          {/* Analysis */}
          <div style={{
            padding: "12px 18px",
            background: "var(--card)", border: "1px solid var(--accent-border)",
            borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 520,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ color: "var(--ink-secondary)", flexShrink: 0 }}><IconSearch size={22} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Analyse &amp; Plan</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Extracts fields, processes, automations, segments. Checks dependencies &amp; tier limits.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <SkillBadge name="Gap Analysis" color="var(--warning)" />
              <SkillBadge name="Tier Check" color="var(--info)" />
              <SkillBadge name="Alternatives" color="var(--success)" />
              <SkillBadge name="Risk Flags" color="var(--danger)" />
            </div>
          </div>

          <ConnectorLabel label="Reads existing portal" />

          {/* Portal Scan */}
          <div style={{
            padding: "12px 18px",
            background: "var(--info-bg)", border: "1px solid rgba(126, 200, 232, 0.12)",
            borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 520,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ color: "var(--info)", flexShrink: 0 }}><IconSearch size={22} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--info)" }}>Duplicate Check</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Reads existing properties, pipelines, workflows &amp; lists from portal. Flags exact matches, similar names &amp; missing dependencies.</div>
              </div>
            </div>
          </div>

          <ConnectorLabel label="You approve the plan" />

          {/* Execution chain */}
          <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { num: 1, label: "Property Groups", desc: "Custom groups created first", page: "/properties", color: "var(--accent)" },
              { num: 2, label: "Properties", desc: "Custom fields, dropdowns, dates", page: "/properties", color: "var(--accent)" },
              { num: 3, label: "Pipelines", desc: "Deal stages, ticket stages", page: "/pipelines", color: "var(--info)" },
              { num: 4, label: "Lists & Segments", desc: "Dynamic audiences, filters", page: "/lists", color: "var(--success)" },
              { num: 5, label: "Workflows", desc: "Automations, triggers, actions", page: "/workflows", color: "var(--warning)" },
            ].map((step, i) => (
              <div key={step.num}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  background: "var(--card)", border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  borderLeft: `3px solid ${step.color}`,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: "var(--bg-raised)", color: step.color,
                    border: `1.5px solid ${step.color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{step.num}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{step.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{step.desc}</div>
                  </div>
                  <PageLink href={step.page} label="Deploy" />
                </div>
                {i < 4 && <Connector height={8} />}
              </div>
            ))}
          </div>

          <ConnectorLabel label="Optional" />

          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
            background: "var(--card)", border: "1px dashed var(--accent-border)",
            borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 520,
          }}>
            <div style={{ color: "var(--ink-secondary)", flexShrink: 0 }}><IconPackage size={22} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Bundle as Template</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Save everything as a reusable template for cloning to other portals</div>
            </div>
            <PageLink href="/templates" label="Templates" />
          </div>
        </div>
      </div>

      {/* ═══ QUICK START: 5 STEPS ═══ */}
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, letterSpacing: -0.3 }}>
          Quick Start
        </h2>

        <div className="stack" style={{ gap: 12 }}>
          <StepCard
            number={1}
            title="Connect a HubSpot Portal"
            description="Go to the Portals page and click Connect. Authorize with your HubSpot account. The app stores OAuth tokens locally and refreshes them automatically."
          >
            <PageLink href="/portals" label="Go to Portals" />
          </StepCard>

          <StepCard
            number={2}
            title="Talk to Claude Code"
            description="Open Claude Code and describe what you need. Paste meeting notes, ask for a pipeline, request properties, or describe a full CRM setup. Claude understands HubSpot and generates valid specs automatically."
          >
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <SkillBadge name="&quot;Create a SaaS pipeline&quot;" color="var(--info)" />
              <SkillBadge name="&quot;Add lead source field&quot;" color="var(--accent)" />
              <SkillBadge name="&quot;Build a trial workflow&quot;" color="var(--warning)" />
            </div>
          </StepCard>

          <StepCard
            number={3}
            title="Review the Plan"
            description="Claude generates a structured plan showing exactly what will be created. Review it, ask questions, request changes. Nothing is created until you approve."
          >
            <div className="card" style={{
              padding: "10px 12px", fontSize: 12, color: "var(--ink-secondary)",
              fontFamily: "var(--font-mono)", background: "var(--bg)", lineHeight: 1.7,
            }}>
              <div style={{ color: "var(--muted)" }}># Implementation Plan</div>
              <div><span style={{ color: "var(--accent)" }}>Properties:</span> lead_source, mrr_value, trial_start</div>
              <div><span style={{ color: "var(--info)" }}>Pipeline:</span> SaaS Sales (7 stages)</div>
              <div><span style={{ color: "var(--warning)" }}>Workflow:</span> Trial Start → Create Task</div>
              <div><span style={{ color: "var(--success)" }}>List:</span> Active Trialists (dynamic)</div>
            </div>
          </StepCard>

          <StepCard
            number={4}
            title="Drafts Are Saved to the App"
            description="When you approve, Claude saves each resource as a draft via MCP. Drafts are stored locally — nothing is pushed to HubSpot yet."
          />

          <StepCard
            number={5}
            title="Deploy to HubSpot"
            description="Click Deploy on each page to push drafts to your HubSpot portal. The app validates, applies safety checks, and creates the resources. Everything is logged."
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 14px", borderRadius: "var(--radius-md)",
              background: "var(--success-bg)", marginTop: 4,
            }}>
              <IconCheckCircle size={16} color="var(--success)" />
              <span style={{ fontSize: 12, color: "var(--success)" }}>
                Workflows deploy disabled. Bulk scripts require dry-run before execute.
              </span>
            </div>
          </StepCard>
        </div>
      </div>

      {/* ═══ WHAT CAN YOU ASK CLAUDE? ═══ */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: -0.3 }}>
          What Can You Ask Claude?
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {[
            { category: "Meeting Notes", color: "var(--accent)", examples: ["Here are my notes from the call with Acme Corp...", "The client needs a B2B SaaS CRM setup", "Analyse these requirements and create a plan"] },
            { category: "Properties", color: "var(--info)", examples: ["Create a lead source dropdown for contacts", "Add MRR and ARR number fields to companies", "Build a custom property group for SaaS metrics"] },
            { category: "Pipelines", color: "var(--success)", examples: ["Build a 7-stage SaaS sales pipeline", "Create a support ticket pipeline", "Add a renewal pipeline for deals"] },
            { category: "Workflows", color: "var(--warning)", examples: ["When a trial starts, create a follow-up task", "Set lifecycle stage when lead score hits 80", "Send notification when deal moves to Proposal"] },
            { category: "Lists & Segments", color: "#b39ddb", examples: ["Create a list of all MQLs from last 30 days", "Segment contacts by product interest", "Build a suppression list for churned customers"] },
          ].map((cat) => (
            <div key={cat.category} style={{
              padding: "12px 14px", borderRadius: "var(--radius-md)",
              border: "1px solid var(--line)",
              borderLeft: `3px solid ${cat.color}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: cat.color, marginBottom: 8 }}>
                {cat.category}
              </div>
              {cat.examples.map((ex) => (
                <div key={ex} style={{
                  fontSize: 12, color: "var(--ink-secondary)",
                  padding: "4px 0", borderBottom: "1px solid var(--line-subtle)",
                  fontStyle: "italic",
                }}>
                  &ldquo;{ex}&rdquo;
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SAFETY & GOVERNANCE ═══ */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: -0.3 }}>
          Safety &amp; Governance
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {[
            { icon: <IconShield size={18} />, title: "Sandbox-First", desc: "New production portals require session validation before writes" },
            { icon: <IconLock size={18} />, title: "Workflows Deploy Disabled", desc: "All workflows are created with isEnabled=false for manual review" },
            { icon: <IconFlask size={18} />, title: "Dry-Run Required", desc: "Bulk scripts must run in dry-run mode before actual execution" },
            { icon: <IconFileText size={18} />, title: "Full Audit Trail", desc: "Every action is logged with timestamp, user, portal, and details" },
            { icon: <IconSearch size={18} />, title: "Duplicate Detection", desc: "Every draft is checked against existing portal resources and pending drafts" },
            { icon: <IconCheckCircle size={18} />, title: "Pre-Flight Validation", desc: "Each skill runs 10-17 validation checks before saving a draft" },
            { icon: <IconRefresh size={18} />, title: "Draft, Review, Deploy", desc: "Nothing goes to HubSpot without your explicit deploy action" },
          ].map((item) => (
            <div key={item.title} style={{
              display: "flex", gap: 12, padding: "10px 0",
              borderBottom: "1px solid var(--line-subtle)",
            }}>
              <div style={{ color: "var(--muted)", flexShrink: 0, paddingTop: 1 }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FULL SKILL MAP ═══ */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, letterSpacing: -0.3 }}>
          Skill Map
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
          8 skills work together. The orchestrator routes your request to the right ones.
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {/* Orchestrator */}
          <div style={{
            padding: "14px 22px", borderRadius: "var(--radius-lg)",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            textAlign: "center", width: "100%", maxWidth: 440,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
            <IconTarget size={22} color="var(--accent)" />
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>Master Orchestrator</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Routes requests, resolves dependencies, manages execution order</div>
          </div>

          <Connector height={20} />

          {/* Analysis */}
          <div style={{
            padding: "12px 18px", borderRadius: "var(--radius-lg)",
            border: "1px solid var(--accent-border)",
            background: "var(--card)", textAlign: "center",
            width: "100%", maxWidth: 440,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
            <IconSearch size={20} color="var(--ink-secondary)" />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Meeting Notes Analyst</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Extracts requirements, produces structured plan</div>
          </div>

          {/* Branching connector */}
          <svg width="100%" height="24" style={{ maxWidth: 440 }}>
            <line x1="50%" y1="0" x2="50%" y2="12" stroke="var(--line)" strokeWidth="1.5" />
            <line x1="16.6%" y1="12" x2="83.3%" y2="12" stroke="var(--line)" strokeWidth="1.5" />
            <line x1="16.6%" y1="12" x2="16.6%" y2="24" stroke="var(--line)" strokeWidth="1.5" />
            <line x1="50%" y1="12" x2="50%" y2="24" stroke="var(--line)" strokeWidth="1.5" />
            <line x1="83.3%" y1="12" x2="83.3%" y2="24" stroke="var(--line)" strokeWidth="1.5" />
          </svg>

          {/* Resource skills grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
            width: "100%",
          }}>
            {[
              { icon: <IconTag size={20} />, name: "Properties", tool: "save_property_draft", color: "var(--accent)", page: "/properties" },
              { icon: <IconGitBranch size={20} />, name: "Pipelines", tool: "save_pipeline_draft", color: "var(--info)", page: "/pipelines" },
              { icon: <IconZap size={20} />, name: "Workflows", tool: "save_workflow_draft", color: "var(--warning)", page: "/workflows" },
              { icon: <IconUsers size={20} />, name: "Lists", tool: "save_list_draft", color: "var(--success)", page: "/lists" },
              { icon: <IconPackage size={20} />, name: "Templates", tool: "save_template_draft", color: "#b39ddb", page: "/templates" },
            ].map((s) => (
              <Link key={s.name} href={s.page} style={{
                padding: "14px 10px", borderRadius: "var(--radius-md)",
                border: "1px solid var(--line)",
                borderTop: `2px solid ${s.color}`,
                textAlign: "center", textDecoration: "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                transition: "border-color var(--transition), background var(--transition)",
              }}>
                <div style={{ color: s.color }}>{s.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{s.name}</div>
                <div style={{
                  fontSize: 10, color: "var(--muted)",
                  fontFamily: "var(--font-mono)",
                }}>{s.tool}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ FAQ ═══ */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: -0.3 }}>
          Common Questions
        </h2>

        {[
          { q: "Can Claude push changes directly to HubSpot?", a: "No. Claude saves drafts locally. You review and deploy from the app UI. Nothing touches HubSpot without your explicit action." },
          { q: "What if I make a mistake?", a: "Drafts can be edited or deleted before deployment. Workflows always deploy disabled. Bulk scripts require a dry-run first. The system checks for duplicates before saving." },
          { q: "Do I need to know the HubSpot API?", a: "No. Claude handles all API formatting, validation rules, and constraints. Just describe what you want in plain English." },
          { q: "Can I use this for multiple portals?", a: "Yes. Connect as many portals as you need. Each portal has isolated drafts and settings." },
          { q: "What HubSpot tiers are supported?", a: "All tiers — Free through Enterprise. The system flags features that require a higher tier before you deploy them." },
          { q: "How do meeting notes work?", a: "Paste your call notes into Claude Code. It extracts every actionable item, identifies gaps, and produces a structured plan. After you approve, it creates all the drafts automatically." },
        ].map((faq) => (
          <div key={faq.q} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-subtle)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{faq.q}</div>
            <div style={{ fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.6 }}>{faq.a}</div>
          </div>
        ))}
      </div>

      {/* ═══ CTA ═══ */}
      <div style={{
        textAlign: "center", padding: "28px 20px",
        background: "var(--accent-dim)",
        border: "1px solid var(--accent-border)",
        borderRadius: "var(--radius-lg)",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Ready to start?</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          Connect a portal, then talk to Claude Code.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link href="/portals" className="btn btn-primary">Connect Portal</Link>
          <Link href="/" className="btn btn-ghost">Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
