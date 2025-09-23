#!/usr/bin/env python3
"""
PDF to JSONL converter for USC/CFR Title 26 with robust chunking and stable IDs.
- Uses PyMuPDF (fitz) for fast, high-fidelity text extraction
- Emits JSON Lines (one JSON object per line)
- Fields align with ustaxpublic index schema
- Intended to be dropped into Azure Blob Storage at:
  saxtechmegamind / container: tax-documents / prefixes: USC/ or CFR/

Usage:
  pip install pymupdf
  python pdf_to_jsonl.py \
    --pdf /path/to/usc26.pdf \
    --out /path/to/usc26_sections.jsonl \
    --doc-type USC \
    --title-number 26 \
    --version 119-36 \
    --source-url "https://uscode.house.gov/download/download.shtml"

Optional: Upload result to Blob Storage
  pip install azure-storage-blob
  python pdf_to_jsonl.py ... \
    --upload \
    --storage-connection-string "DefaultEndpointsProtocol=..." \
    --container tax-documents \
    --blob-prefix USC/usc26_sections.jsonl
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import re
from typing import List, Dict, Any, Tuple

# Fast PDF text extraction
try:
    import fitz  # PyMuPDF
except ImportError as e:
    raise SystemExit("PyMuPDF (fitz) not installed. Run: pip install pymupdf")

# Optional Blob upload
try:
    from azure.storage.blob import BlobServiceClient  # type: ignore
    HAVE_BLOB = True
except Exception:
    HAVE_BLOB = False

STOP_WORDS = {
    'the','and','or','of','to','in','for','a','an','is','be','by','on','with','as','at','from',
    'this','that','shall','such','any','all','under','section','subsection'
}

SECTION_HEADER_PATTERNS = [
    r'(?:^|\n)\s*§\s*(\d+[A-Za-z]*(?:\.\d+)?)\s*[\.—–-]?\s*([^\n]+)',
    r'(?:^|\n)\s*(?:Sec\.|Section)\s*(\d+[A-Za-z]*(?:\.\d+)?)\s*[\.—–-]?\s*([^\n]+)',
    r'(?:^|\n)\s*(\d+[A-Za-z]*(?:\.\d+)?)\s*[\.—–-]\s*([A-Z][^\n]+)'
]

SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def extract_pdf_text_by_page(pdf_path: str) -> Dict[int, str]:
    doc = fitz.open(pdf_path)
    pages: Dict[int, str] = {}
    for i, page in enumerate(doc, start=1):
        text = page.get_text("text")  # layout-preserving text
        pages[i] = text or ""
    return pages


def clean_whitespace(s: str) -> str:
    s = re.sub(r"\r\n|\r", "\n", s)
    s = re.sub(r"\n+", "\n", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def find_sections(text: str) -> List[Tuple[int, re.Match]]:
    matches: List[Tuple[int, re.Match]] = []
    for pat in SECTION_HEADER_PATTERNS:
        for m in re.finditer(pat, text, flags=re.MULTILINE | re.IGNORECASE):
            matches.append((m.start(), m))
    matches.sort(key=lambda x: x[0])
    # de-duplicate near-duplicates
    unique: List[Tuple[int, re.Match]] = []
    last_pos = -10
    for pos, m in matches:
        if pos > last_pos + 10:
            unique.append((pos, m))
            last_pos = pos
    return unique


def generate_keywords(text: str, limit: int = 20) -> List[str]:
    words = re.findall(r"\b[a-zA-Z]+\b", text.lower())
    freq: Dict[str, int] = {}
    for w in words:
        if len(w) > 3 and w not in STOP_WORDS:
            freq[w] = freq.get(w, 0) + 1
    top = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [w for w, _ in top]


def extract_references(text: str) -> Dict[str, List[str]]:
    refs = {
        'internal_references': [],
        'public_laws': [],
        'usc_references': [],
        'cfr_references': [],
        'forms_mentioned': []
    }
    refs['internal_references'] = list(set(re.findall(r"section\s+(\d+(?:\([a-zA-Z0-9]+\))*)", text, re.IGNORECASE)))[:20]
    refs['public_laws'] = list(set(re.findall(r"Pub\.\s*L\.\s*(\d+-\d+)", text, re.IGNORECASE)))[:10]
    usc = set(re.findall(r"(\d+)\s+U\.?S\.?C\.?\s+(\d+)", text, re.IGNORECASE))
    refs['usc_references'] = [f"{t} USC {s}" for t, s in usc][:10]
    cfr = set(re.findall(r"(\d+)\s+C\.?F\.?R\.?\s+([\d.]+)", text, re.IGNORECASE))
    refs['cfr_references'] = [f"{t} CFR {s}" for t, s in cfr][:10]
    forms = set(re.findall(r"Form\s+(\d+[A-Z]*(?:-[A-Z]+)?)", text, re.IGNORECASE))
    refs['forms_mentioned'] = list(forms)[:10]
    return refs


def complexity_score(text: str) -> int:
    if not text:
        return 0
    sentences = re.split(r"[.!?]+", text)
    avg_sent = sum(len(s.split()) for s in sentences) / max(1, len(sentences))
    words = text.split()
    avg_word = sum(len(w) for w in words) / max(1, len(words))
    subsections = len(re.findall(r"\([a-zA-Z0-9]+\)", text))
    has_formula = bool(re.search(r"[\+\-\*\/=]|\d+%|\$\d+", text))
    score = min(100, int(avg_sent * 2 + avg_word * 5 + subsections * 3 + (30 if has_formula else 0)))
    return score


def chunk_text(text: str, target_chars: int = 4000, overlap: int = 400) -> List[str]:
    # split by paragraphs first
    paras = [p.strip() for p in text.split('\n') if p.strip()]
    chunks: List[str] = []
    cur: List[str] = []
    cur_len = 0
    for p in paras:
        if cur_len + len(p) + 1 <= target_chars:
            cur.append(p)
            cur_len += len(p) + 1
        else:
            if cur:
                chunks.append(" ".join(cur))
            # start new chunk with overlap: take tail of previous chunk
            if chunks and overlap > 0:
                tail = chunks[-1][-overlap:]
                cur = [tail, p]
                cur_len = len(tail) + len(p) + 1
            else:
                cur = [p]
                cur_len = len(p)
    if cur:
        chunks.append(" ".join(cur))
    return chunks


def stable_id(prefix: str, title_number: str, section_id: str, chunk_idx: int) -> str:
    base = f"{prefix.lower()}:{title_number}:{section_id}:{chunk_idx}"
    # keep readable, hashed fallback not required
    return base


def build_section_docs(section_id: str, section_title: str, content: str, pages: List[int], *,
                       doc_type: str, title_number: str, version: str, source_url: str) -> List[Dict[str, Any]]:
    content_clean = clean_whitespace(content)
    summary = (content_clean[:300] + "...") if len(content_clean) > 300 else content_clean
    refs = extract_references(content_clean)
    cscore = complexity_score(content_clean[:2000])
    keys = generate_keywords(content_clean[:1500])
    # chunking
    chunks = chunk_text(content_clean, target_chars=4000, overlap=400)
    docs: List[Dict[str, Any]] = []
    for i, ch in enumerate(chunks):
        doc = {
            "id": stable_id('usc' if doc_type.upper()=="USC" else 'cfr', title_number, section_id, i),
            "doc_type": doc_type.upper(),
            "title_number": title_number,
            "section_id": section_id,
            "section_title": section_title,
            "chunk_index": i,
            "content": ch,
            "summary": summary,
            "keywords": keys,
            "internal_references": refs['internal_references'],
            "public_laws": refs['public_laws'],
            "usc_references": refs['usc_references'],
            "cfr_references": refs['cfr_references'],
            "forms_mentioned": refs['forms_mentioned'],
            "page_numbers": pages[:5],
            "content_length": len(ch),
            "complexity_score": cscore,
            "subsection_level": len(section_id.split('.')),
            "parent_section": section_id.split('.')[0] if '.' in section_id else None,
            "source_url": source_url,
            "version": version,
            "indexed_date": dt.datetime.utcnow().isoformat() + 'Z',
            "isDeleted": False
        }
        docs.append(doc)
    return docs


def parse_sections(text: str, text_by_page: Dict[int, str]) -> List[Tuple[str, str, str, List[int]]]:
    """Return list of (section_id, section_title, content, pages)"""
    text = clean_whitespace(text)
    matches = find_sections(text)
    result: List[Tuple[str, str, str, List[int]]] = []
    for idx, (pos, m) in enumerate(matches):
        sid = m.group(1).strip()
        title = m.group(2).strip()
        start = m.end()
        end = matches[idx + 1][0] if idx < len(matches) - 1 else len(text)
        content = text[start:end].strip()
        section_span = text[pos:end]
        # simple page localization
        pages = []
        probe = (sid + " " + title[:60]).lower()
        for pnum, ptxt in text_by_page.items():
            if probe[:40] in (ptxt or "").lower():
                pages.append(pnum)
        pages = pages[:5]
        if sid and title and content:
            result.append((sid, title, content, pages))
    return result


def write_jsonl(docs: List[Dict[str, Any]], out_path: str) -> None:
    with open(out_path, 'w', encoding='utf-8') as f:
        for d in docs:
            f.write(json.dumps(d, ensure_ascii=False) + "\n")


def upload_blob_if_requested(args, local_path: str):
    if not args.upload:
        return
    if not HAVE_BLOB:
        raise SystemExit("azure-storage-blob not installed. Run: pip install azure-storage-blob")
    if not args.storage_connection_string or not args.container or not args.blob_prefix:
        raise SystemExit("--storage-connection-string, --container, and --blob-prefix are required with --upload")
    svc = BlobServiceClient.from_connection_string(args.storage_connection_string)
    bc = svc.get_blob_client(container=args.container, blob=args.blob_prefix)
    with open(local_path, 'rb') as fh:
        bc.upload_blob(fh, overwrite=True)
    print(f"Uploaded to blob: {args.container}/{args.blob_prefix}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', required=True)
    ap.add_argument('--out', required=True, help='Local JSONL output path')
    ap.add_argument('--doc-type', required=True, choices=['USC','CFR'])
    ap.add_argument('--title-number', required=True)
    ap.add_argument('--version', required=True, help='Release/version marker, e.g., 119-36 or yyyy-mm-dd')
    ap.add_argument('--source-url', required=True)
    ap.add_argument('--upload', action='store_true')
    ap.add_argument('--storage-connection-string')
    ap.add_argument('--container')
    ap.add_argument('--blob-prefix', help='e.g., USC/usc26_sections.jsonl or CFR/cfr26_sections.jsonl')
    args = ap.parse_args()

    pages = extract_pdf_text_by_page(args.pdf)
    full_text = "\n".join(pages.get(i, "") for i in sorted(pages))
    sections = parse_sections(full_text, pages)
    print(f"Found {len(sections)} sections")

    all_docs: List[Dict[str, Any]] = []
    for sid, title, content, pnums in sections:
        docs = build_section_docs(
            sid, title, content, pnums,
            doc_type=args.doc_type,
            title_number=args.title_number,
            version=args.version,
            source_url=args.source_url,
        )
        all_docs.extend(docs)

    write_jsonl(all_docs, args.out)
    print(f"Wrote {len(all_docs)} JSONL lines -> {args.out}")

    upload_blob_if_requested(args, args.out)

if __name__ == '__main__':
    main()
