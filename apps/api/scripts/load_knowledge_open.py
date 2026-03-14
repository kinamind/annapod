"""
Load open/public knowledge sources into KnowledgeItem.

Sources:
- PubMed (evidence-focused psychotherapy papers)
- arXiv (open-access mental-health / NLP-for-therapy papers)

Usage:
    cd apps/api
    uv run python scripts/load_knowledge_open.py [--replace] [--pubmed-per-query 50] [--arxiv-max 120]
"""

import argparse
import asyncio
import html
import json
import re
import uuid
from urllib.parse import quote
from urllib.request import urlopen
import xml.etree.ElementTree as ET

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text
from sqlmodel import select

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.models.knowledge import KnowledgeItem

import app.models.user  # noqa
import app.models.seeker  # noqa
import app.models.session  # noqa
import app.models.knowledge  # noqa
import app.models.learning  # noqa
import app.models.memory  # noqa


PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
ARXIV_API = "http://export.arxiv.org/api/query"

PUBMED_STREAMS = [
    ("cognitive behavioral therapy depression randomized trial", "CBT（认知行为疗法）", "抑郁", "intermediate"),
    ("acceptance and commitment therapy anxiety", "接纳承诺疗法（ACT）", "焦虑", "intermediate"),
    ("mindfulness based therapy insomnia", "正念疗法", "睡眠障碍", "beginner"),
    ("family systems therapy adolescent conflict", "家庭治疗/系统治疗", "家庭冲突", "intermediate"),
    ("crisis intervention suicide prevention psychotherapy", "整合取向", "危机干预", "advanced"),
]

ARXIV_STREAMS = [
    ("all:psychotherapy OR all:counseling OR all:mental health", "整合取向", "自我认同", "intermediate"),
    ("all:depression therapy OR all:anxiety intervention", "CBT（认知行为疗法）", "焦虑", "beginner"),
]


def _fetch_text(url: str) -> str:
    with urlopen(url, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(s or "")).strip()


def _pubmed_search_ids(term: str, retmax: int) -> list[str]:
    url = f"{PUBMED_ESEARCH}?db=pubmed&retmode=json&sort=relevance&retmax={retmax}&term={quote(term)}"
    data = json.loads(_fetch_text(url))
    return data.get("esearchresult", {}).get("idlist", [])


def _pubmed_fetch(pmids: list[str]) -> list[dict]:
    if not pmids:
        return []
    url = f"{PUBMED_EFETCH}?db=pubmed&retmode=xml&id={','.join(pmids)}"
    root = ET.fromstring(_fetch_text(url))
    out: list[dict] = []
    for article in root.findall(".//PubmedArticle"):
        pmid = _clean(article.findtext(".//PMID", default=""))
        title = _clean(article.findtext(".//ArticleTitle", default=""))
        journal = _clean(article.findtext(".//Journal/Title", default=""))
        year = _clean(article.findtext(".//PubDate/Year", default=""))
        abs_chunks = []
        for a in article.findall(".//Abstract/AbstractText"):
            label = a.attrib.get("Label")
            txt = _clean("".join(a.itertext()))
            if txt:
                abs_chunks.append(f"{label}: {txt}" if label else txt)
        abstract = "\n".join(abs_chunks)
        if not pmid or not title:
            continue
        out.append({
            "title": title,
            "content": f"Title: {title}\nJournal: {journal or 'N/A'}\nYear: {year or 'N/A'}\nPMID: {pmid}\n\nAbstract:\n{abstract or 'No abstract provided.'}",
            "summary": (abstract or title)[:400],
            "source_ref": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "tags": ["paper", "pubmed"],
            "extra": {"pmid": pmid, "journal": journal, "year": year},
        })
    return out


def _arxiv_fetch(query: str, max_results: int) -> list[dict]:
    url = f"{ARXIV_API}?search_query={quote(query)}&start=0&max_results={max_results}&sortBy=relevance&sortOrder=descending"
    root = ET.fromstring(_fetch_text(url))
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out: list[dict] = []
    for entry in root.findall("a:entry", ns):
        title = _clean(entry.findtext("a:title", default="", namespaces=ns))
        summary = _clean(entry.findtext("a:summary", default="", namespaces=ns))
        published = _clean(entry.findtext("a:published", default="", namespaces=ns))
        link = ""
        for l in entry.findall("a:link", ns):
            href = l.attrib.get("href", "")
            if href.startswith("http"):
                link = href
                break
        if not title or not link:
            continue
        out.append({
            "title": title[:300],
            "content": f"Title: {title}\nPublished: {published or 'N/A'}\nSource: arXiv\n\nAbstract:\n{summary or 'No abstract provided.'}",
            "summary": (summary or title)[:400],
            "source_ref": link,
            "tags": ["paper", "arxiv", "open-access"],
            "extra": {"published": published},
        })
    return out


async def load_open_knowledge(replace: bool, pubmed_per_query: int, arxiv_max: int):
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        if replace:
            await session.execute(text("DELETE FROM knowledge_items"))
            await session.commit()
            print("Cleared existing knowledge items")

        existing_refs = {
            x for x in (await session.execute(select(KnowledgeItem.source_ref))).scalars().all() if x
        }

        inserted = 0
        skipped = 0

        for term, school, issue, difficulty in PUBMED_STREAMS:
            ids = _pubmed_search_ids(term, pubmed_per_query)
            for row in _pubmed_fetch(ids):
                if row["source_ref"] in existing_refs:
                    skipped += 1
                    continue
                session.add(KnowledgeItem(
                    id=str(uuid.uuid4()),
                    school=school,
                    issue=issue,
                    difficulty=difficulty,
                    title=row["title"],
                    content=row["content"],
                    summary=row["summary"],
                    source_type="paper",
                    source_ref=row["source_ref"],
                    tags=row["tags"],
                    extra_info=row["extra"],
                ))
                existing_refs.add(row["source_ref"])
                inserted += 1

        for query, school, issue, difficulty in ARXIV_STREAMS:
            for row in _arxiv_fetch(query, arxiv_max):
                if row["source_ref"] in existing_refs:
                    skipped += 1
                    continue
                session.add(KnowledgeItem(
                    id=str(uuid.uuid4()),
                    school=school,
                    issue=issue,
                    difficulty=difficulty,
                    title=row["title"],
                    content=row["content"],
                    summary=row["summary"],
                    source_type="paper",
                    source_ref=row["source_ref"],
                    tags=row["tags"],
                    extra_info=row["extra"],
                ))
                existing_refs.add(row["source_ref"])
                inserted += 1

        await session.commit()

    await engine.dispose()
    print(f"✅ Open knowledge ingestion finished. inserted={inserted}, skipped={skipped}")


def main():
    parser = argparse.ArgumentParser(description="Load open/public knowledge sources")
    parser.add_argument("--replace", action="store_true", help="Delete existing knowledge items first")
    parser.add_argument("--pubmed-per-query", type=int, default=50)
    parser.add_argument("--arxiv-max", type=int, default=120)
    args = parser.parse_args()

    asyncio.run(load_open_knowledge(args.replace, args.pubmed_per_query, args.arxiv_max))


if __name__ == "__main__":
    main()
