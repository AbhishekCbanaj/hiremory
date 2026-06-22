// One place for OpenAI-compatible (Groq) JSON chat calls.
//
// Groq validates `response_format: json_object` server-side and returns a 400
// with code "json_validate_failed" when the model emits malformed JSON — which
// llama models do often at the default temperature 1.0 (e.g. dropping the quote
// on a string value). We send temperature 0 to make output deterministic and
// well-formed, and on a validation failure we retry once with an explicit
// "valid JSON only" nudge. Throws with the real upstream message on hard errors.
export async function openaiJson(
  system: string,
  user: string,
  maxTokens: number,
): Promise<Record<string, unknown>> {
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const attempts = [
    { system, temperature: 0 },
    {
      system: system
        + " CRITICAL: output ONLY one valid, minified JSON object. Every string"
        + " value MUST be wrapped in double quotes. No prose, no markdown fences.",
      temperature: 0.2,
    },
  ];

  let lastErr = "AI request failed";
  for (const a of attempts) {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: a.temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: a.system },
          { role: "user", content: user },
        ],
      }),
    });
    const j = await r.json();

    if (r.ok) {
      const content = j?.choices?.[0]?.message?.content;
      if (content) {
        try { return JSON.parse(content); }
        catch (e) { lastErr = `AI returned unparseable JSON: ${(e as Error).message}`; continue; }
      }
      lastErr = `AI returned no content: ${JSON.stringify(j).slice(0, 250)}`;
      continue;
    }

    lastErr = `AI provider error ${r.status}: ${JSON.stringify(j?.error ?? j).slice(0, 250)}`;
    // Only a malformed-JSON failure is worth retrying; anything else (bad key,
    // unknown model, rate limit) will just fail again, so stop now.
    if (j?.error?.code !== "json_validate_failed") break;
  }
  throw new Error(lastErr);
}
