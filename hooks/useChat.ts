"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatEvent } from "@/types/chat-events";

export function useChat() {
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const sendPrompt = useCallback(
    async (payload: { prompt: string; portalId: string; autoExecute?: boolean }, onEvent: (event: ChatEvent) => void) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Chat stream failed (${response.status})`);
        }

        if (!response.body) {
          throw new Error("Streaming not available");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const rawEvent of events) {
            const dataLine = rawEvent
              .split("\n")
              .map((line) => line.trim())
              .find((line) => line.startsWith("data:"));

            if (!dataLine) continue;
            const json = dataLine.replace(/^data:\s*/, "").trim();
            if (!json) continue;

            try {
              onEvent(JSON.parse(json) as ChatEvent);
            } catch {
              onEvent({ type: "error", message: "Failed to parse stream event" });
            }
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          onEvent({ type: "error", message: error instanceof Error ? error.message : "Chat request failed" });
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    []
  );

  return { sendPrompt, cancelStream, streaming };
}
