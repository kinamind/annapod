"""
Data Loading Script — 加载 Anna-CPsyCounD 数据集到数据库

Usage:
    cd apps/api
    uv run python -m scripts.load_profiles
"""

import asyncio
import json
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datasets import load_dataset
from sqlmodel import select
from app.core.database import engine, async_session, init_db
from app.models.seeker import SeekerProfile
from app.modules.simulator.profile_manager import ProfileManager


async def load_from_huggingface():
    """Load profiles from HuggingFace datasets."""
    print("Loading Anna-CPsyCounD dataset from HuggingFace...")
    ds = load_dataset("sci-m-wang/Anna-CPsyCounD", split="train")
    print(f"Loaded {len(ds)} profiles.")
    
    await init_db()
    
    async with async_session() as session:
        # Check existing count
        from sqlalchemy import func
        existing_count = (await session.execute(
            select(func.count()).select_from(SeekerProfile)
        )).scalar() or 0
        
        if existing_count > 0:
            print(f"Database already has {existing_count} profiles. Skipping import.")
            print("To re-import, clear the seeker_profiles table first.")
            return
        
        loaded = 0
        for item in ds:
            portrait = item.get("portrait", {})
            if isinstance(portrait, str):
                portrait = json.loads(portrait)
            
            report = item.get("report", {})
            if isinstance(report, str):
                report = json.loads(report)
            
            conversation = item.get("conversation", [])
            if isinstance(conversation, str):
                conversation = json.loads(conversation)
            
            # Classify profile
            classification = ProfileManager.classify(portrait, report)
            
            profile = SeekerProfile(
                age=portrait.get("age", "30"),
                gender=portrait.get("gender", "未知"),
                occupation=portrait.get("occupation", "未知"),
                marital_status=portrait.get("marital_status", "未知"),
                symptoms=portrait.get("symptoms", ""),
                group_tag=classification["group_tag"],
                difficulty=classification["difficulty"],
                issue_tags=classification["issue_tags"],
                report=report,
                conversation=conversation,
                portrait_raw=portrait,
                source_id=item.get("id", ""),
            )
            session.add(profile)
            loaded += 1
            
            if loaded % 100 == 0:
                print(f"  Loaded {loaded} profiles...")
                await session.commit()
        
        await session.commit()
        print(f"Successfully loaded {loaded} profiles into database.")
        
        # Print group distribution
        for group_key in ["elderly", "adolescent", "college", "female", "workplace", "family", "general"]:
            count = (await session.execute(
                select(func.count()).select_from(SeekerProfile).where(SeekerProfile.group_tag == group_key)
            )).scalar() or 0
            print(f"  {group_key}: {count}")


async def load_from_local(path: str):
    """Load profiles from local JSON file."""
    print(f"Loading profiles from {path}...")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if isinstance(data, list):
        items = data
    else:
        items = [data]
    
    print(f"Found {len(items)} profiles.")
    await init_db()
    
    async with async_session() as session:
        for item in items:
            portrait = item.get("portrait", {})
            report = item.get("report", {})
            conversation = item.get("conversation", [])
            
            classification = ProfileManager.classify(portrait, report)
            
            profile = SeekerProfile(
                age=portrait.get("age", "30"),
                gender=portrait.get("gender", "未知"),
                occupation=portrait.get("occupation", "未知"),
                marital_status=portrait.get("marital_status", "未知"),
                symptoms=portrait.get("symptoms", ""),
                group_tag=classification["group_tag"],
                difficulty=classification["difficulty"],
                issue_tags=classification["issue_tags"],
                report=report,
                conversation=conversation,
                portrait_raw=portrait,
                source_id=item.get("id", ""),
            )
            session.add(profile)
        
        await session.commit()
        print(f"Loaded {len(items)} profiles.")


async def seed_knowledge():
    """Seed the knowledge base with starter data."""
    from app.models.knowledge import KnowledgeItem
    from app.modules.knowledge.seed_data import SEED_KNOWLEDGE
    
    await init_db()
    
    async with async_session() as session:
        from sqlalchemy import func
        existing = (await session.execute(
            select(func.count()).select_from(KnowledgeItem)
        )).scalar() or 0
        
        if existing > 0:
            print(f"Knowledge base already has {existing} items. Skipping seed.")
            return
        
        for item_data in SEED_KNOWLEDGE:
            item = KnowledgeItem(**item_data)
            session.add(item)
        
        await session.commit()
        print(f"Seeded {len(SEED_KNOWLEDGE)} knowledge items.")


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Load data into MindBridge database")
    parser.add_argument("--source", choices=["huggingface", "local"], default="huggingface")
    parser.add_argument("--path", type=str, help="Path to local JSON file")
    parser.add_argument("--seed-knowledge", action="store_true", help="Also seed knowledge base")
    args = parser.parse_args()
    
    if args.source == "huggingface":
        await load_from_huggingface()
    elif args.source == "local" and args.path:
        await load_from_local(args.path)
    
    if args.seed_knowledge:
        await seed_knowledge()


if __name__ == "__main__":
    asyncio.run(main())
