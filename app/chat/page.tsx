"use client";

import { useEffect, useMemo, useState } from "react";
import { PromptSidebar } from "@/components/prompts/PromptSidebar";
import { ChatWindow, type RenderMessage } from "@/components/chat/ChatWindow";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { ToastStack, type Toast } from "@/components/shared/ToastStack";
import { usePortal } from "@/hooks/usePortal";
import { useChat } from "@/hooks/useChat";
import { apiGet, apiPost } from "@/lib/api";
import type { ChatEvent } from "@/types/chat-events";
import type { PromptItem } from "@/components/prompts/PromptCard";

type PendingAction =
  | { kind: "dry-run"; code: string }
  | { kind: "deploy"; spec: Record<string, unknown> }
  | null;

type PlanPayload = Extract<RenderMessage, { kind: "plan" }>;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseResultOutput(output: unknown): RenderMessage[] {
  if (!output || typeof output !== "object") {
    return [{ id: uid(), role: "assistant", kind: "text", text: String(output) }];
  }

  const obj = output as Record<string, unknown>;

  if (obj.script && typeof obj.script === "object") {
    const script = obj.script as Record<string, unknown>;
    const code = String(script.code || "");
    const title = `Generated Script: ${String(script.description || script.id || "script")}`;
    const messages: RenderMessage[] = [{ id: uid(), role: "assistant", kind: "code", title, code }];

    const result = obj.result as Record<string, unknown> | undefined;
    if (result) {
      messages.push({
        id: uid(),
        role: "assistant",
        kind: "table",
        title: "Script Result",
        rows: [
          {
            mode: String(result.mode || ""),
            recordsAnalyzed: Number(result.recordsAnalyzed || 0),
            recordsChanged: Number(result.recordsChanged || 0),
            errors: Number(result.errors || 0)
          }
        ]
      });
    }

    return messages;
  }

  if (obj.name && obj.type && Array.isArray(obj.actions)) {
    return [{ id: uid(), role: "assistant", kind: "workflow", spec: obj }];
  }

  if (obj.results && Array.isArray(obj.results) && obj.results.length && typeof obj.results[0] === "object") {
    return [{ id: uid(), role: "assistant", kind: "table", title: "Results", rows: obj.results as Array<Record<string, string | number | null | undefined>> }];
  }

  return [{ id: uid(), role: "assistant", kind: "text", text: JSON.stringify(obj, null, 2) }];
}

