"""
Style Analyzer — 说话风格分析模块
Adapted from AnnaAgent style_analyzer.py
"""

import re
from app.core.llm import llm_chat_text


async def analyze_style(profile: dict, conversations: list[dict]) -> list[str]:
    """Analyze the speaking style of the seeker based on profile and conversation history."""
    patient_info = (
        f"### 患者信息\n年龄：{profile['age']}\n性别：{profile['gender']}\n"
        f"职业：{profile['occupation']}\n婚姻状况：{profile['marital_status']}\n"
        f"症状：{profile['symptoms']}"
    )
    dialogue_history = "\n".join(
        f"{conv['role']}: {conv['content']}" for conv in conversations
    )
    
    prompt = f"""### 任务
根据患者情况及咨访对话历史记录分析患者的说话风格。

{patient_info}

### 对话记录
{dialogue_history}

请分析患者的说话风格，最多列出5种风格特点。
请按以下格式输出结果：
说话风格：
1. [风格特点1]
2. [风格特点2]
3. [风格特点3]
...

只需要列出风格特点，不需要解释。
"""
    
    response_text = await llm_chat_text(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )
    
    # Extract style items
    style_items = re.findall(r"\d+\.\s*([^\n]+)", response_text)
    if style_items:
        return style_items[:5]
    
    fallback_items = re.findall(r"(?:^|\n)(?:\d+[\.\)、]|[-•*])\s*([^\n]+)", response_text)
    if fallback_items:
        return fallback_items[:5]
    
    potential_styles = [
        line.strip() for line in response_text.split('\n')
        if line.strip() and not line.startswith('###') and '：' not in line
    ]
    return potential_styles[:5]
