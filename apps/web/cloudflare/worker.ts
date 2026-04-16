/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-anonymous-default-export */

import { getAuthUserId, hashPassword, signJwt, verifyPassword } from "./auth";
import { DIFFICULTY_LEVELS, EVALUATION_DIMENSIONS, GROUP_OPTIONS, ISSUE_OPTIONS, SCHOOL_OPTIONS } from "./constants";
import { indexLongTermMemory } from "./memory";
import { chatWithSnapshot, createInitialSnapshot } from "./session-engine";
import { buildSystemPrompt, evaluateSession, inferEmotion } from "./simulator";
import type { CloudflareEnv, ProfileView, SeekerProfileCacheRecord, SeekerProfileRecord, SessionSnapshot } from "./types";
import { buildSqlFilters, corsHeaders, errorResponse, jsonResponse, jsonText, nowIso, readForm, readJson, safeJsonParse } from "./utils";

const REGISTRATION_TERMS_VERSION = "annapod-research-terms-v1";

function createJoinCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function getTeamMembership(env: CloudflareEnv, teamId: string, userId: string) {
  return env.DB
    .prepare(`SELECT * FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'`)
    .bind(teamId, userId)
    .first<any>();
}

function canManageTeam(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

async function getTeamById(env: CloudflareEnv, teamId: string) {
  return env.DB.prepare(`SELECT * FROM teams WHERE id = ?`).bind(teamId).first<any>();
}

function teamSummary(row: any, membership: any) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    theme: row.theme,
    profile_group_tag: row.profile_group_tag,
    profile_difficulty: row.profile_difficulty,
    profile_issue_tag: row.profile_issue_tag,
    session_time_limit_minutes: row.session_time_limit_minutes == null ? null : Number(row.session_time_limit_minutes),
    max_sessions_per_user: row.max_sessions_per_user == null ? null : Number(row.max_sessions_per_user),
    training_start_at: row.training_start_at,
    training_end_at: row.training_end_at,
    status: row.status,
    role: membership?.role || "member",
    join_code: canManageTeam(membership?.role) ? row.join_code : undefined,
    can_manage: canManageTeam(membership?.role),
    agreement_title: row.agreement_title,
    agreement_text: row.agreement_text,
    agreement_version: Number(row.agreement_version || 1),
    member_count: Number(row.member_count || 0),
    active_members: Number(row.active_members || 0),
    last_activity_at: row.last_activity_at,
  };
}

async function finalizeSession(
  env: CloudflareEnv,
  session: any,
  snapshot: SessionSnapshot,
  userId: string,
  options?: { autoEnded?: boolean }
) {
  const counselorTurns = snapshot.conversation.filter((item) => item.role === "Counselor").length;
  const seekerTurns = snapshot.conversation.filter((item) => item.role === "Seeker").length;
  if (!counselorTurns || !seekerTurns || snapshot.turnCount < 1) {
    return errorResponse("当前没有可评估的有效咨询对话，请先完成至少一轮咨访互动。", 400);
  }

  let evaluation;
  try {
    evaluation = await evaluateSession(env, snapshot);
  } catch (error: unknown) {
    return errorResponse(
      error instanceof Error ? error.message : "会话评估失败，请稍后重试。",
      503
    );
  }

  const endedAt = nowIso();
  const durationSeconds = Math.max(1, Math.floor((Date.parse(endedAt) - Date.parse(session.started_at)) / 1000));

  await env.DB
    .prepare(
      `UPDATE counseling_sessions
       SET messages = ?, runtime_state = ?, chain_index = ?, status = 'completed', ended_at = ?, duration_seconds = ?, evaluation = ?, score = ?
       WHERE id = ?`
    )
    .bind(
      jsonText(snapshot.conversation),
      jsonText(snapshot),
      snapshot.chainIndex,
      endedAt,
      durationSeconds,
      jsonText(evaluation),
      evaluation.overall_score,
      session.id
    )
    .run();

  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO performance_records
       (id, user_id, session_id, overall_score, dimension_scores, mistakes, strengths, feedback, tips, difficulty, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      session.id,
      evaluation.overall_score,
      jsonText(evaluation.dimension_scores),
      jsonText(evaluation.mistakes),
      jsonText(evaluation.strengths),
      evaluation.feedback,
      jsonText(evaluation.tips),
      snapshot.profile.difficulty || "intermediate",
      endedAt
    )
    .run();

  if (snapshot.hasLongTermMemory) {
    await indexLongTermMemory(env, snapshot);
  }

  return jsonResponse({
    session_id: session.id,
    status: "completed",
    evaluation,
    score: evaluation.overall_score / 10,
    duration_seconds: durationSeconds,
    auto_ended: Boolean(options?.autoEnded),
  });
}

function toProfile(record: SeekerProfileRecord): ProfileView {
  return {
    id: record.id,
    age: record.age,
    gender: record.gender,
    occupation: record.occupation,
    marital_status: record.marital_status,
    symptoms: record.symptoms,
    group_tag: record.group_tag,
    difficulty: record.difficulty,
    issue_tags: record.issue_tags,
    report: safeJsonParse(record.report, {}),
    conversation: safeJsonParse(record.conversation, []),
    portrait_raw: safeJsonParse(record.portrait_raw || "{}", {}),
    source_id: record.source_id,
  };
}

function snapshotFromCache(
  cache: SeekerProfileCacheRecord,
  input: {
    sessionId: string;
    userId: string;
    profileId: string;
    sessionGroupId?: string | null;
    hasLongTermMemory: boolean;
    profile: SessionSnapshot["profile"];
    report: Record<string, unknown>;
    previousConversations: SessionSnapshot["previousConversations"];
  }
): SessionSnapshot {
  const snapshot: SessionSnapshot = {
    sessionId: input.sessionId,
    userId: input.userId,
    profileId: input.profileId,
    sessionGroupId: input.sessionGroupId || null,
    hasLongTermMemory: input.hasLongTermMemory,
    profile: input.profile,
    report: input.report,
    previousConversations: input.previousConversations,
    situation: cache.situation,
    style: safeJsonParse(cache.style, []),
    status: cache.status,
    sampleStatements: input.previousConversations
      .filter((item) => item.role === "Seeker")
      .slice(0, 3)
      .map((item) => item.content),
    complaintChain: safeJsonParse(cache.complaint_chain, []),
    chainIndex: 1,
    currentEmotion: cache.current_emotion || "confusion",
    systemPrompt: "",
    conversation: [],
    llmMessages: [],
    turnCount: 0,
    initSource: "cache",
    initDurationMs: 0,
  };
  snapshot.currentEmotion = inferEmotion(snapshot);
  snapshot.systemPrompt = buildSystemPrompt(snapshot);
  return snapshot;
}

