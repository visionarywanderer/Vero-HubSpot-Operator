"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";

type AppSettings = {
  usersAllowlist: string[];
};

export function UserManagement() {
  const [users, setUsers] = useState<string[]>([]);
  const [newUser, setNewUser] = useState("");

  useEffect(() => {
    apiGet<{ ok: true; settings: AppSettings }>("/api/app-settings")
      .then((response) => setUsers(response.settings.usersAllowlist || []))
      .catch(() => setUsers([]));
  }, []);

  const persist = async (next: string[]) => {
    const normalized = Array.from(new Set(next.map((email) => email.trim().toLowerCase()).filter(Boolean)));
    await apiPatch("/api/app-settings", { updates: { usersAllowlist: normalized } });
    setUsers(normalized);
  };

  return (
    <div className="card stack">
      <h3>Users (Admin)</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="input" value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="user@verodigital.co" />
        <button className="btn btn-primary" onClick={() => {
          if (!newUser.trim()) return;
          persist([...users, newUser]).catch(() => undefined);
          setNewUser("");
        }}>Add</button>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {users.map((user) => (
          <li key={user} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>{user}</span>
            <button className="btn btn-ghost" onClick={() => persist(users.filter((entry) => entry !== user)).catch(() => undefined)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
