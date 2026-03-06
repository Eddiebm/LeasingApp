import { getAdminClient } from "./apiAuth";

export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

/**
 * Log AI token usage for command center. Fire-and-forget; does not throw.
 */
export function logAiUsage(source: string, model: string, usage: Usage): void {
  const prompt = Math.max(0, Number(usage.prompt_tokens) || 0);
  const completion = Math.max(0, Number(usage.completion_tokens) || 0);
  const total = Math.max(0, Number(usage.total_tokens) || prompt + completion);
  try {
    const db = getAdminClient();
    db.from("ai_usage_log")
      .insert({ source, model, prompt_tokens: prompt, completion_tokens: completion, total_tokens: total })
      .then(({ error }) => {
        if (error) console.error("ai_usage_log insert:", error);
      })
      .catch((e) => console.error("ai_usage_log:", e));
  } catch (e) {
    console.error("ai_usage_log getAdminClient:", e);
  }
}
