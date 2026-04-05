INSERT OR IGNORE INTO seeker_profiles (
  id, age, gender, occupation, marital_status, symptoms, group_tag, difficulty, issue_tags, report, conversation, portrait_raw, source_id, created_at
) VALUES
(
  'profile_grad_advisor_pressure',
  '22', '男', '研究生', '未婚', '论文压力;导师关系紧张;情绪低落', 'college', 'beginner', '焦虑,自我认同',
  '{"案例标题":"研究生学业压力与导师关系困扰","案例类别":["学业压力","人际关系"]}',
  '[{"role":"Counselor","content":"你好，请坐。今天想聊些什么？"},{"role":"Seeker","content":"我觉得研究生读得很痛苦，导师总是不满意我的东西。"}]',
  '{"age":"22","gender":"男","marital_status":"未婚","occupation":"研究生","symptoms":"论文压力;导师关系紧张;情绪低落"}',
  'demo-4', datetime('now')
),
(
  'profile_dorm_conflict',
  '19', '女', '大学生', '未婚', '室友矛盾;人际关系困扰;情绪波动', 'college', 'beginner', '自我认同',
  '{"案例标题":"大学生宿舍人际关系困扰","案例类别":["人际关系"]}',
  '[{"role":"Counselor","content":"你好，今天什么风把你吹来了？"},{"role":"Seeker","content":"我和室友的关系越来越差了，我不知道该怎么办。"}]',
  '{"age":"19","gender":"女","marital_status":"未婚","occupation":"大学生","symptoms":"室友矛盾;人际关系困扰;情绪波动"}',
  'demo-5', datetime('now')
),
(
  'profile_college_depression',
  '21', '男', '大学生', '未婚', '抑郁情绪;自我否定;失眠;食欲下降', 'college', 'intermediate', '抑郁,睡眠障碍',
  '{"案例标题":"大学生抑郁情绪与自我否定","案例类别":["抑郁"]}',
  '[{"role":"Counselor","content":"你好，今天来到这里需要很大的勇气，我很高兴你来了。"},{"role":"Seeker","content":"其实是辅导员让我来的，我觉得来不来也没什么用。"}]',
  '{"age":"21","gender":"男","marital_status":"未婚","occupation":"大学生","symptoms":"抑郁情绪;自我否定;失眠;食欲下降"}',
  'demo-6', datetime('now')
),
(
  'profile_teen_study_avoidance',
  '15', '女', '初中生', '未婚', '学业压力;注意力不集中;厌学', 'adolescent', 'beginner', '焦虑',
  '{"案例标题":"初中生厌学与注意力问题","案例类别":["学业问题"]}',
  '[{"role":"Counselor","content":"你好呀，我是这里的心理老师。今天很高兴见到你。"},{"role":"Seeker","content":"是我妈让我来的，我现在就是不想去上学。"}]',
  '{"age":"15","gender":"女","marital_status":"未婚","occupation":"初中生","symptoms":"学业压力;注意力不集中;厌学"}',
  'demo-7', datetime('now')
),
(
  'profile_teen_parent_conflict',
  '16', '男', '高中生', '未婚', '与父母冲突;叛逆;沉迷手机', 'adolescent', 'beginner', '家庭冲突',
  '{"案例标题":"高中生亲子冲突与手机依赖","案例类别":["亲子关系","行为问题"]}',
  '[{"role":"Counselor","content":"嘿，你好。来坐吧，不用紧张。"},{"role":"Seeker","content":"我爸妈让我来的，我没啥好说的。"}]',
  '{"age":"16","gender":"男","marital_status":"未婚","occupation":"高中生","symptoms":"与父母冲突;叛逆;沉迷手机"}',
  'demo-8', datetime('now')
),
(
  'profile_teen_social_anxiety',
  '17', '女', '高中生', '未婚', '社交恐惧;自卑;被同学排挤;焦虑', 'adolescent', 'intermediate', '焦虑,自我认同',
  '{"案例标题":"高中生社交焦虑与自卑","案例类别":["社交焦虑","自我认同"]}',
  '[{"role":"Counselor","content":"你好，这里是一个安全的空间，你可以放心地说任何想说的话。"},{"role":"Seeker","content":"在班上没有人愿意和我说话，我觉得自己很奇怪。"}]',
  '{"age":"17","gender":"女","marital_status":"未婚","occupation":"高中生","symptoms":"社交恐惧;自卑;被同学排挤;焦虑"}',
  'demo-9', datetime('now')
),
(
  'profile_work_burnout_pm',
  '28', '女', '互联网产品经理', '未婚', '工作焦虑;职业倦怠;失眠', 'workplace', 'beginner', '焦虑,职场压力,睡眠障碍',
  '{"案例标题":"互联网从业者职业倦怠与焦虑","案例类别":["职场压力","焦虑"]}',
  '[{"role":"Counselor","content":"你好，请坐。今天是什么让你想来聊聊？"},{"role":"Seeker","content":"我每天加班到很晚，回家也放不下工作上的事情。"}]',
  '{"age":"28","gender":"女","marital_status":"未婚","occupation":"互联网产品经理","symptoms":"工作焦虑;职业倦怠;失眠"}',
  'demo-10', datetime('now')
),
(
  'profile_family_invisible_mother',
  '40', '女', '全职妈妈', '已婚', '婚姻矛盾;孩子教育焦虑;自我价值感低', 'family', 'beginner', '亲密关系,家庭冲突',
  '{"案例标题":"全职妈妈婚姻矛盾与自我价值感","案例类别":["婚姻问题","自我认同"]}',
  '[{"role":"Counselor","content":"你好，很高兴你来了。今天想和我聊些什么？"},{"role":"Seeker","content":"我觉得在这个家里我好像是透明的。"}]',
  '{"age":"40","gender":"女","marital_status":"已婚","occupation":"全职妈妈","symptoms":"婚姻矛盾;孩子教育焦虑;自我价值感低"}',
  'demo-11', datetime('now')
),
(
  'profile_family_marriage_coldness',
  '45', '男', '工程师', '已婚', '夫妻关系冷淡;沟通障碍;婚姻危机', 'family', 'intermediate', '亲密关系,家庭冲突',
  '{"案例标题":"中年夫妻关系冷淡与沟通障碍","案例类别":["婚姻危机","沟通问题"]}',
  '[{"role":"Counselor","content":"你好，今天来是关于什么事情呢？"},{"role":"Seeker","content":"我和我妻子已经很长时间没有好好说过话了，她上周提出了离婚。"}]',
  '{"age":"45","gender":"男","marital_status":"已婚","occupation":"工程师","symptoms":"夫妻关系冷淡;沟通障碍;婚姻危机"}',
  'demo-12', datetime('now')
),
(
  'profile_elderly_grief',
  '68', '女', '退休教师', '丧偶', '丧偶悲伤;孤独感;失眠;子女关系', 'elderly', 'beginner', '抑郁',
  '{"案例标题":"老年丧偶后的悲伤与孤独","案例类别":["哀伤辅导"]}',
  '[{"role":"Counselor","content":"阿姨好，请坐。今天来想聊点什么呢？"},{"role":"Seeker","content":"老伴走了以后，我一个人在家，孩子们也不常回来。"}]',
  '{"age":"68","gender":"女","marital_status":"丧偶","occupation":"退休教师","symptoms":"丧偶悲伤;孤独感;失眠;子女关系"}',
  'demo-13', datetime('now')
),
(
  'profile_body_image_anxiety',
  '30', '女', '设计师', '未婚', '容貌焦虑;社交比较;自我否定', 'female', 'beginner', '焦虑,自我认同',
  '{"案例标题":"年轻女性容貌焦虑与社交比较","案例类别":["自我认同","焦虑"]}',
  '[{"role":"Counselor","content":"你好，今天来想聊些什么呢？"},{"role":"Seeker","content":"我总觉得自己不够好看，看到同龄人结婚生子就很焦虑。"}]',
  '{"age":"30","gender":"女","marital_status":"未婚","occupation":"设计师","symptoms":"容貌焦虑;社交比较;自我否定"}',
  'demo-14', datetime('now')
),
(
  'profile_male_crisis',
  '38', '男', '自由职业者', '已婚', '自杀念头;重度抑郁;失眠;酗酒;家庭暴力受害', 'general', 'advanced', '抑郁,睡眠障碍',
  '{"案例标题":"中年男性重度抑郁伴自杀意念","案例类别":["危机干预","抑郁"]}',
  '[{"role":"Counselor","content":"你好，今天愿意来到这里我觉得很重要。你现在感觉怎么样？"},{"role":"Seeker","content":"不太好，我有时候觉得不想活了。"}]',
  '{"age":"38","gender":"男","marital_status":"已婚","occupation":"自由职业者","symptoms":"自杀念头;重度抑郁;失眠;酗酒;家庭暴力受害"}',
  'demo-15', datetime('now')
),
(
  'profile_college_ptsd',
  '24', '女', '大学生', '未婚', '创伤后应激;噩梦;惊恐发作;回避行为', 'college', 'advanced', '焦虑',
  '{"案例标题":"大学生创伤后应激障碍","案例类别":["创伤","焦虑"]}',
  '[{"role":"Counselor","content":"你好，今天在这里你是安全的。想怎么开始都可以。"},{"role":"Seeker","content":"那件事过去一年了，但我还是经常做噩梦，突然会心跳加速。"}]',
  '{"age":"24","gender":"女","marital_status":"未婚","occupation":"大学生","symptoms":"创伤后应激;噩梦;惊恐发作;回避行为"}',
  'demo-16', datetime('now')
);
