"use client";

type Plan = {
  planId: string;
  intent: string;
  module: string;
  risk: "none" | "low" | "medium" | "high";
  steps: Array<{ action: string; tool?: string }>;
  requiresExactConfirmationText?: string;
  blockedReason?: string;
};

function riskColor(risk: Plan["risk"]): string {
  if (risk === "high") return "var(--danger)";
  if (risk === "medium") return "var(--warning)";
  return "var(--line)";
}

export function PlanPreview({
  plan,
  confirmationText,
  onConfirmationText,
  onConfirm,
  onCancel
}: {
  plan: Plan;
  confirmationText: string;
  onConfirmationText: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const needsExact = Boolean(plan.requiresExactConfirmationText);
  const exactMatch = needsExact ? confirmationText.trim() === (plan.requiresExactConfirmationText || "") : true;

  return (
    <div className="card" style={{ border: `1px solid ${riskColor(plan.risk)}` }}>
      <h3 style={{ marginTop: 0 }}>Operation Plan</h3>
      <div className="page-subtitle">Intent: {plan.intent}</div>
      <div className="page-subtitle">Module: {plan.module}</div>
      <div style={{ margin: "8px 0", fontSize: 13 }}>Risk: <strong>{plan.risk}</strong></div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {plan.steps.map((step, index) => (
          <li key={`${index}-${step.action}`} style={{ marginBottom: 4 }}>
            {step.action} {step.tool ? <span style={{ color: "var(--muted)" }}>- {step.tool}</span> : null}
          </li>
        ))}
      </ol>

      {needsExact ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            Type exact ID to confirm: <strong>{plan.requiresExactConfirmationText}</strong>
          </div>
          <input
            className="input"
            value={confirmationText}
            onChange={(e) => onConfirmationText(e.target.value)}
            placeholder={plan.requiresExactConfirmationText}
          />
        </div>
      ) : null}

      {plan.blockedReason ? <div className="error-inline">{plan.blockedReason}</div> : null}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className={`btn ${plan.risk === "high" ? "btn-danger" : "btn-primary"}`}
          onClick={onConfirm}
          disabled={plan.blockedReason !== undefined || !exactMatch}
        >
          {plan.risk === "high" ? "Confirm Destructive Action" : "Confirm & Execute"}
        </button>
      </div>
    </div>
  );
}