async function requireUser(request: Request, env: CloudflareEnv) {
  const userId = await getAuthUserId(request, env);
  if (!userId) return null;
  return userId;
}

async function listProfiles(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("page_size") || 20);
  const groupTag = url.searchParams.get("group_tag") || "";
  const difficulty = url.searchParams.get("difficulty") || "";
  const issueTag = url.searchParams.get("issue_tag") || "";
  const teamId = url.searchParams.get("team_id") || "";

  let effectiveGroupTag = groupTag;
  let effectiveDifficulty = difficulty;
  let effectiveIssueTag = issueTag;

  if (teamId) {
    const membership = await getTeamMembership(env, teamId, userId);
    if (!membership) return errorResponse("无权访问该团队/比赛的训练范围", 403);
    const team = await getTeamById(env, teamId);
    if (!team) return errorResponse("团队/比赛不存在", 404);
    effectiveGroupTag = team.profile_group_tag || effectiveGroupTag;
    effectiveDifficulty = team.profile_difficulty || effectiveDifficulty;
    effectiveIssueTag = team.profile_issue_tag || effectiveIssueTag;
  }

  const filters = buildSqlFilters([
    ["group_tag = ?", effectiveGroupTag],
    ["difficulty = ?", effectiveDifficulty],
    ["issue_tags LIKE ?", effectiveIssueTag ? `%${effectiveIssueTag}%` : ""],
  ]);

  const totalRow = await env.DB
    .prepare(`SELECT COUNT(*) AS total FROM seeker_profiles${filters.clause}`)
    .bind(...filters.values)
    .first<{ total: number }>();

  const rows = await env.DB
    .prepare(
      `SELECT * FROM seeker_profiles${filters.clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(...filters.values, pageSize, (page - 1) * pageSize)
    .all<SeekerProfileRecord>();

  return jsonResponse({
    profiles: (rows.results || []).map((record) => {
      const profile = toProfile(record);
      return {
        id: profile.id,
        age: profile.age,
        gender: profile.gender,
        occupation: profile.occupation,
        marital_status: profile.marital_status,
        symptoms: profile.symptoms,
        group_tag: profile.group_tag,
        difficulty: profile.difficulty,
        issue_tags: profile.issue_tags,
        source_id: profile.source_id,
      };
    }),
    total: Number(totalRow?.total || 0),
    page,
    page_size: pageSize,
  });
}

async function startSession(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);

  const body = await readJson<{ profile_id: string; enable_long_term_memory?: boolean; session_group_id?: string | null; team_id?: string | null }>(request);
  const record = await env.DB.prepare(`SELECT * FROM seeker_profiles WHERE id = ?`).bind(body.profile_id).first<SeekerProfileRecord>();
  if (!record) return errorResponse("来访者档案不存在", 404);
  const profile = toProfile(record);
  const sessionId = crypto.randomUUID();
  const hasLongTermMemory = body.enable_long_term_memory !== false;
  let sessionGroupId = body.session_group_id || null;
  const teamId = body.team_id || null;
  let sessionNumber = 1;
  let team: any = null;

  if (teamId) {
    const membership = await getTeamMembership(env, teamId, userId);
    if (!membership) return errorResponse("无权在该团队/比赛中发起训练", 403);
    team = await getTeamById(env, teamId);
    if (!team) return errorResponse("团队/比赛不存在", 404);
    if (team.max_sessions_per_user) {
      const attemptsRow = await env.DB
        .prepare(`SELECT COUNT(*) AS total FROM counseling_sessions WHERE team_id = ? AND user_id = ?`)
        .bind(teamId, userId)
        .first<{ total: number }>();
      if (Number(attemptsRow?.total || 0) >= Number(team.max_sessions_per_user)) {
        return errorResponse("你在该比赛/团队中的可用测试次数已用尽", 400);
      }
    }
    if (team.profile_group_tag && team.profile_group_tag !== profile.group_tag) {
      return errorResponse("该团队/比赛限定了特定来访者群体", 400);
    }
    if (team.profile_difficulty && team.profile_difficulty !== profile.difficulty) {
      return errorResponse("该团队/比赛限定了特定训练难度", 400);
    }
    if (team.profile_issue_tag && !(profile.issue_tags || "").includes(team.profile_issue_tag)) {
      return errorResponse("该团队/比赛限定了特定议题范围", 400);
    }
  }

  if (hasLongTermMemory) {
    if (!sessionGroupId) {
      const existingGroup = await env.DB
        .prepare(
          `SELECT id FROM session_groups
           WHERE user_id = ? AND profile_id = ? AND IFNULL(team_id, '') = ? AND status = 'active'
           ORDER BY updated_at DESC LIMIT 1`
        )
        .bind(userId, profile.id, teamId || "")
        .first<{ id: string }>();

      if (existingGroup?.id) {
        sessionGroupId = existingGroup.id;
      } else {
        sessionGroupId = crypto.randomUUID();
        await env.DB
          .prepare(
            `INSERT INTO session_groups (id, user_id, profile_id, team_id, title, description, session_count, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)`
          )
          .bind(
            sessionGroupId,
            userId,
            profile.id,
            teamId,
            `与${profile.gender}${profile.age}岁${profile.occupation}的咨询`,
            "长期记忆咨询组",
            nowIso(),
            nowIso()
          )
          .run();
      }
    }
    const countRow = await env.DB
      .prepare(`SELECT COUNT(*) AS total FROM counseling_sessions WHERE user_id = ? AND profile_id = ? AND session_group_id = ?`)
      .bind(userId, profile.id, sessionGroupId)
      .first<{ total: number }>();
    sessionNumber = Number(countRow?.total || 0) + 1;
  }

  await env.DB
    .prepare(
      `INSERT INTO counseling_sessions
       (id, user_id, profile_id, team_id, session_group_id, has_long_term_memory, session_number, messages, chain_index, runtime_state, time_limit_seconds, status, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 1, '{}', ?, 'active', ?)`
    )
    .bind(
      sessionId,
      userId,
      profile.id,
      teamId,
      sessionGroupId,
      hasLongTermMemory ? 1 : 0,
      sessionNumber,
      team?.session_time_limit_minutes ? Number(team.session_time_limit_minutes) * 60 : null,
      nowIso()
    )
    .run();

  const snapshotInput = {
    sessionId,
    userId,
    profileId: profile.id,
    sessionGroupId,
    hasLongTermMemory,
    profile: {
      age: profile.age,
      gender: profile.gender,
      occupation: profile.occupation,
      marital_status: profile.marital_status,
      symptoms: profile.symptoms,
      difficulty: profile.difficulty,
    },
    report: profile.report,
    previousConversations: profile.conversation,
  };

  const cacheRows = await env.DB
    .prepare(
      `SELECT * FROM seeker_profile_caches
       WHERE profile_id = ? AND has_long_term_memory = ?
       ORDER BY used_count DESC, created_at ASC
       LIMIT 1`
    )
    .bind(profile.id, hasLongTermMemory ? 1 : 0)
    .all<SeekerProfileCacheRecord>();
  const cache = (cacheRows.results || [])[0] || null;

  let snapshot: SessionSnapshot;
  if (cache) {
    snapshot = snapshotFromCache(cache, snapshotInput);
    await env.DB
      .prepare(`UPDATE seeker_profile_caches SET used_count = used_count + 1 WHERE id = ?`)
      .bind(cache.id)
      .run();
  } else {
    snapshot = await createInitialSnapshot(env, snapshotInput);
    await env.DB
      .prepare(
        `INSERT OR REPLACE INTO seeker_profile_caches
         (id, profile_id, system_prompt, complaint_chain, style, situation, status, event, scales, current_emotion, has_long_term_memory, skill_version, source_model, init_trace, created_at, used_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `${profile.id}:${hasLongTermMemory ? "ltm" : "stateless"}`,
        profile.id,
        snapshot.systemPrompt,
        jsonText(snapshot.complaintChain),
        jsonText(snapshot.style),
        snapshot.situation,
        snapshot.status,
        "",
        jsonText({}),
        snapshot.currentEmotion,
        hasLongTermMemory ? 1 : 0,
        "annaagent-init-skill/v1",
        env.AI_MODEL || "deepseek-chat",
        jsonText({ initSource: snapshot.initSource }),
        nowIso(),
        0
      )
      .run();
  }

  await env.DB
    .prepare(`UPDATE counseling_sessions SET runtime_state = ?, chain_index = ? WHERE id = ?`)
    .bind(jsonText(snapshot), snapshot.chainIndex, sessionId)
    .run();

  if (sessionGroupId) {
    await env.DB
      .prepare(`UPDATE session_groups SET session_count = session_count + 1, updated_at = ? WHERE id = ?`)
      .bind(nowIso(), sessionGroupId)
      .run();
  }

  return jsonResponse({
    session_id: sessionId,
    session_group_id: sessionGroupId,
    profile_summary: `${profile.gender}，${profile.age}岁，${profile.occupation}，${profile.marital_status}`,
    session_number: sessionNumber,
    init_source: snapshot.initSource,
    init_duration_ms: snapshot.initDurationMs,
    time_limit_seconds: team?.session_time_limit_minutes ? Number(team.session_time_limit_minutes) * 60 : null,
  });
}

