import { EVALUATION_DIMENSIONS } from "./constants";
import { chatCompletion, tryParseJson } from "./llm";
import type { CloudflareEnv, ComplaintStage, ConversationMessage, EvaluationResult, SessionSnapshot } from "./types";

interface InitializationDraft {
  event?: string;
  situation?: string;
  status?: string;
  style?: string[];
  previous_scales?: Record<string, string[]>;
  current_scales?: Record<string, string[]>;
  complaint_chain?: string[];
  current_emotion?: string;
  system_prompt?: string;
  init_trace?: Record<string, unknown>;
  init_source?: "llm" | "heuristic_fallback";
}

function splitSymptoms(symptoms: string) {
  return symptoms
    .split(/[;,；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createComplaintChain(profile: SessionSnapshot["profile"]): ComplaintStage[] {
  const symptom = splitSymptoms(profile.symptoms)[0] || "最近的困扰";
  return [
    { stage: 1, content: `试探性地描述与「${symptom}」有关的直接困扰。` },
    { stage: 2, content: `开始触及「${symptom}」背后的触发事件、人际处境或压力来源。` },
    { stage: 3, content: `逐步暴露更深层的担心、失控感或未被满足的需要。` },
  ];
}

function buildFallbackInitialization(
  profile: SessionSnapshot["profile"],
  report: Record<string, unknown>,
  previousConversations: ConversationMessage[]
) {
  return {
    event: "",
    situation: createSituation(profile),
    status: createStatus(profile, report),
    style: createStyle(previousConversations),
    sampleStatements: [],
    complaintChain: createComplaintChain(profile),
    scales: {},
    currentEmotion: "confusion",
    initTrace: {},
    systemPrompt: "",
    initSource: "heuristic_fallback" as const,
  };
}

export async function initializeProfileState(
  env: CloudflareEnv,
  profile: SessionSnapshot["profile"],
  report: Record<string, unknown>,
  previousConversations: ConversationMessage[],
  hasLongTermMemory: boolean
) {
  const fallback = buildFallbackInitialization(profile, report, previousConversations);
  const previousDialogue = previousConversations
    .slice(-8)
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n");

  const prompt = `你在执行 AnnaAgent 风格的来访者首次实例化。请严格按照以下内部流程完成：\n1. 生成近期触发事件 event\n2. 基于 event 生成 second-person 情境 situation\n3. 根据画像和历史对话总结说话风格 style\n4. 生成不少于3阶段的 complaint_chain\n5. 基于 portrait/report 推断 previous_scales（p_bdi/p_ghq/p_sass）\n6. 基于当前会话起点推断 current_scales（bdi/ghq/sass）\n7. 根据量表变化总结当前状态 status\n8. 推断当前主情绪 current_emotion\n9. 生成最终 system_prompt\n\n约束：\n- 严格贴合来访者画像、案例报告和历史对话，不要写成咨询师视角。\n- 不要生成主动开场白，等待咨询师先发起对话。\n- style 只写说话风格，不写建议。\n- complaint_chain 必须体现从表层主诉到更深层担忧的递进。\n- situation 必须是第二人称，3-5句，不要包含显式年龄/性别。\n- scales 使用 A/B/C/D 数组表达；previous_scales 包含 p_bdi/p_ghq/p_sass，current_scales 包含 bdi/ghq/sass。\n- system_prompt 必须是完整可直接投喂给 seeker 模型的 prompt。\n- 严格输出 JSON，不要附加解释。\n\n输出 JSON 结构：\n{\n  "event": "string",\n  "situation": "string",\n  "status": "string",\n  "style": ["...", "...", "..."],\n  "previous_scales": {"p_bdi":["A"], "p_ghq":["A"], "p_sass":["A"]},\n  "current_scales": {"bdi":["A"], "ghq":["A"], "sass":["A"]},\n  "complaint_chain": ["第一阶段主诉", "第二阶段主诉", "第三阶段主诉"],\n  "current_emotion": "confusion|sadness|nervousness|anger|fear|shame|hopelessness",\n  "system_prompt": "string",\n  "init_trace": {"notes":"简短说明关键判断"}\n}\n\n来访者画像：\n${JSON.stringify(profile, null, 2)}\n\n案例报告：\n${JSON.stringify(report, null, 2)}\n\n既有对话样本：\n${previousDialogue || "无"}\n\n长期记忆模式：${hasLongTermMemory ? "开启" : "关闭"}`;

  try {
    const text = await chatCompletion(env, [{ role: "user", content: prompt }]);
    const draft = tryParseJson<InitializationDraft>(text, {});
    const complaintChain = Array.isArray(draft.complaint_chain)
      ? draft.complaint_chain
          .map((item, index) => ({ stage: index + 1, content: String(item).trim() }))
          .filter((item) => item.content)
      : [];

    return {
      event: draft.event?.trim() || fallback.event,
      situation: draft.situation?.trim() || fallback.situation,
      status: draft.status?.trim() || fallback.status,
      style: Array.isArray(draft.style) && draft.style.length
        ? draft.style.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
        : fallback.style,
      sampleStatements: [],
      complaintChain: complaintChain.length >= 3 ? complaintChain : fallback.complaintChain,
      scales: {
        ...(draft.previous_scales || {}),
        ...(draft.current_scales || {}),
      },
      currentEmotion: draft.current_emotion?.trim() || fallback.currentEmotion,
      initTrace: draft.init_trace || fallback.initTrace,
      systemPrompt: draft.system_prompt?.trim() || fallback.systemPrompt,
      initSource: "llm" as const,
    };
  } catch {
    return fallback;
  }
}

export function createSituation(profile: SessionSnapshot["profile"]) {
  const symptoms = splitSymptoms(profile.symptoms).slice(0, 2).join("、") || "说不清的难受";
  return `你最近一直被${symptoms}困扰，这些体验已经影响到你的日常节奏。你来咨询并不是因为完全准备好了，而是因为生活和关系中的压力开始让你有些撑不住。你希望被理解，但也担心自己说出来后仍然得不到真正帮助。`;
}

export function createStatus(profile: SessionSnapshot["profile"], report: Record<string, unknown>) {
  const title = typeof report["案例标题"] === "string" ? report["案例标题"] : "当前案例";
  return `${title}相关困扰在近期被持续激活，你的状态带有明显的情绪负荷与防御。表面上你会尽量把问题说得轻一些，但内在其实已经积累了不少无力感和紧张感。`;
}

export function sampleStatements(previousConversations: ConversationMessage[]) {
  return previousConversations
    .filter((item) => item.role === "Seeker")
    .slice(0, 3)
    .map((item) => item.content);
}

export function createStyle(previousConversations: ConversationMessage[]) {
  const seekerTexts = previousConversations
    .filter((item) => item.role === "Seeker")
    .map((item) => item.content);
  const joined = seekerTexts.join("\n");
  const styles = ["回答偏口语化，不会主动做结构化总结"];
  if (/\.\.\.|……/.test(joined)) styles.push("说话时常有犹豫和停顿");
  if (/不想|没用|算了|完了/.test(joined)) styles.push("容易流露无力感和消极预期");
  if (joined.length < 120) styles.push("初期表达较保守，需要咨询师慢慢引导");
  if (styles.length < 3) styles.push("只有在感到被理解时才会逐步展开更多内容");
  return styles.slice(0, 4);
}

export function inferEmotion(snapshot: SessionSnapshot) {
  const symptoms = snapshot.profile.symptoms;
  if (/自杀|自残|危机/.test(symptoms)) return "fear";
  if (/抑郁|无望|悲伤|低落/.test(symptoms)) return "sadness";
  if (/焦虑|恐惧|紧张|失眠/.test(symptoms)) return "nervousness";
  if (/冲突|愤怒|烦躁/.test(symptoms)) return "anger";
  return snapshot.chainIndex >= 3 ? "sadness" : "confusion";
}

export function shouldAdvanceComplaint(snapshot: SessionSnapshot, latestCounselorMessage: string) {
  const reflective = /为什么|发生了什么|什么时候开始|最担心|感觉|想法|以前|上次|你提到/.test(latestCounselorMessage);
  if (!reflective) return snapshot.chainIndex;
  if (snapshot.turnCount >= snapshot.chainIndex * 2) {
    return Math.min(snapshot.chainIndex + 1, snapshot.complaintChain.length);
  }
  return snapshot.chainIndex;
}

export function needsLongTermMemory(message: string) {
  return /之前|以前|上次|过去|先前|前几次|之前疗程|前面谈到/.test(message);
}

export function buildSystemPrompt(snapshot: Pick<SessionSnapshot, "profile" | "situation" | "status" | "style" | "sampleStatements">) {
  return `# Role: 心理咨询患者

## Profile
- 性别: ${snapshot.profile.gender}
- 年龄: ${snapshot.profile.age}
- 职业: ${snapshot.profile.occupation}
- 婚姻状况: ${snapshot.profile.marital_status}

## Situation
- 你是一个正在向心理咨询师求助的来访者，需要围绕自己的真实体验与困扰展开咨询。
${snapshot.situation}

## Status
${snapshot.status}

## Characteristics of speaking style
- ${snapshot.style.join("\n- ")}

## Constraints
- 你不是咨询师，不能给建议，不能替咨询师总结。
- 你只能用第一人称表达自己的感受、想法、经历和需要。
- 一次不要暴露过多信息，每轮只围绕当前最突出的体验说话。
- 如果咨询师回应得不好，你会保留、迟疑、或表达不被理解的感觉。
- 回复语言应和咨询师当前语言一致，保持自然口语。

## OutputFormat
- 使用自然完整的口语句子
- 仅输出对话内容`; 
}

export async function generateSeekerReply(
  env: CloudflareEnv,
  snapshot: SessionSnapshot,
  counselorMessage: string,
  supplementalMemory = ""
) {
  const complaint = snapshot.complaintChain.find((item) => item.stage === snapshot.chainIndex)?.content || "表达当前困扰";
  const reminder = [
    `当前的情绪状态是：${snapshot.currentEmotion}`,
    `当前的主诉是：${complaint}`,
    "你是来访者而不是咨询师，只能从第一人称描述自己的体验",
  ];
  if (supplementalMemory) reminder.push(`涉及到之前疗程的信息是：${supplementalMemory}`);

  return chatCompletion(env, [
    { role: "system", content: snapshot.systemPrompt },
    ...snapshot.llmMessages,
    { role: "user", content: counselorMessage },
    { role: "system", content: reminder.join("，") },
  ]);
}

function fallbackEvaluation(): EvaluationResult {
  const dimensions = Object.fromEntries(
    Object.keys(EVALUATION_DIMENSIONS).map((key) => [key, 60])
  );
  return {
    overall_score: 60,
    dimension_scores: dimensions,
    mistakes: [],
    strengths: ["完成了基础咨询互动"],
    feedback: "本次咨询完成了基本的来访探索，但仍可进一步提升回应深度与结构化能力。",
    tips: ["增加开放式提问", "更及时地反映来访者情绪"],
  };
}

export async function evaluateSession(env: CloudflareEnv, snapshot: SessionSnapshot) {
  const counselorTurns = snapshot.conversation.filter((item) => item.role === "Counselor").length;
  const seekerTurns = snapshot.conversation.filter((item) => item.role === "Seeker").length;
  if (!counselorTurns || !seekerTurns) {
    throw new Error("当前没有可评估的有效咨询对话，请先完成至少一轮咨访互动。");
  }

  const dialogue = snapshot.conversation
    .map((item) => `${item.role === "Counselor" ? "咨询师" : "来访者"}: ${item.content}`)
    .join("\n");
  const dimensions = Object.entries(EVALUATION_DIMENSIONS)
    .map(([key, info]) => `- ${info.label}(${key}): ${info.description}`)
    .join("\n");

  const prompt = `你是一位资深心理咨询督导师，请对以下咨询对话进行评估。\n\n评估维度:\n${dimensions}\n\n来访者背景:\n${snapshot.profile.gender}，${snapshot.profile.age}岁，${snapshot.profile.occupation}，症状：${snapshot.profile.symptoms}\n\n咨询对话:\n${dialogue}\n\n请严格输出 JSON，结构如下：\n{\n  "overall_score": 0-100,\n  "dimension_scores": {"empathy":0,"active_listening":0,"questioning":0,"reflection":0,"confrontation":0,"goal_setting":0,"crisis_handling":0,"theoretical_application":0},\n  "mistakes": [{"type":"questioning","description":"...","severity":"low","suggestion":"...","conversation_turn":1}],\n  "strengths": ["..."],\n  "feedback": "...",\n  "tips": ["..."]\n}`;

  const text = await chatCompletion(env, [{ role: "user", content: prompt }], { temperature: 0.2 });
  const parsed = tryParseJson<EvaluationResult>(text, fallbackEvaluation());
  return {
    ...fallbackEvaluation(),
    ...parsed,
    dimension_scores: {
      ...fallbackEvaluation().dimension_scores,
      ...(parsed.dimension_scores || {}),
    },
    overall_score: Number(parsed.overall_score || 60),
    mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : fallbackEvaluation().strengths,
    tips: Array.isArray(parsed.tips) ? parsed.tips : fallbackEvaluation().tips,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : fallbackEvaluation().feedback,
  };
}
