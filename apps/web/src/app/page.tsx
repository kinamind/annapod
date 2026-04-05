"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare,
  BookOpen,
  TrendingUp,
  Eye,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: MessageSquare,
    title: "虚拟来访者模拟",
    description:
      "3,000+ 真实案例驱动的 AI 来访者，具备情感波动、主诉演变与个性化风格。",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: BookOpen,
    title: "三维知识宝库",
    description:
      "流派 × 议题 × 难度三维结构化知识库，支持语义检索的咨询知识百科。",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: TrendingUp,
    title: "个性化成长路径",
    description:
      "八维度能力评估、智能诊断薄弱环节、个性化练习推荐与成长曲线追踪。",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: Eye,
    title: "场景预览",
    description: "多维咨询场景可视化预览，提前感受不同类型来访者。即将推出。",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
              安
            </div>
            <span className="text-lg font-semibold">annapod</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                登录
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">
                免费注册 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm text-muted-foreground mb-6">
            <Sparkles className="h-4 w-4 text-amber-500" />
            基于 AnnaAgent 研究 · 可配置 AI 模型驱动
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            安娜心训舱{" "}
            <span className="text-primary">annapod</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            AI 驱动的心理咨询师训练平台。通过模拟真实来访者对话、结构化知识学习和智能成长评估，
            加速您的专业成长之路。
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="px-8">
                开始训练 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="px-8">
                已有帐号
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${f.bg} ${f.color} mb-4`}
                  >
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="border-t bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-4">
            {[
              { value: "3,134", label: "真实案例" },
              { value: "10+", label: "咨询流派" },
              { value: "14", label: "议题类型" },
              { value: "8", label: "评估维度" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-primary">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            © 2025 annapod 安娜心训舱 · Built by{" "}
            <a
              href="https://github.com/kinamind"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener"
            >
              KinaMind
            </a>
          </p>
          <p className="mt-1">
            Powered by AnnaAgent research & configurable AI models
          </p>
        </div>
      </footer>
    </div>
  );
}