async function chatSession(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);

  const body = await readJson<{ session_id: string; message: string }>(request);
  const session = await env.DB.prepare(`SELECT * FROM counseling_sessions WHERE id = ?`).bind(body.session_id).first<any>();
  if (!session) return errorResponse("Session 不存在或已结束，请重新开始", 404);
  if (session.user_id !== userId) return errorResponse("无权访问此 session", 403);

  if (session.time_limit_seconds && session.status === "active") {
    const elapsed = Math.floor((Date.now() - Date.parse(session.started_at)) / 1000);
    if (elapsed >= Number(session.time_limit_seconds)) {
      const expiredSnapshot = safeJsonParse<SessionSnapshot | null>(session.runtime_state, null);
      if (!expiredSnapshot) return errorResponse("Session 状态不存在，请重新开始", 404);
      await finalizeSession(env, session, expiredSnapshot, userId, { autoEnded: true });
      return errorResponse("比赛单次咨询时间已到，系统已自动结束并生成评估。", 409);
    }
  }

  const fullSession = await env.DB
    .prepare(`SELECT runtime_state FROM counseling_sessions WHERE id = ?`)
    .bind(body.session_id)
    .first<{ runtime_state: string }>();
  const snapshot = safeJsonParse<SessionSnapshot | null>(fullSession?.runtime_state, null);
  if (!snapshot) return errorResponse("Session 状态不存在，请重新开始", 404);

  const data = await chatWithSnapshot(env, snapshot, body.message);

  await env.DB
    .prepare(`UPDATE counseling_sessions SET messages = ?, chain_index = ?, runtime_state = ? WHERE id = ?`)
    .bind(jsonText(data.snapshot.conversation), data.snapshot.chainIndex, jsonText(data.snapshot), body.session_id)
    .run();

  return jsonResponse({
    session_id: body.session_id,
    response: data.response,
    emotion: data.emotion,
    current_complaint_stage: data.complaint_stage,
    turn_count: data.turn_count,
  });
}

async function endSession(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);

  const body = await readJson<{ session_id: string }>(request);
  const session = await env.DB.prepare(`SELECT * FROM counseling_sessions WHERE id = ?`).bind(body.session_id).first<any>();
  if (!session || session.user_id !== userId) return errorResponse("Session 不存在", 404);

  const snapshot = safeJsonParse<SessionSnapshot | null>(session.runtime_state, null);
  if (!snapshot) return errorResponse("Session 状态不存在", 404);
  return finalizeSession(env, session, snapshot, userId);
}

async function getSessionDetail(request: Request, env: CloudflareEnv, sessionId: string) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const session = await env.DB.prepare(`SELECT * FROM counseling_sessions WHERE id = ?`).bind(sessionId).first<any>();
  if (!session || session.user_id !== userId) return errorResponse("Session 不存在", 404);
  const runtimeState = safeJsonParse<SessionSnapshot | null>(session.runtime_state, null);
  return jsonResponse({
    id: session.id,
    profile_id: session.profile_id,
    team_id: session.team_id,
    session_group_id: session.session_group_id,
    messages: safeJsonParse(session.messages, []),
    status: session.status,
    evaluation: safeJsonParse(session.evaluation, null),
    score: session.score ? Number(session.score) / 10 : null,
    current_emotion: runtimeState?.currentEmotion || null,
    complaint_chain: runtimeState?.complaintChain || [],
    current_complaint_stage: runtimeState?.chainIndex || 1,
    started_at: session.started_at,
    time_limit_seconds: session.time_limit_seconds == null ? null : Number(session.time_limit_seconds),
  });
}

