#!/usr/bin/env python3

import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = Path(
    "/Users/wangm/Desktop/AnnaAgent/AnnaAgent Git Code/seeker_bank/CPsyCounS-3134.json"
)
SKILL_PATH = ROOT.parents[0] / "local-skills" / "annaagent-initialization" / "SKILL.md"


def iso_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def parse_age(value: str) -> int:
    try:
        return int(re.sub(r"[^0-9]", "", value or "") or 0)
    except ValueError:
        return 0


def is_college_priority(record: dict) -> bool:
    portrait = record.get("portrait", {})
    age = parse_age(str(portrait.get("age", "")))
    occupation = str(portrait.get("occupation", ""))
    if "研究生" in occupation or "大学生" in occupation:
        return True
    return "学生" in occupation and 18 <= age <= 25


ISSUE_RULES = [
    ("危机干预", ["自杀", "自残", "危机"]),
    ("创伤与PTSD", ["ptsd", "创伤后应激", "创伤", "闪回"]),
    ("睡眠障碍", ["失眠", "睡眠", "早醒", "噩梦", "睡不着"]),
    ("抑郁", ["抑郁", "情绪低落", "无望", "兴趣低下", "自罪", "价值感低"]),
    ("焦虑", ["焦虑", "紧张", "担心", "害怕", "心慌", "惊恐"]),
    ("亲密关系", ["恋爱", "情感关系", "伴侣", "婚姻", "离婚", "夫妻"]),
    ("家庭冲突", ["家庭", "亲子", "父母", "孩子", "丈夫", "妻子", "家人"]),
    ("自我认同", ["自我", "认同", "自卑", "自信", "价值感"]),
    ("职场压力", ["工作", "职场", "职业", "导师", "论文", "学业压力"]),
    ("青少年成长", ["高中", "初中", "青春期", "校园"]),
    ("躯体化症状", ["胸闷", "气短", "头痛", "躯体", "心慌"]),
    ("丧失与哀伤", ["丧偶", "去世", "死亡", "哀伤", "悲伤"]),
]

GROUP_RULES = [
    ("elderly", ["退休", "老年", "丧偶", "养老"]),
    ("adolescent", ["高中", "初中", "青春期", "高考", "中学"]),
    ("college", ["大学生", "研究生", "考研", "保研", "宿舍", "留学", "大专学生"]),
    ("female", ["女性", "容貌焦虑", "月经", "生育"]),
    ("family", ["婚姻", "夫妻", "亲子", "家人", "母亲", "父亲", "家庭"]),
    ("workplace", ["工作", "职场", "导师", "实习", "公司", "职业"]),
]


ADVANCED_MARKERS = ["自杀", "自残", "危机", "ptsd", "创伤后应激"]
INTERMEDIATE_MARKERS = [
    "抑郁",
    "创伤",
    "惊恐",
    "强迫",
    "躯体",
    "人格",
    "进食",
    "成瘾",
    "无望",
]


def classify_issue_tags(record: dict) -> str:
    blob = json.dumps(record.get("portrait", {}), ensure_ascii=False)
    blob += json.dumps(record.get("report", {}), ensure_ascii=False)
    text = blob.lower()
    issues = []
    for issue, keywords in ISSUE_RULES:
        if any(keyword.lower() in text for keyword in keywords):
            issues.append(issue)
    return ",".join(issues[:4]) if issues else "一般心理问题"


def classify_group_tag(record: dict) -> str:
    blob = json.dumps(record.get("portrait", {}), ensure_ascii=False)
    blob += json.dumps(record.get("report", {}), ensure_ascii=False)
    text = blob.lower()
    age = parse_age(str(record.get("portrait", {}).get("age", "")))
    occupation = str(record.get("portrait", {}).get("occupation", ""))

    if "大学生" in occupation or "研究生" in occupation:
        return "college"
    if "学生" in occupation and 18 <= age <= 25:
        return "college"
    if "学生" in occupation and age < 18:
        return "adolescent"
    if age >= 65:
        return "elderly"

    for group, keywords in GROUP_RULES:
        if any(keyword.lower() in text for keyword in keywords):
            return group
    return "general"


def classify_difficulty(record: dict) -> str:
    blob = json.dumps(record.get("portrait", {}), ensure_ascii=False)
    blob += json.dumps(record.get("report", {}), ensure_ascii=False)
    text = blob.lower()
    if any(marker.lower() in text for marker in ADVANCED_MARKERS):
        return "advanced"
    if any(marker.lower() in text for marker in INTERMEDIATE_MARKERS):
        return "intermediate"
    if len(record.get("conversation", [])) >= 16:
        return "intermediate"
    return "beginner"


