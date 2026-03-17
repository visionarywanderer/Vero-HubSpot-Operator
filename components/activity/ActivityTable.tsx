"use client";

import { Fragment, useState } from "react";
import { ActivityDetail } from "@/components/activity/ActivityDetail";
import type { ActivityEntry } from "@/hooks/useActivity";

export function ActivityTable({ entries }: { entries: ActivityEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="card">
      <table className="table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Object</th>
            <th>Record ID</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <Fragment key={entry.id}>
              <tr onClick={() => setExpandedId((prev) => (prev === entry.id ? null : entry.id))} style={{ cursor: "pointer" }}>
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
                <td>{entry.action}</td>
                <td>{entry.objectType}</td>
                <td>{entry.recordId}</td>
                <td>{entry.description}</td>
                <td>{entry.status}</td>
              </tr>
              {expandedId === entry.id ? (
                <tr>
                  <td colSpan={6}>
                    <ActivityDetail entry={entry} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
