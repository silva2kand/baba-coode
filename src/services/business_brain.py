from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from datetime import datetime
from email import policy
from email.parser import BytesParser
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader  # type: ignore

    HAS_PYPDF = True
except Exception:
    HAS_PYPDF = False


SUPPORTED_EXTENSIONS = {
    ".eml",
    ".txt",
    ".md",
    ".json",
    ".csv",
    ".log",
    ".pdf",
    ".msg",
}

AMOUNT_RE = re.compile(r"(?:GBP|\£|\$|EUR|€)\s?([0-9][0-9,]*(?:\.[0-9]{2})?)")
DATE_RE = re.compile(r"\b(20\d{2}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b")
WHATSAPP_RE = re.compile(r"^(?P<date>\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),?\s+(?P<time>\d{1,2}:\d{2})(?:\s?[APMapm]{2})?\s+-\s+(?P<speaker>[^:]+):\s+(?P<message>.+)$")

DOMAIN_KEYWORDS = {
    "legal": ["contract", "notice", "breach", "claim", "solicitor", "lease", "dispute", "tribunal"],
    "accounting": ["invoice", "vat", "expense", "receipt", "payment", "bank", "statement", "tax"],
    "business": ["supplier", "stock", "margin", "pricing", "wholesale", "rep", "purchase", "order"],
    "property": ["property", "premises", "auction", "lease", "planning", "rent", "landlord", "shop"],
    "content": ["instagram", "facebook", "social", "campaign", "post", "caption", "video", "content"],
    "operations": ["council", "inspection", "license", "renewal", "insurance", "utility", "compliance"],
    "personal": ["car", "pet", "vet", "home", "family", "personal"],
}

OPPORTUNITY_KEYWORDS = ["discount", "deal", "saving", "margin", "opportunity", "vacant", "closing down", "rebate"]
RISK_KEYWORDS = ["urgent", "overdue", "penalty", "breach", "risk", "final notice", "lapse", "expires"]


def get_business_brain_db_path(project_root: Path) -> Path:
    return project_root / ".business_brain" / "business_brain.sqlite3"


def get_business_brain_inbox(project_root: Path) -> Path:
    return project_root / ".business_brain_inbox"