async function listSessions(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const groupId = url.searchParams.get("group_id") || "";
  const status = url.searchParams.get("status") || "";
  const whereClauses = ["s.user_id = ?"];
  const values: Array<string> = [userId];
  if (groupId) {
    whereClauses.push("s.session_group_id = ?");
    values.push(groupId);
  }
  if (status) {
    whereClauses.push("s.status = ?");
    values.push(status);
  }

  const rows = await env.DB
    .prepare(
      `SELECT s.*, p.gender, p.age, p.occupation, p.marital_status
       FROM counseling_sessions s
       JOIN seeker_profiles p ON p.id = s.profile_id
       WHERE ${whereClauses.join(" AND ")}
       ORDER BY s.started_at DESC`
    )
    .bind(...values)
    .all<any>();

  return jsonResponse(
    (rows.results || []).map((row) => ({
      id: row.id,
      profile_id: row.profile_id,
      session_group_id: row.session_group_id,
      status: row.status,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration_seconds: row.duration_seconds,
      score: row.score ? Number(row.score) / 10 : null,
      turn_count: safeJsonParse<any[]>(row.messages, []).filter((item) => item.role === "Seeker").length,
      profile_summary: `${row.gender}，${row.age}岁，${row.occupation}，${row.marital_status}`,
    }))
  );
}

async function listSessionGroups(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const rows = await env.DB
    .prepare(
      `SELECT g.*, p.gender, p.age, p.occupation, p.marital_status,
              MAX(s.started_at) AS last_started_at,
              SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS completed_sessions,
              SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) AS active_sessions
       FROM session_groups g
       JOIN seeker_profiles p ON p.id = g.profile_id
       LEFT JOIN counseling_sessions s ON s.session_group_id = g.id
       WHERE g.user_id = ?
       GROUP BY g.id
       ORDER BY g.updated_at DESC`
    )
    .bind(userId)
    .all<any>();
  return jsonResponse(
    (rows.results || []).map((row) => ({
      id: row.id,
      profile_id: row.profile_id,
      title: row.title,
      description: row.description,
      session_count: Number(row.session_count || 0),
      status: row.status,
      profile_summary: `${row.gender}，${row.age}岁，${row.occupation}，${row.marital_status}`,
      last_started_at: row.last_started_at,
      completed_sessions: Number(row.completed_sessions || 0),
      active_sessions: Number(row.active_sessions || 0),
    }))
  );
}

async function register(request: Request, env: CloudflareEnv) {
  const body = await readJson<{
    email: string;
    username: string;
    display_name: string;
    password: string;
    accepted_terms: boolean;
    accepted_terms_version: string;
  }>(request);
  if (!body.accepted_terms || body.accepted_terms_version !== REGISTRATION_TERMS_VERSION) {
    return errorResponse("注册前需要同意当前版本的使用与研究协议", 400);
  }
  const existing = await env.DB
    .prepare(`SELECT id FROM users WHERE email = ? OR username = ?`)
    .bind(body.email, body.username)
    .first();
  if (existing) return errorResponse("邮箱或用户名已被注册", 400);

  const id = crypto.randomUUID();
  const hashed = await hashPassword(body.password);
  await env.DB
    .prepare(
      `INSERT INTO users
       (id, email, username, display_name, hashed_password, experience_level, is_active, is_admin, accepted_terms_version, accepted_terms_at, research_consent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'beginner', 1, 0, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      body.email,
      body.username,
      body.display_name,
      hashed,
      body.accepted_terms_version,
      nowIso(),
      1,
      nowIso(),
      nowIso()
    )
    .run();
  const token = await signJwt(env, { sub: id });
  return jsonResponse({ access_token: token, token_type: "bearer" }, 201);
}

async function login(request: Request, env: CloudflareEnv) {
  const form = await readForm(request);
  const username = form.get("username") || "";
  const password = form.get("password") || "";
  const user = await env.DB
    .prepare(`SELECT * FROM users WHERE username = ? OR email = ?`)
    .bind(username, username)
    .first<any>();
  if (!user || !(await verifyPassword(password, user.hashed_password))) {
    return errorResponse("用户名或密码错误", 401);
  }
  if (!user.is_active) return errorResponse("账户已被禁用", 403);

  await env.DB.prepare(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`).bind(nowIso(), nowIso(), user.id).run();
  const token = await signJwt(env, { sub: user.id });
  return jsonResponse({ access_token: token, token_type: "bearer" });
}

async function getMe(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first<any>();
  if (!user) return errorResponse("用户不存在", 404);
  return jsonResponse({
    id: user.id,
    email: user.email,
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    experience_level: user.experience_level,
    specialization: user.specialization,
    is_active: Boolean(user.is_active),
    accepted_terms_version: user.accepted_terms_version,
    accepted_terms_at: user.accepted_terms_at,
    research_consent: Boolean(user.research_consent),
  });
}

