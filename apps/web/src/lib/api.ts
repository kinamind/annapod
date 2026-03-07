/* MindBridge - API Client */

import type {
  Token,
  User,
  SeekerProfileList,
  StartSessionRequest,
  StartSessionResponse,
  ChatResponse,
  EndSessionResponse,
  SessionGroup,
  KnowledgeSearchParams,
  KnowledgeSearchResult,
  KnowledgeDimensions,
  KnowledgeItem,
  Dashboard,
  GrowthCurve,
  PerformanceRecord,
  Recommendation,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("mindbridge_token")
      : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ────────────────────────────────────────
export const auth = {
  register(data: {
    email: string;
    username: string;
    display_name: string;
    password: string;
  }) {
    return request<Token>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  login(username: string, password: string) {
    // OAuth2 expects form data
    const body = new URLSearchParams({ username, password });
    return request<Token>("/api/v1/auth/login", {
      method: "POST",
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },

  me() {
    return request<User>("/api/v1/auth/me");
  },

  updateMe(data: Partial<User>) {
    return request<User>("/api/v1/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};

// ─── Simulator ───────────────────────────────────
export const simulator = {
  getProfiles(params?: {
    group_tag?: string;
    difficulty?: string;
    page?: number;
    page_size?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.group_tag) qs.set("group_tag", params.group_tag);
    if (params?.difficulty) qs.set("difficulty", params.difficulty);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    const q = qs.toString();
    return request<SeekerProfileList>(
      `/api/v1/simulator/profiles${q ? `?${q}` : ""}`
    );
  },

  getGroups() {
    return request<SessionGroup[]>("/api/v1/simulator/profiles/groups");
  },

  startSession(data: StartSessionRequest) {
    return request<StartSessionResponse>("/api/v1/simulator/sessions/start", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  chat(sessionId: string, message: string) {
    return request<ChatResponse>("/api/v1/simulator/sessions/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, message }),
    });
  },

  endSession(sessionId: string) {
    return request<EndSessionResponse>("/api/v1/simulator/sessions/end", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  getSession(sessionId: string) {
    return request<{
      id: string;
      profile_id: string;
      messages: Array<{ role: string; content: string }>;
      status: string;
      evaluation?: Record<string, unknown>;
      score?: number;
    }>(`/api/v1/simulator/sessions/${sessionId}`);
  },

  getSessionGroups() {
    return request<SessionGroup[]>("/api/v1/simulator/session-groups");
  },
};

// ─── Knowledge Base ──────────────────────────────
export const knowledge = {
  getDimensions() {
    return request<KnowledgeDimensions>("/api/v1/knowledge/dimensions");
  },

  search(params: KnowledgeSearchParams) {
    return request<KnowledgeSearchResult>("/api/v1/knowledge/search", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  getById(id: string) {
    return request<KnowledgeItem>(`/api/v1/knowledge/${id}`);
  },

  getStats() {
    return request<{
      total_items: number;
      schools: Record<string, number>;
      issues: Record<string, number>;
      difficulties: Record<string, number>;
    }>("/api/v1/knowledge/stats/overview");
  },
};

// ─── Learning Path ───────────────────────────────
export const learning = {
  getDashboard() {
    return request<Dashboard>("/api/v1/learning/dashboard");
  },

  getGrowthCurve(period?: string) {
    const q = period ? `?period=${period}` : "";
    return request<GrowthCurve>(`/api/v1/learning/growth-curve${q}`);
  },

  getMistakes(page = 1, pageSize = 20) {
    return request<{
      mistakes: Array<{
        id: string;
        type: string;
        description: string;
        frequency: number;
        severity: string;
        recent_session: string;
        suggestion: string;
      }>;
      total: number;
      page: number;
      page_size: number;
    }>(`/api/v1/learning/mistakes?page=${page}&page_size=${pageSize}`);
  },

  getRecommendations() {
    return request<Recommendation[]>("/api/v1/learning/recommendations");
  },

  getDimensions() {
    return request<
      Record<string, { score: number; trend: string; sessions_count: number }>
    >("/api/v1/learning/dimensions");
  },

  getSessionEvaluation(sessionId: string) {
    return request<PerformanceRecord>(
      `/api/v1/learning/sessions/${sessionId}/evaluation`
    );
  },
};

export default { auth, simulator, knowledge, learning };
