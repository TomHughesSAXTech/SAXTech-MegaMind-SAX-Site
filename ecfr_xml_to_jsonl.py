#!/usr/bin/env python3
"""
ECFR (CFR Title 26) XML → JSONL converter with robust chunking and stable IDs.

This script parses the US GPO eCFR bulk XML snapshots (no CAPTCHA/IP gating) and produces
JSON Lines compatible with the 'ustaxpublic' Azure AI Search index we configured.

Key features:
- Extracts CFR sections (section id, heading/title, and paragraph text)
- Robust chunking (~4k chars with overlap) and stable IDs: cfr:26:{section_id}:{chunk_index}
- Outputs JSONL lines ready for our Search indexers and vectorization skillset
- Optional Blob upload and optional trigger of the CFR indexer run

Usage examples:
  # Convert downloaded XML
  python ecfr_xml_to_jsonl.py \
    --xml /path/to/ECFR_title26_2025-09-19.xml \
    --out /path/to/cfr26_2025-09-19.jsonl \
    --version 2025-09-19 \
    --source-url "https://www.govinfo.gov/bulkdata/ECFR/.../ECFR-title26-2025-09-19.xml"

  # Download XML from a URL first, then convert and upload to Blob
  python ecfr_xml_to_jsonl.py \
    --xml-url "https://www.govinfo.gov/.../ECFR-title26-2025-09-19.xml" \
    --out /tmp/cfr26_2025-09-19.jsonl \
    --version 2025-09-19 \
    --source-url "https://www.govinfo.gov/.../ECFR-title26-2025-09-19.xml" \
    --upload \
    --storage-connection-string "DefaultEndpointsProtocol=...;AccountName=saxtechmegamind;AccountKey=...;EndpointSuffix=core.windows.net" \
    --container tax-documents \
    --blob-prefix CFR/cfr26_2025-09-19.jsonl \
    --run-indexer \
    --search-service saxmegamind-search \
    --search-api-key <SEARCH_API_KEY> \
    --indexer-name ustaxpublic-cfr-indexer-v3

Notes:
- We do not hardcode a GPO URL pattern; pass the --xml-url you want. The GPO ECFR bulk feed
  provides daily snapshots; choose the desired date and URL.
- The 'version' you supply will be stored in each JSONL record as provenance (e.g., 2025-09-19).
- The Search indexers and skillset handle embeddings (text-embedding-3-large, 3072 dims) server-side.
"""

import argparse
import datetime as dt
import io
import json
import os
import re
import sys
import typing as t
import xml.etree.ElementTree as ET

# Optional HTTP and Blob client
try:
    import requests  # type: ignore
except Exception:
    requests = None  # we'll guard usages

try:
    from azure.storage.blob import BlobServiceClient  # type: ignore
    HAVE_BLOB = True
except Exception:
    HAVE_BLOB = False

STOP_WORDS = {
    'the','and','or','of','to','in','for','a','an','is','be','by','on','with','as','at','from',
    'this','that','shall','such','any','all','under','section','subsection'
}

# --------------------------------- XML Helpers ---------------------------------

def _local(tag: str) -> str:
    """Return local tag name without namespace."""
    if '}' in tag:
        return tag.split('}', 1)[1]
    return tag


def _text(elem: ET.Element) -> str:
    return (elem.text or '').strip()


def _iter_sections(root: ET.Element) -> t.Iterable[ET.Element]:
    """Yield elements that represent a Section.

    Heuristics:
    - Prefer nodes named 'SECTION'
    - Else, any node that contains a child named 'SECTNO'
    """
    # First pass: explicit SECTION tags
    for e in root.iter():
        if _local(e.tag).upper() == 'SECTION':
            yield e
    # Second pass: nodes with SECTNO child but not caught above
    for e in root.iter():
        if _local(e.tag).upper() == 'SECTION':
            continue
        for c in e:
            if _local(c.tag).upper() == 'SECTNO':
                yield e
                break


