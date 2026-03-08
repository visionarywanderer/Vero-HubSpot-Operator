import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { orchestrator } from "@/lib/orchestrator";
import type { ChatEvent } from "@/types/chat-events";

function serializeSse(event: ChatEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(serializeSse({ type: "error", message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" }
    });
  }

  const body = (await req.json()) as {
    prompt?: string;
    portalId?: string;
    autoExecute?: boolean;
    confirmationText?: string;
  };

  if (!body.prompt || !body.prompt.trim()) {
    return new Response(serializeSse({ type: "error", message: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" }
    });
  }

  if (!body.portalId) {
    return new Response(serializeSse({ type: "error", message: "portalId is required" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" }
    });
  }

  const autoExecute = Boolean(body.autoExecute ?? true);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (event: ChatEvent) => controller.enqueue(encoder.encode(serializeSse(event)));

      try {
        write({ type: "thinking", message: "Analyzing your request..." });

        const plan = await orchestrator.processPrompt(body.prompt || "", body.portalId as string);
        write({ type: "plan", plan });

        if (plan.blockedReason) {
          write({ type: "error", message: plan.blockedReason });
          write({ type: "done" });
          controller.close();
          return;
        }

        if (plan.requiresConfirmation || !autoExecute) {
          write({ type: "done" });
          controller.close();
          return;
        }

        const total = plan.steps.length;
        for (let i = 0; i < total; i++) {
          const step = plan.steps[i];
          write({ type: "step_start", index: i + 1, total, step: step.action });
          write({ type: "step_complete", index: i + 1, total, step: step.action });
        }

        const result = await orchestrator.confirmAndExecute(plan.planId, body.confirmationText || "confirm");
        if (result.status === "blocked") {
          write({ type: "error", message: result.message || "Execution blocked" });
        } else {
          for (const output of result.outputs) {
            write({ type: "result", output });
          }
        }

        write({ type: "done" });
        controller.close();
      } catch (error) {
        write({ type: "error", message: error instanceof Error ? error.message : "Chat processing failed" });
        write({ type: "done" });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
