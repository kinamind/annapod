"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { teams } from "@/lib/api";
import { DIFFICULTY_LEVELS, ISSUE_OPTIONS, type TeamKind, type TeamMemberSummary, type TeamSpace } from "@/lib/types";
import { useLocale } from "@/lib/locale";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, KeyRound, Shield, CalendarRange, Copy } from "lucide-react";

const GROUP_OPTIONS = [
  { value: "", label: "不限群体" },
  { value: "elderly", label: "老年群体" },
  { value: "adolescent", label: "青少年" },
  { value: "college", label: "大学生" },
  { value: "female", label: "女性" },
  { value: "workplace", label: "职场" },
  { value: "family", label: "家庭相关" },
  { value: "general", label: "综合" },
];

function TeamKindBadge({ kind }: { kind: TeamKind }) {
  return (
    <Badge variant={kind === "competition" ? "destructive" : "secondary"}>
      {kind === "competition" ? "比赛" : "团队"}
    </Badge>
  );
}

export default function TeamsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "mine";
  const selectedTeamId = searchParams.get("teamId") || "";

  const [createForm, setCreateForm] = useState({
    kind: "team" as TeamKind,
    name: "",
    description: "",
    theme: "",
    profile_group_tag: "",
    profile_difficulty: "",
    profile_issue_tag: "",
    training_start_at: "",
    training_end_at: "",
    agreement_title: "",
    agreement_text: "",
  });
  const [joinCode, setJoinCode] = useState("");
  const [joinAccepted, setJoinAccepted] = useState(false);
  const [previewCode, setPreviewCode] = useState("");
  const [adminForm, setAdminForm] = useState({
    description: "",
    theme: "",
    profile_group_tag: "",
    profile_difficulty: "",
    profile_issue_tag: "",
    training_start_at: "",
    training_end_at: "",
    agreement_title: "",
    agreement_text: "",
  });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const { data: myTeams, refetch: refetchTeams } = useQuery({
    queryKey: ["teams"],
    queryFn: () => teams.list(),
  });

  const { data: joinPreview, refetch: refetchPreview } = useQuery({
    queryKey: ["team-join-preview", previewCode],
    queryFn: () => teams.previewJoin(previewCode),
    enabled: false,
  });

  const { data: teamDetail, refetch: refetchDetail } = useQuery({
    queryKey: ["team-detail", selectedTeamId],
    queryFn: () => teams.getById(selectedTeamId),
    enabled: Boolean(selectedTeamId),
  });

  const { data: members, refetch: refetchMembers } = useQuery({
    queryKey: ["team-members", selectedTeamId],
    queryFn: () => teams.getMembers(selectedTeamId),
    enabled: Boolean(selectedTeamId && teamDetail?.can_manage),
  });

  useEffect(() => {
    if (teamDetail) {
      setAdminForm({
        description: teamDetail.description || "",
        theme: teamDetail.theme || "",
        profile_group_tag: teamDetail.profile_group_tag || "",
        profile_difficulty: teamDetail.profile_difficulty || "",
        profile_issue_tag: teamDetail.profile_issue_tag || "",
        training_start_at: teamDetail.training_start_at || "",
        training_end_at: teamDetail.training_end_at || "",
        agreement_title: teamDetail.agreement_title || "",
        agreement_text: teamDetail.agreement_text || "",
      });
    }
  }, [teamDetail]);

  const selectedTeam = useMemo(
    () => myTeams?.find((team) => team.id === selectedTeamId) || teamDetail,
    [myTeams, selectedTeamId, teamDetail]
  );

  const setTab = (tab: string, teamId?: string) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (teamId) params.set("teamId", teamId);
    router.replace(`/teams?${params.toString()}`);
  };

  const copyJoinCode = async (team: TeamSpace) => {
    if (!team.join_code) return;
    await navigator.clipboard.writeText(team.join_code);
    toast.success("邀请码已复制");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction("create");
    try {
      const created = await teams.create({
        ...createForm,
        profile_group_tag: createForm.profile_group_tag || undefined,
        profile_difficulty: createForm.profile_difficulty || undefined,
        profile_issue_tag: createForm.profile_issue_tag || undefined,
        training_start_at: createForm.training_start_at || undefined,
        training_end_at: createForm.training_end_at || undefined,
        agreement_title: createForm.agreement_title || undefined,
        agreement_text: createForm.agreement_text || undefined,
      });
      toast.success(t("teams.create.success"));
      await refetchTeams();
      setTab("mine", created.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePreviewJoin = async () => {
    if (!joinCode.trim()) return;
    setPreviewCode(joinCode.trim().toUpperCase());
    setTimeout(() => refetchPreview(), 0);
  };

  const handleJoin = async () => {
    if (!previewCode) return;
    setLoadingAction("join");
    try {
      const joined = await teams.join({ join_code: previewCode, accepted_agreement: joinAccepted });
      toast.success(t("teams.join.success"));
      await refetchTeams();
      setTab("mine", joined.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "加入失败");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedTeamId) return;
    setLoadingAction("save-settings");
    try {
      await teams.update(selectedTeamId, adminForm);
      await Promise.all([refetchDetail(), refetchTeams()]);
      toast.success("设置已更新");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "更新失败");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRoleChange = async (member: TeamMemberSummary, role: "admin" | "member") => {
    if (!selectedTeamId) return;
    setLoadingAction(`role-${member.user_id}`);
    try {
      await teams.updateMemberRole(selectedTeamId, member.user_id, role);
      await refetchMembers();
      toast.success("成员角色已更新");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "角色更新失败");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{t("teams.title")}</h1>
        <p className="text-muted-foreground">{t("teams.subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setTab(value, selectedTeamId || undefined)} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="mine">{t("teams.tab.mine")}</TabsTrigger>
          <TabsTrigger value="create">{t("teams.tab.create")}</TabsTrigger>
          <TabsTrigger value="join">{t("teams.tab.join")}</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              {(myTeams || []).map((team) => (
                <Card key={team.id} className={team.id === selectedTeamId ? "border-primary" : undefined}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <span>{team.name}</span>
                          <TeamKindBadge kind={team.kind} />
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{team.theme || "未设置主题"}</div>
                      </div>
                      <Badge variant="outline">{team.role}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                      <span>成员: {team.member_count}</span>
                      {team.last_activity_at && <span>最近活动: {new Date(team.last_activity_at).toLocaleString()}</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTab("mine", team.id)}>
                        查看
                      </Button>
                      {team.can_manage && team.join_code && (
                        <Button variant="outline" size="sm" onClick={() => copyJoinCode(team)}>
                          <Copy className="h-4 w-4 mr-2" /> 邀请码
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {myTeams?.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>你还没有加入任何团队或比赛。</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              {selectedTeam ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span>{selectedTeam.name}</span>
                      <TeamKindBadge kind={selectedTeam.kind} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border p-4 space-y-2">
                        <div className="text-sm font-medium">训练信息</div>
                        <div className="text-sm text-muted-foreground">主题：{selectedTeam.theme || "未设置"}</div>
                        <div className="text-sm text-muted-foreground">限定群体：{selectedTeam.profile_group_tag || "不限"}</div>
                        <div className="text-sm text-muted-foreground">限定难度：{selectedTeam.profile_difficulty || "不限"}</div>
                        <div className="text-sm text-muted-foreground">限定议题：{selectedTeam.profile_issue_tag || "不限"}</div>
                        <div className="text-sm text-muted-foreground">描述：{selectedTeam.description || "无"}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <CalendarRange className="h-4 w-4" />
                          {selectedTeam.training_start_at || "未设置"} - {selectedTeam.training_end_at || "未设置"}
                        </div>
                        {selectedTeam.can_manage && selectedTeam.join_code && (
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <KeyRound className="h-4 w-4" /> 邀请码：<span className="font-mono text-foreground">{selectedTeam.join_code}</span>
                          </div>
                        )}
                        <div>
                          <Button variant="outline" size="sm" onClick={() => router.push(`/simulator?teamId=${encodeURIComponent(selectedTeam.id)}`)}>
                            进入团队训练
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-lg border p-4 space-y-2">
                        <div className="text-sm font-medium">附加协议</div>
                        <div className="text-sm text-muted-foreground">标题：{selectedTeam.agreement_title || "未设置"}</div>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedTeam.agreement_text || "当前没有额外协议。"}
                        </div>
                      </div>
                    </div>

                    {selectedTeam.can_manage && (
                      <div className="space-y-4 rounded-xl border p-4">
                        <div className="font-medium flex items-center gap-2"><Shield className="h-4 w-4" /> 管理设置</div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>描述</Label>
                            <Textarea value={adminForm.description} onChange={(e) => setAdminForm((prev) => ({ ...prev, description: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>主题说明（可选）</Label>
                            <Input value={adminForm.theme} onChange={(e) => setAdminForm((prev) => ({ ...prev, theme: e.target.value }))} />
                            <Label>限定来访者群体</Label>
                            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={adminForm.profile_group_tag} onChange={(e) => setAdminForm((prev) => ({ ...prev, profile_group_tag: e.target.value }))}>
                              {GROUP_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
                            </select>
                            <Label>限定训练难度</Label>
                            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={adminForm.profile_difficulty} onChange={(e) => setAdminForm((prev) => ({ ...prev, profile_difficulty: e.target.value }))}>
                              <option value="">不限难度</option>
                              {DIFFICULTY_LEVELS.map((level) => <option key={level.key} value={level.key}>{level.label}</option>)}
                            </select>
                            <Label>限定议题</Label>
                            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={adminForm.profile_issue_tag} onChange={(e) => setAdminForm((prev) => ({ ...prev, profile_issue_tag: e.target.value }))}>
                              <option value="">不限议题</option>
                              {ISSUE_OPTIONS.map((issue) => <option key={issue} value={issue}>{issue}</option>)}
                            </select>
                            <Label>开始时间</Label>
                            <Input type="datetime-local" value={adminForm.training_start_at} onChange={(e) => setAdminForm((prev) => ({ ...prev, training_start_at: e.target.value }))} />
                            <Label>结束时间</Label>
                            <Input type="datetime-local" value={adminForm.training_end_at} onChange={(e) => setAdminForm((prev) => ({ ...prev, training_end_at: e.target.value }))} />
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>附加协议标题</Label>
                            <Input value={adminForm.agreement_title} onChange={(e) => setAdminForm((prev) => ({ ...prev, agreement_title: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>附加协议内容</Label>
                            <Textarea value={adminForm.agreement_text} onChange={(e) => setAdminForm((prev) => ({ ...prev, agreement_text: e.target.value }))} className="min-h-32" />
                          </div>
                        </div>
                        <Button onClick={handleSaveSettings} disabled={loadingAction === "save-settings"}>保存设置</Button>
                      </div>
                    )}

                    {selectedTeam.can_manage && (
                      <div className="space-y-4">
                        <div className="font-medium">成员情况</div>
                        <div className="overflow-x-auto rounded-xl border">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left">
                              <tr>
                                <th className="p-3">成员</th>
                                <th className="p-3">角色</th>
                                <th className="p-3">完成</th>
                                <th className="p-3">进行中</th>
                                <th className="p-3">均分</th>
                                <th className="p-3">最近活动</th>
                                <th className="p-3">管理</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(members || []).map((member) => (
                                <tr key={member.user_id} className="border-t">
                                  <td className="p-3">
                                    <div className="font-medium">{member.display_name}</div>
                                    <div className="text-xs text-muted-foreground">@{member.username}</div>
                                  </td>
                                  <td className="p-3">{member.role}</td>
                                  <td className="p-3">{member.completed_sessions}</td>
                                  <td className="p-3">{member.active_sessions}</td>
                                  <td className="p-3">{member.average_score == null ? "-" : member.average_score.toFixed(1)}</td>
                                  <td className="p-3">{member.last_activity_at ? new Date(member.last_activity_at).toLocaleString() : "-"}</td>
                                  <td className="p-3">
                                    {member.role !== "owner" && (
                                      <div className="flex gap-2">
                                        <Button size="sm" variant="outline" disabled={loadingAction === `role-${member.user_id}`} onClick={() => handleRoleChange(member, member.role === "admin" ? "member" : "admin")}>
                                          {member.role === "admin" ? "设为成员" : "设为管理员"}
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-10 text-center text-muted-foreground">
                    选择左侧一个团队或比赛，查看详情与成员情况。
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>创建团队或比赛</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>类型</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={createForm.kind} onChange={(e) => setCreateForm((prev) => ({ ...prev, kind: e.target.value as TeamKind }))}>
                      <option value="team">团队</option>
                      <option value="competition">比赛</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>名称</Label>
                    <Input value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>描述</Label>
                  <Textarea value={createForm.description} onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>主题说明（可选）</Label>
                    <Input value={createForm.theme} onChange={(e) => setCreateForm((prev) => ({ ...prev, theme: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>限定来访者群体</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={createForm.profile_group_tag} onChange={(e) => setCreateForm((prev) => ({ ...prev, profile_group_tag: e.target.value }))}>
                      {GROUP_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>限定训练难度</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={createForm.profile_difficulty} onChange={(e) => setCreateForm((prev) => ({ ...prev, profile_difficulty: e.target.value }))}>
                      <option value="">不限难度</option>
                      {DIFFICULTY_LEVELS.map((level) => <option key={level.key} value={level.key}>{level.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>限定议题</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={createForm.profile_issue_tag} onChange={(e) => setCreateForm((prev) => ({ ...prev, profile_issue_tag: e.target.value }))}>
                      <option value="">不限议题</option>
                      {ISSUE_OPTIONS.map((issue) => <option key={issue} value={issue}>{issue}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>开始时间</Label>
                    <Input type="datetime-local" value={createForm.training_start_at} onChange={(e) => setCreateForm((prev) => ({ ...prev, training_start_at: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>结束时间</Label>
                    <Input type="datetime-local" value={createForm.training_end_at} onChange={(e) => setCreateForm((prev) => ({ ...prev, training_end_at: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>附加协议标题</Label>
                    <Input value={createForm.agreement_title} onChange={(e) => setCreateForm((prev) => ({ ...prev, agreement_title: e.target.value }))} placeholder="例如：比赛报名与数据使用协议" />
                  </div>
                  <div className="space-y-2">
                    <Label>附加协议内容</Label>
                    <Textarea value={createForm.agreement_text} onChange={(e) => setCreateForm((prev) => ({ ...prev, agreement_text: e.target.value }))} className="min-h-32" placeholder="管理员可在此声明比赛规则、研究说明、团队内部约定等。" />
                  </div>
                </div>
                <Button type="submit" disabled={loadingAction === "create"}>{loadingAction === "create" ? "创建中..." : "创建"}</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="join">
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>通过邀请码加入</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>邀请码</Label>
                  <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="输入 8 位邀请码" />
                </div>
                <Button onClick={handlePreviewJoin}>预览团队/比赛</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>加入预览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {joinPreview ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-lg">{joinPreview.name}</div>
                      <TeamKindBadge kind={joinPreview.kind} />
                    </div>
                    <div className="text-sm text-muted-foreground">{joinPreview.description || "无描述"}</div>
                    <div className="text-sm text-muted-foreground">主题：{joinPreview.theme || "未设置"}</div>
                    <div className="text-sm text-muted-foreground">限定群体：{joinPreview.profile_group_tag || "不限"}</div>
                    <div className="text-sm text-muted-foreground">限定难度：{joinPreview.profile_difficulty || "不限"}</div>
                    <div className="text-sm text-muted-foreground">限定议题：{joinPreview.profile_issue_tag || "不限"}</div>
                    <div className="text-sm text-muted-foreground">时间：{joinPreview.training_start_at || "未设置"} - {joinPreview.training_end_at || "未设置"}</div>
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="font-medium">{joinPreview.agreement_title || "附加协议"}</div>
                      <div className="text-sm whitespace-pre-wrap text-muted-foreground">{joinPreview.agreement_text || "当前没有附加协议，加入后将遵循平台默认协议。"}</div>
                    </div>
                    {joinPreview.agreement_text && (
                      <label className="flex items-start gap-3 text-sm">
                        <input type="checkbox" checked={joinAccepted} onChange={(e) => setJoinAccepted(e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300" />
                        <span>我已阅读并同意该团队/比赛设置的附加协议</span>
                      </label>
                    )}
                    <Button onClick={handleJoin} disabled={loadingAction === "join" || joinPreview.is_member || (Boolean(joinPreview.agreement_text) && !joinAccepted)}>
                      {loadingAction === "join" ? "加入中..." : joinPreview.is_member ? "已在团队中" : "确认加入"}
                    </Button>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">输入邀请码后即可查看团队/比赛详情与附加协议。</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