def ensure_business_brain_db(project_root: Path) -> Path:
    db_path = get_business_brain_db_path(project_root)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_path TEXT NOT NULL UNIQUE,
                source_name TEXT NOT NULL,
                source_kind TEXT NOT NULL,
                content_type TEXT NOT NULL,
                checksum TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                modified_at TEXT,
                record_date TEXT,
                title TEXT,
                counterparty TEXT,
                domain TEXT NOT NULL DEFAULT 'general',
                risk_level TEXT NOT NULL DEFAULT 'normal',
                money_amount REAL,
                renewal_date TEXT,
                summary TEXT NOT NULL DEFAULT '',
                preview TEXT NOT NULL DEFAULT '',
                tags_json TEXT NOT NULL DEFAULT '[]',
                entities_json TEXT NOT NULL DEFAULT '[]',
                opportunities_json TEXT NOT NULL DEFAULT '[]',
                metadata_json TEXT NOT NULL DEFAULT '{}',
                ingested_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ingestion_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                intake_path TEXT NOT NULL,
                scanned_files INTEGER NOT NULL DEFAULT 0,
                imported_files INTEGER NOT NULL DEFAULT 0,
                skipped_files INTEGER NOT NULL DEFAULT 0,
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_documents_domain ON documents(domain);
            CREATE INDEX IF NOT EXISTS idx_documents_counterparty ON documents(counterparty);
            CREATE INDEX IF NOT EXISTS idx_documents_record_date ON documents(record_date);
            CREATE INDEX IF NOT EXISTS idx_documents_risk_level ON documents(risk_level);
            """
        )
    return db_path


def business_brain_schema_overview() -> str:
    return "\n".join(
        [
            "Business Brain schema",
            "",
            "documents:",
            "- source_path, source_name, source_kind, content_type",
            "- checksum, file_size, modified_at, record_date",
            "- title, counterparty, domain, risk_level",
            "- money_amount, renewal_date",
            "- summary, preview",
            "- tags_json, entities_json, opportunities_json, metadata_json",
            "",
            "ingestion_runs:",
            "- intake_path, scanned_files, imported_files, skipped_files, notes, created_at",
            "",
            "Domain buckets:",
            "- legal, accounting, business, property, content, operations, personal, general",
        ]
    )


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def _read_text_file(path: Path, max_chars: int = 12000) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")[:max_chars]
    except Exception:
        return ""


def _read_pdf_preview(path: Path, max_chars: int = 12000) -> str:
    if not HAS_PYPDF:
        return ""
    try:
        reader = PdfReader(str(path))
        chunks: list[str] = []
        total = 0
        for page in reader.pages[:6]:
            text = (page.extract_text() or "").strip()
            if not text:
                continue
            remaining = max_chars - total
            if remaining <= 0:
                break
            part = text[:remaining]
            chunks.append(part)
            total += len(part)
        return "\n".join(chunks)
    except Exception:
        return ""


def _read_eml_preview(path: Path, max_chars: int = 12000) -> tuple[str, dict[str, Any]]:
    metadata: dict[str, Any] = {}
    try:
        message = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
        metadata = {
            "subject": str(message.get("subject") or "").strip(),
            "from": str(message.get("from") or "").strip(),
            "to": str(message.get("to") or "").strip(),
            "date": str(message.get("date") or "").strip(),
        }
        parts: list[str] = []
        if message.is_multipart():
            for part in message.walk():
                if part.get_content_type() == "text/plain":
                    text = part.get_content().strip()
                    if text:
                        parts.append(text)
        else:
            text = message.get_content().strip()
            if text:
                parts.append(text)
        preview = "\n\n".join(parts)[:max_chars]
        return preview, metadata
    except Exception:
        return "", metadata


def _detect_source_kind(path: Path, preview: str) -> str:
    suffix = path.suffix.lower()
    if suffix == ".eml":
        return "email"
    if suffix == ".pdf":
        return "pdf"
    if "whatsapp chat with" in path.name.lower() or WHATSAPP_RE.search(preview):
        return "whatsapp"
    return "document"


def _detect_domain(text: str, path: Path) -> str:
    haystack = f"{path.name} {text}".lower()
    scores: dict[str, int] = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        scores[domain] = sum(1 for keyword in keywords if keyword in haystack)
    best_domain = max(scores, key=scores.get) if scores else "general"
    return best_domain if scores.get(best_domain, 0) > 0 else "general"


def _detect_risk_level(text: str) -> str:
    lowered = text.lower()
    if any(keyword in lowered for keyword in ["final notice", "penalty", "court", "breach", "lapse"]):
        return "high"
    if any(keyword in lowered for keyword in ["urgent", "overdue", "expires", "renewal", "inspection"]):
        return "medium"
    return "normal"


def _extract_amount(text: str) -> float | None:
    match = AMOUNT_RE.search(text)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except Exception:
        return None


def _extract_first_date(text: str) -> str | None:
    match = DATE_RE.search(text)
    return match.group(1) if match else None


def _extract_counterparty(source_kind: str, preview: str, metadata: dict[str, Any]) -> str:
    if source_kind == "email":
        return str(metadata.get("from") or metadata.get("to") or "").strip()
    whatsapp_match = WHATSAPP_RE.search(preview)
    if whatsapp_match:
        return whatsapp_match.group("speaker").strip()
    lines = [line.strip() for line in preview.splitlines() if line.strip()]
    return lines[0][:120] if lines else ""


def _extract_tags(domain: str, source_kind: str, path: Path, text: str) -> list[str]:
    tags = {domain, source_kind, path.suffix.lower().lstrip(".") or "file"}
    lowered = text.lower()
    if "renewal" in lowered or "expires" in lowered:
        tags.add("renewal")
    if "invoice" in lowered or "receipt" in lowered:
        tags.add("finance")
    if "contract" in lowered or "agreement" in lowered:
        tags.add("contract")
    if "supplier" in lowered or "wholesale" in lowered:
        tags.add("supplier")
    return sorted(tag for tag in tags if tag)


def _extract_entities(preview: str, metadata: dict[str, Any]) -> list[str]:
    entities: set[str] = set()
    for value in metadata.values():
        if isinstance(value, str) and value.strip():
            entities.add(value.strip()[:120])
    for match in re.findall(r"\b[A-Z][A-Za-z0-9&'.,/-]{2,}\b", preview[:1000]):
        if len(match) > 2:
            entities.add(match[:120])
        if len(entities) >= 12:
            break
    return sorted(entities)[:12]


def _extract_opportunities(text: str, domain: str) -> list[str]:
    lowered = text.lower()
    opportunities: list[str] = []
    if any(keyword in lowered for keyword in OPPORTUNITY_KEYWORDS):
        opportunities.append("Review for savings, deals, or renegotiation angles")
    if domain in {"business", "accounting"} and ("supplier" in lowered or "invoice" in lowered):
        opportunities.append("Check supplier pricing, terms, and recurring spend")
    if domain == "property" and any(keyword in lowered for keyword in ["lease", "auction", "vacant", "planning"]):
        opportunities.append("Assess this property or premises for deal potential")
    if domain == "content":
        opportunities.append("Turn this into a campaign, post sequence, or content brief")
    return opportunities[:4]


def _build_summary(path: Path, source_kind: str, domain: str, counterparty: str, text: str) -> str:
    lines = [
        f"Source: {source_kind}",
        f"Domain: {domain}",
    ]
    if counterparty:
        lines.append(f"Counterparty: {counterparty}")
    lines.append(f"File: {path.name}")
    snippet = " ".join(text.split())[:240]
    if snippet:
        lines.append(f"Preview: {snippet}")
    return " | ".join(lines)


def _ingestable_files(root: Path) -> list[Path]:
    if root.is_file():
        return [root] if root.suffix.lower() in SUPPORTED_EXTENSIONS else []
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        files.append(path)
    return sorted(files)


def ingest_business_brain_path(project_root: Path, intake_path: str | Path) -> dict[str, Any]:
    db_path = ensure_business_brain_db(project_root)
    root = Path(intake_path).expanduser()
    if not root.exists():
        return {"ok": False, "message": "Intake path does not exist", "scanned": 0, "imported": 0, "skipped": 0}

    files = _ingestable_files(root)
    imported = 0
    skipped = 0
    now = datetime.now().isoformat(timespec="seconds")

    with sqlite3.connect(db_path) as connection:
        for file_path in files:
            preview = ""
            metadata: dict[str, Any] = {}
            if file_path.suffix.lower() == ".eml":
                preview, metadata = _read_eml_preview(file_path)
            elif file_path.suffix.lower() == ".pdf":
                preview = _read_pdf_preview(file_path)
            else:
                preview = _read_text_file(file_path)

            source_kind = _detect_source_kind(file_path, preview)
            text_for_analysis = preview or file_path.name
            domain = _detect_domain(text_for_analysis, file_path)
            counterparty = _extract_counterparty(source_kind, text_for_analysis, metadata)
            risk_level = _detect_risk_level(text_for_analysis)
            money_amount = _extract_amount(text_for_analysis)
            record_date = metadata.get("date") or _extract_first_date(text_for_analysis)
            renewal_date = _extract_first_date(text_for_analysis) if any(word in text_for_analysis.lower() for word in ["renewal", "expires", "expiry"]) else None
            tags = _extract_tags(domain, source_kind, file_path, text_for_analysis)
            entities = _extract_entities(text_for_analysis, metadata)
            opportunities = _extract_opportunities(text_for_analysis, domain)
            title = str(metadata.get("subject") or file_path.stem).strip()[:240]
            summary = _build_summary(file_path, source_kind, domain, counterparty, text_for_analysis)
            checksum = hashlib.sha256(file_path.read_bytes()).hexdigest()

            connection.execute(
                """
                INSERT INTO documents (
                    source_path, source_name, source_kind, content_type, checksum, file_size, modified_at,
                    record_date, title, counterparty, domain, risk_level, money_amount, renewal_date,
                    summary, preview, tags_json, entities_json, opportunities_json, metadata_json,
                    ingested_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_path) DO UPDATE SET
                    source_name=excluded.source_name,
                    source_kind=excluded.source_kind,
                    content_type=excluded.content_type,
                    checksum=excluded.checksum,
                    file_size=excluded.file_size,
                    modified_at=excluded.modified_at,
                    record_date=excluded.record_date,
                    title=excluded.title,
                    counterparty=excluded.counterparty,
                    domain=excluded.domain,
                    risk_level=excluded.risk_level,
                    money_amount=excluded.money_amount,
                    renewal_date=excluded.renewal_date,
                    summary=excluded.summary,
                    preview=excluded.preview,
                    tags_json=excluded.tags_json,
                    entities_json=excluded.entities_json,
                    opportunities_json=excluded.opportunities_json,
                    metadata_json=excluded.metadata_json,
                    updated_at=excluded.updated_at
                """,
                (
                    str(file_path),
                    file_path.name,
                    source_kind,
                    file_path.suffix.lower().lstrip(".") or "file",
                    checksum,
                    file_path.stat().st_size,
                    datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(timespec="seconds"),
                    record_date,
                    title,
                    counterparty,
                    domain,
                    risk_level,
                    money_amount,
                    renewal_date,
                    summary,
                    text_for_analysis[:4000],
                    _json_dumps(tags),
                    _json_dumps(entities),
                    _json_dumps(opportunities),
                    _json_dumps(metadata),
                    now,
                    now,
                ),
            )
            imported += 1

        connection.execute(
            "INSERT INTO ingestion_runs (intake_path, scanned_files, imported_files, skipped_files, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(root), len(files), imported, skipped, "Business Brain ingestion", now),
        )
        connection.commit()

    return {"ok": True, "message": f"Imported {imported} files into Business Brain", "scanned": len(files), "imported": imported, "skipped": skipped}


def get_business_brain_overview(project_root: Path) -> dict[str, Any]:
    db_path = ensure_business_brain_db(project_root)
    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        total_documents = connection.execute("SELECT COUNT(*) AS count FROM documents").fetchone()["count"]
        high_risk = connection.execute("SELECT COUNT(*) AS count FROM documents WHERE risk_level = 'high'").fetchone()["count"]
        renewals = connection.execute("SELECT COUNT(*) AS count FROM documents WHERE renewal_date IS NOT NULL AND renewal_date != ''").fetchone()["count"]
        money_items = connection.execute("SELECT COUNT(*) AS count FROM documents WHERE money_amount IS NOT NULL").fetchone()["count"]
        domains = [dict(row) for row in connection.execute("SELECT domain, COUNT(*) AS count FROM documents GROUP BY domain ORDER BY count DESC, domain ASC")]
        counterparties = [dict(row) for row in connection.execute("SELECT COALESCE(counterparty, '') AS counterparty, COUNT(*) AS count FROM documents WHERE counterparty IS NOT NULL AND counterparty != '' GROUP BY counterparty ORDER BY count DESC, counterparty ASC LIMIT 8")]
        recent = [dict(row) for row in connection.execute("SELECT source_name, source_kind, domain, risk_level, counterparty, record_date, summary, updated_at FROM documents ORDER BY updated_at DESC LIMIT 12")]
        opportunities: list[str] = []
        for row in connection.execute("SELECT opportunities_json FROM documents ORDER BY updated_at DESC LIMIT 40"):
            for item in json.loads(row[0] or "[]"):
                if item not in opportunities:
                    opportunities.append(item)
                if len(opportunities) >= 8:
                    break
            if len(opportunities) >= 8:
                break

    return {
        "db_path": str(db_path),
        "total_documents": total_documents,
        "high_risk": high_risk,
        "renewals": renewals,
        "money_items": money_items,
        "domains": domains,
        "counterparties": counterparties,
        "recent": recent,
        "opportunities": opportunities,
    }