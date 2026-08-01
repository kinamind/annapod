"use client";

/**
 * Landing page for the KinaMind SSO redirect.
 *
 * Two outcomes arrive here:
 *
 *  - `mode` absent — the identity is already bound (or a new account was just
 *    provisioned). Exchange the ticket for a token and continue.
 *
 *  - `mode=link` — an annapod account already uses this email address. We do
 *    NOT bind on a matching address alone: annapod never verified emails, so
 *    that would let anyone who registered under someone else's address inherit
 *    their counseling history. The person proves ownership with the existing
 *    annapod password, and only then are the two accounts merged into one.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

function KinamindCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setToken = useAuthStore((state) => state.setToken);
  const loadUser = useAuthStore((state) => state.loadUser);

  const ticket = params.get("ticket") ?? "";
  const mode = params.get("mode");
  const email = params.get("email") ?? "";
  const createdAccount = params.get("created") === "1";
  const returnTo = params.get("return_to") || "/dashboard";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = useCallback(
    async (token: string) => {
      setToken(token);
      await loadUser();
      router.replace(returnTo);
    },
    [setToken, loadUser, router, returnTo]
  );

  useEffect(() => {
    if (!ticket) {
      setError("登录凭证缺失，请重新登录。");
      return;
    }
    if (mode === "link") return; // wait for the password

    let cancelled = false;
    (async () => {
      try {
        const token = await auth.kinamindClaim(ticket);
        if (!cancelled) await finish(token.access_token);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "登录失败，请重试。");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket, mode, finish]);

  async function submitLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await auth.kinamindLink(ticket, password);
      await finish(token.access_token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "绑定失败，请重试。");
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto mt-24 max-w-md px-6 text-center">
        <h1 className="mb-3 text-xl font-semibold">无法完成登录</h1>
        <p className="mb-6 text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => router.replace("/login")}
          className="rounded-md border px-4 py-2 text-sm"
        >
          返回登录
        </button>
      </div>
    );
  }

  if (mode === "link") {
    return (
      <div className="mx-auto mt-24 max-w-md px-6">
        <h1 className="mb-2 text-xl font-semibold">绑定已有账号</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          annapod 上已经有一个使用 <strong>{email}</strong> 的账号。
          输入它的密码即可与你的 KinaMind 账户合并为同一个账号，
          原有的咨询会话、团队与评分记录都会保留。
        </p>

        <form onSubmit={submitLink} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              annapod 密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {busy ? "绑定中…" : "确认绑定"}
          </button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground">
          忘记密码？请先用 KinaMind 之外的方式联系管理员，我们不会在未验证身份的情况下合并账号。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-24 max-w-md px-6 text-center">
      <p className="text-sm text-muted-foreground">
        {createdAccount ? "正在为你创建 annapod 账号…" : "正在登录…"}
      </p>
    </div>
  );
}

export default function KinamindCallbackPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 max-w-md px-6 text-center text-sm">加载中…</div>}>
      <KinamindCallbackInner />
    </Suspense>
  );
}
