"use client";

import { useQuery } from "@tanstack/react-query";
import { knowledge } from "@/lib/api";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Search,
  Layers,
  GraduationCap,
  Filter,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import type { KnowledgeItem } from "@/lib/types";
import { SCHOOL_OPTIONS, ISSUE_OPTIONS, DIFFICULTY_LEVELS } from "@/lib/types";

const diffColor: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

const sourceLabel: Record<string, string> = {
  textbook: "教材",
  paper: "论文",
  guideline: "指南",
  case: "案例",
  technique: "技术",
};

export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("");
  const [issue, setIssue] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<KnowledgeItem | null>(null);

  const { data: dimensions } = useQuery({
    queryKey: ["knowledge-dimensions"],
    queryFn: () => knowledge.getDimensions(),
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ["knowledge-search", query, school, issue, difficulty, page],
    queryFn: () =>
      knowledge.search({
        query: query || undefined,
        school: school || undefined,
        issue: issue || undefined,
        difficulty: difficulty || undefined,
        page,
        page_size: 12,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ["knowledge-stats"],
    queryFn: () => knowledge.getStats(),
  });

  const clearFilters = () => {
    setQuery("");
    setSchool("");
    setIssue("");
    setDifficulty("");
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          知识宝库
        </h1>
        <p className="text-muted-foreground">
          流派 × 议题 × 难度 三维结构化咨询知识库
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Layers className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">流派覆盖</p>
                <p className="font-semibold">
                  {Object.keys(stats.schools).length} 种
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Filter className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">议题类型</p>
                <p className="font-semibold">
                  {Object.keys(stats.issues).length} 个
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">总条目</p>
                <p className="font-semibold">{stats.total_items} 条</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="搜索知识条目…"
            className="pl-9"
          />
        </div>

        <Select
          value={school}
          onValueChange={(v) => {
            setSchool(!v || v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="全部流派" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部流派</SelectItem>
            {(dimensions?.schools ?? SCHOOL_OPTIONS).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={issue}
          onValueChange={(v) => {
            setIssue(!v || v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="全部议题" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部议题</SelectItem>
            {(dimensions?.issues ?? ISSUE_OPTIONS).map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={difficulty}
          onValueChange={(v) => {
            setDifficulty(!v || v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="全部难度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部难度</SelectItem>
            {DIFFICULTY_LEVELS.map((d) => (
              <SelectItem key={d.key} value={d.key}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(query || school || issue || difficulty) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            清除筛选
          </Button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-muted-foreground">搜索中…</div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result?.items.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelected(item)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm leading-tight line-clamp-2 flex-1">
                      {item.title}
                    </h3>
                    <Badge
                      className={cn(
                        "ml-2 shrink-0 text-[10px]",
                        diffColor[item.difficulty] ?? "bg-muted"
                      )}
                    >
                      {DIFFICULTY_LEVELS.find((d) => d.key === item.difficulty)
                        ?.label ?? item.difficulty}
                    </Badge>
                  </div>

                  {item.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                      {item.summary}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {item.school}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {item.issue}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {sourceLabel[item.source_type] ?? item.source_type}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {result && result.items.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">未找到匹配的知识条目</p>
              <Button
                variant="link"
                size="sm"
                onClick={clearFilters}
                className="mt-2"
              >
                清除筛选条件
              </Button>
            </div>
          )}

          {result && result.total > 12 && (
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
                第 {page} 页 / 共 {Math.ceil(result.total / 12)} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 12 >= result.total}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="leading-tight">
                  {selected.title}
                </DialogTitle>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="outline">{selected.school}</Badge>
                  <Badge variant="secondary">{selected.issue}</Badge>
                  <Badge
                    className={
                      diffColor[selected.difficulty] ?? "bg-muted"
                    }
                  >
                    {DIFFICULTY_LEVELS.find(
                      (d) => d.key === selected.difficulty
                    )?.label ?? selected.difficulty}
                  </Badge>
                  <Badge variant="secondary">
                    {sourceLabel[selected.source_type] ?? selected.source_type}
                  </Badge>
                </div>
              </DialogHeader>
              <ScrollArea className="max-h-[50vh] mt-4">
                <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                  {selected.content}
                </div>
              </ScrollArea>
              {selected.source_ref && (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <span>来源: {selected.source_ref}</span>
                </div>
              )}
              {selected.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selected.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...args: (string | undefined | false)[]): string {
  return args.filter(Boolean).join(" ");
}
