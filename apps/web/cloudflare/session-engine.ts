import { queryLongTermMemory } from "./memory";
import {
  buildSystemPrompt,
  generateSeekerReply,
  inferEmotion,
  initializeProfileState,
  needsLongTermMemory,
  shouldAdvanceComplaint,
} from "./simulator";
import type { CloudflareEnv, ConversationMessage, SessionSnapshot } from "./types";

export async function createInitialSnapshot(env: CloudflareEnv, input: {
  sessionId: string;
  userId: string;
  profileId: string;
  sessionGroupId?: string | null;
  hasLongTermMemory: boolean;
  profile: SessionSnapshot["profile"];
  report: Record<string, unknown>;
  previousConversations: ConversationMessage[];
}) {
  const start = Date.now();
  const initialized = await initializeProfileState(
    env,
    input.profile,
    input.report,
    input.previousConversations,
    input.hasLongTermMemory
  );

  const snapshot: SessionSnapshot = {
    sessionId: input.sessionId,
    userId: input.userId,
    profileId: input.profileId,
    sessionGroupId: input.sessionGroupId || null,
    hasLongTermMemory: input.hasLongTermMemory,
    profile: input.profile,
    report: input.report,
    previousConversations: input.previousConversations,
    situation: initialized.situation,
    style: initialized.style,
    status: initialized.status,
    sampleStatements: initialized.sampleStatements,
    complaintChain: initialized.complaintChain,
    chainIndex: 1,
    currentEmotion: initialized.currentEmotion,
    systemPrompt: initialized.systemPrompt || "",
    conversation: [],
    llmMessages: [],
    turnCount: 0,
    initSource: initialized.initSource,
    initDurationMs: 0,
  };

  snapshot.currentEmotion = inferEmotion(snapshot);
  if (!snapshot.systemPrompt || !snapshot.systemPrompt.includes("## Example of statement")) {
    snapshot.systemPrompt = buildSystemPrompt(snapshot);
  }
  snapshot.initDurationMs = Date.now() - start;
  return snapshot;
}

export async function chatWithSnapshot(
  env: CloudflareEnv,
  snapshot: SessionSnapshot,
  counselorMessage: string
) {
  const nextSnapshot: SessionSnapshot = {
    ...snapshot,
    complaintChain: [...snapshot.complaintChain],
    conversation: [...snapshot.conversation],
    llmMessages: [...snapshot.llmMessages],
  };

  nextSnapshot.conversation.push({ role: "Counselor", content: counselorMessage });
  nextSnapshot.chainIndex = shouldAdvanceComplaint(nextSnapshot, counselorMessage);
  nextSnapshot.currentEmotion = inferEmotion(nextSnapshot);

  let supplementalMemory = "";
  if (nextSnapshot.hasLongTermMemory && needsLongTermMemory(counselorMessage)) {
    supplementalMemory = await queryLongTermMemory(
      env,
      nextSnapshot.userId,
      nextSnapshot.profileId,
      counselorMessage
    );
  }

  const seekerReply = await generateSeekerReply(
    env,
    nextSnapshot,
    counselorMessage,
    supplementalMemory
  );

  nextSnapshot.conversation.push({ role: "Seeker", content: seekerReply });
  nextSnapshot.llmMessages.push({ role: "user", content: counselorMessage });
  nextSnapshot.llmMessages.push({ role: "assistant", content: seekerReply });
  nextSnapshot.turnCount += 1;

  return {
    snapshot: nextSnapshot,
    response: seekerReply,
    emotion: nextSnapshot.currentEmotion,
    complaint_stage: nextSnapshot.chainIndex,
    turn_count: nextSnapshot.turnCount,
  };
}
