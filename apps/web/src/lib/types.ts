/* annapod - Frontend Type Definitions */

// ─── Auth ────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  experience_level: string;
  specialization?: string;
  is_active: boolean;
  is_admin?: boolean;
  accepted_terms_version?: string;
  accepted_terms_at?: string;
  research_consent?: boolean;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  display_name: string;
  password: string;
  accepted_terms: boolean;
  accepted_terms_version: string;
}

// ─── Simulator ───────────────────────────────────
export interface SeekerProfile {
  id: string;
  age: string;
  gender: string;
  occupation: string;
  marital_status: string;
  symptoms: string;
  group_tag: string;
  difficulty: string;
  issue_tags?: string;
  source_id?: string;
}

export interface SeekerProfileList {
  profiles: SeekerProfile[];
  total: number;
  page: number;
  page_size: number;
}

export interface StartSessionRequest {
  profile_id: string;
  enable_long_term_memory?: boolean;
  session_group_id?: string;
  team_id?: string;
}

export interface StartSessionResponse {
  session_id: string;
  session_group_id?: string;
  profile_summary: string;
  session_number: number;
  init_source?: string;
  init_duration_ms?: number;
  time_limit_seconds?: number | null;
}

export interface ChatMessage {
  role: "counselor" | "client" | "system";
  content: string;
  emotion?: string;
  timestamp?: string;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  emotion?: string;
  current_complaint_stage?: number;
  turn_count: number;
}

export interface EndSessionResponse {
  session_id: string;
  status: string;
  evaluation?: Record<string, unknown>;
  score?: number;
  duration_seconds?: number;
  auto_ended?: boolean;
}

export interface SessionGroup {
  id: string;
  profile_id: string;
  team_id?: string | null;
  title: string;
  description?: string;
  session_count: number;
  status: string;
  profile_summary?: string;
  last_started_at?: string;
  completed_sessions?: number;
  active_sessions?: number;
}

export type TeamKind = "team" | "competition";
export type TeamRole = "owner" | "admin" | "member";

export interface TeamSpace {
  id: string;
  kind: TeamKind;
  name: string;
  description?: string;
  theme?: string;
  profile_group_tag?: string;
  profile_difficulty?: string;
  profile_issue_tag?: string;
  session_time_limit_minutes?: number | null;
  max_sessions_per_user?: number | null;
  training_start_at?: string;
  training_end_at?: string;
  status: string;
  role: TeamRole;
  join_code?: string;
  can_manage: boolean;
  agreement_title?: string;
  agreement_text?: string;
  agreement_version: number;
  member_count: number;
  active_members?: number;
  last_activity_at?: string;
}

export interface TeamJoinPreview {
  id: string;
  kind: TeamKind;
  name: string;
  description?: string;
  theme?: string;
  profile_group_tag?: string;
  profile_difficulty?: string;
  profile_issue_tag?: string;
  session_time_limit_minutes?: number | null;
  max_sessions_per_user?: number | null;
  training_start_at?: string;
  training_end_at?: string;
  agreement_title?: string;
  agreement_text?: string;
  agreement_version: number;
  is_member: boolean;
}

export interface TeamMemberSummary {
  user_id: string;
  display_name: string;
  username: string;
  email: string;
  role: TeamRole;
  joined_at: string;
  total_sessions: number;
  completed_sessions: number;
  active_sessions: number;
  average_score: number | null;
  last_activity_at?: string;
  attempts_used_raw: number;
  attempts_adjustment: number;
  attempts_used_effective: number;
  attempts_remaining?: number | null;
}

export interface TeamRecordSummary {
  session_id: string;
  user_id: string;
  participant_display_name: string;
  participant_username: string;
  participant_email: string;
  profile_id: string;
  session_group_id?: string | null;
  status: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  score?: number | null;
  profile_summary: string;
  feedback?: string;
  team_id: string;
  team_kind: TeamKind;
  team_name: string;
}

// ─── Knowledge Base ──────────────────────────────
export interface KnowledgeItem {
  id: string;
  school: string;
  issue: string;
  difficulty: string;
  title: string;
  content: string;
  summary?: string;
  source_type: string;
  source_ref?: string;
  tags: string[];
}

export interface KnowledgeSearchParams {
  query?: string;
  school?: string;
  issue?: string;
  difficulty?: string;
  source_type?: string;
  page?: number;
  page_size?: number;
}

export interface KnowledgeSearchResult {
  items: KnowledgeItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface KnowledgeDimensions {
  schools: string[];
  issues: string[];
  difficulties: { key: string; label: string; description: string }[];
}

// ─── Learning Path ───────────────────────────────
export interface PerformanceRecord {
  id: string;
  session_id: string;
  overall_score: number;
  dimension_scores: Record<string, number>;
  mistakes: { type: string; description: string; suggestion: string }[];
  strengths: string[];
  feedback: string;
  tips: string[];
  difficulty: string;
  issue_type?: string;
  created_at: string;
}

export interface Dashboard {
  total_sessions: number;
  total_practice_hours: number;
  average_score: number;
  dimension_averages: Record<string, number>;
  recent_scores: { session_id: string; score: number; date: string }[];
  growth_curve: { date: string; score: number }[];
  weak_dimensions: { dim: string; avg: number }[];
  common_mistakes: { type: string; count: number }[];
  recommendations: Recommendation[];
}

export interface GrowthCurve {
  data_points: {
    date: string;
    overall_score: number;
    dimension_scores: Record<string, number>;
  }[];
  trend: "improving" | "stable" | "declining";
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  recommendation_type: string;
  priority: number;
  reason: string;
  knowledge_item_id?: string;
  profile_id?: string;
  is_read: boolean;
  is_completed: boolean;
  created_at: string;
}

// ─── Evaluation Dimensions ───────────────────────
export const EVAL_DIMENSIONS: Record<string, string> = {
  empathy: "共情能力",
  active_listening: "积极倾听",
  questioning: "提问技术",
  reflection: "反映技术",
  confrontation: "面质技术",
  goal_setting: "目标设定",
  crisis_handling: "危机处理",
  theoretical_application: "理论运用",
};

// ─── Knowledge Dimension Constants ───────────────
export const SCHOOL_OPTIONS = [
  "CBT（认知行为疗法）",
  "精神分析/精神动力学",
  "人本主义/人格中心",
  "家庭治疗/系统治疗",
  "接纳承诺疗法（ACT）",
  "正念疗法",
  "焦点解决短程治疗（SFBT）",
  "叙事疗法",
  "格式塔/完形疗法",
  "整合取向",
];

export const ISSUE_OPTIONS = [
  "抑郁", "焦虑", "创伤与PTSD", "亲密关系", "家庭冲突",
  "青少年成长", "职场压力", "自我认同", "丧失与哀伤",
  "成瘾行为", "进食障碍", "睡眠障碍", "躯体化症状", "危机干预",
];

export const DIFFICULTY_LEVELS = [
  { key: "beginner", label: "初级", description: "初次访谈、建立关系、基本倾听与共情" },
  { key: "intermediate", label: "中级", description: "阻抗处理、情感反映、认知重构" },
  { key: "advanced", label: "高级", description: "危机干预、深层洞察、移情与反移情处理" },
];
