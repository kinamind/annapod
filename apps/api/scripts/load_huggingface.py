"""
Load seeker profiles from the AnnaAgent (Anna-CPsyCounD) HuggingFace dataset.

Usage:
    cd apps/api
    uv run python scripts/load_huggingface.py [--max N] [--replace]

Options:
    --max N       Maximum number of records to import (default: all)
    --replace     Delete existing profiles before importing

Requires:
    pip install datasets  (or: uv add datasets)
"""

import argparse
import asyncio
import json
import uuid
import re

from datasets import load_dataset
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text, func
from sqlmodel import select

# Allow running as script from apps/api root
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.models.seeker import SeekerProfile

# Import all models so tables are registered
import app.models.user  # noqa
import app.models.seeker  # noqa
import app.models.session  # noqa
import app.models.knowledge  # noqa
import app.models.learning  # noqa
import app.models.memory  # noqa


DATASET_NAME = "sci-m-wang/Anna-CPsyCounD"

# Map common keywords in 案例类别 to group_tag and issue_tags
CATEGORY_TO_GROUP = {
    "学业": "college", "考试": "college", "研究生": "college", "大学": "college",
    "青少年": "adolescent", "中学": "adolescent", "初中": "adolescent", "高中": "adolescent",
    "职场": "workplace", "工作": "workplace", "职业": "workplace",
    "婚姻": "family", "家庭": "family", "亲子": "family", "夫妻": "family",
    "老年": "elderly", "退休": "elderly",
    "女性": "female",
}

CATEGORY_TO_ISSUE = {
    "焦虑": "焦虑", "抑郁": "抑郁", "睡眠": "睡眠障碍", "失眠": "睡眠障碍",
    "社交": "焦虑", "自杀": "危机干预", "危机": "危机干预",
    "关系": "亲密关系", "亲密": "亲密关系", "婚姻": "亲密关系",
    "创伤": "焦虑", "PTSD": "焦虑",
    "自我": "自我认同", "认同": "自我认同",
    "家庭": "家庭冲突", "亲子": "家庭冲突",
    "职场": "职场压力", "倦怠": "职场压力",
}

DIFFICULTY_MAP = {
    "危机干预": "advanced", "自杀": "advanced", "创伤": "advanced",
    "抑郁": "intermediate",
}


def parse_portrait(portrait_str: str) -> dict:
    """Parse the portrait string into a structured dict."""
    result = {"age": "", "gender": "", "occupation": "", "marital_status": "", "symptoms": ""}

    if not portrait_str:
        return result

    # Try JSON first
    if portrait_str.strip().startswith("{"):
        try:
            return json.loads(portrait_str)
        except json.JSONDecodeError:
            pass

    # Parse key-value pairs from text (e.g. "年龄：25岁\n性别：女\n...")
    lines = portrait_str.strip().split("\n")
    for line in lines:
        line = line.strip()
        if "：" in line:
            k, v = line.split("：", 1)
            k, v = k.strip(), v.strip()
            if "年龄" in k or "age" in k.lower():
                result["age"] = re.sub(r"[^\d]", "", v) or v
            elif "性别" in k or "gender" in k.lower():
                result["gender"] = v
            elif "职业" in k or "occupation" in k.lower():
                result["occupation"] = v
            elif "婚" in k or "marital" in k.lower():
                result["marital_status"] = v
            elif "症状" in k or "主诉" in k or "symptom" in k.lower():
                result["symptoms"] = v

    return result


def parse_conversation(conv_data) -> list[dict]:
    """Ensure conversation is a list of {role, content} dicts with correct role capitalization."""
    if isinstance(conv_data, str):
        try:
            conv_data = json.loads(conv_data)
        except json.JSONDecodeError:
            return []

    if not isinstance(conv_data, list):
        return []

    result = []
    for turn in conv_data:
        if isinstance(turn, dict) and "role" in turn and "content" in turn:
            role = turn["role"]
            # Normalize role names to AnnaAgent convention
            if role.lower() in ("seeker", "来访者", "patient", "client"):
                role = "Seeker"
            elif role.lower() in ("counselor", "咨询师", "therapist"):
                role = "Counselor"
            result.append({"role": role, "content": turn["content"]})

    return result


def parse_report(report_data) -> dict:
    """Ensure report is a dict."""
    if isinstance(report_data, str):
        try:
            return json.loads(report_data)
        except json.JSONDecodeError:
            return {}
    if isinstance(report_data, dict):
        return report_data
    return {}


