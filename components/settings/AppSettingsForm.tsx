"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";

type AppSettings = {
  routingModel: "haiku" | "sonnet" | "opus";
  generationModel: "haiku" | "sonnet" | "opus";
  promptCaching: boolean;
  monthlySpendLimit: number;
  usersAllowlist: string[];
};

export function AppSettingsForm() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    apiGet<{ ok: true; settings: AppSettings }>("/api/app-settings")
      .then((response) => setSettings(response.settings))
      .catch(() => setSettings(null));
  }, []);

  if (!settings) return <div className="skeleton" style={{ height: 120 }} />;

  const save = async (updates: Partial<AppSettings>) => {
    const response = await apiPatch<{ ok: true; settings: AppSettings }>("/api/app-settings", { updates });
    setSettings(response.settings);
  };

  return (
    <div className="card stack">
      <h3>App Settings</h3>
      <label>Default model for routing</label>
      <select className="select" value={settings.routingModel} onChange={(e) => save({ routingModel: e.target.value as AppSettings["routingModel"] }).catch(() => undefined)}>
        <option value="haiku">Haiku (recommended)</option>
        <option value="sonnet">Sonnet</option>
        <option value="opus">Opus</option>
      </select>

      <label>Default model for generation</label>
      <select className="select" value={settings.generationModel} onChange={(e) => save({ generationModel: e.target.value as AppSettings["generationModel"] }).catch(() => undefined)}>
        <option value="sonnet">Sonnet (recommended)</option>
        <option value="haiku">Haiku</option>
        <option value="opus">Opus</option>
      </select>

      <label>
        <input type="checkbox" checked={settings.promptCaching} onChange={(e) => save({ promptCaching: e.target.checked }).catch(() => undefined)} />
        Prompt caching
      </label>

      <label>Monthly budget alert threshold</label>
      <input
        className="input"
        type="number"
        value={settings.monthlySpendLimit}
        onChange={(e) => setSettings((prev) => (prev ? { ...prev, monthlySpendLimit: Number(e.target.value) } : prev))}
      />
      <button className="btn btn-primary" onClick={() => save({ monthlySpendLimit: settings.monthlySpendLimit }).catch(() => undefined)}>Save Spend Limit</button>
    </div>
  );
}
