"""
SimulatorEngine — 虚拟来访者模拟核心引擎
Adapted from AnnaAgent ms_patient.py

Main changes from original:
1. Uses Gemini API (via OpenAI-compatible interface) instead of fine-tuned models
2. All methods are async
3. Long-term memory is toggleable (remove Status section from prompt)
4. Supports caching of initialized state for reuse
5. Supports multi-session mode
"""

import random
from typing import Optional

from app.core.llm import get_llm_client, get_settings
from app.modules.simulator.templates import build_system_prompt
from app.modules.simulator.emotion import emotion_modulation
from app.modules.simulator.complaint import gen_complaint_chain, switch_complaint, transform_chain
from app.modules.simulator.memory import query_long_term_memory, is_need_long_term_memory
from app.modules.simulator.style import analyze_style
from app.modules.simulator.events import event_trigger, situationalise_events
from app.modules.simulator.scales import fill_scales, fill_scales_previous, summarize_scale_changes


class SimulatorEngine:
    """
    Core virtual seeker simulation engine.
    
    Lifecycle:
    1. initialize() — build all components (or load from cache)
    2. chat(message) — process counselor input, return seeker response
    3. get_state() — export current state for persistence
    4. load_state(state) — restore from persisted state
    """
    
    def __init__(
        self,
        portrait: dict,
        report: dict,
        previous_conversations: list[dict],
        has_long_term_memory: bool = True,
    ):
        self.portrait = portrait
        self.report = report
        self.previous_conversations = previous_conversations
        self.has_long_term_memory = has_long_term_memory
        
        # Runtime state
        self.configuration: dict = {}
        self.system_prompt: str = ""
        self.complaint_chain: list[dict] = []
        self.chain_index: int = 1
        self.conversation: list[dict] = []  # [{role: Counselor/Seeker, content: str}]
        self.messages: list[dict] = []  # LLM message format [{role: user/assistant, content: str}]
        self.scales: dict = {}
        self.event: str = ""
        self.situation: str = ""
        self.style: list[str] = []
        self.status: str = ""
        
        self._initialized = False
    
    async def initialize(self) -> dict:
        """
        Initialize the simulator engine — builds system prompt, complaint chain, etc.
        Returns the full initialization state for caching.
        """
        # Basic configuration
        self.configuration["gender"] = self.portrait["gender"]
        self.configuration["age"] = self.portrait["age"]
        self.configuration["occupation"] = self.portrait["occupation"]
        self.configuration["marriage"] = self.portrait["marital_status"]
        
        # Generate event and situation
        self.event = event_trigger(self.portrait)
        self.situation = await situationalise_events(self.portrait)
        self.configuration["situation"] = self.situation
        
        # Analyze speaking style
        self.style = await analyze_style(self.portrait, self.previous_conversations)
        self.configuration["style"] = "\n".join(f"- {s}" for s in self.style) if self.style else ""
        
        # Sample example statements
        seeker_utterances = [
            u["content"] for u in self.previous_conversations if u.get("role") == "Seeker"
        ]
        if seeker_utterances:
            sample_count = min(3, len(seeker_utterances))
            self.configuration["statement"] = random.sample(seeker_utterances, sample_count)
        else:
            self.configuration["statement"] = []
        
        # Generate complaint chain
        self.complaint_chain = await gen_complaint_chain(self.portrait, self.event)
        
        # Handle long-term memory components
        if self.has_long_term_memory:
            # Fill previous session scales
            p_bdi, p_ghq, p_sass = await fill_scales_previous(self.portrait, self.report)
            
            # Need a temporary prompt for current scale filling
            self.configuration["status"] = ""
            temp_prompt = build_system_prompt(self.configuration, has_long_term_memory=True)
            
            # Fill current scales
            bdi, ghq, sass = await fill_scales(temp_prompt)
            
            self.scales = {
                "p_bdi": p_bdi, "p_ghq": p_ghq, "p_sass": p_sass,
                "bdi": bdi, "ghq": ghq, "sass": sass,
            }
            
            # Summarize status from scale changes
            self.status = await summarize_scale_changes(self.scales)
            self.configuration["status"] = self.status
        else:
            self.scales = {}
            self.status = ""
        
        # Build final system prompt
        self.system_prompt = build_system_prompt(self.configuration, self.has_long_term_memory)
        self.chain_index = 1
        self._initialized = True
        
        return self.get_state()
    
    def load_from_cache(self, cache: dict):
        """Load engine state from a cached initialization."""
        self.system_prompt = cache["system_prompt"]
        self.complaint_chain = cache["complaint_chain"]
        self.style = cache.get("style", [])
        self.situation = cache.get("situation", "")
        self.status = cache.get("status", "")
        self.event = cache.get("event", "")
        self.scales = cache.get("scales", {})
        self.chain_index = cache.get("chain_index", 1)
        self.conversation = cache.get("conversation", [])
        self.messages = cache.get("messages", [])
        self.has_long_term_memory = cache.get("has_long_term_memory", True)
        self._initialized = True
    
    async def chat(self, counselor_message: str) -> dict:
        """
        Process a counselor message and generate seeker response.
        
        Returns:
            dict with keys: response, emotion, complaint_stage, turn_count
        """
        if not self._initialized:
            raise RuntimeError("SimulatorEngine not initialized. Call initialize() or load_from_cache() first.")
        
        # Update conversation
        self.conversation.append({"role": "Counselor", "content": counselor_message})
        self.messages.append({"role": "user", "content": counselor_message})
        
        # Emotion modulation
        emotion = await emotion_modulation(self.portrait, self.conversation)
        
        # Complaint chain progression
        self.chain_index = await switch_complaint(
            self.complaint_chain, self.chain_index, self.conversation
        )
        transformed = transform_chain(self.complaint_chain)
        complaint = transformed.get(self.chain_index, "表达当前的感受")
        
        # Build reminder with emotion + complaint + optional long-term memory info
        reminder_parts = [f"当前的情绪状态是：{emotion}", f"当前的主诉是：{complaint}"]
        
        # Check if long-term memory query is needed
        if self.has_long_term_memory and self.previous_conversations:
            needs_memory = await is_need_long_term_memory(counselor_message)
            if needs_memory:
                sup_info = await query_long_term_memory(
                    counselor_message, self.previous_conversations, self.report
                )
                reminder_parts.append(f"涉及到之前疗程的信息是：{sup_info}")
        
        reminder = "，".join(reminder_parts)
        
        # Generate response
        settings = get_settings()
        client = get_llm_client()
        
        response = await client.chat.completions.create(
            model=settings.GEMINI_MODEL,
            messages=(
                [{"role": "system", "content": self.system_prompt}]
                + self.messages
                + [{"role": "system", "content": reminder}]
            ),
            temperature=0.7,
            max_tokens=400,
        )
        
        seeker_response = response.choices[0].message.content or ""
        
        # Update conversation
        self.conversation.append({"role": "Seeker", "content": seeker_response})
        self.messages.append({"role": "assistant", "content": seeker_response})
        
        return {
            "response": seeker_response,
            "emotion": emotion,
            "complaint_stage": self.chain_index,
            "turn_count": len(self.conversation) // 2,
        }
    
    def get_state(self) -> dict:
        """Export current engine state for persistence/caching."""
        return {
            "system_prompt": self.system_prompt,
            "complaint_chain": self.complaint_chain,
            "style": self.style,
            "situation": self.situation,
            "status": self.status,
            "event": self.event,
            "scales": self.scales,
            "chain_index": self.chain_index,
            "conversation": self.conversation,
            "messages": self.messages,
            "has_long_term_memory": self.has_long_term_memory,
        }
