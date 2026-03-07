"""
Performance Evaluator — 心理辅导员表现评估系统

Evaluation Framework (研究驱动设计):
Based on common counseling competency frameworks:
- Hill's Helping Skills Model
- Counseling Competencies Scale (CCS)
- Adapted for Chinese counseling context

8 core dimensions:
1. 共情能力 (Empathy) — 理解和反映来访者情感
2. 积极倾听 (Active Listening) — 关注、回应、不打断
3. 提问技巧 (Questioning) — 开放式问题使用、探索深度
4. 情感反映 (Reflection of Feeling) — 准确识别和命名情绪
5. 面质技术 (Confrontation) — 适时指出矛盾、温和挑战
6. 目标设定 (Goal Setting) — 合作性设定改变目标
7. 危机处理 (Crisis Handling) — 风险评估、安全规划
8. 理论应用 (Theoretical Application) — 技术使用的恰当性
"""

import json
from app.core.llm import llm_chat_text

EVALUATION_DIMENSIONS = {
    "empathy": {"label": "共情能力", "description": "理解和反映来访者内心感受的能力"},
    "active_listening": {"label": "积极倾听", "description": "关注来访者表达、适时回应、不打断的能力"},
    "questioning": {"label": "提问技巧", "description": "使用开放式问题探索来访者内心世界的能力"},
    "reflection": {"label": "情感反映", "description": "准确识别和命名来访者情绪的能力"},
    "confrontation": {"label": "面质技术", "description": "适时指出矛盾、温和挑战防御机制的能力"},
    "goal_setting": {"label": "目标设定", "description": "与来访者合作性地设定治疗目标的能力"},
    "crisis_handling": {"label": "危机处理", "description": "评估风险、制定安全计划的能力"},
    "theoretical_application": {"label": "理论应用", "description": "恰当运用咨询理论和技术的能力"},
}


async def evaluate_session(
    conversation: list[dict],
    profile_info: str,
    difficulty: str = "intermediate",
) -> dict:
    """
    Evaluate a counseling session and return structured performance data.
    
    Returns:
        dict with keys: overall_score, dimension_scores, mistakes, strengths, feedback, tips
    """
    dialogue = "\n".join(
        f"{'咨询师' if msg['role'] == 'Counselor' else '来访者'}: {msg['content']}"
        for msg in conversation
    )
    
    dimensions_desc = "\n".join(
        f"- {info['label']}({key}): {info['description']}"
        for key, info in EVALUATION_DIMENSIONS.items()
    )
    
    prompt = f"""### 任务
你是一位资深心理咨询督导师，请对以下咨询对话中咨询师的表现进行专业评估。

### 评估维度
{dimensions_desc}

### 来访者背景
{profile_info}

### 难度级别
{difficulty}

### 咨询对话
{dialogue}

### 输出要求
请严格按照以下JSON格式输出评估结果：
{{
  "overall_score": <0-100的整数>,
  "dimension_scores": {{
    "empathy": <0-100>,
    "active_listening": <0-100>,
    "questioning": <0-100>,
    "reflection": <0-100>,
    "confrontation": <0-100>,
    "goal_setting": <0-100>,
    "crisis_handling": <0-100>,
    "theoretical_application": <0-100>
  }},
  "mistakes": [
    {{
      "type": "<维度key>",
      "description": "<具体问题描述>",
      "severity": "<low/medium/high>",
      "suggestion": "<改进建议>",
      "conversation_turn": <对话轮次数>
    }}
  ],
  "strengths": [
    "<表现好的方面>"
  ],
  "feedback": "<整体反馈，200字以内>",
  "tips": [
    "<具体可执行的改进建议>"
  ]
}}

只输出JSON，不要其他内容。
"""
    
    response_text = await llm_chat_text(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=2048,
    )
    
    try:
        # Try to extract JSON from response
        # Handle cases where LLM wraps it in markdown code blocks
        text = response_text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text.strip())
        return result
    except (json.JSONDecodeError, IndexError):
        # Fallback evaluation
        return {
            "overall_score": 50,
            "dimension_scores": {k: 50 for k in EVALUATION_DIMENSIONS},
            "mistakes": [],
            "strengths": ["完成了咨询对话"],
            "feedback": "评估生成出现技术问题，请重试。",
            "tips": ["建议回顾本次对话并进行自我反思。"],
        }
