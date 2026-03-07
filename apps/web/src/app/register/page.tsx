"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "",
    username: "",
    display_name: "",
    password: "",
    confirmPassword: "",
  });
  const { register, isLoading } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("两次密码不一致");
      return;
    }
    try {
      await register({
        email: form.email,
        username: form.username,
        display_name: form.display_name,
        password: form.password,
      });
      toast.success("注册成功！欢迎使用 MindBridge");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "注册失败";
      toast.error(msg);
    }
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
              心
            </div>
          </div>
          <CardTitle className="text-2xl">注册 MindBridge</CardTitle>
          <p className="text-sm text-muted-foreground">
            创建帐号，开始您的咨询训练之旅
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="name@example.com"
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  placeholder="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">显示名称</Label>
                <Input
                  id="display_name"
                  value={form.display_name}
                  onChange={(e) => update("display_name", e.target.value)}
                  placeholder="您的名字"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="至少 6 位"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                placeholder="再次输入密码"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "注册中…" : "注 册"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            已有帐号？{" "}
            <Link href="/login" className="text-primary underline">
              立即登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
