"""
Scale Filling — 心理量表填写模块
Adapted from AnnaAgent fill_scales.py + short_term_memory.py

Fills BDI, GHQ-28, SASS scales and summarizes changes.
"""

import json
import re
from pathlib import Path
from app.core.llm import llm_chat_text

SCALES_DIR = Path(__file__).parent.parent.parent.parent.parent / "data" / "scales"


def _load_scale(name: str) -> dict:
    """Load a scale JSON file."""
    path = SCALES_DIR / f"{name}.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _extract_answers(text: str, expected_count: int) -> list[str]:
    """Extract A/B/C/D answers from LLM response."""
    answers = []
    for i in range(1, expected_count + 1):
        patterns = [
            rf"{i}\.\s*(A|B|C|D)",
            rf"{i}：\s*(A|B|C|D)",
            rf"{i}:\s*(A|B|C|D)",
            rf"问题{i}[\.。:]?\s*(A|B|C|D)",
            rf"{i}[、]\s*(A|B|C|D)",
        ]
        found = False
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                answers.append(match.group(1))
                found = True
                break
        if not found:
            answers.append(None)
    
    # Fill gaps with simple extraction
    if None in answers:
        all_options = re.findall(r'(A|B|C|D)', text)
        j = 0
        for i in range(len(answers)):
            if answers[i] is None and j < len(all_options):
                answers[i] = all_options[j]
                j += 1
    
    return [a or "A" for a in answers]


async def _fill_single_scale(scale_name: str, scale_data: dict, system_prompt: str) -> list[str]:
    """Fill a single scale based on the patient's system prompt."""
    questions = scale_data.get("questions", scale_data.get("items", []))
    if not questions:
        return []
    
    questions_text = "\n".join(
        f"{i+1}. {q.get('question', q.get('content', str(q)))}"
        for i, q in enumerate(questions) if isinstance(q, dict)
    )
    if not questions_text:
        questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions))
    
    instruction = f"""### 任务
你扮演以下角色，请根据你的状况如实回答量表中的每道题。

### 角色设定
{system_prompt}

### {scale_name} 量表
{questions_text}

请按照以下格式逐题回答（每题选A/B/C/D之一）：
1. A
2. B
...
"""
    
    response_text = await llm_chat_text(
        messages=[{"role": "user", "content": instruction}],
        temperature=0,
        max_tokens=2048,
    )
    
    count = len(questions) if isinstance(questions, list) else 0
    return _extract_answers(response_text, count)


async def fill_scales(system_prompt: str) -> tuple:
    """Fill BDI, GHQ-28, SASS scales for current session."""
    bdi_scale = _load_scale("bdi")
    ghq_scale = _load_scale("ghq-28")
    sass_scale = _load_scale("sass")
    
    bdi = await _fill_single_scale("BDI", bdi_scale, system_prompt)
    ghq = await _fill_single_scale("GHQ-28", ghq_scale, system_prompt)
    sass = await _fill_single_scale("SASS", sass_scale, system_prompt)
    
    return bdi, ghq, sass


async def fill_scales_previous(portrait: dict, report: dict) -> tuple:
    """Fill scales for previous session context."""
    profile_text = (
        f"性别: {portrait['gender']}, 年龄: {portrait['age']}, "
        f"职业: {portrait['occupation']}, 婚姻: {portrait['marital_status']}, "
        f"症状: {portrait['symptoms']}"
    )
    report_text = json.dumps(report, ensure_ascii=False, indent=2)[:2000]
    
    system_prompt = f"患者基本信息：{profile_text}\n案例报告：{report_text}"
    return await fill_scales(system_prompt)


async def summarize_scale_changes(scales: dict) -> str:
    """Summarize changes between previous and current scale scores."""
    summary_lines = []
    for prefix, label in [("bdi", "BDI 抑郁"), ("ghq", "GHQ-28 健康"), ("sass", "SASS 社交")]:
        prev = scales.get(f"p_{prefix}", [])
        curr = scales.get(prefix, [])
        if prev and curr:
            summary_lines.append(f"{label}量表：之前 {len(prev)} 题，当前 {len(curr)} 题")
    
    if not summary_lines:
        return "暂无量表变化数据"
    
    instruction = f"""### 任务
根据以下量表填写结果的变化，分析患者近期的心理状态变化趋势。

### 量表数据
{chr(10).join(summary_lines)}

之前量表结果: {json.dumps({k: v for k, v in scales.items() if k.startswith('p_')}, ensure_ascii=False)}
当前量表结果: {json.dumps({k: v for k, v in scales.items() if not k.startswith('p_')}, ensure_ascii=False)}

请用2-3句话总结患者的近期状态变化。
"""
    
    return await llm_chat_text(
        messages=[{"role": "user", "content": instruction}],
        temperature=0.3,
        max_tokens=256,
    )
