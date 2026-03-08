"use client";

export function ErrorBlock({
  message,
  portal,
  moduleCode,
  onRetry,
  onViewActivity
}: {
  message: string;
  portal?: string;
  moduleCode?: string;
  onRetry?: () => void;
  onViewActivity?: () => void;
}) {
  return (
    <div className="card stack" style={{ borderLeft: "4px solid var(--danger)" }}>
      <h3 style={{ margin: 0, color: "var(--danger)" }}>Error</h3>
      <div>{message}</div>
      {portal ? <div className="page-subtitle">Portal: {portal}</div> : null}
      {moduleCode ? <div className="page-subtitle">Module: {moduleCode}</div> : null}
      <div style={{ display: "flex", gap: 8 }}>
        {onRetry ? <button className="btn btn-primary" onClick={onRetry}>Retry</button> : null}
        {onViewActivity ? <button className="btn btn-ghost" onClick={onViewActivity}>View in Activity Log</button> : null}
      </div>
    </div>
  );
}
