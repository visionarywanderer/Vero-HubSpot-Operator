"use client";

import Link from "next/link";

/* ──────────────────────────────────────────────── */
/*  Small reusable visual components for the page   */
/* ──────────────────────────────────────────────── */

function Arrow({ label, down }: { label?: string; down?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: down ? "6px 0" : "0 10px" }}>
      {label && <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>}
      <div style={{
        width: down ? 2 : 28,
        height: down ? 28 : 2,
        background: "linear-gradient(to " + (down ? "bottom" : "right") + ", var(--accent), transparent)",
        borderRadius: 1,
      }} />
      <div style={{
        width: 0, height: 0,
        borderLeft: down ? "5px solid transparent" : "none",
        borderRight: down ? "5px solid transparent" : "none",
        borderTop: down ? "6px solid var(--accent)" : "none",
        borderBottom: !down ? "5px solid transparent" : "none",
        ...(down ? {} : { borderLeft: "6px solid var(--accent)", borderTop: "5px solid transparent", borderBottom: "5px solid transparent" }),
      }} />
    </div>
  );
}

function FlowNode({ icon, title, subtitle, accent, small, glow }: {
  icon: string; title: string; subtitle?: string; accent?: boolean; small?: boolean; glow?: boolean;
}) {
  return (
    <div style={{
      background: accent ? "var(--accent-dim)" : "var(--card)",
      border: `1px solid ${accent ? "var(--accent-border)" : "var(--line)"}`,
      borderRadius: "var(--radius-lg)",
      padding: small ? "8px 12px" : "12px 16px",
      textAlign: "center",
      minWidth: small ? 100 : 140,
      boxShadow: glow ? "0 0 20px rgba(232, 213, 163, 0.08)" : "var(--shadow-sm)",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}>
      <div style={{ fontSize: small ? 18 : 24 }}>{icon}</div>
      <div style={{
        fontSize: small ? 11 : 13,
        fontWeight: 600,
        color: accent ? "var(--accent)" : "var(--ink)",
        marginTop: 4,
      }}>{title}</div>
      {subtitle && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function StepCard({ number, title, description, children }: {
  number: number; title: string; description: string; children?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ position: "relative", paddingLeft: 56 }}>
      <div style={{
        position: "absolute", left: 14, top: 14,
        width: 30, height: 30, borderRadius: "50%",
        background: "var(--accent)", color: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700,
      }}>{number}</div>
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>{title}</h3>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-secondary)", lineHeight: 1.6 }}>{description}</p>
      {children}
    </div>
  );
}

function SkillBadge({ name, color }: { name: string; color: string }) {
  return (
    <span style={{
      display: "inline-block",
      fontSize: 10, fontWeight: 500,
      padding: "2px 8px",
      borderRadius: 3,
      background: color + "18",
      color: color,
      border: `1px solid ${color}33`,
    }}>{name}</span>
  );
}

function PageLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, color: "var(--accent)",
      textDecoration: "none",
    }}>
      {label} <span style={{ fontSize: 9 }}>&#8594;</span>
    </Link>
  );
}

/* ──────────────────────────────────────────────── */
/*  Main page                                        */
/* ──────────────────────────────────────────────── */