async function updateMe(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const body = await readJson<Record<string, unknown>>(request);
  const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first<any>();
  if (!user) return errorResponse("用户不存在", 404);

  const next = {
    display_name: String(body.display_name ?? user.display_name),
    bio: body.bio == null ? user.bio : String(body.bio),
    experience_level: String(body.experience_level ?? user.experience_level),
    specialization: body.specialization == null ? user.specialization : String(body.specialization),
    avatar_url: body.avatar_url == null ? user.avatar_url : String(body.avatar_url),
  };

  await env.DB
    .prepare(
      `UPDATE users
       SET display_name = ?, bio = ?, experience_level = ?, specialization = ?, avatar_url = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(next.display_name, next.bio, next.experience_level, next.specialization, next.avatar_url, nowIso(), userId)
    .run();
  return jsonResponse({
    id: user.id,
    email: user.email,
    username: user.username,
    ...next,
    is_active: Boolean(user.is_active),
    accepted_terms_version: user.accepted_terms_version,
    accepted_terms_at: user.accepted_terms_at,
    research_consent: Boolean(user.research_consent),
  });
}

async function listTeams(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);

  const rows = await env.DB
    .prepare(
      `SELECT t.*, tm.role,
              COUNT(DISTINCT tm2.user_id) AS member_count,
              COUNT(DISTINCT CASE WHEN tm2.status = 'active' THEN tm2.user_id END) AS active_members,
              MAX(COALESCE(s.ended_at, s.started_at)) AS last_activity_at
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ? AND tm.status = 'active'
       LEFT JOIN team_members tm2 ON tm2.team_id = t.id
       LEFT JOIN counseling_sessions s ON s.team_id = t.id AND s.user_id = tm2.user_id
       WHERE t.status != 'archived'
       GROUP BY t.id, tm.role
       ORDER BY t.updated_at DESC`
    )
    .bind(userId)
    .all<any>();

  return jsonResponse((rows.results || []).map((row) => teamSummary(row, row)));
}

async function createTeam(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const body = await readJson<{
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
  }>(request);
  if (!body.name?.trim()) return errorResponse("团队/比赛名称不能为空", 400);
  if (body.kind !== "team" && body.kind !== "competition") {
    return errorResponse("kind 必须是 team 或 competition", 400);
  }

  const teamId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const joinCode = createJoinCode();
  const agreementVersion = body.agreement_text?.trim() ? 1 : 0;
  const now = nowIso();

  await env.DB
    .prepare(
      `INSERT INTO teams
       (id, kind, name, description, theme, profile_group_tag, profile_difficulty, profile_issue_tag, session_time_limit_minutes, max_sessions_per_user, training_start_at, training_end_at, owner_user_id, join_code, status, agreement_title, agreement_text, agreement_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
    )
    .bind(
      teamId,
      body.kind,
      body.name.trim(),
      body.description || null,
      body.theme || null,
      body.profile_group_tag || null,
      body.profile_difficulty || null,
      body.profile_issue_tag || null,
      body.session_time_limit_minutes ?? null,
      body.max_sessions_per_user ?? null,
      body.training_start_at || null,
      body.training_end_at || null,
      userId,
      joinCode,
      body.agreement_title || null,
      body.agreement_text || null,
      agreementVersion,
      now,
      now
    )
    .run();

  await env.DB
    .prepare(
      `INSERT INTO team_members
       (id, team_id, user_id, role, status, accepted_agreement_version, accepted_agreement_at, joined_at)
       VALUES (?, ?, ?, 'owner', 'active', ?, ?, ?)`
    )
    .bind(memberId, teamId, userId, agreementVersion || null, agreementVersion ? now : null, now)
    .run();

  const team = await getTeamById(env, teamId);
  return jsonResponse(teamSummary({ ...team, member_count: 1, active_members: 1 }, { role: "owner" }), 201);
}

async function previewJoinTeam(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code) return errorResponse("请输入邀请码", 400);
  const team = await env.DB.prepare(`SELECT * FROM teams WHERE join_code = ? AND status = 'active'`).bind(code).first<any>();
  if (!team) return errorResponse("未找到对应的团队或比赛", 404);
  const membership = await getTeamMembership(env, team.id, userId);
  return jsonResponse({
    id: team.id,
    kind: team.kind,
    name: team.name,
    description: team.description,
    theme: team.theme,
    profile_group_tag: team.profile_group_tag,
    profile_difficulty: team.profile_difficulty,
    profile_issue_tag: team.profile_issue_tag,
    session_time_limit_minutes: team.session_time_limit_minutes == null ? null : Number(team.session_time_limit_minutes),
    max_sessions_per_user: team.max_sessions_per_user == null ? null : Number(team.max_sessions_per_user),
    training_start_at: team.training_start_at,
    training_end_at: team.training_end_at,
    agreement_title: team.agreement_title,
    agreement_text: team.agreement_text,
    agreement_version: Number(team.agreement_version || 0),
    is_member: Boolean(membership),
  });
}

