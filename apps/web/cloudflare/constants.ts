export const GROUP_OPTIONS = [
  { key: "elderly", label: "银发群体", description: "65岁以上的老年来访者" },
  { key: "adolescent", label: "青少年", description: "18岁以下的青少年来访者" },
  { key: "college", label: "大学生", description: "18-25岁学生群体" },
  { key: "female", label: "女性", description: "女性来访者专项训练" },
  { key: "workplace", label: "职场人群", description: "职场压力相关" },
  { key: "family", label: "家庭关系", description: "婚姻/家庭关系相关" },
  { key: "general", label: "综合训练", description: "综合性咨询训练" },
];

export const SCHOOL_OPTIONS = [
  "CBT（认知行为疗法）",
  "精神分析/精神动力学",
  "人本主义/人格中心",
  "家庭治疗/系统治疗",
  "接纳承诺疗法（ACT）",
  "正念疗法",
  "焦点解决短程治疗（SFBT）",
  "叙事疗法",
  "格式塔/完形疗法",
  "整合取向",
];

export const ISSUE_OPTIONS = [
  "抑郁",
  "焦虑",
  "创伤与PTSD",
  "亲密关系",
  "家庭冲突",
  "青少年成长",
  "职场压力",
  "自我认同",
  "丧失与哀伤",
  "成瘾行为",
  "进食障碍",
  "睡眠障碍",
  "躯体化症状",
  "危机干预",
];

export const DIFFICULTY_LEVELS = [
  { key: "beginner", label: "初级", description: "初次访谈、建立关系、基本倾听与共情" },
  { key: "intermediate", label: "中级", description: "阻抗处理、情感反映、认知重构" },
  { key: "advanced", label: "高级", description: "危机干预、深层洞察、移情与反移情处理" },
];

export const EVALUATION_DIMENSIONS = {
  empathy: { label: "共情能力", description: "理解和反映来访者内心感受的能力" },
  active_listening: { label: "积极倾听", description: "关注来访者表达、适时回应、不打断的能力" },
  questioning: { label: "提问技巧", description: "使用开放式问题探索来访者内心世界的能力" },
  reflection: { label: "情感反映", description: "准确识别和命名来访者情绪的能力" },
  confrontation: { label: "面质技术", description: "适时指出矛盾、温和挑战防御机制的能力" },
  goal_setting: { label: "目标设定", description: "与来访者合作性地设定治疗目标的能力" },
  crisis_handling: { label: "危机处理", description: "评估风险、制定安全计划的能力" },
  theoretical_application: { label: "理论应用", description: "恰当运用咨询理论和技术的能力" },
} as const;
