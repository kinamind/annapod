import type { CloudflareEnv, LlmMessage } from "./types";

function getChatBaseUrl(env: CloudflareEnv) {
  return (env.AI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
}

function getEmbeddingBaseUrl(env: CloudflareEnv) {
  return (env.EMBEDDING_BASE_URL || env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

export async function chatCompletion(
  env: CloudflareEnv,
  messages: LlmMessage[],
  options?: { temperature?: number }
) {
  const model = env.AI_MODEL || "glm-4.7-flashx";
  const body: Record<string, unknown> = {
    model,
    messages,
  };

  // Zhipu GLM-4.5+ enables chain-of-thought by default unless explicitly disabled.
  // For annapod's live chat-style workloads, disable it to reduce latency and avoid verbose reasoning behavior.
  if (/^glm-4\./.test(model)) {
    body.thinking = { type: "disabled" };
  }

  // GPT-5 family rejects custom temperature values in this API shape.
  if (typeof options?.temperature === "number" && !/^gpt-5(?:-|$)/.test(model)) {
    body.temperature = options.temperature;
  }

  const response = await fetch(`${getChatBaseUrl(env)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() || "";
}

export async function embedText(env: CloudflareEnv, text: string) {
  const provider = (env.EMBEDDING_PROVIDER || "openai_compatible").toLowerCase();
  const apiKey = env.EMBEDDING_API_KEY || env.AI_API_KEY;
  const input = text.slice(0, 4000);

  if (!apiKey) return [];

  if (provider === "google") {
    const endpoint = `${getEmbeddingBaseUrl(env)}/models/${env.EMBEDDING_MODEL || "gemini-embedding-2-preview"}:embedContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${env.EMBEDDING_MODEL || "gemini-embedding-2-preview"}`,
        content: { parts: [{ text: input }] },
      }),
    });

    if (!response.ok) return [];
    const json = (await response.json()) as { embedding?: { values?: number[] } };
    return json.embedding?.values || [];
  }

  const response = await fetch(`${getEmbeddingBaseUrl(env)}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.EMBEDDING_MODEL || "text-embedding-3-small",
      input,
    }),
  });

  if (!response.ok) return [];
  const json = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  return json.data?.[0]?.embedding || [];
}

export function tryParseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}
