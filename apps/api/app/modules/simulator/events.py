"""
Event Trigger — 近期事件生成模块
Adapted from AnnaAgent event_trigger.py
"""

import random
import re
from pathlib import Path
from app.core.llm import llm_chat_text

# Teen-specific events
TEEN_EVENTS = [
    "在一次重要的考试中表现不佳，比如期末考试、升学考试（如中考或高考），导致自信心受挫。",
    "在学校里被同龄人孤立、嘲笑或遭受言语/身体上的霸凌，感到孤独无助。",
    "父母关系破裂并最终离婚，需要适应新的家庭环境，感到不安或缺乏安全感。",
    "陪伴多年的宠物突然生病或意外去世，第一次直面死亡的悲伤。",
    "因为家庭原因搬到了一个陌生的城市或学校，需要重新适应新环境和结交朋友。",
    "进入青春期后，身体发生明显变化（如长高、变声、月经初潮等），心理上也开始对自我形象产生困惑。",
    "参加一场期待已久的竞赛（如体育比赛、演讲比赛、艺术表演）但未能取得好成绩，感到失落。",
    "与最亲密的朋友发生争执甚至决裂，短时间内难以修复关系，陷入情绪低谷。",
    "家里的经济状况出现问题（如父母失业或生意失败），影响到日常生活。",
    "偶然间发现自己特别喜欢某件事情（如画画、编程、音乐、运动），并投入大量时间去练习。",
]

# CBT triggering events will be loaded from CSV
_events_df = None


def _load_events():
    """Lazy-load the CBT triggering events CSV."""
    global _events_df
    if _events_df is None:
        import pandas as pd
        events_path = Path(__file__).parent.parent.parent.parent.parent / "data" / "scales" / "cbt-triggering-events.csv"
        if events_path.exists():
            _events_df = pd.read_csv(events_path, header=0)
        else:
            # Fallback: use an empty frame
            _events_df = pd.DataFrame(columns=["Age", "Triggering_Event"])
    return _events_df


def event_trigger(profile: dict) -> str:
    """Select a triggering event based on age group."""
    age = int(profile['age'])
    
    if age < 18:
        return random.choice(TEEN_EVENTS)
    
    events = _load_events()
    if events.empty:
        return random.choice(TEEN_EVENTS)  # fallback
    
    if age >= 65:
        filtered = events[events['Age'] >= 60]
    else:
        filtered = events[(events['Age'] >= age - 5) & (events['Age'] <= age + 5)]
    
    if filtered.empty:
        filtered = events  # fallback to all events
    
    return filtered.sample(1)['Triggering_Event'].values[0]


async def situationalise_events(profile: dict) -> str:
    """Generate a situational description from a triggering event."""
    event = event_trigger(profile)
    
    prompt = f"""### 情境生成任务
请根据以下事件生成一个第二人称视角的情境描述。

### 规则要求
1. 必须使用第二人称(你/你的)
2. 不要包含任何个人信息(年龄/性别等)
3. 保持3-5句话的篇幅
4. 直接输出情境描述，不要额外解释

### 触发事件
{event}

### 示例输出
你走进办公室时发现同事们突然停止交谈。桌上放着一封未拆的信件，周围人投来复杂的目光。
"""
    
    raw_output = await llm_chat_text(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8,
        max_tokens=150,
    )
    
    situation = re.sub(r'^(情境|描述|输出)[:：]?\s*', '', raw_output)
    situation = situation.split('\n')[0]
    return situation
