import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "@/lib/env";

export function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY });
}