export default function HowItWorksPage() {
  return (
    <div className="stack" style={{ gap: 24, maxWidth: 900 }}>

      {/* ═══ HERO ═══ */}
      <div>
        <h1 className="page-title" style={{ fontSize: 24 }}>How It Works</h1>
        <p className="page-subtitle" style={{ fontSize: 13, maxWidth: 600 }}>
          From meeting notes to a fully configured HubSpot portal — in minutes, not days.
          Here&apos;s how the three layers work together.
        </p>
        <div className="accent-stripe" />
      </div>

      {/* ═══ THREE-LAYER ARCHITECTURE ═══ */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, letterSpacing: -0.2 }}>
          The Three-Layer Architecture
        </h2>

        {/* Layer 1: Claude */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, flexWrap: "wrap", padding: "16px 0",
          background: "var(--accent-dim)",
          border: "1px solid var(--accent-border)",
          borderRadius: "var(--radius-lg)",
          marginBottom: 0,
        }}>
          <div style={{ width: "100%", textAlign: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent)", fontWeight: 600 }}>
              Layer 1 &mdash; AI Brain
            </span>
          </div>
          <FlowNode icon="🧠" title="Claude Code" subtitle="You talk here" accent glow />
          <span style={{ color: "var(--accent)", fontSize: 16 }}>&#8594;</span>
          <FlowNode icon="📋" title="Skills" subtitle="8 specialized" accent small />
          <span style={{ color: "var(--accent)", fontSize: 16 }}>&#8594;</span>
          <FlowNode icon="📐" title="Constraints" subtitle="Validation rules" accent small />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Arrow down label="Drafts via MCP" />
        </div>

        {/* Layer 2: App */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, flexWrap: "wrap", padding: "16px 0",
          background: "var(--info-bg)",
          border: "1px solid rgba(126, 200, 232, 0.15)",
          borderRadius: "var(--radius-lg)",
          marginBottom: 0,
        }}>
          <div style={{ width: "100%", textAlign: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--info)", fontWeight: 600 }}>
              Layer 2 &mdash; Vero App
            </span>
          </div>
          <FlowNode icon="💾" title="Draft Store" subtitle="SQLite" small />
          <span style={{ color: "var(--info)", fontSize: 16 }}>&#8594;</span>
          <FlowNode icon="🖥️" title="App UI" subtitle="Review & deploy" small />
          <span style={{ color: "var(--info)", fontSize: 16 }}>&#8594;</span>
          <FlowNode icon="🛡️" title="Safety Layer" subtitle="Governance" small />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Arrow down label="API calls" />
        </div>

        {/* Layer 3: HubSpot */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, flexWrap: "wrap", padding: "16px 0",
          background: "var(--success-bg)",
          border: "1px solid rgba(126, 203, 160, 0.15)",
          borderRadius: "var(--radius-lg)",
        }}>
          <div style={{ width: "100%", textAlign: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--success)", fontWeight: 600 }}>
              Layer 3 &mdash; HubSpot
            </span>
          </div>
          <FlowNode icon="📊" title="CRM v3" subtitle="Properties, Objects" small />
          <FlowNode icon="🔗" title="Associations v4" subtitle="Record links" small />
          <FlowNode icon="⚡" title="Automation v4" subtitle="Workflows" small />
        </div>
      </div>

      {/* ═══ THE SKILL CHAIN ═══ */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, letterSpacing: -0.2 }}>
          The Skill Chain — Meeting Notes to Execution
        </h2>
        <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>
          Paste meeting notes in Claude Code. The system analyses them and chains through each skill in dependency order.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center" }}>
          {/* Entry */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 500,
          }}>
            <span style={{ fontSize: 20 }}>📝</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Meeting Notes</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>Paste client call notes, requirements, or CRM plans into Claude Code</div>
            </div>
          </div>

          <Arrow down label="Analysis skill" />

          {/* Analysis */}
          <div style={{
            padding: "10px 16px",
            background: "var(--card)", border: "1px solid var(--accent-border)",
            borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 500,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Analyse &amp; Plan</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Extracts fields, processes, automations, segments. Checks dependencies &amp; tier limits.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              <SkillBadge name="Gap Analysis" color="var(--warning)" />
              <SkillBadge name="Tier Check" color="var(--info)" />
              <SkillBadge name="Alternatives" color="var(--success)" />
              <SkillBadge name="Risk Flags" color="var(--danger)" />
            </div>
          </div>

          <Arrow down label="Reads existing portal" />

          {/* Portal Scan */}
          <div style={{
            padding: "10px 16px",
            background: "var(--info-bg)", border: "1px solid rgba(126, 200, 232, 0.15)",
            borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 500,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🔎</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--info)" }}>Duplicate Check</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Reads existing properties, pipelines, workflows &amp; lists from portal via the app. Flags exact matches, similar names &amp; missing dependencies.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              <SkillBadge name="list_properties" color="var(--info)" />
              <SkillBadge name="list_pipelines" color="var(--info)" />
              <SkillBadge name="list_workflows" color="var(--info)" />
              <SkillBadge name="list_lists" color="var(--info)" />
            </div>
          </div>

          <Arrow down label="You approve the plan" />

          {/* Execution chain */}
          <div style={{ width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { num: 1, icon: "🏷️", label: "Property Groups", desc: "Custom groups created first", page: "/properties", skill: "property-drafts", color: "var(--accent)" },
              { num: 2, icon: "📋", label: "Properties", desc: "Custom fields, dropdowns, dates", page: "/properties", skill: "property-drafts", color: "var(--accent)" },
              { num: 3, icon: "🔀", label: "Pipelines", desc: "Deal stages, ticket stages", page: "/pipelines", skill: "pipeline-drafts", color: "var(--info)" },
              { num: 4, icon: "👥", label: "Lists & Segments", desc: "Dynamic audiences, filters", page: "/lists", skill: "list-drafts", color: "var(--success)" },
              { num: 5, icon: "⚡", label: "Workflows", desc: "Automations, triggers, actions", page: "/workflows", skill: "workflow-drafts", color: "var(--warning)" },
              { num: 6, icon: "📦", label: "Bulk Operations", desc: "Data cleanup, mass updates", page: "/bulk", skill: "bulk-drafts", color: "var(--danger)" },
            ].map((step, i) => (
              <div key={step.num}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                  background: "var(--card)", border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  borderLeft: `3px solid ${step.color}`,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: step.color + "22", color: step.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>{step.num}</div>
                  <span style={{ fontSize: 16 }}>{step.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{step.label}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{step.desc}</div>
                  </div>
                  <PageLink href={step.page} label="Deploy" />
                </div>
                {i < 5 && (
                  <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
                    <div style={{ width: 1, height: 10, background: "var(--line)" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <Arrow down label="Optional" />

          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
            background: "var(--card)", border: "1px dashed var(--accent-border)",
            borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 500,
          }}>
            <span style={{ fontSize: 20 }}>📦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Bundle as Template</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>Save everything as a reusable template for cloning to other portals</div>
            </div>
            <PageLink href="/templates" label="Templates" />
          </div>
        </div>
      </div>

      {/* ═══ QUICK START: 5 STEPS ═══ */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, letterSpacing: -0.2 }}>
          Quick Start — 5 Steps
        </h2>

        <div className="stack" style={{ gap: 10 }}>
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
            description="Open Claude Code (the terminal AI) and describe what you need. You can paste meeting notes, ask for a pipeline, request properties, or describe a full CRM setup. Claude understands HubSpot and will generate valid specs automatically."
          >
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              <SkillBadge name="&quot;Create a SaaS pipeline&quot;" color="var(--info)" />
              <SkillBadge name="&quot;Add lead source field&quot;" color="var(--accent)" />
              <SkillBadge name="&quot;Build a trial workflow&quot;" color="var(--warning)" />
            </div>
          </StepCard>

          <StepCard
            number={3}
            title="Review the Plan"
            description="Claude generates a structured plan showing exactly what will be created — properties, pipelines, workflows, lists, and scripts. Review it, ask questions, request changes. Nothing is created until you approve."
          >
            <div className="card" style={{
              padding: "8px 10px", fontSize: 11, color: "var(--ink-secondary)",
              fontFamily: "var(--font-mono)", background: "var(--bg)", lineHeight: 1.6,
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
            description="When you approve, Claude saves each resource as a draft via the MCP connection. Drafts are stored locally in the app — nothing is pushed to HubSpot yet. You can review each draft in the corresponding page."
          >
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 4,
            }}>
              {[
                { label: "Properties", href: "/properties", count: "3 drafts" },
                { label: "Pipelines", href: "/pipelines", count: "1 draft" },
                { label: "Workflows", href: "/workflows", count: "1 draft" },
                { label: "Lists", href: "/lists", count: "1 draft" },
                { label: "Bulk Ops", href: "/bulk", count: "1 draft" },
                { label: "Templates", href: "/templates", count: "0 drafts" },
              ].map((d) => (
                <Link key={d.href} href={d.href} style={{
                  display: "flex", flexDirection: "column",
                  padding: "6px 8px", borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line)", textDecoration: "none",
                  fontSize: 11, textAlign: "center",
                  transition: "border-color 0.15s",
                }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{d.label}</span>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>{d.count}</span>
                </Link>
              ))}
            </div>
          </StepCard>

          <StepCard
            number={5}
            title="Deploy to HubSpot"
            description="Click Deploy on each page to push drafts to your HubSpot portal. The app validates, applies safety checks (sandbox-first policy, dry-run enforcement), and creates the resources. Everything is logged in the Activity page."
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderRadius: "var(--radius-md)",
              background: "var(--success-bg)", marginTop: 4,
            }}>
              <span style={{ fontSize: 14 }}>✓</span>
              <span style={{ fontSize: 11, color: "var(--success)" }}>
                Workflows deploy disabled for safety. Bulk scripts require dry-run before execute.
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <PageLink href="/activity" label="View Activity Log" />
            </div>
          </StepCard>
        </div>
      </div>

      {/* ═══ WHAT CAN YOU ASK CLAUDE? ═══ */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, letterSpacing: -0.2 }}>
          What Can You Ask Claude?
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {[
            {
              category: "Meeting Notes",
              color: "var(--accent)",
              examples: [
                "Here are my notes from the call with Acme Corp...",
                "The client needs a B2B SaaS CRM setup",
                "Analyse these requirements and create a plan",
              ],
            },
            {
              category: "Properties",
              color: "var(--info)",
              examples: [
                "Create a lead source dropdown for contacts",
                "Add MRR and ARR number fields to companies",
                "Build a custom property group for SaaS metrics",
              ],
            },
            {
              category: "Pipelines",
              color: "var(--success)",
              examples: [
                "Build a 7-stage SaaS sales pipeline",
                "Create a support ticket pipeline",
                "Add a renewal pipeline for deals",
              ],
            },
            {
              category: "Workflows",
              color: "var(--warning)",
              examples: [
                "When a trial starts, create a follow-up task",
                "Set lifecycle stage when lead score hits 80",
                "Send notification when deal moves to Proposal",
              ],
            },
            {
              category: "Lists & Segments",
              color: "#b39ddb",
              examples: [
                "Create a list of all MQLs from last 30 days",
                "Segment contacts by product interest",
                "Build a suppression list for churned customers",
              ],
            },
            {
              category: "Bulk Operations",
              color: "var(--danger)",
              examples: [
                "Clean up phone number formatting",
                "Update all contacts where lead status is empty",
                "Backfill lifecycle stage for existing contacts",
              ],
            },
          ].map((cat) => (
            <div key={cat.category} style={{
              padding: "10px 12px", borderRadius: "var(--radius-md)",
              border: "1px solid var(--line)",
              borderLeft: `3px solid ${cat.color}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: cat.color, marginBottom: 6 }}>
                {cat.category}
              </div>
              {cat.examples.map((ex) => (
                <div key={ex} style={{
                  fontSize: 11, color: "var(--ink-secondary)",
                  padding: "3px 0", borderBottom: "1px solid var(--line-subtle)",
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
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, letterSpacing: -0.2 }}>
          Safety &amp; Governance
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {[
            { icon: "🛡️", title: "Sandbox-First", desc: "New production portals require session validation before writes" },
            { icon: "🔒", title: "Workflows Deploy Disabled", desc: "All workflows are created with isEnabled=false for manual review" },
            { icon: "🧪", title: "Dry-Run Required", desc: "Bulk scripts must run in dry-run mode before actual execution" },
            { icon: "📝", title: "Full Audit Trail", desc: "Every action is logged with timestamp, user, portal, and details" },
            { icon: "🔎", title: "Duplicate Detection", desc: "Every draft is checked against existing portal resources and pending drafts before saving" },
            { icon: "✅", title: "Pre-Flight Validation", desc: "Each skill runs 10-17 validation checks before saving a draft" },
            { icon: "🔄", title: "Draft → Review → Deploy", desc: "Nothing goes to HubSpot without your explicit deploy action" },
          ].map((item) => (
            <div key={item.title} style={{
              display: "flex", gap: 10, padding: "8px 0",
              borderBottom: "1px solid var(--line-subtle)",
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FULL SKILL MAP ═══ */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, letterSpacing: -0.2 }}>
          Complete Skill Map
        </h2>
        <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>
          8 skills work together. The orchestrator routes your request to the right one(s).
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {/* Orchestrator at top */}
          <div style={{
            padding: "12px 20px", borderRadius: "var(--radius-lg)",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            textAlign: "center", width: "100%", maxWidth: 420,
          }}>
            <div style={{ fontSize: 18 }}>🎯</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>Master Orchestrator</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Routes requests, resolves dependencies, manages execution order</div>
          </div>

          {/* Connector lines */}
          <div style={{ display: "flex", gap: 4 }}>
            {[1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{ width: 1, height: 16, background: "var(--line)" }} />
            ))}
          </div>

          {/* Analysis skill */}
          <div style={{
            padding: "10px 16px", borderRadius: "var(--radius-lg)",
            border: "1px solid var(--accent-border)",
            background: "var(--card)", textAlign: "center",
            width: "100%", maxWidth: 420,
          }}>
            <div style={{ fontSize: 16 }}>🔍</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Meeting Notes Analyst</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Extracts requirements → produces structured plan</div>
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            {[1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{ width: 1, height: 12, background: "var(--line)" }} />
            ))}
          </div>

          {/* Resource skills grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
            width: "100%",
          }}>
            {[
              { icon: "🏷️", name: "Properties", tool: "save_property_draft", color: "var(--accent)", page: "/properties" },
              { icon: "🔀", name: "Pipelines", tool: "save_pipeline_draft", color: "var(--info)", page: "/pipelines" },
              { icon: "⚡", name: "Workflows", tool: "save_workflow_draft", color: "var(--warning)", page: "/workflows" },
              { icon: "👥", name: "Lists", tool: "save_list_draft", color: "var(--success)", page: "/lists" },
              { icon: "📦", name: "Bulk Ops", tool: "save_script_draft", color: "var(--danger)", page: "/bulk" },
              { icon: "🧩", name: "Templates", tool: "save_template_draft", color: "#b39ddb", page: "/templates" },
            ].map((s) => (
              <Link key={s.name} href={s.page} style={{
                padding: "10px 8px", borderRadius: "var(--radius-md)",
                border: "1px solid var(--line)",
                borderTop: `2px solid ${s.color}`,
                textAlign: "center", textDecoration: "none",
                transition: "border-color 0.15s, transform 0.15s",
              }}>
                <div style={{ fontSize: 20 }}>{s.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>{s.name}</div>
                <div style={{
                  fontSize: 9, color: "var(--muted)", marginTop: 2,
                  fontFamily: "var(--font-mono)",
                }}>{s.tool}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ DATA FLOW DETAIL ═══ */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, letterSpacing: -0.2 }}>
          How Data Moves
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center" }}>
          {[
            { icon: "💬", label: "You describe what you need", detail: "In Claude Code (terminal)", bg: "var(--accent-dim)", border: "var(--accent-border)" },
            { icon: "🔎", label: "Claude reads existing portal state", detail: "list_properties, list_pipelines, list_workflows, list_lists", bg: "var(--accent-dim)", border: "var(--accent-border)" },
            { icon: "🧠", label: "Claude generates a valid spec", detail: "JSON format, pre-validated, duplicates flagged", bg: "var(--accent-dim)", border: "var(--accent-border)" },
            { icon: "🔌", label: "MCP tool saves draft", detail: "save_*_draft → checks conflicts → SQLite database", bg: "var(--info-bg)", border: "rgba(126, 200, 232, 0.15)" },
            { icon: "🖥️", label: "You review in the app", detail: "Each resource has its own page", bg: "var(--info-bg)", border: "rgba(126, 200, 232, 0.15)" },
            { icon: "🚀", label: "You click Deploy", detail: "App validates + calls HubSpot API", bg: "var(--success-bg)", border: "rgba(126, 203, 160, 0.15)" },
            { icon: "✅", label: "Resource created in HubSpot", detail: "Logged in Activity page", bg: "var(--success-bg)", border: "rgba(126, 203, 160, 0.15)" },
          ].map((step, i) => (
            <div key={step.label}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", borderRadius: "var(--radius-md)",
                background: step.bg, border: `1px solid ${step.border}`,
                width: "100%", maxWidth: 460,
              }}>
                <span style={{ fontSize: 18 }}>{step.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{step.label}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{step.detail}</div>
                </div>
              </div>
              {i < 6 && (
                <div style={{ display: "flex", justifyContent: "center", padding: "3px 0" }}>
                  <div style={{ width: 1, height: 14, background: "var(--line)" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FAQ ═══ */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, letterSpacing: -0.2 }}>
          Common Questions
        </h2>

        {[
          { q: "Can Claude push changes directly to HubSpot?", a: "No. Claude saves drafts locally. You review and deploy from the app UI. This is a safety feature — nothing touches HubSpot without your explicit action." },
          { q: "What if I make a mistake?", a: "Drafts can be edited or deleted before deployment. Workflows always deploy disabled. Bulk scripts require a dry-run first. The system also checks for duplicates against existing portal resources before saving any draft, so you won't accidentally create something that already exists." },
          { q: "Do I need to know the HubSpot API?", a: "No. Claude handles all API formatting, validation rules, and constraints. Just describe what you want in plain English." },
          { q: "Can I use this for multiple portals?", a: "Yes. Connect as many portals as you need. Each portal has isolated drafts and settings. You can even clone configurations between portals." },
          { q: "What HubSpot tiers are supported?", a: "All tiers — Free through Enterprise. The system automatically flags features that require a higher tier before you try to deploy them." },
          { q: "How do meeting notes work?", a: "Paste your call notes into Claude Code. It extracts every actionable item (fields, processes, automations, segments), identifies gaps, and produces a structured plan. After you approve, it creates all the drafts automatically." },
        ].map((faq) => (
          <div key={faq.q} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-subtle)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{faq.q}</div>
            <div style={{ fontSize: 11, color: "var(--ink-secondary)", lineHeight: 1.6 }}>{faq.a}</div>
          </div>
        ))}
      </div>

      {/* ═══ CTA ═══ */}
      <div style={{
        textAlign: "center", padding: "24px 16px",
        background: "var(--accent-dim)",
        border: "1px solid var(--accent-border)",
        borderRadius: "var(--radius-lg)",
      }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>🚀</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Ready to start?</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          Connect a portal, then talk to Claude Code.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Link href="/portals" className="btn btn-primary">Connect Portal</Link>
          <Link href="/" className="btn btn-ghost">Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