export default function ChatPage() {
  const { activePortal } = usePortal();
  const { sendPrompt, streaming, cancelStream } = useChat();

  const [messages, setMessages] = useState<RenderMessage[]>([]);
  const [input, setInput] = useState("");
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [confirmationText, setConfirmationText] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const portalLabel = useMemo(() => {
    if (!activePortal) return "";
    return `${activePortal.name} (${activePortal.environment})`;
  }, [activePortal]);

  const notify = (tone: Toast["tone"], message: string) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  useEffect(() => {
    setLoadingPrompts(true);
    apiGet<{ ok: true; prompts: PromptItem[] }>("/api/prompts")
      .then((response) => setPrompts(response.prompts))
      .catch(() => setPrompts([]))
      .finally(() => setLoadingPrompts(false));
  }, []);

  const updateProgress = (index: number, state: "running" | "done") => {
    setMessages((prev) => {
      const next = [...prev];
      const progressIndex = [...next].reverse().findIndex((message) => message.role === "assistant" && message.kind === "progress");
      if (progressIndex < 0) return prev;

      const absolute = next.length - 1 - progressIndex;
      const progress = next[absolute] as Extract<RenderMessage, { kind: "progress" }>;
      const steps = progress.steps.map((step, i) => {
        if (i + 1 < index) return { ...step, state: "done" as const };
        if (i + 1 === index) return { ...step, state };
        return step;
      });

      next[absolute] = { ...progress, steps };
      return next;
    });
  };

  const handleEvent = (event: ChatEvent) => {
    if (event.type === "thinking") {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", kind: "text", text: event.message }]);
      return;
    }

    if (event.type === "plan") {
      const planMessage: PlanPayload = {
        id: uid(),
        role: "assistant",
        kind: "plan",
        plan: {
          planId: event.plan.planId,
          intent: event.plan.intent,
          module: event.plan.module,
          risk: event.plan.risk,
          steps: event.plan.steps,
          blockedReason: event.plan.blockedReason,
          requiresExactConfirmationText: event.plan.requiresExactConfirmationText
        }
      };

      const progressMessage: RenderMessage = {
        id: uid(),
        role: "assistant",
        kind: "progress",
        title: event.plan.intent,
        steps: event.plan.steps.map((step) => ({ label: step.action, state: "pending" as const }))
      };

      setMessages((prev) => [...prev, planMessage, ...(event.plan.requiresConfirmation ? [] : [progressMessage])]);
      return;
    }

    if (event.type === "step_start") {
      updateProgress(event.index, "running");
      return;
    }

    if (event.type === "step_complete") {
      updateProgress(event.index, "done");
      return;
    }

    if (event.type === "result") {
      const rendered = parseResultOutput(event.output);
      setMessages((prev) => [...prev, ...rendered]);
      return;
    }

    if (event.type === "error") {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", kind: "error", message: event.message }]);
      notify("error", event.message);
      return;
    }

    if (event.type === "done") {
      notify("success", "Operation stream complete.");
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!activePortal) {
      notify("error", "Select a portal first.");
      return;
    }

    setMessages((prev) => [...prev, { id: uid(), role: "user", text }]);
    setInput("");
    await sendPrompt({ prompt: text, portalId: activePortal.id, autoExecute: true }, handleEvent);
  };

  const onInsertPrompt = (text: string, parameters?: Record<string, string>) => {
    let resolved = text;
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        resolved = resolved.replaceAll(`{${key}}`, value);
      }
    }
    setInput(resolved);
  };

  const confirmPlan = async (planId: string, exactText?: string) => {
    try {
      const confirmation = exactText ? confirmationText : "confirm";
      const response = await apiPost<{ ok: true; result: { status: string; outputs: unknown[]; message?: string } }>("/api/chat/confirm", {
        planId,
        confirmationText: confirmation
      });

      if (response.result.status === "blocked") {
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", kind: "error", message: response.result.message || "Execution blocked" }]);
        return;
      }

      for (const output of response.result.outputs || []) {
        const rendered = parseResultOutput(output);
        setMessages((prev) => [...prev, ...rendered]);
      }

      notify("success", "Plan executed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Confirmation failed";
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", kind: "error", message }]);
      notify("error", message);
    }
  };

  const cancelPlan = async (planId: string) => {
    await apiPost("/api/chat/cancel", { planId }).catch(() => undefined);
    notify("info", "Plan cancelled.");
  };

  const runDryRunFromCode = (code: string) => {
    setPendingAction({ kind: "dry-run", code });
  };

  const deployWorkflow = (spec: Record<string, unknown>) => {
    setPendingAction({ kind: "deploy", spec });
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;

    if (pendingAction.kind === "deploy") {
      try {
        const resp = await apiPost<{ ok: boolean; result?: unknown; errors?: string[] }>("/api/workflows/deploy", { portalId: activePortal?.id, spec: pendingAction.spec });
        if (!resp.ok) {
          notify("error", (resp.errors || ["Deploy failed"]).join(", "));
        } else {
          notify("success", "Workflow deployed disabled.");
        }
      } catch (error) {
        notify("error", error instanceof Error ? error.message : "Deploy failed");
      }
    }

    if (pendingAction.kind === "dry-run") {
      notify("info", "Dry-run execution is available from generated script output flow.");
    }

    setPendingAction(null);
  };

  return (
    <div className="chat-layout">
      {loadingPrompts ? (
        <aside className="card stack prompt-sidebar">
          <h3>Prompt Library</h3>
          <div className="skeleton" style={{ height: 36 }} />
          <div className="skeleton" style={{ height: 72 }} />
          <div className="skeleton" style={{ height: 72 }} />
        </aside>
      ) : (
        <PromptSidebar prompts={prompts} onInsert={onInsertPrompt} />
      )}

      <section className="card stack">
        <ChatWindow
          messages={messages}
          confirmationText={confirmationText}
          onConfirmationText={setConfirmationText}
          onConfirmPlan={confirmPlan}
          onCancelPlan={cancelPlan}
          onRunDryRun={runDryRunFromCode}
          onDeployWorkflow={deployWorkflow}
          onRetry={() => send().catch(() => undefined)}
          onViewActivity={() => (window.location.href = activePortal ? `/activity?portalId=${encodeURIComponent(activePortal.id)}` : "/activity")}
        />
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => send().catch(() => undefined)}
          disabled={streaming || !activePortal}
          portalLabel={portalLabel}
        />

        {streaming ? (
          <button className="btn btn-ghost" onClick={cancelStream}>Stop Streaming</button>
        ) : null}
      </section>

      <ConfirmModal
        open={Boolean(pendingAction)}
        title={pendingAction?.kind === "deploy" ? "Deploy Workflow" : "Run Dry-Run"}
        message={
          pendingAction?.kind === "deploy"
            ? "This will create a DISABLED workflow in the active portal. Continue?"
            : "Run dry-run for generated script?"
        }
        confirmLabel={pendingAction?.kind === "deploy" ? "Deploy Disabled" : "Run Dry-Run"}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => executePendingAction().catch(() => undefined)}
      />

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
