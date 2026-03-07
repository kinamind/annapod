"""
MindBridge - Virtual Seeker Simulator Module
Adapted from AnnaAgent (Wang et al., ACL 2025 Findings)

This module implements the core virtual client simulation with:
- 三级记忆结构 (Three-level memory: long-term, short-term, working)
- 动态情绪演化 (Dynamic emotion evolution)
- 主诉认知变化链 (Complaint cognitive change chain)
- 可选长期记忆 (Optional long-term memory toggle)
- Profile 缓存复用 (Profile cache for reuse)
"""

from app.modules.simulator.engine import SimulatorEngine
from app.modules.simulator.emotion import emotion_modulation
from app.modules.simulator.complaint import gen_complaint_chain, switch_complaint, transform_chain
from app.modules.simulator.memory import query_long_term_memory, is_need_long_term_memory
from app.modules.simulator.style import analyze_style
from app.modules.simulator.events import event_trigger, situationalise_events
from app.modules.simulator.scales import fill_scales, fill_scales_previous
from app.modules.simulator.profile_manager import ProfileManager

__all__ = [
    "SimulatorEngine",
    "emotion_modulation",
    "gen_complaint_chain", "switch_complaint", "transform_chain",
    "query_long_term_memory", "is_need_long_term_memory",
    "analyze_style",
    "event_trigger", "situationalise_events",
    "fill_scales", "fill_scales_previous",
    "ProfileManager",
]
