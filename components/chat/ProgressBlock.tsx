"use client";

type StepState = "pending" | "running" | "done";

export function ProgressBlock({ title, steps, onCancel }: { title: string; steps: Array<{ label: string; state: StepState }>; onCancel?: () => void }) {
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Executing: {title}</h3>
      {steps.map((step, idx) => {
        const icon = step.state === "done" ? "✅" : step.state === "running" ? "⏳" : "○";
        return <div key={`${idx}-${step.label}`}>{icon} {step.label}</div>;
      })}
      {onCancel ? <button className="btn btn-ghost" onClick={onCancel}>Cancel</button> : null}
    </div>
  );
}
