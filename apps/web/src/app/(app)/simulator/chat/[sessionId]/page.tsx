"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { simulator } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  StopCircle,
  ArrowLeft,
  Bot,
  UserRound,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [evaluation, setEvaluation] = useState<Record<string, string> | null>(
    null
  );
  const [score, setScore] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    // Load existing session data
    async function loadSession() {
      try {
        const data = await simulator.getSession(sessionId);
        if (data.messages && data.messages.length > 0) {
          const formattedMsgs: ChatMessage[] = data.messages.map(m => ({
            role: m.role.toLowerCase() === "seeker" || m.role.toLowerCase() === "client" ? "client" : "counselor",
            content: m.content,
            timestamp: new Date().toISOString(), // Mock timestamp for history
          }));
          setMessages(formattedMsgs);
          const cCount = formattedMsgs.filter(m => m.role === "client").length;
          setTurnCount(cCount);
        }
        if (data.status === "completed") {
          setSessionEnded(true);
          const ev = data.evaluation as Record<string, string> | undefined;
          if (ev) setEvaluation(ev);
          if (data.score) setScore(data.score);
        }
      } catch (err) {
        console.error("Failed to load session:", err);
      }
    }
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading || sessionEnded) return;

    const userMsg: ChatMessage = {
      role: "counselor",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await simulator.chat(sessionId, text);
      const clientMsg: ChatMessage = {
        role: "client",
        content: res.response,
        emotion: res.emotion ?? undefined,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, clientMsg]);
      setTurnCount(res.turn_count);
      setCurrentEmotion(res.emotion ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "发送失败";
      toast.error(msg);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleEnd = async () => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      const res = await simulator.endSession(sessionId);
      setSessionEnded(true);
      setEvaluation((res.evaluation as Record<string, string>) ?? null);
      setScore(res.score ?? null);

      const sysMsg: ChatMessage = {
        role: "system",
        content: `会话已结束。${res.score ? `综合得分: ${res.score.toFixed(1)} / 10` : ""}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, sysMsg]);
      toast.success("会话已结束，评估已生成");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "结束会话失败";
      toast.error(msg);
    } finally {
      setIsEnding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/simulator")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-sm font-semibold">模拟咨询</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>对话轮次: {turnCount}</span>
              {currentEmotion && (
                <>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {currentEmotion}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleEnd}
          disabled={sessionEnded || isEnding}
        >
          <StopCircle className="mr-1 h-4 w-4" />
          {isEnding ? "结束中…" : "结束咨询"}
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Welcome */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">来访者已就座，请开始咨询对话。</p>
              <p className="text-xs mt-1">
                您可以从自我介绍和开放性提问开始。
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn("flex gap-3", {
                "justify-end": msg.role === "counselor",
                "justify-center": msg.role === "system",
              })}
            >
              {msg.role === "client" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              {msg.role === "system" ? (
                <div className="rounded-lg bg-muted/50 px-4 py-2 text-sm text-muted-foreground text-center max-w-lg">
                  {msg.content}
                </div>
              ) : (
                <div
                  className={cn("rounded-2xl px-4 py-2.5 max-w-[75%] text-sm leading-relaxed", {
                    "bg-primary text-primary-foreground":
                      msg.role === "counselor",
                    "bg-muted": msg.role === "client",
                  })}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.emotion && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                      <Sparkles className="h-3 w-3" />
                      {msg.emotion}
                    </div>
                  )}
                </div>
              )}

              {msg.role === "counselor" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-muted px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Evaluation Summary (shown after session ends) */}
      {sessionEnded && evaluation && (
        <div className="border-t bg-muted/30 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-2">
                会话评估 · 综合得分:{" "}
                <span className="text-primary">
                  {score?.toFixed(1) ?? "N/A"} / 10
                </span>
              </h3>
              {evaluation.feedback && (
                <p className="text-sm text-muted-foreground mb-2">
                  {evaluation.feedback}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/simulator")}
                >
                  再练一次
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/learning")}
                >
                  查看成长报告
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Input Area */}
      {!sessionEnded && (
        <div className="border-t bg-card px-4 py-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的咨询回应…（Enter 发送，Shift+Enter 换行）"
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
              disabled={isLoading}
              autoFocus
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-11 w-11"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
