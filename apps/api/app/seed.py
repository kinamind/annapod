"""Seed the database with sample seeker profiles and knowledge items for demo/training.

Seed data follows the AnnaAgent (Anna-CPsyCounD) format:
- portrait: {age, gender, marital_status, occupation, symptoms}
- report: {案例标题, 案例类别[], 运用的技术[], 案例简述[], 咨询经过[], 经验感想[]}
- conversation: [{role: "Seeker"/"Counselor", content: "..."}]  (note: capitalized roles)
"""

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select
from sqlalchemy import func

from app.core.config import get_settings
from app.models.seeker import SeekerProfile
from app.models.knowledge import KnowledgeItem

# Import all models
import app.models.user  # noqa
import app.models.seeker  # noqa
import app.models.session  # noqa
import app.models.knowledge  # noqa
import app.models.learning  # noqa

settings = get_settings()

# ──── Sample profiles (AnnaAgent-compatible format) ────────────────
# Roles use capitalized "Seeker" / "Counselor" to match AnnaAgent convention.
# Reports include full structured fields for long-term memory module.

SAMPLE_PROFILES = [
    # ── college / beginner ──
    {
        "age": "20", "gender": "女", "occupation": "大学生",
        "marital_status": "未婚", "symptoms": "考试焦虑;社交回避;失眠",
        "group_tag": "college", "difficulty": "beginner",
        "issue_tags": "焦虑,睡眠障碍",
        "report": {
            "案例标题": "大学生考试焦虑伴失眠",
            "案例类别": ["焦虑", "睡眠障碍"],
            "运用的技术": ["认知行为疗法", "放松训练"],
            "案例简述": ["来访者是一名20岁的大学二年级女生，主诉每到考试前就会极度紧张，伴有失眠和社交回避。她描述自己从高中起就有考试焦虑，进入大学后症状加重。"],
            "咨询经过": ["咨询师首先建立了信任关系，通过共情回应让来访者感受到被理解。随后引导来访者识别考试前的自动化想法，发现其核心信念是'如果考不好就完蛋了'。"],
            "经验感想": ["本案例中认知重构是关键，帮助来访者区分'考试表现'和'个人价值'。"]
        },
        "portrait_raw": {"age": "20", "gender": "女", "marital_status": "未婚", "occupation": "大学生", "symptoms": "考试焦虑;社交回避;失眠"},
        "conversation": [
            {"role": "Counselor", "content": "你好，欢迎来到咨询室。可以和我说说最近让你困扰的事情吗？"},
            {"role": "Seeker", "content": "老师好...我最近总是睡不着觉，特别是快考试的时候。"},
            {"role": "Counselor", "content": "嗯，听起来考试给你带来了很大的压力。能具体说说是什么样的感受吗？"},
            {"role": "Seeker", "content": "就是一想到要考试，心就会怦怦跳，手心出汗，脑子里全是'完了完了'的想法。然后晚上躺在床上翻来覆去睡不着。"},
            {"role": "Counselor", "content": "我能感受到你的焦虑。你提到脑子里会出现'完了完了'的想法，能再多说说这些想法吗？"},
            {"role": "Seeker", "content": "就是觉得如果这次考不好，GPA就完了，以后找工作也完了...其实理智上知道没那么严重，但就是控制不住。"},
            {"role": "Counselor", "content": "你有一个很好的觉察——你注意到理智上知道没那么严重。这说明你有能力去审视这些想法。"},
            {"role": "Seeker", "content": "可是每次到那个时刻就还是会被淹没...我也不想这样的。"},
        ],
    },
    {
        "age": "22", "gender": "男", "occupation": "研究生",
        "marital_status": "未婚", "symptoms": "论文压力;导师关系紧张;情绪低落",
        "group_tag": "college", "difficulty": "beginner",
        "issue_tags": "焦虑,自我认同",
        "report": {
            "案例标题": "研究生学业压力与导师关系困扰",
            "案例类别": ["学业压力", "人际关系"],
            "运用的技术": ["人本主义取向", "认知行为疗法"],
            "案例简述": ["来访者是一名22岁的男性硕士研究生，因论文进展缓慢、导师反复否定而情绪低落。来访者表现出明显的自我怀疑和对学术能力的不自信。"],
            "咨询经过": ["咨询师通过无条件积极关注帮助来访者重建自信，同时运用认知重构技术帮助来访者区分'导师的批评'和'自身的价值'。"],
            "经验感想": ["研究生群体的学业压力常常与自我认同感紧密相关，需要同时关注情绪和认知层面。"]
        },
        "portrait_raw": {"age": "22", "gender": "男", "marital_status": "未婚", "occupation": "研究生", "symptoms": "论文压力;导师关系紧张;情绪低落"},
        "conversation": [
            {"role": "Counselor", "content": "你好，请坐。今天想聊些什么？"},
            {"role": "Seeker", "content": "我觉得研究生读得很痛苦...导师总是不满意我的东西。"},
            {"role": "Counselor", "content": "听起来你在学业上承受了很大的压力。导师不满意具体是什么情况？"},
            {"role": "Seeker", "content": "每次交给他的东西都被打回来，改了无数遍还是不行。有时候觉得是不是自己根本就不适合读研。"},
            {"role": "Counselor", "content": "被反复否定确实会让人很受挫。你说觉得自己不适合读研，这个想法是从什么时候开始的？"},
            {"role": "Seeker", "content": "大概从上学期开始吧，那次开题报告被批得很惨。从那以后就越来越没有信心了。"},
            {"role": "Counselor", "content": "那次经历对你影响很大。在那之前你对自己的学术能力是怎么看的呢？"},
            {"role": "Seeker", "content": "之前还好吧，本科成绩还不错的。就是到了研究生突然就不行了。"},
        ],
    },
    {
        "age": "19", "gender": "女", "occupation": "大学生",
        "marital_status": "未婚", "symptoms": "室友矛盾;人际关系困扰;情绪波动",
        "group_tag": "college", "difficulty": "beginner",
        "issue_tags": "自我认同",
        "report": {
            "案例标题": "大学生宿舍人际关系困扰",
            "案例类别": ["人际关系"],
            "运用的技术": ["人本主义取向", "情绪聚焦"],
            "案例简述": ["来访者是一名19岁的大一女生，因与室友关系恶化而情绪波动。来访者在人际互动中倾向于讨好他人，不善于表达自己的需求。"],
            "咨询经过": ["引导来访者探索在人际关系中的模式，认识到自己习惯性地压抑需求来换取关系和谐的方式其实在伤害自己。"],
            "经验感想": ["大学生群体中宿舍人际关系问题非常普遍，往往反映出个体在自我边界方面的困扰。"]
        },
        "portrait_raw": {"age": "19", "gender": "女", "marital_status": "未婚", "occupation": "大学生", "symptoms": "室友矛盾;人际关系困扰;情绪波动"},
        "conversation": [
            {"role": "Counselor", "content": "你好，今天什么风把你吹来了？"},
            {"role": "Seeker", "content": "我和室友的关系越来越差了，我不知道该怎么办..."},
            {"role": "Counselor", "content": "能具体说说发生了什么吗？"},
            {"role": "Seeker", "content": "就是...她们说话总是故意不带我，有时候我回宿舍她们就突然安静了。我觉得她们在背后说我。"},
            {"role": "Counselor", "content": "这种被排斥的感觉一定很不好受。你有试过和她们沟通过吗？"},
            {"role": "Seeker", "content": "没有...我不敢。我怕说了之后关系更差。其实我之前一直都是迁就她们的，但好像越迁就她们越不在乎我。"},
            {"role": "Counselor", "content": "你注意到了一个很重要的模式——越迁就越不被在乎。这种感觉对你来说是新的，还是以前也有类似的经历？"},
            {"role": "Seeker", "content": "好像...从小就这样。我妈总说要让着别人，不要起冲突。"},
        ],
    },
    # ── college / intermediate ──
    {
        "age": "21", "gender": "男", "occupation": "大学生",
        "marital_status": "未婚", "symptoms": "抑郁情绪;自我否定;失眠;食欲下降",
        "group_tag": "college", "difficulty": "intermediate",
        "issue_tags": "抑郁,睡眠障碍",
        "report": {
            "案例标题": "大学生抑郁情绪与自我否定",
            "案例类别": ["抑郁"],
            "运用的技术": ["认知行为疗法", "行为激活"],
            "案例简述": ["来访者是一名21岁的大三男生，近三个月来持续情绪低落，伴有失眠、食欲下降和自我否定。来访者逐渐减少社交活动，大部分时间待在宿舍。"],
            "咨询经过": ["咨询初期重点建立治疗联盟和进行风险评估。通过行为激活逐步增加来访者的日常活动，同时用认知重构技术处理其'我什么都做不好'的核心信念。"],
            "经验感想": ["抑郁来访者需要格外注意自杀风险评估，同时行为激活是改善抑郁的有效起点。"]
        },
        "portrait_raw": {"age": "21", "gender": "男", "marital_status": "未婚", "occupation": "大学生", "symptoms": "抑郁情绪;自我否定;失眠;食欲下降"},
        "conversation": [
            {"role": "Counselor", "content": "你好，今天来到这里需要很大的勇气，我很高兴你来了。"},
            {"role": "Seeker", "content": "嗯...其实是辅导员让我来的。我自己觉得来不来也没什么用。"},
            {"role": "Counselor", "content": "你现在的感受是什么样的？"},
            {"role": "Seeker", "content": "我觉得自己什么都做不好。活着好像也没什么意思。"},
            {"role": "Counselor", "content": "听到你这样说我有些担心。你说活着没什么意思，能再多说说这个想法吗？"},
            {"role": "Seeker", "content": "就是...也不是说想死。但就是觉得每天都一样，没有什么值得期待的事情。"},
            {"role": "Counselor", "content": "谢谢你愿意和我分享这些。你提到每天都一样——你现在一天通常是怎么度过的？"},
            {"role": "Seeker", "content": "基本上就是躺在床上，偶尔去上课，但也听不进去。晚上又睡不着，恶性循环。吃饭也不怎么想吃。"},
            {"role": "Counselor", "content": "这种状态持续多久了？"},
            {"role": "Seeker", "content": "大概三个月了吧。从上学期期末考试之后就开始了。"},
        ],
    },
    {
        "age": "23", "gender": "女", "occupation": "研究生",
        "marital_status": "恋爱中", "symptoms": "恋爱关系焦虑;分离焦虑;依赖;情绪不稳",
        "group_tag": "college", "difficulty": "intermediate",
        "issue_tags": "焦虑,亲密关系",
        "report": {
            "案例标题": "研究生恋爱关系中的焦虑依附",
            "案例类别": ["亲密关系", "焦虑"],
            "运用的技术": ["情绪聚焦疗法", "依附理论"],
            "案例简述": ["来访者是一名23岁的女性研究生，在恋爱关系中表现出强烈的分离焦虑和依赖行为。当男友不及时回复消息时，她会陷入极度焦虑和灾难化思维。"],
            "咨询经过": ["通过情绪聚焦帮助来访者接触到焦虑行为背后的深层情绪——对被抛弃的恐惧，并追溯到早年与母亲的不安全依附关系。"],
            "经验感想": ["亲密关系中的焦虑往往根源于早期依附模式，需要在安全的治疗关系中体验新的关系模式。"]
        },
        "portrait_raw": {"age": "23", "gender": "女", "marital_status": "恋爱中", "occupation": "研究生", "symptoms": "恋爱关系焦虑;分离焦虑;依赖;情绪不稳"},
        "conversation": [
            {"role": "Counselor", "content": "你好，今天想聊什么呢？"},
            {"role": "Seeker", "content": "我男朋友昨晚又没回我消息，我一晚上都没睡好。"},
            {"role": "Counselor", "content": "这让你很不安。当他没回消息的时候，你心里在想什么？"},
            {"role": "Seeker", "content": "我就会开始想他是不是在跟别人聊天，是不是不爱我了，是不是要分手了...我知道这样想不对，但就是控制不住。"},
            {"role": "Counselor", "content": "你提到了'控制不住'——那种焦虑的感觉有多强烈？"},
            {"role": "Seeker", "content": "特别强烈，心脏好像要跳出来一样。有时候我会一遍遍刷他的朋友圈，看他什么时候最后上线的。"},
            {"role": "Counselor", "content": "当你做这些事情的时候，你内心最深的担心是什么？"},
            {"role": "Seeker", "content": "我怕他离开我。我觉得如果他离开我，我就什么都没有了..."},
            {"role": "Counselor", "content": "这种'他离开我就什么都没有了'的感觉，在你更小的时候有过类似的体验吗？"},
            {"role": "Seeker", "content": "...我妈小时候经常出差，走之前也不怎么和我说。每次她不在，我都害怕她不回来了。"},
        ],
    },
    # ── adolescent / beginner ──
    {
        "age": "15", "gender": "女", "occupation": "初中生",
        "marital_status": "未婚", "symptoms": "学业压力;注意力不集中;厌学",
        "group_tag": "adolescent", "difficulty": "beginner",
        "issue_tags": "焦虑",
        "report": {
            "案例标题": "初中生厌学与注意力问题",
            "案例类别": ["学业问题"],
            "运用的技术": ["认知行为疗法", "家庭系统视角"],
            "案例简述": ["来访者是一名15岁的初三女生，近期出现明显的厌学情绪和注意力不集中，成绩从年级前10名下降到50名左右。家长反映孩子在家不愿谈学习。"],
            "咨询经过": ["以来访者感兴趣的话题入手建立关系。发现厌学背后是过度的家长期望带来的压力，来访者感到无论怎么努力都达不到父母的要求。"],
            "经验感想": ["青少年厌学问题需要同时考虑家庭动力，单独对来访者做工作往往效果有限。"]
        },
        "portrait_raw": {"age": "15", "gender": "女", "marital_status": "未婚", "occupation": "初中生", "symptoms": "学业压力;注意力不集中;厌学"},
        "conversation": [
            {"role": "Counselor", "content": "你好呀，我是这里的心理老师。今天很高兴见到你。"},
            {"role": "Seeker", "content": "嗯...是我妈让我来的。"},
            {"role": "Counselor", "content": "我理解。那你自己觉得最近有什么困扰吗？"},
            {"role": "Seeker", "content": "就是不想去上学了，上课完全听不进去..."},
            {"role": "Counselor", "content": "不想上学的感觉是从什么时候开始的呢？"},
            {"role": "Seeker", "content": "这学期开始吧。以前还好，但现在一进教室就觉得喘不过气来。"},
            {"role": "Counselor", "content": "喘不过气来——这是一种身体上的感觉对吗？那个时候你在想什么？"},
            {"role": "Seeker", "content": "觉得不管怎么学都没用。我爸妈总觉得我应该考年级前三，但我怎么努力都做不到。"},
        ],
    },
    {
        "age": "16", "gender": "男", "occupation": "高中生",
        "marital_status": "未婚", "symptoms": "与父母冲突;叛逆;沉迷手机",
        "group_tag": "adolescent", "difficulty": "beginner",
        "issue_tags": "家庭冲突",
        "report": {
            "案例标题": "高中生亲子冲突与手机依赖",
            "案例类别": ["亲子关系", "行为问题"],
            "运用的技术": ["动机式访谈", "家庭治疗视角"],
            "案例简述": ["来访者是一名16岁的高一男生，因频繁与父母发生冲突被班主任建议前来咨询。父母反映孩子沉迷手机、不服管教。来访者对咨询有明显的抵触情绪。"],
            "咨询经过": ["咨询师避免说教姿态，通过对来访者的兴趣表达好奇来建立关系。逐步了解到冲突背后是来访者对自主权的需要与父母控制型教养方式之间的矛盾。"],
            "经验感想": ["青少年的'叛逆'往往是对过度控制的合理反抗，需要帮助家长理解而非强化控制。"]
        },
        "portrait_raw": {"age": "16", "gender": "男", "marital_status": "未婚", "occupation": "高中生", "symptoms": "与父母冲突;叛逆;沉迷手机"},
        "conversation": [
            {"role": "Counselor", "content": "嘿，你好。来坐吧，不用紧张。"},
            {"role": "Seeker", "content": "我爸妈让我来的，我没啥好说的。"},
            {"role": "Counselor", "content": "我理解，被别人安排来做一件事确实不太舒服。不过既然来了，我们可以随便聊聊。"},
            {"role": "Seeker", "content": "那聊什么？"},
            {"role": "Counselor", "content": "你平时喜欢做什么呢？"},
            {"role": "Seeker", "content": "打游戏呗。但我爸妈天天管我，动不动就把手机没收。烦死了。"},
            {"role": "Counselor", "content": "听起来你觉得他们管得太多了。"},
            {"role": "Seeker", "content": "对啊！我都16了，他们还把我当小孩一样。上个厕所都要问干嘛去。我同学谁像我这样啊？"},
        ],
    },
    # ── adolescent / intermediate ──
    {
        "age": "17", "gender": "女", "occupation": "高中生",
        "marital_status": "未婚", "symptoms": "社交恐惧;自卑;被同学排挤;焦虑",
        "group_tag": "adolescent", "difficulty": "intermediate",
        "issue_tags": "焦虑,自我认同",
        "report": {
            "案例标题": "高中生社交焦虑与自卑",
            "案例类别": ["社交焦虑", "自我认同"],
            "运用的技术": ["认知行为疗法", "暴露疗法"],
            "案例简述": ["来访者是一名17岁的高二女生，因严重的社交恐惧和自卑感前来咨询。她在班上被同学排挤，不敢在课堂上发言，午饭时总是一个人吃。"],
            "咨询经过": ["咨询师先通过积极倾听和共情建立安全感。通过认知重构帮助来访者检验'别人都讨厌我'的信念，并制定渐进式社交暴露计划。"],
            "经验感想": ["社交焦虑往往伴随着严重的自我意识过剩和消极自我评价，需要同时处理认知和行为层面。"]
        },
        "portrait_raw": {"age": "17", "gender": "女", "marital_status": "未婚", "occupation": "高中生", "symptoms": "社交恐惧;自卑;被同学排挤;焦虑"},
        "conversation": [
            {"role": "Counselor", "content": "你好，这里是一个安全的空间，你可以放心地说任何想说的话。"},
            {"role": "Seeker", "content": "...嗯。"},
            {"role": "Counselor", "content": "不着急，慢慢来。你愿意告诉我是什么让你决定来这里吗？"},
            {"role": "Seeker", "content": "在班上没有人愿意和我说话...我觉得自己很奇怪。"},
            {"role": "Counselor", "content": "你觉得自己很奇怪——能说说是怎么回事吗？"},
            {"role": "Seeker", "content": "就是...别的同学都能自然地聊天、开玩笑，但我一说话就结巴，或者说出来的话很无聊。所以我干脆就不说了。"},
            {"role": "Counselor", "content": "你担心自己说的话不够好。当你准备说什么的时候，脑子里会出现什么想法？"},
            {"role": "Seeker", "content": "我会想'说了肯定被人笑话''他们肯定觉得我很蠢'。所以话到嘴边就咽回去了。"},
            {"role": "Counselor", "content": "这些想法出现的频次高吗？除了在学校，其他场合也会这样吗？"},
            {"role": "Seeker", "content": "几乎随时都会。和亲戚、邻居也是。只有跟我妈在一起的时候还好一点..."},
        ],
    },
    # ── workplace / beginner ──
    {
        "age": "28", "gender": "女", "occupation": "互联网产品经理",
        "marital_status": "未婚", "symptoms": "工作焦虑;职业倦怠;失眠",
        "group_tag": "workplace", "difficulty": "beginner",
        "issue_tags": "焦虑,职场压力,睡眠障碍",
        "report": {
            "案例标题": "互联网从业者职业倦怠与焦虑",
            "案例类别": ["职场压力", "焦虑"],
            "运用的技术": ["认知行为疗法", "正念减压"],
            "案例简述": ["来访者是一名28岁的互联网产品经理，因长期加班导致职业倦怠，伴有焦虑和失眠。她感到无法在工作和生活之间建立边界。"],
            "咨询经过": ["帮助来访者识别导致过度工作的认知因素（'不加班就会被淘汰'），并练习正念技术来管理焦虑情绪。"],
            "经验感想": ["互联网行业的高压文化容易让个体内化'内卷'价值观，需要帮助来访者建立更平衡的工作观。"]
        },
        "portrait_raw": {"age": "28", "gender": "女", "marital_status": "未婚", "occupation": "互联网产品经理", "symptoms": "工作焦虑;职业倦怠;失眠"},
        "conversation": [
            {"role": "Counselor", "content": "你好，请坐。今天是什么让你想来聊聊？"},
            {"role": "Seeker", "content": "我每天加班到很晚，回家也放不下工作上的事情。最近一个月几乎没睡过一个好觉。"},
            {"role": "Counselor", "content": "持续高强度的工作加上睡眠不好，身体和精神上一定都很疲惫。"},
            {"role": "Seeker", "content": "是的。但我不敢停下来。公司最近在裁员，我怕自己一慢下来就被裁了。"},
            {"role": "Counselor", "content": "这种不安全感一直在推着你往前。你觉得如果真的慢下来，最坏会怎么样？"},
            {"role": "Seeker", "content": "被裁员，然后找不到新工作，房租交不起...一想到就更焦虑了。"},
            {"role": "Counselor", "content": "这些担忧是真实存在的。不过我想了解一下，你在工作中的表现实际上是怎样的？"},
            {"role": "Seeker", "content": "其实...上个季度绩效还是A。但我总觉得下个季度可能就不行了。"},
        ],
    },
    {
        "age": "35", "gender": "男", "occupation": "销售经理",
        "marital_status": "已婚", "symptoms": "业绩压力;酗酒;烦躁易怒",
        "group_tag": "workplace", "difficulty": "beginner",
        "issue_tags": "焦虑,职场压力",
        "report": {
            "案例标题": "销售经理业绩压力与情绪管理",
            "案例类别": ["职场压力"],
            "运用的技术": ["动机式访谈", "认知行为疗法"],
            "案例简述": ["来访者是一名35岁的已婚男性销售经理，因业绩压力导致饮酒增多、对家人烦躁易怒。妻子提出如果不改变就要分居。"],
            "咨询经过": ["使用动机式访谈探索来访者改变的意愿，帮助其看到酒精是短期应对策略但长期损害家庭关系。"],
            "经验感想": ["男性来访者常将情绪问题外化为行为问题（酗酒、易怒），需要帮助他们连接行为与内在情绪。"]
        },
        "portrait_raw": {"age": "35", "gender": "男", "marital_status": "已婚", "occupation": "销售经理", "symptoms": "业绩压力;酗酒;烦躁易怒"},
        "conversation": [
            {"role": "Counselor", "content": "你好，今天来聊聊是什么契机？"},
            {"role": "Seeker", "content": "老婆让来的。她说再这样下去就要跟我分居。"},
            {"role": "Counselor", "content": "她说的'这样下去'具体是指什么？"},
            {"role": "Seeker", "content": "就是...业绩指标根本完不成，回家就想喝酒。有时候喝多了对她和孩子发脾气。"},
            {"role": "Counselor", "content": "听起来工作的压力影响到了你在家里的状态。喝酒是从什么时候开始变多的？"},
            {"role": "Seeker", "content": "去年换了新领导之后吧。指标翻了将近一倍，但市场又不好。"},
            {"role": "Counselor", "content": "一方面压力翻倍，另一方面外部环境又不配合。你对目前的喝酒情况怎么看？"},
            {"role": "Seeker", "content": "我也知道不好...但不喝的话晚上脑子里全是那些数字和deadline，根本停不下来。"},
        ],
    },
    # ── workplace / intermediate ──
    {
        "age": "32", "gender": "女", "occupation": "教师",
        "marital_status": "已婚", "symptoms": "职业倦怠;躯体化症状;头痛;胸闷",
        "group_tag": "workplace", "difficulty": "intermediate",
        "issue_tags": "职场压力,躯体化症状",
        "report": {
            "案例标题": "教师职业倦怠伴躯体化症状",
            "案例类别": ["躯体化", "职业倦怠"],
            "运用的技术": ["身心整合取向", "正念减压"],
            "案例简述": ["来访者是一名32岁的已婚女性中学教师，从教10年后出现严重的职业倦怠。近半年频繁出现头痛、胸闷等躯体症状，多次体检均未发现器质性问题。"],
            "咨询经过": ["帮助来访者建立身体症状与情绪的连接，发现躯体化症状是长期压抑工作不满和家庭矛盾的身体表达。运用正念身体扫描让来访者重新与身体建立连接。"],
            "经验感想": ["躯体化来访者需要先尊重其身体体验，不宜过早进行心理化解释，以免来访者感到被否定。"]
        },
        "portrait_raw": {"age": "32", "gender": "女", "marital_status": "已婚", "occupation": "教师", "symptoms": "职业倦怠;躯体化症状;头痛;胸闷"},
        "conversation": [
            {"role": "Counselor", "content": "你好，很高兴见到你。能和我说说是什么让你来到这里吗？"},
            {"role": "Seeker", "content": "我当了十年老师了，最近经常头疼胸闷。去医院检查了好几次，都说没什么问题，建议我来看看心理。"},
            {"role": "Counselor", "content": "身体不舒服又查不出原因，一定让你很困惑也很担心。"},
            {"role": "Seeker", "content": "是的。而且这些症状经常在要上课之前特别明显。我都开始害怕走进教室了。"},
            {"role": "Counselor", "content": "你说走进教室之前症状会加重——在那个时刻你心里是什么感觉？"},
            {"role": "Seeker", "content": "就是觉得很累...不是身体的累，是一种从心里往外冒的倦怠感。觉得自己像个机器一样。"},
            {"role": "Counselor", "content": "像机器一样——做着重复的事情，但感受不到意义？"},
            {"role": "Seeker", "content": "对...以前我是真的喜欢教书的。但现在除了上课还有无穷无尽的行政任务、检查、评比。我都忘了为什么要当老师了。"},
        ],
    },
    # ── family / beginner ──
    {
        "age": "40", "gender": "女", "occupation": "全职妈妈",
        "marital_status": "已婚", "symptoms": "婚姻矛盾;孩子教育焦虑;自我价值感低",
        "group_tag": "family", "difficulty": "beginner",
        "issue_tags": "亲密关系,家庭冲突",
        "report": {
            "案例标题": "全职妈妈婚姻矛盾与自我价值感",
            "案例类别": ["婚姻问题", "自我认同"],
            "运用的技术": ["家庭系统疗法", "人本主义取向"],
            "案例简述": ["来访者是一名40岁的全职妈妈，因婚姻不满和自我价值感低前来咨询。丈夫不参与家务和育儿，来访者感到不被理解和重视。"],
            "咨询经过": ["帮助来访者看到她在家庭中承担了过多的功能角色，同时丧失了作为个体的需求。探索她选择全职妈妈角色背后的价值观和期待。"],
            "经验感想": ["全职妈妈群体的心理困扰往往被社会忽视，需要在咨询中先肯定她们的付出和价值。"]
        },
        "portrait_raw": {"age": "40", "gender": "女", "marital_status": "已婚", "occupation": "全职妈妈", "symptoms": "婚姻矛盾;孩子教育焦虑;自我价值感低"},
        "conversation": [
            {"role": "Counselor", "content": "你好，很高兴你来了。今天想和我聊些什么？"},
            {"role": "Seeker", "content": "我不知道从哪里说起...就是觉得在这个家里我好像是透明的。"},
            {"role": "Counselor", "content": "透明的——你觉得没有被看到。"},
            {"role": "Seeker", "content": "我老公完全不管孩子，什么都是我一个人做。洗衣做饭接送孩子辅导作业，我觉得自己就是个保姆。"},
            {"role": "Counselor", "content": "你承担了这么多，但却没有得到相应的认可和支持。"},
            {"role": "Seeker", "content": "是啊。他回来就瘫在沙发上刷手机。我跟他说我很累，他说'你又不上班，有什么好累的'。"},
            {"role": "Counselor", "content": "听到这句话的时候你是什么感觉？"},
            {"role": "Seeker", "content": "特别委屈，也很生气...但生完气又觉得也许他说的也有道理？也许是我太矫情了？"},
        ],
    },
    # ── family / intermediate ──
    {
        "age": "45", "gender": "男", "occupation": "工程师",
        "marital_status": "已婚", "symptoms": "夫妻关系冷淡;沟通障碍;婚姻危机",
        "group_tag": "family", "difficulty": "intermediate",
        "issue_tags": "亲密关系,家庭冲突",
        "report": {
            "案例标题": "中年夫妻关系冷淡与沟通障碍",
            "案例类别": ["婚姻危机", "沟通问题"],
            "运用的技术": ["情绪聚焦疗法", "戈特曼方法"],
            "案例简述": ["来访者是一名45岁的已婚男性工程师，因妻子提出离婚而前来咨询。夫妻之间长期缺乏情感沟通，形成了'追-逃'互动模式。"],
            "咨询经过": ["帮助来访者理解'追-逃'模式中双方的情绪需求——妻子的'追'是渴望连接，自己的'逃'是回避冲突的防御。引导来访者练习用非防御性的方式回应妻子。"],
            "经验感想": ["婚姻危机中的男性来访者常常对情感表达有障碍，需要耐心引导他们进入情感层面。"]
        },
        "portrait_raw": {"age": "45", "gender": "男", "marital_status": "已婚", "occupation": "工程师", "symptoms": "夫妻关系冷淡;沟通障碍;婚姻危机"},
        "conversation": [
            {"role": "Counselor", "content": "你好，今天来是关于什么事情呢？"},
            {"role": "Seeker", "content": "我和我妻子已经很长时间没有好好说过话了。上周她提出要离婚。"},
            {"role": "Counselor", "content": "听到妻子提出离婚，你现在的感受是什么？"},
            {"role": "Seeker", "content": "...不知道。我好像应该很难过，但实际上感觉有点麻木。"},
            {"role": "Counselor", "content": "麻木也是一种真实的感受。你们之间是怎么走到今天这一步的？"},
            {"role": "Seeker", "content": "她总说我不关心她。但我觉得我一直在挣钱养家，该做的都做了。她想要的那些——什么情感交流，我确实不太擅长。"},
            {"role": "Counselor", "content": "你觉得你通过工作和经济支持来表达对家庭的关心，但她需要的是另一种方式的连接。"},
            {"role": "Seeker", "content": "对。我们每次一说话就吵起来，后来我干脆不说了。不说至少不会吵。"},
            {"role": "Counselor", "content": "你选择沉默来避免冲突——但看起来这种方式反而让她更想要和你沟通？"},
            {"role": "Seeker", "content": "是...她说我像一堵墙。但我真的不知道该说什么。一开口就感觉会说错。"},
        ],
    },
    # ── elderly / beginner ──
    {
        "age": "68", "gender": "女", "occupation": "退休教师",
        "marital_status": "丧偶", "symptoms": "丧偶悲伤;孤独感;失眠;子女关系",
        "group_tag": "elderly", "difficulty": "beginner",
        "issue_tags": "抑郁",
        "report": {
            "案例标题": "老年丧偶后的悲伤与孤独",
            "案例类别": ["哀伤辅导"],
            "运用的技术": ["哀伤辅导", "回忆疗法"],
            "案例简述": ["来访者是一名68岁的退休女教师，丈夫半年前去世后出现持续的悲伤、失眠和孤独感。子女因工作忙碌很少陪伴，来访者独居。"],
            "咨询经过": ["为来访者提供一个安全的空间表达悲伤，通过回忆疗法帮助她整理与丈夫的美好回忆，并逐步适应新的生活角色。"],
            "经验感想": ["老年丧偶悲伤需要给予充分的时间和空间，不宜过早推动'走出来'。"]
        },
        "portrait_raw": {"age": "68", "gender": "女", "marital_status": "丧偶", "occupation": "退休教师", "symptoms": "丧偶悲伤;孤独感;失眠;子女关系"},
        "conversation": [
            {"role": "Counselor", "content": "阿姨好，请坐。今天来想聊点什么呢？"},
            {"role": "Seeker", "content": "老伴走了以后，我一个人在家...孩子们都忙，也不常回来。"},
            {"role": "Counselor", "content": "老伴离开对您来说一定是非常大的打击。"},
            {"role": "Seeker", "content": "走了半年了，有时候我还是会忘记他不在了。做好了饭会喊他来吃，回头才发现空的。"},
            {"role": "Counselor", "content": "这半年来你一直在慢慢适应他不在的生活，这一定很不容易。"},
            {"role": "Seeker", "content": "晚上最难熬。以前两个人看看电视说说话，现在就我一个人，电视也不想看。经常睡不着。"},
            {"role": "Counselor", "content": "夜晚的寂静会让思念更加强烈。你和孩子们说过自己的感受吗？"},
            {"role": "Seeker", "content": "不想给他们添麻烦。他们工作压力也大，我不能总拖累他们。"},
        ],
    },
    # ── elderly / intermediate ──
    {
        "age": "72", "gender": "男", "occupation": "退休工人",
        "marital_status": "已婚", "symptoms": "退休适应困难;记忆力减退焦虑;存在焦虑",
        "group_tag": "elderly", "difficulty": "intermediate",
        "issue_tags": "焦虑,自我认同",
        "report": {
            "案例标题": "退休老人的存在焦虑与衰老恐惧",
            "案例类别": ["适应障碍", "存在焦虑"],
            "运用的技术": ["存在主义疗法", "回忆疗法"],
            "案例简述": ["来访者是一名72岁的退休男性工人，退休后感到失去人生意义，同时对记忆力减退产生强烈焦虑，担心自己患上老年痴呆。"],
            "咨询经过": ["通过存在主义视角帮助来访者面对衰老和有限性，同时用回忆疗法帮助他重新审视和肯定自己一生的贡献和成就。"],
            "经验感想": ["老年来访者的存在焦虑需要被认真对待，帮助他们在有限性中找到意义是关键。"]
        },
        "portrait_raw": {"age": "72", "gender": "男", "marital_status": "已婚", "occupation": "退休工人", "symptoms": "退休适应困难;记忆力减退焦虑;存在焦虑"},
        "conversation": [
            {"role": "Counselor", "content": "大爷您好，来坐这里。今天怎么想到来这里了？"},
            {"role": "Seeker", "content": "退休以后在家闲着，觉得自己没什么用了。老伴说我退休后脾气变大了，让我来看看。"},
            {"role": "Counselor", "content": "从忙碌了一辈子到突然停下来，确实需要适应。您退休多久了？"},
            {"role": "Seeker", "content": "两年了。以前每天去工厂，虽然累但充实。现在每天在家不知道干嘛。"},
            {"role": "Counselor", "content": "以前有工作带来的归属感和价值感，现在这些突然没有了。"},
            {"role": "Seeker", "content": "而且我最近记性越来越差了。前天找钥匙，找了半天发现在自己手里。我怕...怕自己是不是得老年痴呆了。"},
            {"role": "Counselor", "content": "这种担心让您很焦虑。其实随着年龄增长，记忆力有些变化是正常的。不过我能理解这种恐惧。"},
            {"role": "Seeker", "content": "楼下老张就是得了这个病，最后连自己孩子都不认识了。我不想变成那样。"},
        ],
    },
    # ── female / beginner ──
    {
        "age": "30", "gender": "女", "occupation": "设计师",
        "marital_status": "未婚", "symptoms": "容貌焦虑;社交比较;自我否定",
        "group_tag": "female", "difficulty": "beginner",
        "issue_tags": "焦虑,自我认同",
        "report": {
            "案例标题": "年轻女性容貌焦虑与社交比较",
            "案例类别": ["自我认同", "焦虑"],
            "运用的技术": ["认知行为疗法", "自我关怀训练"],
            "案例简述": ["来访者是一名30岁的未婚女设计师，因容貌焦虑和与同龄人的社交比较导致自我否定。社交媒体使用加剧了她的比较心理。"],
            "咨询经过": ["帮助来访者识别和挑战关于外貌和人生进度的不合理信念，减少社交媒体使用，练习自我关怀和自我接纳。"],
            "经验感想": ["社交媒体时代的容貌焦虑和生活比较日益普遍，需要帮助来访者建立内在的自我价值标准。"]
        },
        "portrait_raw": {"age": "30", "gender": "女", "marital_status": "未婚", "occupation": "设计师", "symptoms": "容貌焦虑;社交比较;自我否定"},
        "conversation": [
            {"role": "Counselor", "content": "你好，今天来想聊些什么呢？"},
            {"role": "Seeker", "content": "我总觉得自己不够好看。看到同龄人都结婚生子了，觉得自己很失败。"},
            {"role": "Counselor", "content": "你给自己定义了'失败'——这个标准是从哪里来的？"},
            {"role": "Seeker", "content": "就...身边的人都到了这个阶段了呀。我妈也老催我。每次打开朋友圈看到谁又结婚了谁又生了，就特别焦虑。"},
            {"role": "Counselor", "content": "朋友圈成了一个让你不自在的比较场。你觉得现在的生活中，有什么是让你满意或骄傲的吗？"},
            {"role": "Seeker", "content": "工作还可以吧...但一想到30了还单身，就觉得什么都白搭。"},
            {"role": "Counselor", "content": "你把自己的价值和感情状态绑定在了一起。如果一个好朋友跟你说同样的话，你会怎么回应她？"},
            {"role": "Seeker", "content": "我大概会说...顺其自然，不用着急。但轮到自己就做不到了。"},
        ],
    },
    # ── female / intermediate ──
    {
        "age": "27", "gender": "女", "occupation": "护士",
        "marital_status": "离异", "symptoms": "离婚创伤;自责;信任缺失;抑郁",
        "group_tag": "female", "difficulty": "intermediate",
        "issue_tags": "抑郁,亲密关系",
        "report": {
            "案例标题": "年轻女性离婚后的创伤与信任修复",
            "案例类别": ["离婚适应", "创伤"],
            "运用的技术": ["情绪聚焦疗法", "叙事疗法"],
            "案例简述": ["来访者是一名27岁的离异女护士，离婚半年后出现持续的自责、抑郁和对亲密关系的信任缺失。她将婚姻失败归因于自己。"],
            "咨询经过": ["通过叙事疗法帮助来访者重新审视婚姻故事，从'全是我的错'的单一叙事中解放出来，看到解蝶关系中双方的互动模式。"],
            "经验感想": ["离婚创伤中的自责往往涉及对'完美关系'的幻想破灭，需要帮助来访者接受关系的复杂性。"]
        },
        "portrait_raw": {"age": "27", "gender": "女", "marital_status": "离异", "occupation": "护士", "symptoms": "离婚创伤;自责;信任缺失;抑郁"},
        "conversation": [
            {"role": "Counselor", "content": "你好，今天愿意和我聊聊吗？"},
            {"role": "Seeker", "content": "离婚之后...我一直在想是不是自己的问题。"},
            {"role": "Counselor", "content": "这个想法一直困扰着你。能说说你觉得'自己有什么问题'吗？"},
            {"role": "Seeker", "content": "也许是我不够好吧。不够温柔、不够体贴、工作太忙照顾不到他..."},
            {"role": "Counselor", "content": "你列了很多自己'不够'的地方。你对自己的要求非常苛刻。你的前夫在这段关系中是什么样的？"},
            {"role": "Seeker", "content": "他...其实一开始很好。但后来我发现他一直在跟前女友联系。我提出来他反而怪我小气不信任他。"},
            {"role": "Counselor", "content": "尽管他有这样的行为，你却把婚姻的失败都归咎在了自己身上。"},
            {"role": "Seeker", "content": "...是。说出来好像确实不合理。但我就是控制不住地想，如果当时我做得更好，结局会不会不一样。"},
            {"role": "Counselor", "content": "这种反复的自我审视其实是创伤的一种表现。你对新的亲密关系有什么想法？"},
            {"role": "Seeker", "content": "再也不敢相信别人了。有人对我好，我第一反应就是'你到底想干嘛'。"},
        ],
    },
    # ── general / advanced ──
    {
        "age": "38", "gender": "男", "occupation": "自由职业者",
        "marital_status": "已婚", "symptoms": "自杀念头;重度抑郁;失眠;酗酒;家庭暴力受害",
        "group_tag": "general", "difficulty": "advanced",
        "issue_tags": "抑郁,睡眠障碍",
        "report": {
            "案例标题": "中年男性重度抑郁伴自杀意念",
            "案例类别": ["危机干预", "抑郁"],
            "运用的技术": ["危机干预", "安全计划"],
            "案例简述": ["来访者是一名38岁的已婚男性自由职业者，近期事业严重受挫，同时面临家庭暴力（作为受害者），出现重度抑郁和间歇性自杀意念。酒精使用增多以应对情绪。"],
            "咨询经过": ["首先进行全面的自杀风险评估，确认来访者有自杀意念但无具体计划。建立安全计划，并将家庭暴力议题作为持续关注点。同时协助就医评估是否需要药物治疗。"],
            "经验感想": ["有自杀意念的来访者需要优先确保安全，同时不能忽视其背后的系统性压力源（如家暴）。男性作为家暴受害者往往更难寻求帮助。"]
        },
        "portrait_raw": {"age": "38", "gender": "男", "marital_status": "已婚", "occupation": "自由职业者", "symptoms": "自杀念头;重度抑郁;失眠;酗酒;家庭暴力受害"},
        "conversation": [
            {"role": "Counselor", "content": "你好，今天愿意来到这里我觉得很重要。你现在感觉怎么样？"},
            {"role": "Seeker", "content": "不太好...我有时候觉得不想活了。"},
            {"role": "Counselor", "content": "谢谢你信任我告诉我这些。能再多说说这个想法吗？是偶尔闪过，还是经常出现？"},
            {"role": "Seeker", "content": "最近越来越频繁了。特别是喝了酒之后...但又想到孩子还小，不想让她没有爸爸。"},
            {"role": "Counselor", "content": "孩子是你心中很重要的牵挂。你有没有想过具体的方式或计划？"},
            {"role": "Seeker", "content": "没有具体想怎么做...就是觉得活着太累了。事业完了，在家也不好过。"},
            {"role": "Counselor", "content": "你说在家也不好过——能说说是什么情况吗？"},
            {"role": "Seeker", "content": "我老婆...她脾气不好，有时候会动手。我知道说出来很丢人。一个大男人被老婆打。"},
            {"role": "Counselor", "content": "这一点都不丢人。任何人遭受暴力都不是他的错。你愿意告诉我这些需要很大的勇气。"},
            {"role": "Seeker", "content": "...谢谢。从来没有人这样说过。"},
        ],
    },
    {
        "age": "24", "gender": "女", "occupation": "大学生",
        "marital_status": "未婚", "symptoms": "创伤后应激;噩梦;惊恐发作;回避行为",
        "group_tag": "college", "difficulty": "advanced",
        "issue_tags": "焦虑",
        "report": {
            "案例标题": "大学生创伤后应激障碍",
            "案例类别": ["创伤", "焦虑"],
            "运用的技术": ["创伤聚焦认知行为疗法", "EMDR"],
            "案例简述": ["来访者是一名24岁的女大学生，一年前经历了严重的创伤事件后出现典型的PTSD症状：侵入性记忆、回避行为、惊恐发作和噩梦。日常功能受到严重影响。"],
            "咨询经过": ["建立安全感是第一阶段的工作重点。教授来访者稳定化技术（安全岛想象、蝴蝶拥抱）来管理闪回和惊恐发作。在来访者准备好后，逐步进行创伤的暴露处理。"],
            "经验感想": ["创伤工作需要严格遵循分阶段治疗模型：先稳定化再处理创伤。过早进入创伤记忆可能导致再创伤。"]
        },
        "portrait_raw": {"age": "24", "gender": "女", "marital_status": "未婚", "occupation": "大学生", "symptoms": "创伤后应激;噩梦;惊恐发作;回避行为"},
        "conversation": [
            {"role": "Counselor", "content": "你好，今天在这里你是安全的。想怎么开始都可以。"},
            {"role": "Seeker", "content": "那件事过去一年了，但我还是经常做噩梦。突然会心跳加速，好像又回到了那个时候。"},
            {"role": "Counselor", "content": "这些反应在经历了那样的事情之后是很正常的身体反应。你的身体在试图保护你。"},
            {"role": "Seeker", "content": "可是已经过去了啊...我不明白为什么还是这样。我以为时间会让一切好起来的。"},
            {"role": "Counselor", "content": "创伤的记忆和一般的记忆不同，时间本身不一定能治愈它。但我们可以一起工作来帮助你。"},
            {"role": "Seeker", "content": "我现在不敢一个人走夜路，不敢去那个地方附近。有时候闻到某种味道都会突然紧张起来。"},
            {"role": "Counselor", "content": "你描述的这些——噩梦、闪回、回避、过度警觉——都是你的身心在告诉你，那段经历还需要被处理。"},
            {"role": "Seeker", "content": "处理...我不知道还能不能好起来。"},
            {"role": "Counselor", "content": "我能理解你的怀疑。不过有很多经历过类似事情的人通过专业帮助恢复了。首先我们会先让你学会一些稳定技术，不会马上去碰那些记忆。"},
            {"role": "Seeker", "content": "好...那这个过程会很痛苦吗？"},
        ],
    },
]

