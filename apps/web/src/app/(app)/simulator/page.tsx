"use client";

import { useQuery } from "@tanstack/react-query";
import { simulator, teams } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Heart,
  AlertTriangle,
  Brain,
  History,
  PlaySquare,
  Eye,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { SeekerProfile, SessionGroup } from "@/lib/types";
import { useLocale } from "@/lib/locale";

const GROUP_TAGS = [
  { value: "", labelKey: "simulator.group.all" },
  { value: "elderly", labelKey: "simulator.group.elderly" },
  { value: "adolescent", labelKey: "simulator.group.adolescent" },
  { value: "college", labelKey: "simulator.group.college" },
  { value: "female", labelKey: "simulator.group.female" },
  { value: "workplace", labelKey: "simulator.group.workplace" },
  { value: "family", labelKey: "simulator.group.family" },
  { value: "general", labelKey: "simulator.group.general" },
];

const DIFFICULTIES = [
  { value: "", labelKey: "difficulty.all" },
  { value: "beginner", labelKey: "difficulty.beginner" },
  { value: "intermediate", labelKey: "difficulty.intermediate" },
  { value: "advanced", labelKey: "difficulty.advanced" },
];

const difficultyColor: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

function ProfileCard({
  profile,
  onStart,
  loading,
}: {
  profile: SeekerProfile;
  onStart: () => void;
  loading: boolean;
}) {
  const { t } = useLocale();
  const isFemale = profile.gender === "女" || profile.gender.toLowerCase() === "female";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
              {isFemale ? "♀" : "♂"}
            </div>
            <div>
              <p className="font-medium">{profile.age}岁 · {profile.gender}</p>
              <p className="text-xs text-muted-foreground">{profile.occupation}</p>
            </div>
          </div>
          <Badge className={difficultyColor[profile.difficulty] ?? "bg-muted"}>
            {t(
              DIFFICULTIES.find((d) => d.value === profile.difficulty)?.labelKey ??
                profile.difficulty
            )}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <Heart className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{profile.marital_status}</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{profile.symptoms}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {profile.group_tag}
          </Badge>
          {profile.issue_tags && (
            <Badge variant="secondary" className="text-[10px]">
              {profile.issue_tags}
            </Badge>
          )}
        </div>

        <Button
          className="w-full mt-4"
          size="sm"
          onClick={onStart}
          disabled={loading}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          {loading ? t("simulator.creating") : t("simulator.start")}
        </Button>
      </CardContent>
    </Card>
  );
}