def infer_metadata(portrait: dict, report: dict, conversation: list[dict]) -> tuple[str, str, str]:
    """Infer group_tag, difficulty, issue_tags from content."""
    text_blob = json.dumps(portrait, ensure_ascii=False) + json.dumps(report, ensure_ascii=False)

    # Group tag
    group_tag = "general"
    for keyword, group in CATEGORY_TO_GROUP.items():
        if keyword in text_blob:
            group_tag = group
            break

    # Issue tags
    issues = set()
    for keyword, issue in CATEGORY_TO_ISSUE.items():
        if keyword in text_blob:
            issues.add(issue)
    issue_tags = ",".join(issues) if issues else "一般心理问题"

    # Difficulty
    difficulty = "beginner"
    for keyword, diff in DIFFICULTY_MAP.items():
        if keyword in text_blob:
            difficulty = diff
            break
    if len(conversation) > 15:
        difficulty = max(difficulty, "intermediate", key=["beginner", "intermediate", "advanced"].index)

    return group_tag, difficulty, issue_tags


async def load_from_huggingface(max_records: int | None = None, replace: bool = False):
    """Load Anna-CPsyCounD dataset and insert into the database."""
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print(f"Loading dataset from HuggingFace: {DATASET_NAME} ...")
    ds = load_dataset(DATASET_NAME, split="train")
    total = len(ds)
    print(f"Dataset has {total} records")

    if max_records:
        ds = ds.select(range(min(max_records, total)))
        print(f"Will import {len(ds)} records")

    async with Session() as session:
        if replace:
            await session.execute(text("DELETE FROM seeker_profile_caches"))
            await session.execute(text("DELETE FROM counseling_sessions"))
            await session.execute(text("DELETE FROM session_groups"))
            await session.execute(text("DELETE FROM seeker_profiles"))
            await session.commit()
            print("Cleared existing profiles")

        existing_source_ids: set[str] = set()
        if not replace:
            existing_rows = await session.execute(select(SeekerProfile.source_id))
            existing_source_ids = {sid for sid in existing_rows.scalars().all() if sid}

        count = 0
        skipped = 0
        for i, record in enumerate(ds):
            portrait_raw = record.get("portrait", {})
            portrait = parse_portrait(json.dumps(portrait_raw) if isinstance(portrait_raw, dict) else str(portrait_raw or ""))
            report = parse_report(record.get("report", {}))
            conversation = parse_conversation(record.get("conversation", []))

            group_tag, difficulty, issue_tags = infer_metadata(portrait, report, conversation)

            # Extract symptoms from portrait
            symptoms = portrait.get("symptoms", "")
            if not symptoms and isinstance(report, dict):
                categories = report.get("案例类别", [])
                if isinstance(categories, list):
                    symptoms = ";".join(categories)

            source_id = str(record.get("id", i))
            if source_id in existing_source_ids:
                skipped += 1
                continue

            profile = SeekerProfile(
                id=str(uuid.uuid4()),
                age=portrait.get("age", ""),
                gender=portrait.get("gender", ""),
                occupation=portrait.get("occupation", ""),
                marital_status=portrait.get("marital_status", ""),
                symptoms=symptoms,
                group_tag=group_tag,
                difficulty=difficulty,
                issue_tags=issue_tags,
                report=report,
                conversation=conversation,
                portrait_raw=portrait_raw if isinstance(portrait_raw, dict) else {},
                source_id=source_id,
            )
            session.add(profile)
            count += 1

            if count % 100 == 0:
                await session.commit()
                print(f"  Imported {count}/{len(ds)} ...")

        await session.commit()
        print(f"✅ Imported {count} profiles from HuggingFace")
        if skipped:
            print(f"⏭ Skipped {skipped} duplicate profiles (by source_id)")

    await engine.dispose()
    print("🎉 Done!")


def main():
    parser = argparse.ArgumentParser(description="Load AnnaAgent dataset from HuggingFace")
    parser.add_argument("--max", type=int, default=None, help="Max records to import")
    parser.add_argument("--replace", action="store_true", help="Delete existing profiles first")
    args = parser.parse_args()

    asyncio.run(load_from_huggingface(max_records=args.max, replace=args.replace))


if __name__ == "__main__":
    main()
