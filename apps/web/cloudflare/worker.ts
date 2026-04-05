/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-anonymous-default-export */

import { getAuthUserId, hashPassword, signJwt, verifyPassword } from "./auth";
import { DIFFICULTY_LEVELS, EVALUATION_DIMENSIONS, GROUP_OPTIONS, ISSUE_OPTIONS, SCHOOL_OPTIONS } from "./constants";
import { indexLongTermMemory } from "./memory";
import { chatWithSnapshot, createInitialSnapshot } from "./session-engine";
import { buildSystemPrompt, evaluateSession, inferEmotion } from "./simulator";
import type { CloudflareEnv, ProfileView, SeekerProfileCacheRecord, SeekerProfileRecord, SessionSnapshot } from "./types";
import { buildSqlFilters, corsHeaders, errorResponse, jsonResponse, jsonText, nowIso, readForm, readJson, safeJsonParse } from "./utils";

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

  const filters = buildSqlFilters([
    ["group_tag = ?", groupTag],
    ["difficulty = ?", difficulty],
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

  const body = await readJson<{ profile_id: string; enable_long_term_memory?: boolean; session_group_id?: string | null }>(request);
  const record = await env.DB.prepare(`SELECT * FROM seeker_profiles WHERE id = ?`).bind(body.profile_id).first<SeekerProfileRecord>();
  if (!record) return errorResponse("来访者档案不存在", 404);
  const profile = toProfile(record);
  const sessionId = crypto.randomUUID();
  const hasLongTermMemory = body.enable_long_term_memory !== false;
  let sessionGroupId = body.session_group_id || null;
  let sessionNumber = 1;

  if (hasLongTermMemory) {
    if (!sessionGroupId) {
      const existingGroup = await env.DB
        .prepare(
          `SELECT id FROM session_groups
           WHERE user_id = ? AND profile_id = ? AND status = 'active'
           ORDER BY updated_at DESC LIMIT 1`
        )
        .bind(userId, profile.id)
        .first<{ id: string }>();

      if (existingGroup?.id) {
        sessionGroupId = existingGroup.id;
      } else {
        sessionGroupId = crypto.randomUUID();
        await env.DB
          .prepare(
            `INSERT INTO session_groups (id, user_id, profile_id, title, description, session_count, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?)`
          )
          .bind(
            sessionGroupId,
            userId,
            profile.id,
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
       (id, user_id, profile_id, session_group_id, has_long_term_memory, session_number, messages, chain_index, runtime_state, status, started_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', 1, '{}', 'active', ?)`
    )
    .bind(sessionId, userId, profile.id, sessionGroupId, hasLongTermMemory ? 1 : 0, sessionNumber, nowIso())
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
        env.AI_MODEL || "gpt-5-nano",
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
  });
}

async function chatSession(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);

  const body = await readJson<{ session_id: string; message: string }>(request);
  const session = await env.DB.prepare(`SELECT * FROM counseling_sessions WHERE id = ?`).bind(body.session_id).first<{ user_id: string }>();
  if (!session) return errorResponse("Session 不存在或已结束，请重新开始", 404);
  if (session.user_id !== userId) return errorResponse("无权访问此 session", 403);

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
      body.session_id
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
      body.session_id,
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
    session_id: body.session_id,
    status: "completed",
    evaluation,
    score: evaluation.overall_score / 10,
    duration_seconds: durationSeconds,
  });
}

async function getSessionDetail(request: Request, env: CloudflareEnv, sessionId: string) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);
  const session = await env.DB.prepare(`SELECT * FROM counseling_sessions WHERE id = ?`).bind(sessionId).first<any>();
  if (!session || session.user_id !== userId) return errorResponse("Session 不存在", 404);
  return jsonResponse({
    id: session.id,
    profile_id: session.profile_id,
    session_group_id: session.session_group_id,
    messages: safeJsonParse(session.messages, []),
    status: session.status,
    evaluation: safeJsonParse(session.evaluation, null),
    score: session.score ? Number(session.score) / 10 : null,
  });
}

async function listSessions(request: Request, env: CloudflareEnv) {
  const userId = await requireUser(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const groupId = url.searchParams.get("group_id") || "";
  const status = url.searchParams.get("status") || "";
  const filters = buildSqlFilters([
    ["s.session_group_id = ?", groupId],
    ["s.status = ?", status],
  ]);

  const rows = await env.DB
    .prepare(
      `SELECT s.*, p.gender, p.age, p.occupation, p.marital_status
       FROM counseling_sessions s
       JOIN seeker_profiles p ON p.id = s.profile_id
       WHERE s.user_id = ?${filters.clause}
       ORDER BY s.started_at DESC`
    )
    .bind(userId, ...filters.values)
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
  const body = await readJson<{ email: string; username: string; display_name: string; password: string }>(request);
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
       (id, email, username, display_name, hashed_password, experience_level, is_active, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'beginner', 1, 0, ?, ?)`
    )
    .bind(id, body.email, body.username, body.display_name, hashed, nowIso(), nowIso())
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
  });
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
