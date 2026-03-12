"""
Emotion Modulation — 情绪推理与扰动模块
Adapted from AnnaAgent emotion_modulator_fc.py + emotion_pertuber.py

Uses LLM API instead of fine-tuned emotion model.
"""

import json
import random
from app.core.llm import llm_chat

# GoEmotions 27 emotion categories
EMOTIONS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval",
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief",
    "joy", "love", "nervousness", "optimism", "pride", "realization",
    "relief", "remorse", "sadness", "surprise", "neutral"
]

EMOTION_TOOL = {
    "type": "function",
    "function": {
        "name": "emotion_inference",
        "description": "根据profile和对话记录，推理下一句情绪",
        "parameters": {
            "type": "object",
            "properties": {
                "emotion": {
                    "type": "string",
                    "enum": EMOTIONS,
                    "description": "推理出的情绪类别，必须是GoEmotions定义的27种情绪之一。"
                }
            },
            "required": ["emotion"]
        },
    }
}

# Emotion perturbation categories and distances
EMOTION_CATEGORIES = {
    "Positive": [
        "admiration", "amusement", "approval", "caring", "curiosity",
        "desire", "excitement", "gratitude", "joy", "love",
        "optimism", "pride", "realization", "relief"
    ],
    "Negative": [
        "anger", "annoyance", "disappointment", "disapproval",
        "disgust", "embarrassment", "fear", "grief",
        "nervousness", "remorse", "sadness"
    ],
    "Ambiguous": ["confusion", "surprise"],
    "Neutral": ["neutral"]
}

CATEGORY_DISTANCES = {
    "Positive":  {"Positive": 0, "Ambiguous": 1, "Neutral": 2, "Negative": 3},
    "Negative":  {"Negative": 0, "Ambiguous": 1, "Neutral": 2, "Positive": 3},
    "Ambiguous": {"Ambiguous": 0, "Positive": 1, "Negative": 1, "Neutral": 1},
    "Neutral":   {"Neutral": 0, "Ambiguous": 1, "Positive": 2, "Negative": 2},
}

DISTANCE_WEIGHTS = {0: 5, 1: 3, 2: 1, 3: 0.5}


def _get_emotion_category(emotion: str) -> str:
    for cat, emotions in EMOTION_CATEGORIES.items():
        if emotion in emotions:
            return cat
    return "Neutral"


def perturb_state(current_emotion: str) -> str:
    """Perturb an emotion state based on category distance weights."""
    current_cat = _get_emotion_category(current_emotion)
    probabilities = {}
    total_weight = 0.0
    
    for cat, emotions in EMOTION_CATEGORIES.items():
        distance = CATEGORY_DISTANCES[current_cat][cat]
        weight = DISTANCE_WEIGHTS.get(distance, 0)
        for e in emotions:
            if e != current_emotion:
                probabilities[e] = weight
                total_weight += weight
    
    if total_weight == 0:
        return current_emotion
    
    # Normalize and sample
    rand_val = random.random() * total_weight
    cumulative = 0.0
    for e, w in probabilities.items():
        cumulative += w
        if rand_val <= cumulative:
            return e
    return current_emotion


async def emotion_inference(profile: dict, conversation: list[dict]) -> str:
    """Infer the next emotion using LLM with function calling."""
    patient_info = (
        f"### 患者信息\n"
        f"年龄：{profile['age']}\n性别：{profile['gender']}\n"
        f"职业：{profile['occupation']}\n婚姻状况：{profile['marital_status']}\n"
        f"症状：{profile['symptoms']}"
    )
    dialogue_history = "\n".join(
        f"{conv['role']}: {conv['content']}" for conv in conversation
    )
    
    msg = await llm_chat(
        messages=[{
            "role": "user",
            "content": f"### 任务\n根据患者情况及咨访对话历史记录推测患者下一句话最可能的情绪。\n{patient_info}\n### 对话记录\n{dialogue_history}"
        }],
        tools=[EMOTION_TOOL],
        tool_choice={"type": "function", "function": {"name": "emotion_inference"}},
        temperature=0.3,
    )
    
    try:
        emotion = json.loads(msg.tool_calls[0].function.arguments)["emotion"]
    except (TypeError, AttributeError, IndexError, KeyError, json.JSONDecodeError):
        emotion = "sadness"  # safe fallback for mental health context
    
    return emotion


async def emotion_modulation(profile: dict, conversation: list[dict]) -> str:
    """Emotion modulation with 10% perturbation chance (original AnnaAgent logic)."""
    emotion = await emotion_inference(profile, conversation)
    if random.randint(0, 100) > 90:
        return perturb_state(emotion)
    return emotion
