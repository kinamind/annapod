import type { CloudflareEnv } from "./types";

export function jsonResponse(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export function errorResponse(detail: string, status = 400) {
  return jsonResponse({ detail }, status);
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export async function readForm(request: Request) {
  const raw = await request.text();
  return new URLSearchParams(raw);
}

export function nowIso() {
  return new Date().toISOString();
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function jsonText(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  keys: K[]
) {
  return keys.reduce((acc, key) => {
    if (value[key] !== undefined) {
      acc[key] = value[key];
    }
    return acc;
  }, {} as Record<K, T[K]>);
}

export function corsHeaders(request: Request, env: CloudflareEnv) {
  const origin = request.headers.get("Origin") || env.CORS_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  };
}

export function buildSqlFilters(filters: Array<[string, unknown]>) {
  const where: string[] = [];
  const values: unknown[] = [];

  for (const [clause, value] of filters) {
    if (value !== undefined && value !== null && value !== "") {
      where.push(clause);
      values.push(value);
    }
  }

  return {
    clause: where.length ? ` WHERE ${where.join(" AND ")}` : "",
    values,
  };
}

export function decodeRow<T>(row: T | null) {
  if (!row) throw new Error("NOT_FOUND");
  return row;
}