function UserSessionsList({ groupId }: { groupId?: string }) {
  const { t } = useLocale();
  const router = useRouter();

  const { data: sessions, isLoading, isError } = useQuery({
    queryKey: ["my-sessions", groupId],
    queryFn: () => simulator.getSessions({ group_id: groupId || undefined }),
  });

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground">{t("simulator.loading") || "Loading..."}</div>;
  }

  if (isError) {
    return <div className="py-20 text-center text-red-500">Failed to load sessions.</div>;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground flex flex-col items-center">
        <History className="h-10 w-10 mb-3 opacity-50" />
        <p>No history found.</p>
      </div>
    );
  }

  const activeSessions = sessions.filter((ses) => ses.status !== "completed");
  const completedSessions = sessions.filter((ses) => ses.status === "completed");

  const renderSessionCard = (ses: (typeof sessions)[number]) => (
    <Card key={ses.id} className="hover:shadow-md transition">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <div className="font-medium flex items-center gap-2">
            {ses.profile_summary}
            <Badge variant="outline" className={ses.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}>
              {ses.status === "completed" ? "Completed" : "Active"}
            </Badge>
            {ses.team_id && (
              <Badge variant="secondary">
                {ses.team_kind === "competition" ? "比赛" : "团队"}
                {ses.team_name ? ` · ${ses.team_name}` : ""}
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex gap-4 flex-wrap">
            <span>{new Date(ses.started_at).toLocaleString()}</span>
            <span>Turns: {ses.turn_count}</span>
            {ses.score !== null && ses.score !== undefined && (
              <span className="text-indigo-600 font-medium">Score: {ses.score.toFixed(1)}</span>
            )}
          </div>
        </div>
        <div>
          <Button
            variant={ses.status === "completed" ? "outline" : "default"}
            onClick={() => router.push(`/simulator/chat?sessionId=${encodeURIComponent(ses.id)}`)}
          >
            {ses.status === "completed" ? (
              <><Eye className="h-4 w-4 mr-2" /> View</>
            ) : (
              <><PlaySquare className="h-4 w-4 mr-2" /> Continue</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
      <div className="space-y-6">
      {groupId && (
        <div className="text-sm text-muted-foreground">当前正在查看同一长期记忆分组下的历史会话。</div>
      )}
      {activeSessions.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm font-medium text-muted-foreground">进行中的咨询</div>
          {activeSessions.map(renderSessionCard)}
        </div>
      )}
      {completedSessions.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm font-medium text-muted-foreground">已完成的咨询</div>
          {completedSessions.map(renderSessionCard)}
        </div>
      )}
    </div>
  );
}

function SessionGroupsList() {
  const { t } = useLocale();
  const router = useRouter();
  const [startingGroupId, setStartingGroupId] = useState<string | null>(null);

  const { data: groups, isLoading, isError } = useQuery({
    queryKey: ["session-groups"],
    queryFn: () => simulator.getSessionGroups(),
  });

  const handleContinue = async (group: SessionGroup) => {
    setStartingGroupId(group.id);
    try {
      const res = await simulator.startSession({
        profile_id: group.profile_id,
        session_group_id: group.id,
        enable_long_term_memory: true,
      });
      router.push(`/simulator/chat?sessionId=${encodeURIComponent(res.session_id)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "创建长期记忆会话失败");
      setStartingGroupId(null);
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground">{t("simulator.loading") || "Loading..."}</div>;
  }

  if (isError) {
    return <div className="py-20 text-center text-red-500">Failed to load session groups.</div>;
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground flex flex-col items-center">
        <Brain className="h-10 w-10 mb-3 opacity-50" />
        <p>还没有长期记忆会话分组。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.id} className="hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="font-medium">{group.title}</div>
              <div className="text-sm text-muted-foreground">{group.profile_summary}</div>
              <div className="text-xs text-muted-foreground flex gap-4 flex-wrap">
                <span>会话数: {group.session_count}</span>
                <span>已完成: {group.completed_sessions ?? 0}</span>
                {group.last_started_at && <span>最近一次: {new Date(group.last_started_at).toLocaleString()}</span>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => router.push(`/simulator?tab=sessions&groupId=${encodeURIComponent(group.id)}`)}>
                <History className="h-4 w-4 mr-2" />
                记录
              </Button>
              <Button onClick={() => handleContinue(group)} disabled={startingGroupId === group.id}>
                <PlaySquare className="h-4 w-4 mr-2" />
                {startingGroupId === group.id ? "创建中..." : "继续咨询"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function SimulatorPage() {
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const [groupTag, setGroupTag] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState(1);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [enableLtm, setEnableLtm] = useState(true);
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "profiles";
  const selectedGroupId = searchParams.get("groupId") || "";
  const selectedTeamId = searchParams.get("teamId") || "";

  const { data: teamDetail } = useQuery({
    queryKey: ["team-detail-simulator", selectedTeamId],
    queryFn: () => teams.getById(selectedTeamId),
    enabled: Boolean(selectedTeamId),
  });

  const effectiveGroupTag = teamDetail?.profile_group_tag || groupTag;
  const effectiveDifficulty = teamDetail?.profile_difficulty || difficulty;
  const effectiveIssueTag = teamDetail?.profile_issue_tag || "";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["profiles", effectiveGroupTag, effectiveDifficulty, effectiveIssueTag, selectedTeamId, page],
    queryFn: () =>
      simulator.getProfiles({
        group_tag: effectiveGroupTag || undefined,
        difficulty: effectiveDifficulty || undefined,
        issue_tag: effectiveIssueTag || undefined,
        team_id: selectedTeamId || undefined,
        page,
        page_size: 12,
      }),
  });

  const handleStart = async (profile: SeekerProfile) => {
    setStartingId(profile.id);
    try {
      const res = await simulator.startSession({
        profile_id: profile.id,
        enable_long_term_memory: enableLtm,
        team_id: selectedTeamId || undefined,
      });
      router.push(`/simulator/chat?sessionId=${encodeURIComponent(res.session_id)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("simulator.createFailed");
      toast.error(msg);
      setStartingId(null);
    }
  };

  const clearFilters = () => {
    setGroupTag("");
    setDifficulty("");
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / 12) : 1;
  const pageText =
    locale === "zh"
      ? `${t("simulator.page")} ${page} ${t("simulator.pageOf")} ${totalPages} ${t("simulator.pageSuffix")}`
      : `${t("simulator.page")} ${page} ${t("simulator.pageOf")} ${totalPages}`;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{t("simulator.title")}</h1>
        <p className="text-muted-foreground">{t("simulator.subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => router.replace(value === "sessions" && selectedGroupId ? `/simulator?tab=${value}&groupId=${encodeURIComponent(selectedGroupId)}` : `/simulator?tab=${value}`)} className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3 mb-6">
          <TabsTrigger value="profiles">{locale === "zh" ? "选择来访者" : "Profiles"}</TabsTrigger>
          <TabsTrigger value="groups">{locale === "zh" ? "长期记忆分组" : "Memory Groups"}</TabsTrigger>
          <TabsTrigger value="sessions">{locale === "zh" ? "咨询记录" : "Sessions"}</TabsTrigger>
        </TabsList>
        <TabsContent value="profiles" className="space-y-6">
      {teamDetail && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
            <div className="font-medium text-foreground">当前正在进行团队/比赛训练：{teamDetail.name}</div>
            <div>
              限定群体：{teamDetail.profile_group_tag || "不限"} · 限定难度：{teamDetail.profile_difficulty || "不限"} · 限定议题：{teamDetail.profile_issue_tag || "不限"}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={groupTag} onValueChange={(v) => { setGroupTag(!v || v === "__all__" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("simulator.group.all")} />
          </SelectTrigger>
          <SelectContent>
            {GROUP_TAGS.map((g) => (
              <SelectItem key={g.value || "__all__"} value={g.value || "__all__"}>
                {t(g.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficulty} onValueChange={(v) => { setDifficulty(!v || v === "__all__" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t("difficulty.all")} />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d.value} value={d.value || "__all__"}>
                {t(d.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(groupTag || difficulty) && !teamDetail && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("common.clearFilters")}
          </Button>
        )}

        <div className="flex items-center space-x-2 ml-auto shrink-0 bg-white dark:bg-zinc-900 border rounded-md px-3 py-1.5 shadow-sm">
          <Brain className="h-4 w-4 text-emerald-500" />
          <label htmlFor="ltm-toggle" className="text-sm font-medium leading-none cursor-pointer">
            {locale === "zh" ? "长记忆模式" : "Long-term Memory"}
          </label>
          <input
            type="checkbox"
            id="ltm-toggle"
            checked={enableLtm}
            onChange={(e) => setEnableLtm(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 ml-2"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-muted-foreground">{t("simulator.loading")}</div>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mb-3 opacity-60" />
          <p className="text-sm">{t("common.backendError")}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.profiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                onStart={() => handleStart(p)}
                loading={startingId === p.id}
              />
            ))}
          </div>

          {data && data.profiles.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t("simulator.empty")}</p>
              <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                {t("common.clearFilters")}
              </Button>
            </div>
          )}

          {data && data.total > 12 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("common.prev")}
              </Button>
              <span className="text-sm text-muted-foreground">{pageText}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 12 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}
        </TabsContent>
        <TabsContent value="groups">
          <SessionGroupsList />
        </TabsContent>
        <TabsContent value="sessions">
          <UserSessionsList groupId={selectedGroupId || undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
