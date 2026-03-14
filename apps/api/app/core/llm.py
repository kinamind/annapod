"""MindBridge API - Shared LLM client (OpenAI-compatible)."""

import asyncio
from openai import AsyncOpenAI, RateLimitError, APIError
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
    max_tokens: int | None = None,
    tools: list[dict] | None = None,
    tool_choice: dict | str | None = None,
) -> str:
    """Utility: single LLM chat completion call, return content text."""
    client = get_llm_client()
    kwargs = {
        "model": model or settings.LLM_MODEL,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if tools:
        kwargs["tools"] = tools
    if tool_choice:
        kwargs["tool_choice"] = tool_choice
        
    max_retries = 4
    for attempt in range(max_retries):
        try:
            response = await client.chat.completions.create(**kwargs)
            return response.choices[0].message
        except (RateLimitError, APIError) as e:
            if attempt == max_retries - 1:
                raise e
            # Log issue and backoff
            await asyncio.sleep(2 ** attempt)



async def llm_chat_text(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
) -> str:
    """Utility: single LLM chat completion call, return plain text."""
    msg = await llm_chat(messages, model, temperature, max_tokens)
    return msg.content or ""
