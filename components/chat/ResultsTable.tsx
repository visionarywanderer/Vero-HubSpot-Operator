"use client";

import { useMemo, useState } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

type GenericRow = Record<string, string | number | null | undefined>;

function statusFor(value: number): "ok" | "warn" | "bad" {
  if (value >= 80) return "ok";
  if (value >= 50) return "warn";
  return "bad";
}

export function ResultsTable({ title, rows }: { title: string; rows: GenericRow[] }) {
  const [sortKey, setSortKey] = useState<string>("");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const keys = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
    return copy;
  }, [rows, sortAsc, sortKey]);

  const fillRate = Number(rows[0]?.fillRate ?? rows[0]?.fill_rate ?? 0);
  const chartData = [{ name: "fill", value: fillRate }];

  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>{title}</h3>
      <div style={{ height: 110 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="60%" outerRadius="100%" data={chartData} startAngle={180} endAngle={0}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} fill="var(--primary)" />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <table className="table">
        <thead>
          <tr>
            {keys.map((key) => (
              <th
                key={key}
                onClick={() => {
                  if (sortKey === key) setSortAsc((v) => !v);
                  else {
                    setSortKey(key);
                    setSortAsc(true);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                {key}
              </th>
            ))}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const numeric = Number(row.fillRate ?? row.fill_rate ?? 0);
            const status = statusFor(Number.isFinite(numeric) ? numeric : 0);
            const icon = status === "ok" ? "✅" : status === "warn" ? "⚠️" : "❌";
            return (
              <tr key={idx}>
                {keys.map((key) => (
                  <td key={key}>{String(row[key] ?? "")}</td>
                ))}
                <td>{icon}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost">Export CSV</button>
        <button className="btn btn-primary">Create Tasks for Gaps</button>
      </div>
    </div>
  );
}