SAMPLE_KNOWLEDGE = [
    # ── CBT ──
    {
        "title": "认知行为疗法（CBT）基础",
        "school": "认知行为", "issue": "焦虑", "difficulty": "beginner",
        "summary": "理解认知三角（想法-情绪-行为）以及认知歪曲的识别方法。",
        "content": "认知行为疗法的核心理论认为，人们的情绪和行为并非直接由事件引起，而是由对事件的认知解释所驱动。治疗的重点是帮助来访者识别和修正自动化的消极想法（认知歪曲），从而改善情绪状态和行为模式。常见认知歪曲包括：全或无思维、过度概括、灾难化思维、情感推理等。",
        "source_type": "textbook",
        "tags": ["CBT", "认知歪曲", "基础理论"],
    },
    {
        "title": "苏格拉底式提问技术",
        "school": "认知行为", "issue": "抑郁", "difficulty": "intermediate",
        "summary": "通过引导式提问帮助来访者重新审视自动化想法。",
        "content": "苏格拉底式提问是CBT中的核心技术，通过一系列开放性问题引导来访者自主探索和检验其自动化想法的有效性。典型问法包括：'支持这个想法的证据是什么？''反对的证据呢？''最坏的情况是什么？最好的呢？最可能的呢？''如果朋友遇到同样的情况你会怎么说？'",
        "source_type": "technique",
        "tags": ["CBT", "苏格拉底提问", "认知重构"],
    },
    # ── Person-centered ──
    {
        "title": "来访者中心疗法核心条件",
        "school": "人本主义", "issue": "个人成长", "difficulty": "beginner",
        "summary": "罗杰斯提出的三个核心条件：共情、无条件积极关注和真诚一致。",
        "content": "卡尔·罗杰斯认为治疗效果的关键在于治疗关系的质量。他提出了三个核心条件：（1）共情理解——准确感受来访者的内心世界；（2）无条件积极关注——不带评判地接纳来访者；（3）真诚一致——治疗师表里如一。这三个条件被认为是所有有效心理咨询的基础。",
        "source_type": "textbook",
        "tags": ["人本主义", "罗杰斯", "核心条件"],
    },
    {
        "title": "共情回应技巧",
        "school": "人本主义", "issue": "个人成长", "difficulty": "beginner",
        "summary": "如何进行准确的共情回应，包括情感反映和意义反映。",
        "content": "共情回应分为初级共情和高级共情。初级共情是对来访者表达的情感进行反映（'你感到...因为...'）。高级共情则进一步理解来访者话语背后未表达的深层含义和情感。有效的共情回应需要：专注倾听、暂停自我、用来访者的语言回应、检验理解是否准确。",
        "source_type": "technique",
        "tags": ["共情", "积极倾听", "情感反映"],
    },
    # ── Psychodynamic ──
    {
        "title": "精神动力学取向初次访谈",
        "school": "精神分析", "issue": "个人成长", "difficulty": "intermediate",
        "summary": "精神动力学视角下的初次评估面谈结构与技巧。",
        "content": "精神动力学初始访谈关注来访者的主诉、现病史、个人发展史（尤其是早期关系经验）、防御机制模式、移情反应等。评估内容包括：现实检验能力、客体关系质量、自我功能水平。面谈中注意来访者的自由联想、口误、情感回避等潜意识线索。",
        "source_type": "textbook",
        "tags": ["精神分析", "初始访谈", "评估"],
    },
    # ── Crisis intervention ──
    {
        "title": "自杀风险评估流程",
        "school": "危机干预", "issue": "危机干预", "difficulty": "advanced",
        "summary": "系统化的自杀风险评估框架，包括直接询问和安全计划制定。",
        "content": "自杀风险评估的关键步骤：（1）直接询问自杀意念（'你有没有想过不想活了？'）——直接询问不会增加风险；（2）评估自杀计划的具体性、方法的致命性和获取手段的可能性；（3）评估保护因素（家庭支持、对未来的期待等）；（4）制定安全计划：列出警告信号、自我应对策略、可联系的人、专业求助渠道；（5）限制致命手段的接触。",
        "source_type": "guideline",
        "tags": ["危机干预", "自杀评估", "安全计划"],
    },
    # ── Family therapy ──
    {
        "title": "家庭系统理论基础",
        "school": "家庭治疗", "issue": "家庭冲突", "difficulty": "beginner",
        "summary": "理解家庭作为系统运作的基本原理和核心概念。",
        "content": "家庭系统理论认为家庭是一个互相关联的系统，每个成员的行为都会影响其他成员。核心概念包括：家庭结构（权力层级、联盟、界限）、三角化（两人冲突拉入第三方）、代际传递（模式在代际间重复）、家庭规则（显性和隐性）。理解这些概念有助于从系统视角而非个人视角来理解来访者的问题。",
        "source_type": "textbook",
        "tags": ["家庭治疗", "系统理论", "三角化"],
    },
    # ── Emotion-focused ──
    {
        "title": "情绪聚焦疗法（EFT）基础",
        "school": "人本主义", "issue": "亲密关系", "difficulty": "intermediate",
        "summary": "EFT的核心概念和处理关系中情感互动的方法。",
        "content": "情绪聚焦疗法认为情绪是信息的来源和行动的指南。在亲密关系中，表面的冲突行为（如指责、退缩）背后是更深层的依附需求（需要被看见、被接纳）。EFT的目标是帮助伴侣识别消极互动循环，接触深层情绪，重建安全的情感联结。治疗分三个阶段：降低冲突升级→重构互动模式→巩固新的联结。",
        "source_type": "textbook",
        "tags": ["EFT", "情绪聚焦", "亲密关系"],
    },
]


