"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";
import { useLocale } from "@/lib/locale";
import { auth } from "@/lib/api";

function LoginPageInner() {
  const { t } = useLocale();
  const params = useSearchParams();
  const [ssoBusy, setSsoBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading } = useAuthStore();
  const router = useRouter();

  // Surface failures bounced back from the KinaMind callback.
  const ssoError = params.get("sso_error");
  useEffect(() => {
    if (ssoError) toast.error(`KinaMind 登录失败：${ssoError}`);
  }, [ssoError]);

  const handleKinamind = async () => {
    setSsoBusy(true);
    try {
      await auth.kinamindStart("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "无法连接 KinaMind");
      setSsoBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      toast.success(t("auth.login.success"));
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("auth.login.failed");
      toast.error(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
              安
            </div>
          </div>
          <CardTitle className="text-2xl">{t("auth.login.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("auth.login.subtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleKinamind}
            disabled={ssoBusy}
          >
            {ssoBusy ? "跳转中…" : "使用 KinaMind 账号登录"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            一个 KinaMind 账号通行所有 KinaMind 应用
          </p>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            或使用 annapod 账号
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t("auth.login.user")}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("auth.login.userPlaceholder")}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.login.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.login.passwordPlaceholder")}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("auth.login.loading") : t("auth.login.submit")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.login.noAccount")}{" "}
            <Link href="/register" className="text-primary underline">
              {t("auth.login.register")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
