"use client";

export function ActivityFilters({
  value,
  onChange,
  onExport
}: {
  value: {
    dateFrom: string;
    dateTo: string;
    action: string;
    objectType: string;
    status: string;
  };
  onChange: (next: Partial<{ dateFrom: string; dateTo: string; action: string; objectType: string; status: string }>) => void;
  onExport: () => void;
}) {
  return (
    <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
      <input type="date" className="input" value={value.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} />
      <input type="date" className="input" value={value.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} />
      <select className="select" value={value.action} onChange={(e) => onChange({ action: e.target.value })}>
        <option value="">All Actions</option>
        <option value="create">Create</option>
        <option value="update">Update</option>
        <option value="delete">Delete</option>
        <option value="workflow_deploy">Workflow Deploy</option>
        <option value="script_execute">Script Execute</option>
      </select>
      <select className="select" value={value.objectType} onChange={(e) => onChange({ objectType: e.target.value })}>
        <option value="">All Objects</option>
        <option value="contact">Contact</option>
        <option value="company">Company</option>
        <option value="deal">Deal</option>
        <option value="ticket">Ticket</option>
        <option value="workflow">Workflow</option>
        <option value="property">Property</option>
        <option value="list">List</option>
      </select>
      <select className="select" value={value.status} onChange={(e) => onChange({ status: e.target.value })}>
        <option value="">All Statuses</option>
        <option value="success">Success</option>
        <option value="error">Error</option>
        <option value="dry_run">Dry Run</option>
      </select>
      <button className="btn btn-ghost" onClick={onExport}>Export CSV</button>
    </div>
  );
}
