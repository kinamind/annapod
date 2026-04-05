/* eslint-disable @typescript-eslint/no-explicit-any */

import { embedText } from "./llm";
import type { CloudflareEnv, SessionSnapshot } from "./types";

export async function queryLongTermMemory(
  env: CloudflareEnv,
  userId: string,
  profileId: string,
  utterance: string
) {
  if (!env.MEMORY_INDEX) return "";
  const vector = await embedText(env, utterance);
  if (!vector.length) return "";

  try {
    const result = (await env.MEMORY_INDEX.query(vector, {
      topK: 6,
      returnMetadata: "all",
      filter: { userId, profileId },
    })) as any;
    const matches = (result?.matches || result?.results || []) as Array<{ metadata?: Record<string, unknown> }>;
    return matches
      .map((item) => String(item.metadata?.content || ""))
      .filter(Boolean)
      .slice(0, 3)
      .join("\n");
  } catch {
    const fallback = await env.DB
      .prepare(
        `SELECT content FROM long_term_memory_chunks
         WHERE user_id = ? AND profile_id = ?
         ORDER BY created_at DESC LIMIT 3`
      )
      .bind(userId, profileId)
      .all<{ content: string }>();
    return (fallback.results || []).map((item) => item.content).join("\n");
  }
}

export async function indexLongTermMemory(env: CloudflareEnv, snapshot: SessionSnapshot) {
  if (!env.MEMORY_INDEX) return;
  const upserts: Array<Record<string, unknown>> = [];

  for (let i = 0; i < snapshot.llmMessages.length; i += 1) {
    const message = snapshot.llmMessages[i];
    if (message.role === "system" || !message.content) continue;
    const values = await embedText(env, message.content);
    if (!values.length) continue;

    const id = `${snapshot.sessionId}:${i}`;
    upserts.push({
      id,
      values,
      metadata: {
        userId: snapshot.userId,
        profileId: snapshot.profileId,
        sessionId: snapshot.sessionId,
        role: message.role,
        content: message.content,
      },
    });

    await env.DB
      .prepare(
        `INSERT OR REPLACE INTO long_term_memory_chunks
         (id, user_id, profile_id, session_id, turn_index, role, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        snapshot.userId,
        snapshot.profileId,
        snapshot.sessionId,
        i,
        message.role,
        message.content,
        new Date().toISOString()
      )
      .run();
  }

  if (upserts.length) {
    await env.MEMORY_INDEX.upsert(upserts);
  }
}
