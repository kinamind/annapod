"""
Load real counseling knowledge items from PubMed into KnowledgeItem.

Usage:
    cd apps/api
    uv run python scripts/load_knowledge_pubmed.py [--per-query 40] [--replace]

Notes:
- This script fetches real paper metadata/abstracts via NCBI E-utilities.
- It maps each query stream to school/issue/difficulty labels for the 3D knowledge model.
"""

import argparse
import asyncio
import html
import json
import re
import uuid
from typing import Iterable
from urllib.parse import quote
from urllib.request import urlopen
import xml.etree.ElementTree as ET

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text
from sqlmodel import select

# Allow running as script from apps/api root
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.models.knowledge import KnowledgeItem

# Import all models so tables are registered
import app.models.user  # noqa
import app.models.seeker  # noqa
import app.models.session  # noqa
import app.models.knowledge  # noqa
import app.models.learning  # noqa


PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

# Query streams mapped to 3D taxonomy
QUERY_STREAMS = [
    {
        "term": "cognitive behavioral therapy depression randomized trial",
        "school": "CBT（认知行为疗法）",
        "issue": "抑郁",
        "difficulty": "intermediate",
        "tags": ["CBT", "depression", "evidence-based"],
    },
    {
        "term": "cognitive behavioral therapy anxiety disorder meta analysis",
        "school": "CBT（认知行为疗法）",
        "issue": "焦虑",
        "difficulty": "intermediate",
        "tags": ["CBT", "anxiety", "meta-analysis"],
    },
    {
        "term": "acceptance and commitment therapy ACT depression anxiety",
        "school": "接纳承诺疗法（ACT）",
        "issue": "焦虑",
        "difficulty": "intermediate",
        "tags": ["ACT", "acceptance", "values"],
    },
    {
        "term": "mindfulness based therapy insomnia sleep disorder",
        "school": "正念疗法",
        "issue": "睡眠障碍",
        "difficulty": "beginner",
        "tags": ["mindfulness", "sleep", "insomnia"],
    },
    {
        "term": "family systems therapy adolescent conflict",
        "school": "家庭治疗/系统治疗",
        "issue": "家庭冲突",
        "difficulty": "intermediate",
        "tags": ["family therapy", "adolescent", "systems"],
    },
    {
        "term": "narrative therapy identity trauma",
        "school": "叙事疗法",
        "issue": "自我认同",
        "difficulty": "intermediate",
        "tags": ["narrative", "identity", "trauma"],
    },
    {
        "term": "person centered therapy therapeutic alliance",
        "school": "人本主义/人格中心",
        "issue": "自我认同",
        "difficulty": "beginner",
        "tags": ["person-centered", "alliance", "empathy"],
    },
    {
        "term": "crisis intervention suicide prevention psychotherapy",
        "school": "整合取向",
        "issue": "危机干预",
        "difficulty": "advanced",
        "tags": ["crisis", "suicide prevention", "intervention"],
    },
]


def _fetch_text(url: str) -> str:
    with urlopen(url, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _esearch_ids(term: str, retmax: int) -> list[str]:
    q = quote(term)
    url = f"{PUBMED_ESEARCH}?db=pubmed&retmode=json&sort=relevance&retmax={retmax}&term={q}"
    payload = _fetch_text(url)
    data = json.loads(payload)
    return data.get("esearchresult", {}).get("idlist", [])


def _clean_text(s: str) -> str:
    s = html.unescape(s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _extract_abstract(article: ET.Element) -> str:
    chunks: list[str] = []
    for abs_text in article.findall(".//Abstract/AbstractText"):
        label = abs_text.attrib.get("Label")
        text = "".join(abs_text.itertext())
        text = _clean_text(text)
        if not text:
            continue
        if label:
            chunks.append(f"{label}: {text}")
        else:
            chunks.append(text)
    return "\n".join(chunks)


def _efetch_articles(pmids: Iterable[str]) -> list[dict]:
    ids = [str(x) for x in pmids if x]
    if not ids:
        return []

    url = f"{PUBMED_EFETCH}?db=pubmed&retmode=xml&id={','.join(ids)}"
    xml_text = _fetch_text(url)
    root = ET.fromstring(xml_text)

    records: list[dict] = []
    for article in root.findall(".//PubmedArticle"):
        pmid = _clean_text("".join(article.findtext(".//PMID", default="")))
        title = _clean_text(article.findtext(".//ArticleTitle", default=""))
        journal = _clean_text(article.findtext(".//Journal/Title", default=""))
        year = _clean_text(article.findtext(".//PubDate/Year", default=""))
        abstract = _extract_abstract(article)

        if not pmid or not title:
            continue

        records.append(
            {
                "pmid": pmid,
                "title": title,
                "journal": journal,
                "year": year,
                "abstract": abstract,
                "source_ref": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            }
        )

    return records


def _build_content(item: dict) -> tuple[str, str]:
    abstract = item.get("abstract", "")
    journal = item.get("journal", "")
    year = item.get("year", "")

    summary = abstract[:400] if abstract else "No abstract provided by PubMed."
    content = (
        f"Title: {item['title']}\n"
        f"Journal: {journal or 'N/A'}\n"
        f"Year: {year or 'N/A'}\n"
        f"PMID: {item['pmid']}\n\n"
        f"Abstract:\n{abstract or 'No abstract provided by PubMed.'}"
    )
    return summary, content


async def load_knowledge_from_pubmed(per_query: int = 40, replace: bool = False):
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        if replace:
            await session.execute(text("DELETE FROM knowledge_items"))
            await session.commit()
            print("Cleared existing knowledge items")

        existing_refs_rows = await session.execute(select(KnowledgeItem.source_ref))
        existing_refs = {x for x in existing_refs_rows.scalars().all() if x}

        inserted = 0
        skipped = 0

        for stream in QUERY_STREAMS:
            term = stream["term"]
            print(f"Fetching PubMed IDs for query: {term}")
            pmids = _esearch_ids(term, per_query)
            articles = _efetch_articles(pmids)

            for article in articles:
                if article["source_ref"] in existing_refs:
                    skipped += 1
                    continue

                summary, content = _build_content(article)

                item = KnowledgeItem(
                    id=str(uuid.uuid4()),
                    school=stream["school"],
                    issue=stream["issue"],
                    difficulty=stream["difficulty"],
                    title=article["title"][:300],
                    content=content,
                    summary=summary,
                    source_type="paper",
                    source_ref=article["source_ref"],
                    tags=stream["tags"],
                    extra_info={
                        "pmid": article["pmid"],
                        "journal": article.get("journal"),
                        "year": article.get("year"),
                        "query": term,
                    },
                )
                session.add(item)
                existing_refs.add(article["source_ref"])
                inserted += 1

                if inserted % 100 == 0:
                    await session.commit()
                    print(f"  Inserted {inserted} knowledge items...")

        await session.commit()

    await engine.dispose()
    print(f"✅ Inserted {inserted} knowledge items from PubMed")
    if skipped:
        print(f"⏭ Skipped {skipped} duplicate items")


def main():
    parser = argparse.ArgumentParser(description="Load real knowledge items from PubMed")
    parser.add_argument("--per-query", type=int, default=40, help="PubMed records per query stream")
    parser.add_argument("--replace", action="store_true", help="Delete existing knowledge items before import")
    args = parser.parse_args()

    asyncio.run(load_knowledge_from_pubmed(per_query=args.per_query, replace=args.replace))


if __name__ == "__main__":
    main()
