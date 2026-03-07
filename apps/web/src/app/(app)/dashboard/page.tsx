"use client";

import { useQuery } from "@tanstack/react-query";
import { learning, knowledge } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  BookOpen,
  TrendingUp,
  Clock,
  Target,
  Award,
  ArrowRight,
  Brain,
} from "lucide-react";
import Link from "next/link";
import { EVAL_DIMENSIONS } from "@/lib/types";

export default function DashboardPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => learning.getDashboard(),
  });

  const { data: knowledgeStats } = useQuery({
    queryKey: ["knowledge-stats"],
    queryFn: () => knowledge.getStats(),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">加载中…</div>
      </div>
    );
  }

  const stats = dashboard;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">工作台</h1>
        <p className="text-muted-foreground">概览您的训练进度与学习推荐</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">完成会话</p>
                <p className="text-2xl font-bold">
                  {stats?.total_sessions ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Clock className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">练习时长</p>
                <p className="text-2xl font-bold">
                  {(stats?.total_practice_hours ?? 0).toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Target className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">平均得分</p>
                <p className="text-2xl font-bold">
                  {(stats?.average_score ?? 0).toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <BookOpen className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">知识条目</p>
                <p className="text-2xl font-bold">
                  {knowledgeStats?.total_items ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Dimension Radar / Bar */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">能力维度</CardTitle>
            <Link href="/learning">
              <Button variant="ghost" size="sm">
                详情 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats?.dimension_averages &&
            Object.keys(stats.dimension_averages).length > 0 ? (
              Object.entries(stats.dimension_averages).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {EVAL_DIMENSIONS[key] ?? key}
                    </span>
                    <span className="font-medium">
                      {((value as number) * 10).toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={(value as number) * 10} className="h-2" />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Brain className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">完成首次模拟咨询后将显示能力分析</p>
                <Link href="/simulator" className="mt-3">
                  <Button size="sm" variant="outline">
                    开始练习 <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weak Areas + Quick Actions */}
        <div className="space-y-6">
          {/* Weak Areas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">薄弱环节</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.weak_dimensions && stats.weak_dimensions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stats.weak_dimensions.map((d) => (
                    <Badge key={d} variant="secondary">
                      {EVAL_DIMENSIONS[d] ?? d}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  暂无数据，请先完成练习
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">快速操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/simulator" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="mr-2 h-4 w-4 text-blue-500" />
                  开始模拟咨询
                </Button>
              </Link>
              <Link href="/knowledge" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <BookOpen className="mr-2 h-4 w-4 text-emerald-500" />
                  浏览知识库
                </Button>
              </Link>
              <Link href="/learning" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="mr-2 h-4 w-4 text-amber-500" />
                  查看成长曲线
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recommendations */}
      {stats?.recommendations && stats.recommendations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              学习推荐
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.recommendations.slice(0, 6).map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-medium leading-tight">
                      {rec.title}
                    </h4>
                    <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                      {rec.recommendation_type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {rec.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
