"use client";

export function LoadingSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 12,
              flex: i === 0 ? 2 : 1,
              background: "var(--line)",
              borderRadius: 4,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={colIdx}
              style={{
                height: 16,
                flex: colIdx === 0 ? 2 : 1,
                background: "var(--line)",
                borderRadius: 4,
                opacity: 0.6,
                animation: `pulse 1.5s ease-in-out ${rowIdx * 0.1}s infinite`,
              }}
            />
          ))}
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32, color: "var(--muted)", fontSize: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 16,
          height: 16,
          border: "2px solid var(--line)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        Loading...
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
