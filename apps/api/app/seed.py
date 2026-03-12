"""Seed the database with sample seeker profiles and knowledge items for demo/training."""

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

SAMPLE_PROFILES = [
    # ── college / beginner ──
    {
        "age": "20", "gender": "女", "occupation": "大学生",
        "marital_status": "未婚", "symptoms": "考试焦虑;社交回避;失眠",
        "group_tag": "college", "difficulty": "beginner",
        "issue_tags": "焦虑,睡眠障碍",
        "report": {"案例类别": ["焦虑"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "老师好，我最近考试前总是特别紧张，晚上也睡不着..."},
        ],
    },
    {
        "age": "22", "gender": "男", "occupation": "研究生",
        "marital_status": "未婚", "symptoms": "论文压力;导师关系紧张;情绪低落",
        "group_tag": "college", "difficulty": "beginner",
        "issue_tags": "焦虑,自我认同",
        "report": {"案例类别": ["学业压力"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我觉得研究生读得很痛苦，导师总是不满意..."},
        ],
    },
    {
        "age": "19", "gender": "女", "occupation": "大学生",
        "marital_status": "未婚", "symptoms": "室友矛盾;人际关系困扰;情绪波动",
        "group_tag": "college", "difficulty": "beginner",
        "issue_tags": "自我认同",
        "report": {"案例类别": ["人际关系"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我和室友的关系越来越差，我不知道该怎么办..."},
        ],
    },
    # ── college / intermediate ──
    {
        "age": "21", "gender": "男", "occupation": "大学生",
        "marital_status": "未婚", "symptoms": "抑郁情绪;自我否定;失眠;食欲下降",
        "group_tag": "college", "difficulty": "intermediate",
        "issue_tags": "抑郁,睡眠障碍",
        "report": {"案例类别": ["抑郁"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我觉得自己什么都做不好，活着没什么意思..."},
        ],
    },
    {
        "age": "23", "gender": "女", "occupation": "研究生",
        "marital_status": "恋爱中", "symptoms": "恋爱关系焦虑;分离焦虑;依赖;情绪不稳",
        "group_tag": "college", "difficulty": "intermediate",
        "issue_tags": "焦虑,亲密关系",
        "report": {"案例类别": ["亲密关系"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我男朋友每次不回我消息我就会特别焦虑，控制不住地想很多..."},
        ],
    },
    # ── adolescent / beginner ──
    {
        "age": "15", "gender": "女", "occupation": "初中生",
        "marital_status": "未婚", "symptoms": "学业压力;注意力不集中;厌学",
        "group_tag": "adolescent", "difficulty": "beginner",
        "issue_tags": "焦虑",
        "report": {"案例类别": ["学业问题"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我不想去上学了，上课完全听不进去..."},
        ],
    },
    {
        "age": "16", "gender": "男", "occupation": "高中生",
        "marital_status": "未婚", "symptoms": "与父母冲突;叛逆;沉迷手机",
        "group_tag": "adolescent", "difficulty": "beginner",
        "issue_tags": "家庭冲突",
        "report": {"案例类别": ["亲子关系"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我爸妈天天管我，我烦死了..."},
        ],
    },
    # ── adolescent / intermediate ──
    {
        "age": "17", "gender": "女", "occupation": "高中生",
        "marital_status": "未婚", "symptoms": "社交恐惧;自卑;被同学排挤;焦虑",
        "group_tag": "adolescent", "difficulty": "intermediate",
        "issue_tags": "焦虑,自我认同",
        "report": {"案例类别": ["社交焦虑"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "在班上没有人愿意和我说话，我觉得自己很奇怪..."},
        ],
    },
    # ── workplace / beginner ──
    {
        "age": "28", "gender": "女", "occupation": "互联网产品经理",
        "marital_status": "未婚", "symptoms": "工作焦虑;职业倦怠;失眠",
        "group_tag": "workplace", "difficulty": "beginner",
        "issue_tags": "焦虑,职场压力,睡眠障碍",
        "report": {"案例类别": ["职场压力"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我每天加班到很晚，回家也放不下工作上的事情..."},
        ],
    },
    {
        "age": "35", "gender": "男", "occupation": "销售经理",
        "marital_status": "已婚", "symptoms": "业绩压力;酗酒;烦躁易怒",
        "group_tag": "workplace", "difficulty": "beginner",
        "issue_tags": "焦虑,职场压力",
        "report": {"案例类别": ["职场压力"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "业绩指标根本完不成，回家就想喝酒，老婆说我变了..."},
        ],
    },
    # ── workplace / intermediate ──
    {
        "age": "32", "gender": "女", "occupation": "教师",
        "marital_status": "已婚", "symptoms": "职业倦怠;躯体化症状;头痛;胸闷",
        "group_tag": "workplace", "difficulty": "intermediate",
        "issue_tags": "职场压力,躯体化症状",
        "report": {"案例类别": ["躯体化"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我当了十年老师了，最近经常头疼胸闷，去医院检查又没什么问题..."},
        ],
    },
    # ── family / beginner ──
    {
        "age": "40", "gender": "女", "occupation": "全职妈妈",
        "marital_status": "已婚", "symptoms": "婚姻矛盾;孩子教育焦虑;自我价值感低",
        "group_tag": "family", "difficulty": "beginner",
        "issue_tags": "亲密关系,家庭冲突",
        "report": {"案例类别": ["婚姻问题"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我老公完全不管孩子，什么都是我一个人，我觉得自己不被理解..."},
        ],
    },
    # ── family / intermediate ──
    {
        "age": "45", "gender": "男", "occupation": "工程师",
        "marital_status": "已婚", "symptoms": "夫妻关系冷淡;沟通障碍;婚姻危机",
        "group_tag": "family", "difficulty": "intermediate",
        "issue_tags": "亲密关系,家庭冲突",
        "report": {"案例类别": ["婚姻危机"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我和我妻子已经很长时间没有好好说过话了，她提出要离婚..."},
        ],
    },
    # ── elderly / beginner ──
    {
        "age": "68", "gender": "女", "occupation": "退休教师",
        "marital_status": "丧偶", "symptoms": "丧偶悲伤;孤独感;失眠;子女关系",
        "group_tag": "elderly", "difficulty": "beginner",
        "issue_tags": "抑郁",
        "report": {"案例类别": ["哀伤辅导"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "老伴走了以后，我一个人在家，孩子们都忙..."},
        ],
    },
    # ── elderly / intermediate ──
    {
        "age": "72", "gender": "男", "occupation": "退休工人",
        "marital_status": "已婚", "symptoms": "退休适应困难;记忆力减退焦虑;存在焦虑",
        "group_tag": "elderly", "difficulty": "intermediate",
        "issue_tags": "焦虑,自我认同",
        "report": {"案例类别": ["适应障碍"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "退休以后觉得自己没什么用了，记性也越来越差，怕得老年痴呆..."},
        ],
    },
    # ── female / beginner ──
    {
        "age": "30", "gender": "女", "occupation": "设计师",
        "marital_status": "未婚", "symptoms": "容貌焦虑;社交比较;自我否定",
        "group_tag": "female", "difficulty": "beginner",
        "issue_tags": "焦虑,自我认同",
        "report": {"案例类别": ["自我认同"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我总觉得自己不够好看，看到同龄人结婚生子，觉得自己很失败..."},
        ],
    },
    # ── female / intermediate ──
    {
        "age": "27", "gender": "女", "occupation": "护士",
        "marital_status": "离异", "symptoms": "离婚创伤;自责;信任缺失;抑郁",
        "group_tag": "female", "difficulty": "intermediate",
        "issue_tags": "抑郁,亲密关系",
        "report": {"案例类别": ["离婚适应"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "离婚之后我觉得是不是自己的问题，再也不敢相信别人了..."},
        ],
    },
    # ── general / advanced ──
    {
        "age": "38", "gender": "男", "occupation": "自由职业者",
        "marital_status": "已婚", "symptoms": "自杀念头;重度抑郁;失眠;酗酒;家庭暴力受害",
        "group_tag": "general", "difficulty": "advanced",
        "issue_tags": "抑郁,睡眠障碍",
        "report": {"案例类别": ["危机干预"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "我有时候觉得不想活了...但又不想让孩子没有爸爸..."},
        ],
    },
    {
        "age": "24", "gender": "女", "occupation": "大学生",
        "marital_status": "未婚", "symptoms": "创伤后应激;噩梦;惊恐发作;回避行为",
        "group_tag": "college", "difficulty": "advanced",
        "issue_tags": "焦虑",
        "report": {"案例类别": ["创伤"]},
        "portrait_raw": {},
        "conversation": [
            {"role": "seeker", "content": "那件事过去一年了，但我还是经常做噩梦，突然会心跳加速..."},
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
