/* annapod - API Client */

import type {
  Token,
  User,
  RegisterRequest,
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
  TeamJoinPreview,
  TeamMemberSummary,
  TeamRecordSummary,
  TeamRole,
  TeamSpace,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

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
      ? localStorage.getItem("annapod_token")
      : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err: unknown) {
    const detail =
      err instanceof Error && err.message
        ? `网络请求失败: ${err.message}`
        : "网络请求失败，请检查后端服务与网络连接";
    throw new ApiError(0, detail);
  }

  if (!res.ok) {
    const fallbackText = await res.text().catch(() => "");
    let detail = res.statusText;
    try {
      const body = fallbackText ? (JSON.parse(fallbackText) as { detail?: string }) : null;
      detail = body?.detail || fallbackText || res.statusText;
    } catch {
      detail = fallbackText || res.statusText;
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ────────────────────────────────────────
export const auth = {
  register(data: RegisterRequest) {
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
    issue_tag?: string;
    team_id?: string;
    page?: number;
    page_size?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.group_tag) qs.set("group_tag", params.group_tag);
    if (params?.difficulty) qs.set("difficulty", params.difficulty);
    if (params?.issue_tag) qs.set("issue_tag", params.issue_tag);
    if (params?.team_id) qs.set("team_id", params.team_id);
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
      can_interact?: boolean;
      team_id?: string | null;
      team_kind?: "team" | "competition" | null;
      team_name?: string | null;
      session_group_id?: string;
      messages: Array<{ role: string; content: string }>;
      status: string;
      evaluation?: Record<string, unknown>;
      score?: number;
      current_emotion?: string;
      complaint_chain?: Array<{ stage: number; content: string }>;
      current_complaint_stage?: number;
      started_at?: string;
      time_limit_seconds?: number | null;
    }>(`/api/v1/simulator/sessions/${sessionId}`);
  },

  getSessionGroups() {
    return request<SessionGroup[]>("/api/v1/simulator/session-groups");
  },

  getSessions(params?: { group_id?: string; status?: string }) {
    const qs = new URLSearchParams();
    if (params?.group_id) qs.set("group_id", params.group_id);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<Array<{
      id: string;
      profile_id: string;
      team_id?: string | null;
      team_kind?: "team" | "competition" | null;
      team_name?: string | null;
      session_group_id?: string;
      status: string;
      started_at: string;
      ended_at?: string;
      duration_seconds?: number;
      score?: number;
      turn_count: number;
      profile_summary: string;
    }>>(`/api/v1/simulator/sessions${q ? `?${q}` : ""}`);
  },
};

// ─── Teams & Competitions ────────────────────────
export const teams = {
  list() {
    return request<TeamSpace[]>("/api/v1/teams");
  },

  create(data: {
    kind: "team" | "competition";
    name: string;
    description?: string;
    theme?: string;
    profile_group_tag?: string;
    profile_difficulty?: string;
    profile_issue_tag?: string;
    session_time_limit_minutes?: number;
    max_sessions_per_user?: number;
    training_start_at?: string;
    training_end_at?: string;
    agreement_title?: string;
    agreement_text?: string;
  }) {
    return request<TeamSpace>("/api/v1/teams", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getById(id: string) {
    return request<TeamSpace>(`/api/v1/teams/${id}`);
  },

  update(id: string, data: Partial<{
    name: string;
    description: string;
    theme: string;
    profile_group_tag: string;
    profile_difficulty: string;
    profile_issue_tag: string;
    session_time_limit_minutes: number;
    max_sessions_per_user: number;
    training_start_at: string;
    training_end_at: string;
    agreement_title: string;
    agreement_text: string;
    status: string;
  }>) {
    return request<TeamSpace>(`/api/v1/teams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  previewJoin(joinCode: string) {
    return request<TeamJoinPreview>(`/api/v1/teams/join-preview?code=${encodeURIComponent(joinCode)}`);
  },

  join(data: { join_code: string; accepted_agreement: boolean }) {
    return request<TeamSpace>("/api/v1/teams/join", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getMembers(id: string) {
    return request<TeamMemberSummary[]>(`/api/v1/teams/${id}/members`);
  },

  updateMemberRole(id: string, userId: string, role: TeamRole) {
    return request<{ ok: true }>(`/api/v1/teams/${id}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  getRecords(id: string) {
    return request<TeamRecordSummary[]>(`/api/v1/teams/${id}/records`);
  },

  getRecordsCsvUrl(id: string) {
    return `${API_BASE}/api/v1/teams/${id}/records?format=csv`;
  },

  getTranscriptsUrl(id: string, params?: { user_id?: string; session_id?: string }) {
    const qs = new URLSearchParams();
    if (params?.user_id) qs.set("user_id", params.user_id);
    if (params?.session_id) qs.set("session_id", params.session_id);
    return `${API_BASE}/api/v1/teams/${id}/transcripts${qs.toString() ? `?${qs.toString()}` : ""}`;
  },

  adjustMemberAttempts(id: string, userId: string, data: { action: "reset" | "add" | "subtract"; amount?: number }) {
    return request<{
      attempts_used_raw: number;
      attempts_adjustment: number;
      attempts_used_effective: number;
      attempts_remaining?: number | null;
    }>(`/api/v1/teams/${id}/members/${userId}/attempts`, {
      method: "POST",
      body: JSON.stringify(data),
    });
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

const api = { auth, simulator, knowledge, learning, teams };

export default api;