def robust_json_parse(text: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise
        return json.loads(match.group(0))


def merge_manual_outputs(manual_items: list[dict]):
    merged = {}
    for item in manual_items:
        merged[item["id"]] = item
    return merged


def validate_scales(payload: dict):
    expected = {
        "p_bdi": 21,
        "p_ghq": 28,
        "p_sass": 21,
        "bdi": 21,
        "ghq": 28,
        "sass": 21,
    }
    merged = {}
    merged.update(payload.get("previous_scales", {}))
    merged.update(payload.get("current_scales", {}))
    for key, length in expected.items():
        values = merged.get(key)
        if (
            not isinstance(values, list)
            or len(values) != length
            or any(v not in ["A", "B", "C", "D"] for v in values)
        ):
            raise ValueError(f"invalid scale {key}")
    return {key: merged[key] for key in expected}


def call_skill(
    api_key: str,
    base_url: str,
    model: str,
    skill_text: str,
    record: dict,
    max_retries: int = 3,
) -> dict:
    portrait = record["portrait"]
    report = record["report"]
    conversation = record["conversation"]
    user_prompt = (
        skill_text
        + "\n\n## Input Portrait\n"
        + json.dumps(portrait, ensure_ascii=False, indent=2)
        + "\n\n## Input Report\n"
        + json.dumps(report, ensure_ascii=False, indent=2)
        + "\n\n## Input Conversation\n"
        + json.dumps(conversation, ensure_ascii=False, indent=2)
        + "\n\n## Long-term Memory Mode\n开启"
    )
    body = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": user_prompt}],
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        base_url.rstrip("/") + "/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    ssl_context = (
        ssl._create_unverified_context()
        if os.getenv("ANNAPOD_INSECURE_SSL") == "1"
        else None
    )

    last_error = None
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(
                request, timeout=120, context=ssl_context
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
            text = payload["choices"][0]["message"]["content"].strip()
            data = robust_json_parse(text)
            complaint_chain = data.get("complaint_chain")
            if not isinstance(complaint_chain, list) or len(complaint_chain) < 3:
                raise ValueError("complaint_chain too short")
            style = data.get("style")
            if not isinstance(style, list) or not style:
                raise ValueError("style missing")
            system_prompt = data.get("system_prompt")
            if not isinstance(system_prompt, str) or len(system_prompt.strip()) < 80:
                raise ValueError("system_prompt missing")
            data["scales"] = validate_scales(data)
            return data
        except (
            urllib.error.HTTPError,
            urllib.error.URLError,
            KeyError,
            ValueError,
            json.JSONDecodeError,
        ) as error:
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"skill generation failed for {record['id']}: {last_error}")


def build_profile_sql(record: dict) -> str:
    portrait = record["portrait"]
    source_id = record["id"]
    return (
        "("
        + ", ".join(
            [
                sql_quote(source_id),
                sql_quote(str(portrait.get("age", ""))),
                sql_quote(str(portrait.get("gender", ""))),
                sql_quote(str(portrait.get("occupation", ""))),
                sql_quote(str(portrait.get("marital_status", ""))),
                sql_quote(str(portrait.get("symptoms", ""))),
                sql_quote(classify_group_tag(record)),
                sql_quote(classify_difficulty(record)),
                sql_quote(classify_issue_tags(record)),
                sql_quote(json.dumps(record["report"], ensure_ascii=False)),
                sql_quote(json.dumps(record["conversation"], ensure_ascii=False)),
                sql_quote(json.dumps(record["portrait"], ensure_ascii=False)),
                sql_quote(source_id),
                sql_quote(iso_now()),
            ]
        )
        + ")"
    )


def build_cache_sql(
    record: dict, generated: dict, skill_version: str, model: str
) -> str:
    source_id = record["id"]
    return (
        "("
        + ", ".join(
            [
                sql_quote(f"cache:{source_id}:ltm"),
                sql_quote(source_id),
                sql_quote(generated["system_prompt"].strip()),
                sql_quote(
                    json.dumps(
                        [
                            {"stage": index + 1, "content": str(item).strip()}
                            for index, item in enumerate(generated["complaint_chain"])
                        ],
                        ensure_ascii=False,
                    )
                ),
                sql_quote(
                    json.dumps(
                        [str(item).strip() for item in generated["style"]],
                        ensure_ascii=False,
                    )
                ),
                sql_quote(str(generated.get("situation", "")).strip()),
                sql_quote(str(generated.get("status", "")).strip()),
                sql_quote(str(generated.get("event", "")).strip()),
                sql_quote(json.dumps(generated.get("scales", {}), ensure_ascii=False)),
                sql_quote(str(generated.get("current_emotion", "confusion")).strip()),
                "1",
                sql_quote(skill_version),
                sql_quote(model),
                sql_quote(
                    json.dumps(generated.get("init_trace", {}), ensure_ascii=False)
                ),
                sql_quote(iso_now()),
                "0",
            ]
        )
        + ")"
    )


