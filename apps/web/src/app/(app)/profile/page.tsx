"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { auth } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { User, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const EXPERIENCE_LEVELS = [
  { value: "student", label: "学生 / 实习阶段" },
  { value: "beginner", label: "新手咨询师 (0-2年)" },
  { value: "intermediate", label: "成长期咨询师 (2-5年)" },
  { value: "senior", label: "资深咨询师 (5年以上)" },
  { value: "supervisor", label: "督导师" },
];

export default function ProfilePage() {
  const { user, loadUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: user?.display_name ?? "",
    bio: user?.bio ?? "",
    experience_level: user?.experience_level ?? "student",
    specialization: user?.specialization ?? "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await auth.updateMe(form);
      await loadUser();
      toast.success("个人信息已更新");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "更新失败";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" />
          个人中心
        </h1>
        <p className="text-muted-foreground">管理您的帐号和训练偏好</p>
      </div>

      {/* Avatar & Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
              {user.display_name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold">{user.display_name}</p>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">显示名称</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={(e) => update("display_name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">个人简介</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
                placeholder="简单介绍一下自己…"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience_level">经验水平</Label>
              <Select
                value={form.experience_level}
                onValueChange={(v) => v && update("experience_level", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择经验水平" />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialization">擅长方向</Label>
              <Input
                id="specialization"
                value={form.specialization}
                onChange={(e) => update("specialization", e.target.value)}
                placeholder="如：CBT、家庭治疗、青少年咨询…"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "保存中…" : "保存更改"}
          </Button>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">帐号信息</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="flex justify-between">
            <span>用户 ID</span>
            <span className="font-mono text-xs">{user.id}</span>
          </div>
          <div className="flex justify-between">
            <span>帐号状态</span>
            <span className={user.is_active ? "text-emerald-500" : "text-red-500"}>
              {user.is_active ? "正常" : "已禁用"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