async def seed_database():
    """Seed database with sample profiles and knowledge items."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        # Check if profiles already exist
        count_result = await session.execute(
            select(func.count()).select_from(SeekerProfile)
        )
        existing_profiles = count_result.scalar() or 0

        if existing_profiles == 0:
            for p in SAMPLE_PROFILES:
                profile = SeekerProfile(
                    id=str(uuid.uuid4()),
                    age=p["age"],
                    gender=p["gender"],
                    occupation=p["occupation"],
                    marital_status=p["marital_status"],
                    symptoms=p["symptoms"],
                    group_tag=p["group_tag"],
                    difficulty=p["difficulty"],
                    issue_tags=p.get("issue_tags"),
                    report=p.get("report", {}),
                    conversation=p.get("conversation", []),
                    portrait_raw=p.get("portrait_raw", {}),
                )
                session.add(profile)
            await session.commit()
            print(f"✅ Seeded {len(SAMPLE_PROFILES)} seeker profiles")
        else:
            print(f"⏭ Skipped profiles — {existing_profiles} already exist")

        # Seed knowledge items
        count_result = await session.execute(
            select(func.count()).select_from(KnowledgeItem)
        )
        existing_items = count_result.scalar() or 0

        if existing_items == 0:
            for k in SAMPLE_KNOWLEDGE:
                item = KnowledgeItem(
                    id=str(uuid.uuid4()),
                    title=k["title"],
                    school=k["school"],
                    issue=k["issue"],
                    difficulty=k["difficulty"],
                    summary=k.get("summary", ""),
                    content=k["content"],
                    source_type=k.get("source_type", "textbook"),
                    source_ref=k.get("source_ref"),
                    tags=k.get("tags", []),
                )
                session.add(item)
            await session.commit()
            print(f"✅ Seeded {len(SAMPLE_KNOWLEDGE)} knowledge items")
        else:
            print(f"⏭ Skipped knowledge items — {existing_items} already exist")

    await engine.dispose()
    print("🎉 Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed_database())
