"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export type ActivityEntry = {
  id: string;
  timestamp: string;
  action: string;
  objectType: string;
  recordId: string;
  description: string;
  status: string;
  module?: string;
  prompt?: string;
  before?: object;
  after?: object;
  error?: string;
};

export type ActivityFilters = {
  portalId: string;
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  objectType?: string;
  status?: string;
};

export function useActivity(filters: ActivityFilters) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!filters.portalId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const query = new URLSearchParams();
    query.set("portalId", filters.portalId);
    if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) query.set("dateTo", filters.dateTo);
    if (filters.action) query.set("action", filters.action);
    if (filters.objectType) query.set("objectType", filters.objectType);
    if (filters.status) query.set("status", filters.status);

    try {
      const response = await apiGet<{ ok: true; logs: ActivityEntry[] }>(`/api/activity?${query.toString()}`);
      setEntries(response.logs);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filters.portalId, filters.dateFrom, filters.dateTo, filters.action, filters.objectType, filters.status]);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  return { entries, loading, refresh };
}