async function joinTeam(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const body = await readJson<{ join_code: string; accepted_agreement: boolean }>(request);
  const code = body.join_code?.trim().toUpperCase();
  if (!code) return errorResponse("请输入邀请码", 400);
  const team = await env.DB.prepare(`SELECT * FROM teams WHERE join_code = ? AND status = 'active'`).bind(code).first<any>();
  if (!team) return errorResponse("未找到对应的团队或比赛", 404);
  const existing = await getTeamMembership(env, team.id, userId);
  if (existing) {
    return jsonResponse(teamSummary({ ...team, member_count: 0, active_members: 0 }, existing));
  }
  if (team.agreement_text && !body.accepted_agreement) {
    return errorResponse("加入前需要同意该团队/比赛的附加协议", 400);
  }

  const now = nowIso();
  await env.DB
    .prepare(
      `INSERT INTO team_members
       (id, team_id, user_id, role, status, accepted_agreement_version, accepted_agreement_at, joined_at)
       VALUES (?, ?, ?, 'member', 'active', ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      team.id,
      userId,
      team.agreement_text ? Number(team.agreement_version || 0) : null,
      team.agreement_text ? now : null,
      now
    )
    .run();

  return jsonResponse(teamSummary({ ...team, member_count: 0, active_members: 0 }, { role: "member" }), 201);
}

async function getTeamDetail(request: Request, env: CloudflareEnv, teamId: string) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const team = await getTeamById(env, teamId);
  if (!team) return errorResponse("团队/比赛不存在", 404);
  const membership = await getTeamMembership(env, teamId, userId);
  if (!membership) return errorResponse("无权访问该团队/比赛", 403);
  const meta = await env.DB
    .prepare(`SELECT COUNT(*) AS member_count, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_members FROM team_members WHERE team_id = ?`)
    .bind(teamId)
    .first<any>();
  return jsonResponse(teamSummary({ ...team, ...meta }, membership));
}

async function updateTeam(request: Request, env: CloudflareEnv, teamId: string) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const team = await getTeamById(env, teamId);
  if (!team) return errorResponse("团队/比赛不存在", 404);
  const membership = await getTeamMembership(env, teamId, userId);
  if (!membership || !canManageTeam(membership.role)) return errorResponse("无权管理该团队/比赛", 403);
  const body = await readJson<Record<string, unknown>>(request);
  const agreementChanged =
    body.agreement_title !== undefined || body.agreement_text !== undefined;
  const agreementVersion = agreementChanged
    ? Number(team.agreement_version || 0) + 1
    : Number(team.agreement_version || 0);

  const next = {
    name: body.name == null ? team.name : String(body.name),
    description: body.description == null ? team.description : String(body.description),
    theme: body.theme == null ? team.theme : String(body.theme),
    profile_group_tag: body.profile_group_tag == null ? team.profile_group_tag : String(body.profile_group_tag),
    profile_difficulty: body.profile_difficulty == null ? team.profile_difficulty : String(body.profile_difficulty),
    profile_issue_tag: body.profile_issue_tag == null ? team.profile_issue_tag : String(body.profile_issue_tag),
    session_time_limit_minutes: body.session_time_limit_minutes == null ? team.session_time_limit_minutes : Number(body.session_time_limit_minutes),
    max_sessions_per_user: body.max_sessions_per_user == null ? team.max_sessions_per_user : Number(body.max_sessions_per_user),
    training_start_at: body.training_start_at == null ? team.training_start_at : String(body.training_start_at),
    training_end_at: body.training_end_at == null ? team.training_end_at : String(body.training_end_at),
    agreement_title: body.agreement_title == null ? team.agreement_title : String(body.agreement_title),
    agreement_text: body.agreement_text == null ? team.agreement_text : String(body.agreement_text),
    status: body.status == null ? team.status : String(body.status),
  };

  await env.DB
    .prepare(
      `UPDATE teams
       SET name = ?, description = ?, theme = ?, profile_group_tag = ?, profile_difficulty = ?, profile_issue_tag = ?, session_time_limit_minutes = ?, max_sessions_per_user = ?, training_start_at = ?, training_end_at = ?, agreement_title = ?, agreement_text = ?, agreement_version = ?, status = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.name,
      next.description,
      next.theme,
      next.profile_group_tag,
      next.profile_difficulty,
      next.profile_issue_tag,
      next.session_time_limit_minutes,
      next.max_sessions_per_user,
      next.training_start_at,
      next.training_end_at,
      next.agreement_title,
      next.agreement_text,
      agreementVersion,
      next.status,
      nowIso(),
      teamId
    )
    .run();

  const updated = await getTeamById(env, teamId);
  const meta = await env.DB
    .prepare(`SELECT COUNT(*) AS member_count, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_members FROM team_members WHERE team_id = ?`)
    .bind(teamId)
    .first<any>();
  return jsonResponse(teamSummary({ ...updated, ...meta }, membership));
}

async function getTeamMembers(request: Request, env: CloudflareEnv, teamId: string) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const membership = await getTeamMembership(env, teamId, userId);
  if (!membership || !canManageTeam(membership.role)) return errorResponse("无权查看成员情况", 403);
  const team = await getTeamById(env, teamId);
  if (!team) return errorResponse("团队/比赛不存在", 404);
  const start = team.training_start_at || "";
  const end = team.training_end_at || "";

  const rows = await env.DB
    .prepare(
      `SELECT tm.user_id, tm.role, tm.joined_at, u.display_name, u.username, u.email,
              COUNT(DISTINCT s.id) AS total_sessions,
              SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS completed_sessions,
              SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) AS active_sessions,
              AVG(CASE WHEN s.status = 'completed' THEN s.score / 10.0 END) AS average_score,
              MAX(COALESCE(s.ended_at, s.started_at, tm.joined_at)) AS last_activity_at
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       LEFT JOIN counseling_sessions s
         ON s.user_id = tm.user_id
        AND s.team_id = ?
        AND (? = '' OR s.started_at >= ?)
        AND (? = '' OR s.started_at <= ?)
       WHERE tm.team_id = ? AND tm.status = 'active'
       GROUP BY tm.user_id, tm.role, tm.joined_at, u.display_name, u.username, u.email
       ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.display_name ASC`
    )
    .bind(teamId, start, start, end, end, teamId)
    .all<any>();

  return jsonResponse(
    (rows.results || []).map((row) => ({
      user_id: row.user_id,
      display_name: row.display_name,
      username: row.username,
      email: row.email,
      role: row.role,
      joined_at: row.joined_at,
      total_sessions: Number(row.total_sessions || 0),
      completed_sessions: Number(row.completed_sessions || 0),
      active_sessions: Number(row.active_sessions || 0),
      average_score: row.average_score == null ? null : Number(row.average_score),
      last_activity_at: row.last_activity_at,
    }))
  );
}

async function updateTeamMemberRole(request: Request, env: CloudflareEnv, teamId: string, memberUserId: string) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const membership = await getTeamMembership(env, teamId, userId);
  if (!membership || !canManageTeam(membership.role)) return errorResponse("无权管理成员角色", 403);
  const target = await getTeamMembership(env, teamId, memberUserId);
  if (!target) return errorResponse("成员不存在", 404);
  if (target.role === "owner") return errorResponse("不能修改发起者角色", 400);
  const body = await readJson<{ role: "admin" | "member" }>(request);
  if (!["admin", "member"].includes(body.role)) return errorResponse("role 非法", 400);
  await env.DB
    .prepare(`UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?`)
    .bind(body.role, teamId, memberUserId)
    .run();
  return jsonResponse({ ok: true });
}

async function knowledgeDimensions() {
  return jsonResponse({ schools: SCHOOL_OPTIONS, issues: ISSUE_OPTIONS, difficulties: DIFFICULTY_LEVELS });
}

