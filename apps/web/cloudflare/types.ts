export interface FetcherBinding {
  fetch(request: Request): Promise<Response>;
}

export interface D1ResultLike<T = Record<string, unknown>> {
  results?: T[];
  success?: boolean;
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

export interface VectorizeLike {
  upsert(items: unknown[]): Promise<unknown>;
  query(vector: number[], options?: Record<string, unknown>): Promise<unknown>;
}

export interface CloudflareEnv {
  ASSETS: FetcherBinding;
  DB: D1DatabaseLike;
  MEMORY_INDEX?: VectorizeLike;
  AI_API_KEY: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_API_KEY?: string;
  EMBEDDING_BASE_URL?: string;
  EMBEDDING_MODEL?: string;
  JWT_SECRET: string;
  CORS_ORIGIN?: string;
}

export interface SeekerProfileRecord {
  id: string;
  age: string;
  gender: string;
  occupation: string;
  marital_status: string;
  symptoms: string;
  group_tag: string;
  difficulty: string;
  issue_tags?: string | null;
  report: string;
  conversation: string;
  portrait_raw?: string | null;
  source_id?: string | null;
}

export interface ProfileView {
  id: string;
  age: string;
  gender: string;
  occupation: string;
  marital_status: string;
  symptoms: string;
  group_tag: string;
  difficulty: string;
  issue_tags?: string | null;
  report: Record<string, unknown>;
  conversation: ConversationMessage[];
  portrait_raw: Record<string, unknown>;
  source_id?: string | null;
}

export interface ConversationMessage {
  role: "Counselor" | "Seeker";
  content: string;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ComplaintStage {
  stage: number;
  content: string;
}

export interface SessionSnapshot {
  sessionId: string;
  userId: string;
  profileId: string;
  sessionGroupId?: string | null;
  hasLongTermMemory: boolean;
  profile: {
    age: string;
    gender: string;
    occupation: string;
    marital_status: string;
    symptoms: string;
    difficulty?: string;
  };
  report: Record<string, unknown>;
  previousConversations: ConversationMessage[];
  situation: string;
  style: string[];
  status: string;
  sampleStatements: string[];
  complaintChain: ComplaintStage[];
  chainIndex: number;
  currentEmotion: string;
  systemPrompt: string;
  conversation: ConversationMessage[];
  llmMessages: LlmMessage[];
  turnCount: number;
  initSource: "fresh" | "resume" | "llm" | "heuristic_fallback";
  initDurationMs: number;
}

export interface EvaluationResult {
  overall_score: number;
  dimension_scores: Record<string, number>;
  mistakes: Array<Record<string, unknown>>;
  strengths: string[];
  feedback: string;
  tips: string[];
}
