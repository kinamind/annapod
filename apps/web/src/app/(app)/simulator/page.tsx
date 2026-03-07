"use client";

import { useQuery } from "@tanstack/react-query";
import { simulator } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Search,
  User,
  Briefcase,
  Heart,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SeekerProfile } from "@/lib/types";

const GROUP_TAGS = [
  { value: "", label: "全部分组" },
  { value: "elderly", label: "老年来访者" },
  { value: "adolescent", label: "青少年来访者" },
  { value: "college", label: "大学生来访者" },
  { value: "female", label: "女性来访者" },
  { value: "workplace", label: "职场来访者" },
  { value: "family", label: "家庭相关" },
  { value: "general", label: "一般来访者" },
];

const DIFFICULTIES = [
  { value: "", label: "全部难度" },
  { value: "beginner", label: "初级" },
  { value: "intermediate", label: "中级" },
  { value: "advanced", label: "高级" },
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
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
              {profile.gender === "女" ? "♀" : "♂"}
            </div>
            <div>
              <p className="font-medium">{profile.age}岁 · {profile.gender}</p>
              <p className="text-xs text-muted-foreground">{profile.occupation}</p>
            </div>
          </div>
          <Badge className={difficultyColor[profile.difficulty] ?? "bg-muted"}>
            {DIFFICULTIES.find((d) => d.value === profile.difficulty)?.label ??
              profile.difficulty}
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
          {loading ? "创建中…" : "开始咨询"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SimulatorPage() {
  const [groupTag, setGroupTag] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState(1);
  const [startingId, setStartingId] = useState<string | null>(null);
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["profiles", groupTag, difficulty, page],
    queryFn: () =>
      simulator.getProfiles({
        group_tag: groupTag || undefined,
        difficulty: difficulty || undefined,
        page,
        page_size: 12,
      }),
  });

  const handleStart = async (profile: SeekerProfile) => {
    setStartingId(profile.id);
    try {
      const res = await simulator.startSession({
        profile_id: profile.id,
        enable_long_term_memory: true,
      });
      router.push(`/simulator/chat/${res.session_id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "创建会话失败";
      toast.error(msg);
      setStartingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">虚拟来访者</h1>
        <p className="text-muted-foreground">
          选择一位来访者开始模拟咨询练习
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={groupTag} onValueChange={(v) => { setGroupTag(v ?? ""); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="全部分组" />
          </SelectTrigger>
          <SelectContent>
            {GROUP_TAGS.map((g) => (
              <SelectItem key={g.value} value={g.value || "__all__"}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficulty} onValueChange={(v) => { setDifficulty(v ?? ""); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部难度" />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d.value} value={d.value || "__all__"}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-muted-foreground">加载来访者档案…</div>
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

          {data && data.total > 12 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {page} 页 / 共 {Math.ceil(data.total / 12)} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 12 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
