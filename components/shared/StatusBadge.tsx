"use client";

type BadgeStatus = "connected" | "disconnected" | "processing" | "error" | "sandbox" | "production";

export function StatusBadge({ status, label }: { status: BadgeStatus; label?: string }) {
  const text = label ?? status;
  return <span className={`badge badge-${status}`}>{text}</span>;
}
