"use client";

export function MessageBubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div
      className="card"
      style={{
        marginLeft: role === "user" ? "22%" : 0,
        marginRight: role === "assistant" ? "12%" : 0,
        background: role === "user" ? "var(--primary)" : "var(--card)",
        color: role === "user" ? "#fff" : "var(--ink)"
      }}
    >
      {children}
    </div>
  );
}
