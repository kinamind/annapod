"""
ProfileManager — 来访者档案管理
Handles:
- Loading profiles from HuggingFace dataset (Anna-CPsyCounD)
- Profile categorization by age/demographics
- Profile search and filtering
"""

from typing import Optional


# Group classification rules
GROUP_RULES = {
    "elderly": {"label": "银发群体", "description": "65岁以上的老年来访者", "age_min": 65},
    "adolescent": {"label": "青少年", "description": "18岁以下的青少年来访者", "age_max": 18},
    "college": {"label": "大学生", "description": "18-25岁学生群体", "age_min": 18, "age_max": 25, "occupations": ["学生", "大学生", "研究生"]},
    "female": {"label": "女性", "description": "女性来访者专项训练", "gender": "女"},
    "workplace": {"label": "职场人群", "description": "职场压力相关", "age_min": 22, "age_max": 60},
    "family": {"label": "家庭关系", "description": "婚姻/家庭关系相关"},
    "general": {"label": "综合训练", "description": "综合性咨询训练"},
}


def classify_profile_group(portrait: dict) -> str:
    """Classify a seeker profile into a training group based on demographics."""
    age = int(portrait.get("age", 30))
    gender = portrait.get("gender", "")
    occupation = portrait.get("occupation", "")
    symptoms = portrait.get("symptoms", "")
    marital_status = portrait.get("marital_status", "")
    
    # Priority classification
    if age < 18:
        return "adolescent"
    if age >= 65:
        return "elderly"
    if occupation in ["学生", "大学生", "研究生"] or (18 <= age <= 25 and "学" in occupation):
        return "college"
    
    # Keyword-based classification
    family_keywords = ["婚姻", "家庭", "离婚", "已婚", "夫妻", "丈夫", "妻子", "配偶"]
    if any(kw in symptoms or kw in marital_status for kw in family_keywords):
        return "family"
    
    workplace_keywords = ["工作", "职场", "同事", "上司", "职业", "加班"]
    if any(kw in symptoms for kw in workplace_keywords):
        return "workplace"
    
    if gender == "女":
        return "female"
    
    return "general"


def classify_difficulty(portrait: dict, report: dict) -> str:
    """Classify session difficulty based on symptom severity indicators."""
    symptoms = portrait.get("symptoms", "")
    
    # High-risk indicators -> advanced
    high_risk = ["自杀", "自残", "自伤", "危机", "幻觉", "妄想", "创伤", "暴力"]
    if any(kw in symptoms for kw in high_risk):
        return "advanced"
    
    # Moderate complexity -> intermediate
    moderate = ["抑郁", "焦虑", "失眠", "恐惧", "强迫", "躯体化", "进食"]
    if any(kw in symptoms for kw in moderate):
        return "intermediate"
    
    return "beginner"


def classify_issues(portrait: dict, report: dict) -> list[str]:
    """Extract issue tags from profile."""
    symptoms = portrait.get("symptoms", "")
    categories = report.get("案例类别", [])
    
    issues = set()
    
    # From report categories
    for cat in categories:
        issues.add(cat)
    
    # From symptoms keyword matching
    issue_keywords = {
        "抑郁": ["抑郁", "消沉", "无望", "悲伤"],
        "焦虑": ["焦虑", "紧张", "恐惧", "担心"],
        "亲密关系": ["婚姻", "恋爱", "伴侣", "配偶"],
        "家庭冲突": ["家庭", "父母", "离婚", "子女"],
        "职场压力": ["工作", "职场", "同事", "领导"],
        "睡眠障碍": ["失眠", "睡眠", "噩梦"],
        "躯体化症状": ["胸闷", "头痛", "疼痛", "身体"],
        "自我认同": ["自信", "价值", "认同", "自我"],
    }
    
    for issue, keywords in issue_keywords.items():
        if any(kw in symptoms for kw in keywords):
            issues.add(issue)
    
    return list(issues) if issues else ["个人成长"]


class ProfileManager:
    """Manages seeker profiles with classification and filtering."""
    
    @staticmethod
    def classify(portrait: dict, report: dict) -> dict:
        """Classify a profile and return group/difficulty/issues."""
        return {
            "group_tag": classify_profile_group(portrait),
            "difficulty": classify_difficulty(portrait, report),
            "issue_tags": ",".join(classify_issues(portrait, report)),
        }
    
    @staticmethod
    def get_group_options() -> list[dict]:
        """Return available group options for UI selection."""
        return [
            {"key": key, **info}
            for key, info in GROUP_RULES.items()
        ]