def _extract_section_fields(sec: ET.Element) -> t.Optional[t.Tuple[str, str, str]]:
    """Return (section_id, heading, content_text) or None if invalid."""
    section_id = ''
    heading = ''
    paragraphs: t.List[str] = []

    # Section number in <SECTNO>
    for c in sec.iter():
        if _local(c.tag).upper() == 'SECTNO':
            raw = _text(c)
            # remove leading '§' and spaces
            section_id = re.sub(r'^§\s*', '', raw).strip()
            break

    if not section_id:
        return None

    # Heading could be in <SUBJECT> or <HEAD>
    for c in sec.iter():
        lname = _local(c.tag).upper()
        if lname in ('SUBJECT', 'HEAD'):
            heading = _text(c)
            if heading:
                break

    # Collect paragraphs <P>
    for p in sec.iter():
        if _local(p.tag).upper() == 'P':
            txt = _text(p)
            if txt:
                paragraphs.append(txt)

    content = ' '.join(paragraphs).strip()
    return (section_id, heading, content)

# --------------------------------- Text utils ---------------------------------

def clean_whitespace(s: str) -> str:
    s = re.sub(r"\s+", ' ', s)
    return s.strip()


def generate_keywords(text: str, limit: int = 20) -> t.List[str]:
    words = re.findall(r"\b[a-zA-Z]+\b", (text or '').lower())
    freq: t.Dict[str, int] = {}
    for w in words:
        if len(w) > 3 and w not in STOP_WORDS:
            freq[w] = freq.get(w, 0) + 1
    return [w for w, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:limit]]


def extract_references(text: str) -> t.Dict[str, t.List[str]]:
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


def chunk_text(text: str, target_chars: int = 4000, overlap: int = 400) -> t.List[str]:
    if not text:
        return []
    chunks: t.List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + target_chars)
        chunk = text[start:end]
        chunks.append(chunk)
        if end == n:
            break
        start = max(end - overlap, start + 1)
    return chunks

# ------------------------------- Record builder -------------------------------

def stable_id(title_number: str, section_id: str, chunk_index: int) -> str:
    return f"cfr:{title_number}:{section_id}:{chunk_index}"


def build_docs_for_section(section_id: str, heading: str, content: str, *,
                           title_number: str, version: str, source_url: str) -> t.List[dict]:
    content_clean = clean_whitespace(content)
    summary = (content_clean[:300] + '...') if len(content_clean) > 300 else content_clean
    refs = extract_references(content_clean)
    keys = generate_keywords(content_clean[:2000])
    cscore = complexity_score(content_clean[:2000])

    chunks = chunk_text(content_clean, target_chars=4000, overlap=400)
    docs: t.List[dict] = []
    for idx, ch in enumerate(chunks or ['']):
        rec = {
            # Core/stable ids
            'id': stable_id(title_number, section_id, idx),
            'doc_type': 'CFR',
            'title_number': title_number,
            'section_id': section_id,
            'section_title': heading or f'Section {section_id}',
            'chunk_index': idx,

            # Text
            'content': ch,
            'summary': summary,
            'keywords': keys,

            # References/metadata
            'internal_references': refs['internal_references'],
            'public_laws': refs['public_laws'],
            'usc_references': refs['usc_references'],
            'cfr_references': refs['cfr_references'],
            'forms_mentioned': refs['forms_mentioned'],

            'page_numbers': [],  # not available for CFR XML
            'content_length': len(ch),
            'complexity_score': cscore,
            'subsection_level': len(section_id.split('.')),
            'parent_section': section_id.split('.')[0] if '.' in section_id else None,

            'source_url': source_url,
            'version': version,
            'indexed_date': dt.datetime.utcnow().isoformat() + 'Z',
            'isDeleted': False
        }
        docs.append(rec)
    return docs

# --------------------------------- IO helpers ---------------------------------

def download_xml(url: str, timeout: int = 180) -> bytes:
    if not requests:
        raise RuntimeError("requests not installed. Run: pip install requests")
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    return r.content


def write_jsonl(records: t.Iterable[dict], out_path: str) -> None:
    with open(out_path, 'w', encoding='utf-8') as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')


