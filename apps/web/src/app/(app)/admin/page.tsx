"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { admin } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, FileDown, Shield } from "lucide-react";
import { useAuthStore } from "@/lib/store";

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const [userId, setUserId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => admin.listUsers(),
    enabled: !!user?.is_admin,
  });

  const teamsQuery = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => admin.listTeams(),
    enabled: !!user?.is_admin,
  });

  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions", userId, teamId, status, from, to],
    queryFn: () => admin.listSessions({
      user_id: userId || undefined,
      team_id: teamId || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    enabled: !!user?.is_admin,
  });

  const sessions = sessionsQuery.data || [];
  const users = usersQuery.data || [];
  const teamList = teamsQuery.data || [];

  const groupedStats = useMemo(() => {
    const byUser = new Map<string, number>();
    for (const s of sessions) byUser.set(s.user_id, (byUser.get(s.user_id) || 0) + 1);
    return { totalUsers: byUser.size, totalSessions: sessions.length };
  }, [sessions]);

  const handleDownload = async (actionKey: string, url: string, filename: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("annapod_token") : null;
    if (!token) {
      toast.error("当前未登录");
      return;
    }
    setLoadingAction(actionKey);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
      toast.success("导出成功");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "导出失败");
    } finally {
      setLoadingAction(null);
    }
  };

  const exportAll = () => handleDownload(
    "all",
    admin.getTranscriptsUrl({ user_id: userId || undefined, team_id: teamId || undefined }),
    `咨询实录-全部.zip`,
  );

  const exportUser = (uid: string, name: string) => handleDownload(
    `user-${uid}`,
    admin.getTranscriptsUrl({ user_id: uid }),
    `${name}-咨询实录.docx`,
  );

  const exportSession = (sid: string, name: string) => handleDownload(
    `session-${sid}`,
    admin.getTranscriptsUrl({ session_id: sid }),
    `${name}-${sid}.docx`,
  );

  if (!user?.is_admin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            当前账户无系统管理员权限
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">系统管理</h1>
          <p className="text-sm text-muted-foreground">跨比赛与用户的咨询记录总览与导出</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">用户</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">全部用户</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name} (@{u.username})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">比赛/团队</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">全部</option>
              {teamList.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name} ({tm.kind === "competition" ? "比赛" : "团队"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">状态</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">全部</option>
              <option value="active">进行中</option>
              <option value="ended">已结束</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">起始时间</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">结束时间</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">会话列表</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              共 {groupedStats.totalSessions} 次会话 / {groupedStats.totalUsers} 位用户
            </p>
          </div>
          <Button
            size="sm"
            onClick={exportAll}
            disabled={loadingAction !== null || sessions.length === 0}
          >
            <FileDown className="h-4 w-4 mr-1" />
            {userId ? "导出该用户全部" : teamId ? "导出该比赛全部" : "导出全部（ZIP）"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">参赛者</th>
                  <th className="px-3 py-2 font-medium">比赛</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">开始时间</th>
                  <th className="px-3 py-2 font-medium">得分</th>
                  <th className="px-3 py-2 font-medium">画像</th>
                  <th className="px-3 py-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.display_name}</div>
                      <div className="text-xs text-muted-foreground">@{s.username}</div>
                    </td>
                    <td className="px-3 py-2">
                      {s.team_name ? (
                        <Badge variant={s.team_kind === "competition" ? "destructive" : "secondary"}>
                          {s.team_name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">个人训练</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{s.status}</td>
                    <td className="px-3 py-2 text-xs">
                      {s.started_at ? new Date(s.started_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.score != null ? (Number(s.score) / 10).toFixed(1) : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {[s.gender, s.age, s.occupation].filter(Boolean).join("·")}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loadingAction !== null}
                        onClick={() => exportSession(s.id, s.display_name)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" /> 单次
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loadingAction !== null}
                        onClick={() => exportUser(s.user_id, s.display_name)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" /> 全部
                      </Button>
                    </td>
                  </tr>
                ))}
                {!sessions.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground text-sm">
                      {sessionsQuery.isLoading ? "加载中..." : "暂无符合条件的会话"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
