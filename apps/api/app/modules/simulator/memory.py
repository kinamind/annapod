"""Long-term Memory — AnnaAgent-style gated retrieval with vector search."""

import asyncio
import json
import re
from urllib.request import Request, urlopen

from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.config import get_settings
from app.core.llm import llm_chat_text
from app.models.memory import LongTermMemoryChunk

settings = get_settings()


def _extract_boolean(text: str) -> bool:
    """Extract boolean from LLM response text."""
    text_lower = text.lower()

    negative_patterns = [
        r"不需要",
        r"没有提及",
        r"不涉及",
        r"没有涉及",
        r"无关",
        r"没有提到",
        r"不是",
        r"否",
        r"不包含",
        r"未提及",
        r"未涉及",
        r"未提到",
        r"不包括",
        r"并未",
        r"没有",
        r"无",
    ]
    for pattern in negative_patterns:
        if re.search(pattern, text_lower):
            return False

    positive_patterns = [
        r"是的",
        r"提及了",
        r"确实",
        r"有提到",
        r"涉及到",
        r"提及",
        r"确认",
        r"有关联",
        r"有联系",
        r"包含",
        r"涉及",
    ]
    for pattern in positive_patterns:
        if re.search(pattern, text_lower):
            return True

    therapy_mention = re.search(r"(之前|以前|上次|过去|先前).*?(疗程|治疗|会话)", text_lower)
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


def _embed_text_sync(text: str) -> list[float]:
    """Embed text via the configured embedding provider."""
    api_key = settings.EMBEDDING_API_KEY or settings.LLM_API_KEY
    base_url = settings.EMBEDDING_BASE_URL or settings.LLM_BASE_URL
    provider = settings.EMBEDDING_PROVIDER.lower()

    if not api_key:
        return []

    if provider == "google":
        endpoint = f"{base_url}/models/{settings.EMBEDDING_MODEL}:embedContent?key={api_key}"
        payload = {
            "model": f"models/{settings.EMBEDDING_MODEL}",
            "content": {
                "parts": [{"text": text[:4000]}],
            },
        }

        req = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        values = data.get("embedding", {}).get("values", [])
        return [float(v) for v in values]

    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.embeddings.create(
        model=settings.EMBEDDING_MODEL,
        input=text[:4000],
    )
    return [float(v) for v in response.data[0].embedding]


async def embed_text(text: str) -> list[float]:
    return await asyncio.to_thread(_embed_text_sync, text)


async def index_long_term_memory(
    db: AsyncSession,
    user_id: str,
    profile_id: str,
    session_id: str,
    messages: list[dict],
) -> int:
    """Index this session's messages into vector store (long-term mode only)."""
    inserted = 0
    for idx, m in enumerate(messages):
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue

        vec = await embed_text(content)
        if not vec:
            continue

        db.add(
            LongTermMemoryChunk(
                user_id=user_id,
                profile_id=profile_id,
                session_id=session_id,
                turn_index=idx,
                role=role,
                content=content,
                embedding=vec,
            )
        )
        inserted += 1

    return inserted


async def query_long_term_memory(
    utterance: str,
    db: AsyncSession,
    user_id: str,
    profile_id: str,
    report: dict,
    top_k: int = 6,
) -> str:
    """Retrieve relevant long-term memory chunks from vector DB and summarize."""
    query_vec = await embed_text(utterance)
    if not query_vec:
        return ""

    stmt = (
        select(LongTermMemoryChunk)
        .where(
            LongTermMemoryChunk.user_id == user_id,
            LongTermMemoryChunk.profile_id == profile_id,
        )
        .order_by(LongTermMemoryChunk.embedding.cosine_distance(query_vec))
        .limit(top_k)
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return ""

    dialogue_history = "\n".join(f"{r.role}: {r.content}" for r in rows)
    report_str = "\n".join(f"{k}: {v}" for k, v in report.items() if isinstance(v, str))
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
