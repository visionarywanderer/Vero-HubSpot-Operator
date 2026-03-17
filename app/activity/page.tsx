"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { usePortal } from "@/hooks/usePortal";
import { useActivity } from "@/hooks/useActivity";
import { apiPost } from "@/lib/api";
import { ActivityFilters } from "@/components/activity/ActivityFilters";
import { ActivityTable } from "@/components/activity/ActivityTable";

function ActivityPageContent() {
  const params = useSearchParams();
  const { activePortal } = usePortal();

  const [filter, setFilter] = useState({
    dateFrom: "",
    dateTo: "",
    action: "",
    objectType: "",
    status: ""
  });

  const portalId = params.get("portalId") || activePortal?.id || "";
  const { entries, loading } = useActivity({
    portalId,
    dateFrom: filter.dateFrom || undefined,
    dateTo: filter.dateTo || undefined,
    action: filter.action || undefined,
    objectType: filter.objectType || undefined,
    status: filter.status || undefined
  });

  const summaryData = useMemo(() => {
    const byAction = new Map<string, number>();
    for (const entry of entries) {
      byAction.set(entry.action, (byAction.get(entry.action) || 0) + 1);
    }
    return Array.from(byAction.entries()).map(([name, value]) => ({ name, value }));
  }, [entries]);

  return (
    <div className="stack">
      <h1 className="page-title">Activity Log</h1>
      <p className="page-subtitle">Full audit trail for all app actions.</p>

      <ActivityFilters
        value={filter}
        onChange={(next) => setFilter((prev) => ({ ...prev, ...next }))}
        onExport={() => {
          if (!portalId) return;
          apiPost("/api/activity/export", { portalId, format: "csv" }).catch(() => undefined);
        }}
      />

      <div className="card-grid two">
        <div className="card">
          <h3>Summary</h3>
          <div className="page-subtitle">Total changes: {entries.length}</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={summaryData} dataKey="value" nameKey="name" outerRadius={70} fill="var(--accent)" label />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Errors</h3>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {entries.filter((entry) => entry.status === "error").slice(0, 8).map((entry) => (
              <li key={entry.id}>{entry.description}</li>
            ))}
          </ul>
        </div>
      </div>

      {loading ? <div className="skeleton" style={{ height: 180 }} /> : <ActivityTable entries={entries} />}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 180 }} />}>
      <ActivityPageContent />
    </Suspense>
  );
}
