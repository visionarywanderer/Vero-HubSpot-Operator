"use client";

import { useMemo, useState } from "react";
import { CodeBlock } from "@/components/chat/CodeBlock";

type Action = { actionId?: string; actionTypeId?: string; [key: string]: unknown };

type Spec = {
  name?: string;
  type?: string;
  enrollmentCriteria?: { type?: string };
  actions?: Action[];
  isEnabled?: boolean;
  [key: string]: unknown;
};

export function WorkflowSpec({ spec, onDeployDisabled }: { spec: Spec; onDeployDisabled?: () => void }) {
  const [showRaw, setShowRaw] = useState(false);

  const actions = useMemo(() => (Array.isArray(spec.actions) ? spec.actions : []), [spec.actions]);

  if (showRaw) {
    return (
      <div className="stack">
        <CodeBlock title={`Workflow JSON: ${spec.name || "Unnamed"}`} language="json" code={JSON.stringify(spec, null, 2)} />
        <button className="btn btn-ghost" onClick={() => setShowRaw(false)}>Hide Raw JSON</button>
      </div>
    );
  }

  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Workflow: {spec.name || "Unnamed"}</h3>
      <div>Type: {spec.type || "unknown"}</div>
      <div>Trigger: {spec.enrollmentCriteria?.type || "unknown"}</div>
      <div>Actions:</div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {actions.map((action, i) => (
          <li key={`${action.actionId || i}`}>{action.actionTypeId || "action"}</li>
        ))}
      </ol>
      <div>Deploy state: {spec.isEnabled === false ? "DISABLED (safe)" : "ENABLED"}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => setShowRaw(true)}>View Raw JSON</button>
        {onDeployDisabled ? <button className="btn btn-primary" onClick={onDeployDisabled}>Deploy to HubSpot</button> : null}
      </div>
    </div>
  );
}