async function knowledgeSearch(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const body = await readJson<{ query?: string; school?: string; issue?: string; difficulty?: string; source_type?: string; page?: number; page_size?: number }>(request);
  const page = Number(body.page || 1);
  const pageSize = Number(body.page_size || 20);
  const filters = buildSqlFilters([
    ["school = ?", body.school],
    ["issue = ?", body.issue],
    ["difficulty = ?", body.difficulty],
    ["source_type = ?", body.source_type],
  ]);

  const query = body.query?.trim().toLowerCase();
  const queryClause = query ? `${filters.clause ? `${filters.clause} AND` : " WHERE"} (lower(title) LIKE ? OR lower(content) LIKE ? OR lower(ifnull(summary, '')) LIKE ?)` : filters.clause;
  const queryValues = query ? [...filters.values, `%${query}%`, `%${query}%`, `%${query}%`] : filters.values;
  const total = await env.DB
    .prepare(`SELECT COUNT(*) AS total FROM knowledge_items${queryClause}`)
    .bind(...queryValues)
    .first<{ total: number }>();
  const rows = await env.DB
    .prepare(`SELECT * FROM knowledge_items${queryClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .bind(...queryValues, pageSize, (page - 1) * pageSize)
    .all<any>();

  return jsonResponse({
    items: (rows.results || []).map((row) => ({
      id: row.id,
      school: row.school,
      issue: row.issue,
      difficulty: row.difficulty,
      title: row.title,
      content: row.content,
      summary: row.summary,
      source_type: row.source_type,
      source_ref: row.source_ref,
      tags: safeJsonParse(row.tags, []),
    })),
    total: Number(total?.total || 0),
    page,
    page_size: pageSize,
  });
}

async function knowledgeStats(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total_items FROM knowledge_items`).first<{ total_items: number }>();
  const groupBy = async (column: string) => {
    const rows = await env.DB.prepare(`SELECT ${column} AS key, COUNT(*) AS total FROM knowledge_items GROUP BY ${column}`).all<{ key: string; total: number }>();
    return Object.fromEntries((rows.results || []).map((row) => [row.key, Number(row.total)]));
  };
  return jsonResponse({
    total_items: Number(totalRow?.total_items || 0),
    schools: await groupBy("school"),
    issues: await groupBy("issue"),
    difficulties: await groupBy("difficulty"),
  });
}

async function knowledgeItem(request: Request, env: CloudflareEnv, itemId: string) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const row = await env.DB.prepare(`SELECT * FROM knowledge_items WHERE id = ?`).bind(itemId).first<any>();
  if (!row) return errorResponse("知识条目不存在", 404);
  return jsonResponse({
    id: row.id,
    school: row.school,
    issue: row.issue,
    difficulty: row.difficulty,
    title: row.title,
    content: row.content,
    summary: row.summary,
    source_type: row.source_type,
    source_ref: row.source_ref,
    tags: safeJsonParse(row.tags, []),
  });
}

async function learningRecords(env: CloudflareEnv, userId: string) {
  const rows = await env.DB
    .prepare(`SELECT * FROM performance_records WHERE user_id = ? ORDER BY created_at ASC`)
    .bind(userId)
    .all<any>();
  return rows.results || [];
}

async function learningDashboard(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const records = await learningRecords(env, userId);
  const sessions = await env.DB
    .prepare(`SELECT duration_seconds FROM counseling_sessions WHERE user_id = ? AND status = 'completed'`)
    .bind(userId)
    .all<{ duration_seconds: number }>();
  const totalSessions = records.length;
  const totalPracticeHours = ((sessions.results || []).reduce((sum, row) => sum + Number(row.duration_seconds || 0), 0) / 3600);
  const averageScore = totalSessions ? records.reduce((sum, row) => sum + Number(row.overall_score || 0), 0) / totalSessions : 0;

  const dimensionTotals: Record<string, number[]> = {};
  const mistakeMap: Record<string, number> = {};
  for (const record of records) {
    const dims = safeJsonParse<Record<string, number>>(record.dimension_scores, {});
    Object.entries(dims).forEach(([key, value]) => {
      dimensionTotals[key] ||= [];
      dimensionTotals[key].push(Number(value));
    });
    const mistakes = safeJsonParse<Array<{ type?: string }>>(record.mistakes, []);
    mistakes.forEach((mistake) => {
      const type = mistake.type || "unknown";
      mistakeMap[type] = (mistakeMap[type] || 0) + 1;
    });
  }

  const dimensionAverages = Object.fromEntries(
    Object.entries(dimensionTotals).map(([key, values]) => [key, values.reduce((sum, value) => sum + value, 0) / values.length])
  );
  const weakDimensions = Object.entries(dimensionAverages)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .slice(0, 3)
    .map(([dim, avg]) => ({ dim, avg }));
  const commonMistakes = Object.entries(mistakeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  const knowledgeRows = await env.DB.prepare(`SELECT id, title, summary, difficulty FROM knowledge_items ORDER BY updated_at DESC LIMIT 10`).all<any>();
  const recommendations = weakDimensions.flatMap((item) => {
    const difficulty = Number(item.avg) < 40 ? "beginner" : Number(item.avg) < 70 ? "intermediate" : "advanced";
    return (knowledgeRows.results || [])
      .filter((row) => row.difficulty === difficulty)
      .slice(0, 2)
      .map((row) => ({
        id: `${item.dim}:${row.id}`,
        title: `学习: ${row.title}`,
        description: row.summary || row.title,
        recommendation_type: "knowledge",
        priority: 8,
        reason: `你在「${item.dim}」维度的表现较弱，建议优先补强。`,
        knowledge_item_id: row.id,
        profile_id: null,
        is_read: false,
        is_completed: false,
        created_at: nowIso(),
      }));
  }).slice(0, 5);

  return jsonResponse({
    total_sessions: totalSessions,
    total_practice_hours: totalPracticeHours,
    average_score: averageScore,
    dimension_averages: dimensionAverages,
    recent_scores: records.slice(-10).map((row) => ({ session_id: row.session_id, score: row.overall_score, date: row.created_at })),
    growth_curve: records.map((row) => ({ date: row.created_at, score: row.overall_score })),
    weak_dimensions: weakDimensions,
    common_mistakes: commonMistakes,
    recommendations,
  });
}

async function growthCurve(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const records = await learningRecords(env, userId);
  const dataPoints = records.map((row) => ({ date: row.created_at, overall_score: row.overall_score, dimension_scores: safeJsonParse(row.dimension_scores, {}) }));
  return jsonResponse({ data_points: dataPoints, trend: "stable" });
}

async function mistakeBook(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("page_size") || 20);
  const records = await learningRecords(env, userId);
  const aggregate: Record<string, any> = {};
  for (const row of records) {
    const mistakes = safeJsonParse<Array<any>>(row.mistakes, []);
    mistakes.forEach((mistake) => {
      const key = `${mistake.type || "unknown"}:${String(mistake.description || "").slice(0, 50)}`;
      if (!aggregate[key]) {
        aggregate[key] = {
          id: key,
          type: mistake.type || "unknown",
          description: mistake.description || "",
          frequency: 0,
          severity: mistake.severity || "medium",
          recent_session: row.session_id,
          suggestion: mistake.suggestion || "",
        };
      }
      aggregate[key].frequency += 1;
    });
  }
  const mistakes = Object.values(aggregate).sort((a: any, b: any) => b.frequency - a.frequency);
  return jsonResponse({
    mistakes: mistakes.slice((page - 1) * pageSize, page * pageSize),
    total: mistakes.length,
    page,
    page_size: pageSize,
  });
}

