"use client";

import { useMemo } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TextBlock } from "@/components/chat/TextBlock";
import { PlanPreview } from "@/components/chat/PlanPreview";
import { ProgressBlock } from "@/components/chat/ProgressBlock";
import { ErrorBlock } from "@/components/chat/ErrorBlock";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { WorkflowSpec } from "@/components/chat/WorkflowSpec";
import { ResultsTable } from "@/components/chat/ResultsTable";

export type RenderMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; kind: "text"; text: string }
  | {
      id: string;
      role: "assistant";
      kind: "plan";
      plan: {
        planId: string;
        intent: string;
        module: string;
        risk: "none" | "low" | "medium" | "high";
        steps: Array<{ action: string; tool?: string }>;
        blockedReason?: string;
        requiresExactConfirmationText?: string;
      };
    }
  | { id: string; role: "assistant"; kind: "progress"; title: string; steps: Array<{ label: string; state: "pending" | "running" | "done" }> }
  | { id: string; role: "assistant"; kind: "code"; title: string; code: string }
  | { id: string; role: "assistant"; kind: "workflow"; spec: Record<string, unknown> }
  | { id: string; role: "assistant"; kind: "table"; title: string; rows: Array<Record<string, string | number | null | undefined>> }
  | { id: string; role: "assistant"; kind: "error"; message: string; moduleCode?: string };

export function ChatWindow({
  messages,
  confirmationText,
  onConfirmationText,
  onConfirmPlan,
  onCancelPlan,
  onRunDryRun,
  onDeployWorkflow,
  onRetry,
  onViewActivity
}: {
  messages: RenderMessage[];
  confirmationText: string;
  onConfirmationText: (value: string) => void;
  onConfirmPlan: (planId: string, exactText?: string) => void;
  onCancelPlan: (planId: string) => void;
  onRunDryRun: (code: string) => void;
  onDeployWorkflow: (spec: Record<string, unknown>) => void;
  onRetry: () => void;
  onViewActivity: () => void;
}) {
  const content = useMemo(
    () =>
      messages.map((message) => {
        if (message.role === "user") {
          return (
            <MessageBubble key={message.id} role="user">
              <TextBlock text={message.text} />
            </MessageBubble>
          );
        }

        if (message.kind === "text") {
          return (
            <MessageBubble key={message.id} role="assistant">
              <TextBlock text={message.text} />
            </MessageBubble>
          );
        }

        if (message.kind === "plan") {
          return (
            <MessageBubble key={message.id} role="assistant">
              <PlanPreview
                plan={message.plan}
                confirmationText={confirmationText}
                onConfirmationText={onConfirmationText}
                onConfirm={() => onConfirmPlan(message.plan.planId, message.plan.requiresExactConfirmationText)}
                onCancel={() => onCancelPlan(message.plan.planId)}
              />
            </MessageBubble>
          );
        }

        if (message.kind === "progress") {
          return (
            <MessageBubble key={message.id} role="assistant">
              <ProgressBlock title={message.title} steps={message.steps} />
            </MessageBubble>
          );
        }

        if (message.kind === "code") {
          return (
            <MessageBubble key={message.id} role="assistant">
              <CodeBlock title={message.title} code={message.code} onRunDryRun={() => onRunDryRun(message.code)} />
            </MessageBubble>
          );
        }

        if (message.kind === "workflow") {
          return (
            <MessageBubble key={message.id} role="assistant">
              <WorkflowSpec spec={message.spec} onDeployDisabled={() => onDeployWorkflow(message.spec)} />
            </MessageBubble>
          );
        }

        if (message.kind === "table") {
          return (
            <MessageBubble key={message.id} role="assistant">
              <ResultsTable title={message.title} rows={message.rows} />
            </MessageBubble>
          );
        }

        return (
          <MessageBubble key={message.id} role="assistant">
            <ErrorBlock message={message.message} moduleCode={message.moduleCode} onRetry={onRetry} onViewActivity={onViewActivity} />
          </MessageBubble>
        );
      }),
    [messages, confirmationText, onConfirmationText, onConfirmPlan, onCancelPlan, onRunDryRun, onDeployWorkflow, onRetry, onViewActivity]
  );

  return <div className="stack chat-history">{content}</div>;
}
