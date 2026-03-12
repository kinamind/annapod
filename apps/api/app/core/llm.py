"""MindBridge API - Shared LLM client (OpenAI-compatible)."""

from openai import AsyncOpenAI
from app.core.config import get_settings

settings = get_settings()


def get_llm_client() -> AsyncOpenAI:
    """Get an async OpenAI-compatible LLM client."""
    return AsyncOpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
    )


async def llm_chat(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
    tools: list[dict] | None = None,
    tool_choice: dict | str | None = None,
) -> str:
    """Utility: single LLM chat completion call, return content text."""
    client = get_llm_client()
    kwargs = {
        "model": model or settings.LLM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        kwargs["tools"] = tools
    if tool_choice:
        kwargs["tool_choice"] = tool_choice
    
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message


async def llm_chat_text(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> str:
    """Utility: single LLM chat completion call, return plain text."""
    msg = await llm_chat(messages, model, temperature, max_tokens)
    return msg.content or ""