async function recommendations(request: Request, env: CloudflareEnv) {
  return learningDashboard(request, env).then(async (response) => {
    const dashboard = await response.json() as any;
    return jsonResponse(dashboard.recommendations || []);
  });
}

async function getSessionEvaluation(request: Request, env: CloudflareEnv, sessionId: string) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const row = await env.DB
    .prepare(`SELECT * FROM performance_records WHERE user_id = ? AND session_id = ?`)
    .bind(userId, sessionId)
    .first<any>();
  if (!row) return errorResponse("评估记录不存在", 404);
  return jsonResponse({
    id: row.id,
    session_id: row.session_id,
    overall_score: Number(row.overall_score || 0),
    dimension_scores: safeJsonParse(row.dimension_scores, {}),
    mistakes: safeJsonParse(row.mistakes, []),
    strengths: safeJsonParse(row.strengths, []),
    feedback: row.feedback || "",
    tips: safeJsonParse(row.tips, []),
    difficulty: row.difficulty || "intermediate",
    issue_type: row.issue_type,
    created_at: row.created_at,
  });
}

async function handleApi(request: Request, env: CloudflareEnv) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });

  if (pathname === "/api/v1/auth/register" && request.method === "POST") return register(request, env);
  if (pathname === "/api/v1/auth/login" && request.method === "POST") return login(request, env);
  if (pathname === "/api/v1/auth/me" && request.method === "GET") return getMe(request, env);
  if (pathname === "/api/v1/auth/me" && request.method === "PATCH") return updateMe(request, env);

  if (pathname === "/api/v1/teams" && request.method === "GET") return listTeams(request, env);
  if (pathname === "/api/v1/teams" && request.method === "POST") return createTeam(request, env);
  if (pathname === "/api/v1/teams/join-preview" && request.method === "GET") return previewJoinTeam(request, env);
  if (pathname === "/api/v1/teams/join" && request.method === "POST") return joinTeam(request, env);

  const teamDetailMatch = pathname.match(/^\/api\/v1\/teams\/([^/]+)$/);
  if (teamDetailMatch && request.method === "GET") return getTeamDetail(request, env, teamDetailMatch[1]);
  if (teamDetailMatch && request.method === "PATCH") return updateTeam(request, env, teamDetailMatch[1]);

  const teamMembersMatch = pathname.match(/^\/api\/v1\/teams\/([^/]+)\/members$/);
  if (teamMembersMatch && request.method === "GET") return getTeamMembers(request, env, teamMembersMatch[1]);

  const teamMemberRoleMatch = pathname.match(/^\/api\/v1\/teams\/([^/]+)\/members\/([^/]+)$/);
  if (teamMemberRoleMatch && request.method === "PATCH") {
    return updateTeamMemberRole(request, env, teamMemberRoleMatch[1], teamMemberRoleMatch[2]);
  }

  if (pathname === "/api/v1/simulator/profiles" && request.method === "GET") return listProfiles(request, env);
  if (pathname === "/api/v1/simulator/profiles/groups" && request.method === "GET") return jsonResponse(GROUP_OPTIONS);
  if (pathname === "/api/v1/simulator/sessions/start" && request.method === "POST") return startSession(request, env);
  if (pathname === "/api/v1/simulator/sessions/chat" && request.method === "POST") return chatSession(request, env);
  if (pathname === "/api/v1/simulator/sessions/end" && request.method === "POST") return endSession(request, env);
  if (pathname === "/api/v1/simulator/session-groups" && request.method === "GET") return listSessionGroups(request, env);
  if (pathname === "/api/v1/simulator/sessions" && request.method === "GET") return listSessions(request, env);

  const sessionMatch = pathname.match(/^\/api\/v1\/simulator\/sessions\/([^/]+)$/);
  if (sessionMatch && request.method === "GET") return getSessionDetail(request, env, sessionMatch[1]);

  if (pathname === "/api/v1/knowledge/dimensions" && request.method === "GET") return knowledgeDimensions();
  if (pathname === "/api/v1/knowledge/search" && request.method === "POST") return knowledgeSearch(request, env);
  if (pathname === "/api/v1/knowledge/stats/overview" && request.method === "GET") return knowledgeStats(request, env);

  const knowledgeMatch = pathname.match(/^\/api\/v1\/knowledge\/([^/]+)$/);
  if (knowledgeMatch && request.method === "GET") return knowledgeItem(request, env, knowledgeMatch[1]);

  if (pathname === "/api/v1/learning/dashboard" && request.method === "GET") return learningDashboard(request, env);
  if (pathname === "/api/v1/learning/growth-curve" && request.method === "GET") return growthCurve(request, env);
  if (pathname === "/api/v1/learning/mistakes" && request.method === "GET") return mistakeBook(request, env);
  if (pathname === "/api/v1/learning/recommendations" && request.method === "GET") return recommendations(request, env);
  if (pathname === "/api/v1/learning/dimensions" && request.method === "GET") return jsonResponse(EVALUATION_DIMENSIONS);

  const evaluationMatch = pathname.match(/^\/api\/v1\/learning\/sessions\/([^/]+)\/evaluation$/);
  if (evaluationMatch && request.method === "GET") return getSessionEvaluation(request, env, evaluationMatch[1]);

  if (pathname === "/api/v1/health") {
    return jsonResponse({
      ok: true,
      runtime: "cloudflare-pages",
      diagnostics: {
        has_jwt_secret: Boolean(env.JWT_SECRET?.trim()),
        has_ai_api_key: Boolean(env.AI_API_KEY?.trim()),
        has_db_binding: Boolean(env.DB),
        has_memory_index: Boolean(env.MEMORY_INDEX),
      },
    });
  }

  return errorResponse("Not found", 404);
}
export default {
  async fetch(request: Request, env: CloudflareEnv) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        const response = await handleApi(request, env);
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
        return new Response(response.body, { status: response.status, headers });
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : "Internal server error";
        const response = errorResponse(detail, 500);
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
        return new Response(response.body, { status: response.status, headers });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