def upload_blob(connection_string: str, container: str, blob_path: str, local_file: str) -> None:
    if not HAVE_BLOB:
        raise RuntimeError("azure-storage-blob not installed. Run: pip install azure-storage-blob")
    svc = BlobServiceClient.from_connection_string(connection_string)
    bc = svc.get_blob_client(container=container, blob=blob_path)
    with open(local_file, 'rb') as fh:
        bc.upload_blob(fh, overwrite=True)


def trigger_indexer(search_service: str, api_key: str, indexer_name: str) -> None:
    if not requests:
        raise RuntimeError("requests not installed. Run: pip install requests")
    url = f"https://{search_service}.search.windows.net/indexers/{indexer_name}/run?api-version=2024-05-01-preview"
    r = requests.post(url, headers={'api-key': api_key, 'Content-Length': '0'}, data=b'')
    if r.status_code not in (200, 202):
        sys.stderr.write(f"Failed to trigger indexer {indexer_name}: {r.status_code} {r.text}\n")

# ----------------------------------- main -------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--xml', help='Path to CFR XML file (if already downloaded)')
    ap.add_argument('--xml-url', help='URL to download CFR XML (GPO bulk ECFR feed)')
    ap.add_argument('--out', required=True, help='Output JSONL path')
    ap.add_argument('--title-number', default='26', help='CFR Title number (default: 26)')
    ap.add_argument('--version', required=True, help='Snapshot date/version string, e.g., 2025-09-19')
    ap.add_argument('--source-url', required=True, help='Canonical source URL or XML URL for provenance')

    # Optional upload to Blob
    ap.add_argument('--upload', action='store_true')
    ap.add_argument('--storage-connection-string')
    ap.add_argument('--container')
    ap.add_argument('--blob-prefix', help='e.g., CFR/cfr26_2025-09-19.jsonl')

    # Optional: trigger indexer run
    ap.add_argument('--run-indexer', action='store_true')
    ap.add_argument('--search-service')
    ap.add_argument('--search-api-key')
    ap.add_argument('--indexer-name', default='ustaxpublic-cfr-indexer-v3')

    args = ap.parse_args()

    if not args.xml and not args.xml_url:
        ap.error('Provide --xml or --xml-url')

    xml_bytes: bytes
    if args.xml_url:
        xml_bytes = download_xml(args.xml_url)
    else:
        with open(args.xml, 'rb') as fh:
            xml_bytes = fh.read()

    # Parse XML
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        sys.stderr.write(f"Failed to parse XML: {e}\n")
        return 2

    # Walk sections
    total_sections = 0
    written = 0
    records: t.List[dict] = []

    for sec in _iter_sections(root):
        fields = _extract_section_fields(sec)
        if not fields:
            continue
        section_id, heading, content = fields
        if not content:
            continue
        docs = build_docs_for_section(section_id, heading, content,
                                      title_number=args.title_number,
                                      version=args.version,
                                      source_url=args.source_url)
        records.extend(docs)
        total_sections += 1

    write_jsonl(records, args.out)
    written = len(records)

    print(f"Extracted sections: {total_sections}")
    print(f"Wrote JSONL lines: {written} -> {args.out}")

    if args.upload:
        if not (args.storage-connection-string and args.container and args.blob_prefix):
            # Workaround: argparse with hyphen not allowed as attribute, rename read
            scs = getattr(args, 'storage-connection-string', None) or getattr(args, 'storage_connection_string', None)
            if scs:
                args.storage_connection_string = scs
        if not args.storage_connection_string or not args.container or not args.blob_prefix:
            sys.stderr.write('--upload requires --storage-connection-string, --container, and --blob-prefix\n')
            return 3
        upload_blob(args.storage_connection_string, args.container, args.blob_prefix, args.out)
        print(f"Uploaded to: {args.container}/{args.blob_prefix}")

    if args.run_indexer:
        if not args.search_service or not args.search_api_key:
            sys.stderr.write('--run-indexer requires --search-service and --search-api-key\n')
            return 4
        trigger_indexer(args.search_service, args.search_api_key, args.indexer_name)
        print(f"Triggered indexer: {args.indexer_name}")

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
