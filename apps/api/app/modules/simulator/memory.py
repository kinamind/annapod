"""
Long-term Memory — 长期记忆查询模块
Adapted from AnnaAgent querier.py

Handles:
- is_need: determine if counselor's utterance refers to previous sessions
- query: retrieve relevant info from previous session history + report
"""

import re
from app.core.llm import llm_chat_text


def _extract_boolean(text: str) -> bool:
    """Extract boolean from LLM response text."""
    text_lower = text.lower()
    
    negative_patterns = [
        r'不需要', r'没有提及', r'不涉及', r'没有涉及', r'无关', r'没有提到',
        r'不是', r'否', r'不包含', r'未提及', r'未涉及', r'未提到',
        r'不包括', r'并未', r'没有', r'无'
    ]
    for pattern in negative_patterns:
        if re.search(pattern, text_lower):
            return False
    
    positive_patterns = [
        r'是的', r'提及了', r'确实', r'有提到', r'涉及到',
        r'提及', r'确认', r'有关联', r'有联系', r'包含', r'涉及'
    ]
    for pattern in positive_patterns:
        if re.search(pattern, text_lower):
            return True
    
    therapy_mention = re.search(r'(之前|以前|上次|过去|先前).*?(疗程|治疗|会话)', text_lower)
    if therapy_mention:
        return True
    
    return False


async def is_need_long_term_memory(utterance: str) -> bool:
    """Determine if counselor's utterance references previous therapy sessions."""
    instruction = f"""### 任务
下面这句话是心理咨询师说的话，请判断它是否提及了之前疗程的内容。

请使用以下确切格式回答:
判断: [是/否]
解释: [简要解释为什么]

### 话语
"{utterance}"
"""
    response_text = await llm_chat_text(
        messages=[{"role": "user", "content": instruction}],
        temperature=0,
    )
    return _extract_boolean(response_text)


async def query_long_term_memory(
    utterance: str,
    previous_conversations: list[dict],
    report: dict,
) -> str:
    """Query previous session data for relevant info about counselor's question."""
    dialogue_history = "\n".join(
        f"{conv['role']}: {conv['content']}" for conv in previous_conversations
    )
    report_str = "\n".join(
        f"{k}: {v}" for k, v in report.items()
        if isinstance(v, str)
    )
    for k, v in report.items():
        if isinstance(v, list):
            report_str += f"\n{k}: " + "; ".join(str(item) for item in v)
    
    instruction = f"""### 任务
根据之前疗程的对话记录和案例报告，回答咨询师的问题或提供相关信息。

### 对话记录
{dialogue_history}

### 案例报告
{report_str}

### 咨询师当前的话
"{utterance}"

请从之前的疗程记录中找到与咨询师当前问题相关的信息，用简要的方式总结出来。
"""
    return await llm_chat_text(
        messages=[{"role": "user", "content": instruction}],
        temperature=0,
        max_tokens=512,
    )
