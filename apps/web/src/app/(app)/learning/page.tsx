"use client";

import { useQuery } from "@tanstack/react-query";
import { learning } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  Target,
  BookOpen,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Brain,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import { EVAL_DIMENSIONS } from "@/lib/types";

export default function LearningPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => learning.getDashboard(),
  });

  const { data: growthCurve } = useQuery({
    queryKey: ["growth-curve"],
    queryFn: () => learning.getGrowthCurve(),
  });

  const { data: mistakes } = useQuery({
    queryKey: ["mistakes"],
    queryFn: () => learning.getMistakes(1, 10),
  });

  const { data: recommendations } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => learning.getRecommendations(),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">加载中…</div>
      </div>
    );
  }

  const stats = dashboard;
  const hasData = stats && stats.total_sessions > 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          成长路径
        </h1>
        <p className="text-muted-foreground">
          追踪训练进度、分析能力维度、获取个性化学习建议
        </p>
      </div>

      {!hasData ? (
        <Card className="p-12">
          <div className="text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="font-semibold text-lg mb-2">开始您的成长之旅</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              完成首次模拟咨询后，系统将自动生成多维度能力评估和个性化学习建议。
            </p>
            <Link href="/simulator">
              <Button>
                开始练习 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="dimensions">能力维度</TabsTrigger>
            <TabsTrigger value="mistakes">错题集</TabsTrigger>
            <TabsTrigger value="recommendations">学习推荐</TabsTrigger>
          </TabsList>

          {/* --- Overview Tab --- */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-5 flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">平均得分</p>
                    <p className="text-2xl font-bold">
                      {stats.average_score.toFixed(1)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 flex items-center gap-3">
                  <Target className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">完成会话</p>
                    <p className="text-2xl font-bold">{stats.total_sessions}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">成长趋势</p>
                    <p className="text-xl font-bold">
                      {growthCurve?.trend === "improving"
                        ? "📈 上升"
                        : growthCurve?.trend === "declining"
                        ? "📉 下降"
                        : "➡️ 稳定"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 flex items-center gap-3">
                  <Award className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">练习时长</p>
                    <p className="text-2xl font-bold">
                      {stats.total_practice_hours.toFixed(1)}h
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Growth Curve (ASCII/text representation) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">成长曲线</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.growth_curve.length > 0 ? (
                  <div className="space-y-2">
                    {stats.growth_curve.slice(-10).map((pt, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">
                          {new Date(pt.date).toLocaleDateString("zh-CN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <Progress
                          value={pt.score}
                          className="flex-1 h-3"
                        />
                        <span className="text-sm font-medium w-10 text-right">
                          {pt.score.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无数据</p>
                )}
              </CardContent>
            </Card>

            {/* Weak Dimensions */}
            {stats.weak_dimensions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    薄弱环节
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {stats.weak_dimensions.map((item) => (
                      <Badge key={item.dim} variant="destructive" className="text-xs">
                        {EVAL_DIMENSIONS[item.dim] ?? item.dim}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    系统检测到以上维度得分偏低，建议针对性加强练习。
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* --- Dimensions Tab --- */}
          <TabsContent value="dimensions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">八维度能力详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(stats.dimension_averages).map(
                  ([key, value]) => {
                    const score = value as number;
                    const isWeak = stats.weak_dimensions.some((item) => item.dim === key);
                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            {EVAL_DIMENSIONS[key] ?? key}
                            {isWeak && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] h-4"
                              >
                                需提升
                              </Badge>
                            )}
                          </span>
                          <span className="font-medium">
                            {score.toFixed(1)} / 100
                          </span>
                        </div>
                        <Progress value={score} className="h-2.5" />
                      </div>
                    );
                  }
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Mistakes Tab --- */}
          <TabsContent value="mistakes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  错题集
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mistakes && mistakes.mistakes.length > 0 ? (
                  <div className="space-y-3">
                    {mistakes.mistakes.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {m.type}
                            </Badge>
                            <Badge
                              variant={
                                m.severity === "high"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {m.severity === "high"
                                ? "严重"
                                : m.severity === "medium"
                                ? "中等"
                                : "轻微"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            出现 {m.frequency} 次
                          </span>
                        </div>
                        <p className="text-sm">{m.description}</p>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                          <span>{m.suggestion}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    暂无错误记录，继续保持！
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Recommendations Tab --- */}
          <TabsContent value="recommendations" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {recommendations && recommendations.length > 0 ? (
                recommendations.map((rec) => (
                  <Card key={rec.id}>
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-sm">{rec.title}</h3>
                        <Badge variant="outline" className="text-[10px] ml-2">
                          {rec.recommendation_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rec.description}
                      </p>
                      <Separator />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{rec.reason}</span>
                        {rec.is_completed && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="col-span-2 p-8">
                  <div className="text-center text-muted-foreground">
                    <Award className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">完成更多练习后将获得个性化推荐</p>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
