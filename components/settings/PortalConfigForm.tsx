"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

export function PortalConfigForm({ portalId }: { portalId: string }) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [maxBulkRecords, setMaxBulkRecords] = useState(5000);
  const [requireDryRun, setRequireDryRun] = useState(true);
  const [requireConfirmation, setRequireConfirmation] = useState(true);
  const [allowDeletes, setAllowDeletes] = useState(false);

  const load = useCallback(async () => {
    const response = await apiGet<{ ok: true; config: Record<string, unknown> }>(`/api/portal-config/${portalId}`);
    setConfig(response.config);
    const safety = (response.config.safety as Record<string, unknown>) || {};
    setMaxBulkRecords(Number(safety.maxBulkRecords || 5000));
    setRequireDryRun(Boolean(safety.requireDryRun ?? true));
    setRequireConfirmation(Boolean(safety.requireConfirmation ?? true));
    setAllowDeletes(Boolean(safety.allowDeletes ?? false));
  }, [portalId]);

  useEffect(() => {
    load().catch(() => setConfig(null));
  }, [load]);

  return (
    <div className="stack">
      <div className="card stack">
        <h3>Portal Configuration</h3>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await apiPost("/api/portal-config/discover", { portalId });
            await load();
          }}
        >
          Auto-Discover
        </button>

        <label>Max bulk records</label>
        <input className="input" type="number" value={maxBulkRecords} onChange={(e) => setMaxBulkRecords(Number(e.target.value))} />

        <label><input type="checkbox" checked={requireDryRun} onChange={(e) => setRequireDryRun(e.target.checked)} /> Require dry run</label>
        <label><input type="checkbox" checked={requireConfirmation} onChange={(e) => setRequireConfirmation(e.target.checked)} /> Require confirmation</label>
        <label><input type="checkbox" checked={allowDeletes} onChange={(e) => setAllowDeletes(e.target.checked)} /> Allow deletes</label>

        <button
          className="btn btn-primary"
          onClick={async () => {
            const response = await apiPatch<{ ok: true; config: Record<string, unknown> }>(`/api/portal-config/${portalId}`, {
              updates: {
                "safety.maxBulkRecords": maxBulkRecords,
                "safety.requireDryRun": requireDryRun,
                "safety.requireConfirmation": requireConfirmation,
                "safety.allowDeletes": allowDeletes
              }
            });
            setConfig(response.config);
          }}
        >
          Save Safety Settings
        </button>
      </div>

      {config ? <pre className="code-shell">{JSON.stringify(config, null, 2)}</pre> : null}
    </div>
  );
}
