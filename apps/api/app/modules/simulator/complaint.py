"""
Complaint Chain — 主诉认知变化链生成与切换
Adapted from AnnaAgent complaint_chain_fc.py + complaint_elicitor.py

Uses LLM API instead of fine-tuned complaint model.
"""

import json
import re
from app.core.llm import llm_chat, llm_chat_text

COMPLAINT_CHAIN_TOOL = {
    "type": "function",
    "function": {
        "name": "generate_complaint_chain",
        "description": "根据角色信息和近期遭遇的事件，生成一个患者的主诉请求认知变化链",
        "parameters": {
            "type": "object",
            "properties": {
                "chain": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "stage": {"type": "integer"},
                            "content": {"type": "string"}
                        },
                        "required": ["stage", "content"]
                    },
                    "minItems": 3,
                    "maxItems": 7
                }
            },
            "required": ["chain"]
        },
    }
}


async def gen_complaint_chain(profile: dict, event: str) -> list[dict]:
    """Generate complaint cognitive change chain using LLM."""
    patient_info = (
        f"### 患者信息\n年龄：{profile['age']}\n性别：{profile['gender']}\n"
        f"职业：{profile['occupation']}\n婚姻状况：{profile['marital_status']}\n"
        f"症状：{profile['symptoms']}"
    )
    
    msg = await llm_chat(
        messages=[{
            "role": "user",
            "content": (
                f"### 任务\n根据患者情况及近期遭遇事件生成患者的主诉认知变化链。"
                f"请注意，事件可能与患者信息冲突，如果发生这种情况，以患者的信息为准。\n"
                f"{patient_info}\n### 近期遭遇事件\n{event}"
            )
        }],
        tools=[COMPLAINT_CHAIN_TOOL],
        tool_choice={"type": "function", "function": {"name": "generate_complaint_chain"}},
        temperature=0.5,
    )
    
    try:
        chain = json.loads(msg.tool_calls[0].function.arguments)["chain"]
    except (TypeError, AttributeError, IndexError, KeyError, json.JSONDecodeError):
        # Fallback: generate a simple 3-stage chain
        chain = [
            {"stage": 1, "content": "初步表达不适感受"},
            {"stage": 2, "content": "深入探讨核心困扰"},
            {"stage": 3, "content": "尝试理解和接纳"},
        ]
    
    return chain


def transform_chain(chain: list[dict]) -> dict[int, str]:
    """Transform chain list to {stage: content} dict."""
    return {node["stage"]: node["content"] for node in chain}


async def switch_complaint(
    chain: list[dict],
    current_index: int,
    conversation: list[dict],
    max_retries: int = 3,
) -> int:
    """Determine if current complaint stage is resolved, advance if so."""
    transformed = transform_chain(chain)
    if current_index not in transformed:
        return current_index
    
    dialogue_history = "\n".join(
        f"{conv['role']}: {conv['content']}" for conv in conversation
    )
    
    prompt = f"""### 任务说明
根据患者情况及咨访对话历史记录，判断患者当前阶段的主诉问题是否已经得到解决。

### 输出要求
必须严格使用以下JSON格式响应，且只包含指定字段：
{{"is_recognized": true/false}}

### 对话记录
{dialogue_history}

### 主诉认知链
{json.dumps(transformed, ensure_ascii=False, indent=2)}

### 当前阶段（阶段{current_index}）
{transformed[current_index]}
"""
    
    for _ in range(max_retries):
        response_text = await llm_chat_text(
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        
        try:
            result = json.loads(response_text.strip())
            if "is_recognized" in result:
                return current_index + 1 if result["is_recognized"] else current_index
        except json.JSONDecodeError:
            pass
        
        match = re.search(
            r'"is_recognized"\s*:\s*(true|false)|is_recognized\s*:\s*(true|false)',
            response_text, re.IGNORECASE
        )
        if match:
            value = (match.group(1) or match.group(2)).lower()
            return current_index + 1 if value == "true" else current_index
    
    return current_index
