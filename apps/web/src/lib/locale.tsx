"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Locale = "zh" | "en";

const translations: Record<Locale, Record<string, string>> = {
  zh: {
    "nav.dashboard": "工作台",
    "nav.simulator": "虚拟来访",
    "nav.simulator.desc": "AI 模拟咨询练习",
    "nav.knowledge": "知识宝库",
    "nav.knowledge.desc": "三维知识检索系统",
    "nav.learning": "成长路径",
    "nav.learning.desc": "个性化学习与评估",
    "nav.preview": "场景预览",
    "nav.preview.desc": "即将推出",
    "nav.profile": "个人中心",
    "nav.soon": "即将",
    "app.name": "annapod",
    "app.subtitle": "安心舱 · 咨询师训练",
    "common.loading": "加载中…",
    "theme.light": "浅色",
    "theme.dark": "深色",
    "lang.zh": "中文",
    "lang.en": "English",
    "common.retry": "重试",
    "common.prev": "上一页",
    "common.next": "下一页",
    "common.clearFilters": "清除筛选",
    "common.backendError": "后端连接失败，请检查 API 服务是否启动",

    "difficulty.all": "全部难度",
    "difficulty.beginner": "初级",
    "difficulty.intermediate": "中级",
    "difficulty.advanced": "高级",

    "simulator.title": "虚拟来访者",
    "simulator.subtitle": "选择一位来访者开始模拟咨询练习",
    "simulator.group.all": "全部分组",
    "simulator.group.elderly": "老年来访者",
    "simulator.group.adolescent": "青少年来访者",
    "simulator.group.college": "大学生来访者",
    "simulator.group.female": "女性来访者",
    "simulator.group.workplace": "职场来访者",
    "simulator.group.family": "家庭相关",
    "simulator.group.general": "一般来访者",
    "simulator.loading": "加载来访者档案…",
    "simulator.start": "开始咨询",
    "simulator.creating": "创建中…",
    "simulator.createFailed": "创建会话失败",
    "simulator.empty": "暂无匹配的来访者档案",
    "simulator.page": "第",
    "simulator.pageOf": "页 / 共",
    "simulator.pageSuffix": "页",

    "knowledge.title": "知识宝库",
    "knowledge.subtitle": "流派 × 议题 × 难度 三维结构化咨询知识库",
    "knowledge.stats.schools": "流派覆盖",
    "knowledge.stats.issues": "议题类型",
    "knowledge.stats.total": "总条目",
    "knowledge.stats.kind": "种",
    "knowledge.stats.count": "个",
    "knowledge.stats.item": "条",
    "knowledge.search.placeholder": "搜索知识条目…",
    "knowledge.school.all": "全部流派",
    "knowledge.issue.all": "全部议题",
    "knowledge.loading": "搜索中…",
    "knowledge.empty": "未找到匹配的知识条目",
    "knowledge.clearFilters": "清除筛选条件",
    "knowledge.page": "第",
    "knowledge.pageOf": "页 / 共",
    "knowledge.pageSuffix": "页",
    "knowledge.source.textbook": "教材",
    "knowledge.source.paper": "论文",
    "knowledge.source.guideline": "指南",
    "knowledge.source.case": "案例",
    "knowledge.source.technique": "技术",
    "knowledge.source": "来源",

    "dashboard.title": "工作台",
    "dashboard.subtitle": "概览您的训练进度与学习推荐",
    "dashboard.sessions": "完成会话",
    "dashboard.hours": "练习时长",
    "dashboard.avgScore": "平均得分",
    "dashboard.knowledgeItems": "知识条目",
    "dashboard.dimensions": "能力维度",
    "dashboard.detail": "详情",
    "dashboard.noDimension": "完成首次模拟咨询后将显示能力分析",
    "dashboard.startPractice": "开始练习",
    "dashboard.weakAreas": "薄弱环节",
    "dashboard.noData": "暂无数据，请先完成练习",
    "dashboard.quickActions": "快速操作",
    "dashboard.startSimulator": "开始模拟咨询",
    "dashboard.browseKnowledge": "浏览知识库",
    "dashboard.viewGrowth": "查看成长曲线",
    "dashboard.recommendations": "学习推荐",

    "auth.login.title": "登录 annapod",
    "auth.login.subtitle": "安娜心训舱 · AI 咨询师训练平台",
    "auth.login.user": "用户名或邮箱",
    "auth.login.userPlaceholder": "输入用户名或邮箱",
    "auth.login.password": "密码",
    "auth.login.passwordPlaceholder": "输入密码",
    "auth.login.loading": "登录中…",
    "auth.login.submit": "登 录",
    "auth.login.noAccount": "还没有帐号？",
    "auth.login.register": "免费注册",
    "auth.login.success": "登录成功！",
    "auth.login.failed": "登录失败",

    "auth.register.title": "注册 annapod",
    "auth.register.subtitle": "创建帐号，开始您的咨询训练之旅",
    "auth.register.email": "邮箱",
    "auth.register.username": "用户名",
    "auth.register.displayName": "显示名称",
    "auth.register.displayNamePlaceholder": "您的名字",
    "auth.register.password": "密码",
    "auth.register.passwordPlaceholder": "至少 6 位",
    "auth.register.confirmPassword": "确认密码",
    "auth.register.confirmPasswordPlaceholder": "再次输入密码",
    "auth.register.loading": "注册中…",
    "auth.register.submit": "注 册",
    "auth.register.hasAccount": "已有帐号？",
    "auth.register.toLogin": "立即登录",
    "auth.register.passwordMismatch": "两次密码不一致",
    "auth.register.success": "注册成功！欢迎使用安娜心训舱",
    "auth.register.failed": "注册失败",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.simulator": "Virtual Client",
    "nav.simulator.desc": "AI counseling simulation",
    "nav.knowledge": "Knowledge Base",
    "nav.knowledge.desc": "3D knowledge retrieval",
    "nav.learning": "Growth Path",
    "nav.learning.desc": "Personalized learning",
    "nav.preview": "Scene Preview",
    "nav.preview.desc": "Coming soon",
    "nav.profile": "Profile",
    "nav.soon": "Soon",
    "app.name": "annapod",
    "app.subtitle": "Annapod Counselor Training",
    "common.loading": "Loading…",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "lang.zh": "中文",
    "lang.en": "English",
    "common.retry": "Retry",
    "common.prev": "Previous",
    "common.next": "Next",
    "common.clearFilters": "Clear filters",
    "common.backendError": "Backend connection failed. Please make sure API is running.",

    "difficulty.all": "All difficulties",
    "difficulty.beginner": "Beginner",
    "difficulty.intermediate": "Intermediate",
    "difficulty.advanced": "Advanced",

    "simulator.title": "Virtual Client",
    "simulator.subtitle": "Choose a client profile to start simulation practice",
    "simulator.group.all": "All groups",
    "simulator.group.elderly": "Elderly Clients",
    "simulator.group.adolescent": "Adolescent Clients",
    "simulator.group.college": "College Students",
    "simulator.group.female": "Female Clients",
    "simulator.group.workplace": "Workplace Clients",
    "simulator.group.family": "Family-related",
    "simulator.group.general": "General Clients",
    "simulator.loading": "Loading profiles...",
    "simulator.start": "Start Session",
    "simulator.creating": "Creating...",
    "simulator.createFailed": "Failed to create session",
    "simulator.empty": "No matching client profiles found",
    "simulator.page": "Page",
    "simulator.pageOf": "of",
    "simulator.pageSuffix": "",

    "knowledge.title": "Knowledge Base",
    "knowledge.subtitle": "Structured counseling knowledge by school, issue, and difficulty",
    "knowledge.stats.schools": "Schools Covered",
    "knowledge.stats.issues": "Issue Types",
    "knowledge.stats.total": "Total Items",
    "knowledge.stats.kind": "",
    "knowledge.stats.count": "",
    "knowledge.stats.item": "",
    "knowledge.search.placeholder": "Search knowledge entries...",
    "knowledge.school.all": "All schools",
    "knowledge.issue.all": "All issues",
    "knowledge.loading": "Searching...",
    "knowledge.empty": "No matching knowledge items found",
    "knowledge.clearFilters": "Clear filter conditions",
    "knowledge.page": "Page",
    "knowledge.pageOf": "of",
    "knowledge.pageSuffix": "",
    "knowledge.source.textbook": "Textbook",
    "knowledge.source.paper": "Paper",
    "knowledge.source.guideline": "Guideline",
    "knowledge.source.case": "Case",
    "knowledge.source.technique": "Technique",
    "knowledge.source": "Source",

    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Overview of your training progress and recommendations",
    "dashboard.sessions": "Completed Sessions",
    "dashboard.hours": "Practice Hours",
    "dashboard.avgScore": "Average Score",
    "dashboard.knowledgeItems": "Knowledge Items",
    "dashboard.dimensions": "Skill Dimensions",
    "dashboard.detail": "Details",
    "dashboard.noDimension": "Complete your first simulation session to view analytics",
    "dashboard.startPractice": "Start Practice",
    "dashboard.weakAreas": "Weak Areas",
    "dashboard.noData": "No data yet. Please complete a practice session first.",
    "dashboard.quickActions": "Quick Actions",
    "dashboard.startSimulator": "Start Simulation",
    "dashboard.browseKnowledge": "Browse Knowledge Base",
    "dashboard.viewGrowth": "View Growth Curve",
    "dashboard.recommendations": "Learning Recommendations",

    "auth.login.title": "Sign in to annapod",
    "auth.login.subtitle": "annapod · AI Counselor Training Platform",
    "auth.login.user": "Username or Email",
    "auth.login.userPlaceholder": "Enter username or email",
    "auth.login.password": "Password",
    "auth.login.passwordPlaceholder": "Enter password",
    "auth.login.loading": "Signing in...",
    "auth.login.submit": "Sign In",
    "auth.login.noAccount": "Don't have an account?",
    "auth.login.register": "Create one",
    "auth.login.success": "Login successful!",
    "auth.login.failed": "Login failed",

    "auth.register.title": "Create annapod account",
    "auth.register.subtitle": "Sign up and start your counselor training journey",
    "auth.register.email": "Email",
    "auth.register.username": "Username",
    "auth.register.displayName": "Display Name",
    "auth.register.displayNamePlaceholder": "Your name",
    "auth.register.password": "Password",
    "auth.register.passwordPlaceholder": "At least 6 characters",
    "auth.register.confirmPassword": "Confirm Password",
    "auth.register.confirmPasswordPlaceholder": "Enter password again",
    "auth.register.loading": "Signing up...",
    "auth.register.submit": "Sign Up",
    "auth.register.hasAccount": "Already have an account?",
    "auth.register.toLogin": "Sign in now",
    "auth.register.passwordMismatch": "Passwords do not match",
    "auth.register.success": "Registration successful! Welcome to annapod",
    "auth.register.failed": "Registration failed",
  },
};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh",
  setLocale: () => {},
  t: (key) => key,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("annapod_locale") as Locale) || "zh";
    }
    return "zh";
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("annapod_locale", l);
  }, []);

  const t = useCallback(
    (key: string) => translations[locale][key] ?? key,
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
