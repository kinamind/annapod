INSERT OR IGNORE INTO seeker_profiles (
  id, age, gender, occupation, marital_status, symptoms, group_tag, difficulty, issue_tags, report, conversation, portrait_raw, source_id, created_at
) VALUES
(
  'profile_college_exam_anxiety',
  '20', '女', '大学生', '未婚', '考试焦虑;社交回避;失眠', 'college', 'beginner', '焦虑,睡眠障碍',
  '{"案例标题":"大学生考试焦虑伴失眠","案例类别":["焦虑","睡眠障碍"]}',
  '[{"role":"Counselor","content":"你好，欢迎来到咨询室。可以和我说说最近让你困扰的事情吗？"},{"role":"Seeker","content":"老师好...我最近总是睡不着觉，特别是快考试的时候。"}]',
  '{"age":"20","gender":"女","marital_status":"未婚","occupation":"大学生","symptoms":"考试焦虑;社交回避;失眠"}',
  'demo-1', datetime('now')
),
(
  'profile_relationship_anxiety',
  '23', '女', '研究生', '恋爱中', '恋爱关系焦虑;分离焦虑;依赖;情绪不稳', 'college', 'intermediate', '焦虑,亲密关系',
  '{"案例标题":"研究生恋爱关系中的焦虑依附","案例类别":["亲密关系","焦虑"]}',
  '[{"role":"Counselor","content":"你好，今天想聊什么呢？"},{"role":"Seeker","content":"我男朋友昨晚又没回我消息，我一晚上都没睡好。"}]',
  '{"age":"23","gender":"女","marital_status":"恋爱中","occupation":"研究生","symptoms":"恋爱关系焦虑;分离焦虑;依赖;情绪不稳"}',
  'demo-2', datetime('now')
),
(
  'profile_teacher_burnout',
  '32', '女', '教师', '已婚', '职业倦怠;躯体化症状;头痛;胸闷', 'workplace', 'intermediate', '职场压力,躯体化症状',
  '{"案例标题":"教师职业倦怠伴躯体化症状","案例类别":["躯体化","职业倦怠"]}',
  '[{"role":"Counselor","content":"你好，很高兴见到你。能和我说说是什么让你来到这里吗？"},{"role":"Seeker","content":"我当了十年老师了，最近经常头疼胸闷。"}]',
  '{"age":"32","gender":"女","marital_status":"已婚","occupation":"教师","symptoms":"职业倦怠;躯体化症状;头痛;胸闷"}',
  'demo-3', datetime('now')
);

INSERT OR IGNORE INTO knowledge_items (
  id, school, issue, difficulty, title, content, summary, source_type, source_ref, tags, extra_info, created_at, updated_at
) VALUES
(
  'knowledge_cbt_triangle',
  'CBT（认知行为疗法）', '抑郁', 'beginner',
  '认知三角：思维-情感-行为的关系',
  '认知行为疗法认为思维、情感和行为相互影响。咨询师需要帮助来访者识别自动思维、情绪反应和回避行为之间的循环，并在其中找到干预点。',
  'CBT核心模型-认知三角。',
  'textbook', 'Beck, 1979', '["CBT","认知三角","抑郁"]', '{}', datetime('now'), datetime('now')
),
(
  'knowledge_exposure',
  'CBT（认知行为疗法）', '焦虑', 'intermediate',
  '暴露疗法与焦虑层级',
  '暴露疗法通过渐进接触恐惧刺激来削弱焦虑反应。咨询师需要和来访者共同建立层级，并帮助其留在情境中直到焦虑下降。',
  '暴露疗法在焦虑治疗中的核心应用。',
  'technique', NULL, '["CBT","暴露疗法","焦虑"]', '{}', datetime('now'), datetime('now')
),
(
  'knowledge_rogers',
  '人本主义/人格中心', '自我认同', 'beginner',
  '罗杰斯的核心条件：共情、无条件积极关注与真诚',
  '人格中心疗法强调共情理解、无条件积极关注和真诚一致。这三种态度构成了咨询关系中的治疗性条件。',
  '罗杰斯人本主义疗法的三大核心条件。',
  'textbook', 'Rogers, 1957', '["人本主义","共情","真诚"]', '{}', datetime('now'), datetime('now')
),
(
  'knowledge_suicide',
  '整合取向', '危机干预', 'advanced',
  '自杀风险评估与危机干预流程',
  '自杀风险评估应覆盖意念、计划、手段、时间框架和保护因素，并在必要时制定安全计划和转介。',
  '自杀风险评估的系统框架和危机干预流程。',
  'guideline', NULL, '["危机干预","自杀评估","安全计划"]', '{}', datetime('now'), datetime('now')
),
(
  'knowledge_intake',
  '整合取向', '自我认同', 'beginner',
  '初次访谈的结构化流程',
  '初次访谈通常包括开场、主诉探索、背景信息收集与总结下一步四个阶段。其核心不是立刻解决问题，而是建立信任和工作框架。',
  '初次访谈的完整结构化流程。',
  'guideline', NULL, '["初次访谈","建立关系","结构化"]', '{}', datetime('now'), datetime('now')
);
