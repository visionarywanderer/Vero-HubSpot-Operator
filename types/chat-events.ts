export type RiskLevel = "none" | "low" | "medium" | "high";

export type ChatEvent =
  | { type: "thinking"; message: string }
  | {
      type: "plan";
      plan: {
        planId: string;
        intent: string;
        layer: "mcp" | "api" | "script";
        module: string;
        steps: Array<{ action: string; tool?: string; layer?: string }>;
        requiresConfirmation: boolean;
        risk: RiskLevel;
        preview?: string;
        blockedReason?: string;
        requiresExactConfirmationText?: string;
      };
    }
  | { type: "step_start"; index: number; total: number; step: string }
  | { type: "step_complete"; index: number; total: number; step: string }
  | { type: "result"; output: unknown }
  | { type: "error"; message: string }
  | { type: "done" };