def main():
    parser = argparse.ArgumentParser(
        description="Precompute AnnaAgent initialization caches for D1"
    )
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET))
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--output-sql", default="/tmp/annapod_profile_cache_seed.sql")
    parser.add_argument("--output-json", default="/tmp/annapod_profile_cache_seed.json")
    parser.add_argument("--model", default=os.getenv("AI_MODEL", "gpt-5.4"))
    parser.add_argument(
        "--base-url",
        default=os.getenv("AI_BASE_URL", "https://api.openai.com/v1"),
    )
    parser.add_argument("--skill-version", default="annaagent-init-skill/v1")
    parser.add_argument(
        "--manual-generated",
        default="",
        help="Path to a JSON array of manually generated init results",
    )
    parser.add_argument(
        "--use-all-records",
        action="store_true",
        help="Use all records from the provided dataset file instead of college-priority selection",
    )
    args = parser.parse_args()

    dataset = json.loads(Path(args.dataset).read_text())

    if args.use_all_records:
        selected = dataset[: args.limit]
        if len(selected) < args.limit:
            raise SystemExit(f"not enough records in dataset: {len(selected)}")
    else:
        prioritized = [row for row in dataset if is_college_priority(row)]
        selected = prioritized[: args.limit]
        if len(selected) < args.limit:
            raise SystemExit(f"not enough prioritized samples: {len(selected)}")

    generated_rows = []
    if args.manual_generated:
        manual_map = merge_manual_outputs(
            json.loads(Path(args.manual_generated).read_text())
        )
        for index, record in enumerate(selected, start=1):
            generated = manual_map.get(record["id"])
            if not generated:
                raise SystemExit(f"missing manual result for {record['id']}")
            generated_rows.append({"record": record, "generated": generated})
            print(f"[{index}/{args.limit}] linked manual cache {record['id']}")
    else:
        api_key = os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise SystemExit("AI_API_KEY or OPENAI_API_KEY is required")
        skill_text = SKILL_PATH.read_text()
        for index, record in enumerate(selected, start=1):
            generated = call_skill(
                api_key, args.base_url, args.model, skill_text, record
            )
            generated_rows.append({"record": record, "generated": generated})
            print(f"[{index}/{args.limit}] cached {record['id']}")

    profile_values = ",\n".join(
        build_profile_sql(item["record"]) for item in generated_rows
    )
    cache_values = ",\n".join(
        build_cache_sql(
            item["record"], item["generated"], args.skill_version, args.model
        )
        for item in generated_rows
    )

    sql = (
        f"""
DELETE FROM seeker_profile_caches WHERE profile_id IN ({", ".join(sql_quote(item["record"]["id"]) for item in generated_rows)});
DELETE FROM seeker_profiles WHERE source_id LIKE 'demo-%';

INSERT OR REPLACE INTO seeker_profiles (
  id, age, gender, occupation, marital_status, symptoms, group_tag, difficulty, issue_tags, report, conversation, portrait_raw, source_id, created_at
) VALUES
{profile_values};

INSERT OR REPLACE INTO seeker_profile_caches (
  id, profile_id, system_prompt, complaint_chain, style, situation, status, event, scales, current_emotion, has_long_term_memory, skill_version, source_model, init_trace, created_at, used_count
) VALUES
{cache_values};
""".strip()
        + "\n"
    )

    Path(args.output_sql).write_text(sql)
    Path(args.output_json).write_text(
        json.dumps(
            [
                {
                    "profile_id": item["record"]["id"],
                    "title": item["record"]["report"].get("案例标题", ""),
                    "occupation": item["record"]["portrait"].get("occupation", ""),
                    "system_prompt": item["generated"]["system_prompt"],
                }
                for item in generated_rows
            ],
            ensure_ascii=False,
            indent=2,
        )
    )

    print(f"Wrote SQL seed to {args.output_sql}")
    print(f"Wrote cache preview JSON to {args.output_json}")


if __name__ == "__main__":
    main()
