import azure.functions as func
import logging
import json
import os
import requests
import zipfile
import xml.etree.ElementTree as ET
import re
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
try:
    from azure.storage.blob import BlobServiceClient
except Exception:
    BlobServiceClient = None  # Will be None until dependencies are available
try:
    from azure.search.documents import SearchClient
    from azure.core.credentials import AzureKeyCredential
    from azure.search.documents.models import IndexAction
except Exception:
    SearchClient = None
    AzureKeyCredential = None
    IndexAction = None
import time
from io import StringIO
try:
    from pdfminer.high_level import extract_text as pdf_extract_text
except Exception:
    pdf_extract_text = None

app = func.FunctionApp()

DEFAULT_HEADERS = {
    "User-Agent": "saxtech-tax-ingestor/1.0 (+https://saxtechnology.com)"
}

def _http_request(method: str, url: str, *, timeout: int = 60, retries: int = 3, backoff: float = 1.5, headers: Dict[str, str] | None = None, **kwargs):
    """HTTP request with simple exponential backoff retries.
    Raises on final failure.
    """
    _headers = DEFAULT_HEADERS.copy()
    if headers:
        _headers.update(headers)
    last_exc = None
    for attempt in range(retries):
        try:
            resp = requests.request(method, url, timeout=timeout, headers=_headers, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as e:
            last_exc = e
            if attempt == retries - 1:
                break
            # small exponential backoff
            sleep_s = backoff ** attempt
            time.sleep(sleep_s)
    raise last_exc

def _http_head_ok(url: str, *, timeout: int = 30, retries: int = 3) -> bool:
    try:
        resp = _http_request("HEAD", url, timeout=timeout, retries=retries, headers=None, allow_redirects=True)
        return 200 <= resp.status_code < 400
    except Exception:
        return False

def _parse_account_name_from_conn(conn: str) -> str:
    try:
        m = re.search(r"AccountName=([^;]+)", conn or "")
        return m.group(1) if m else ""
    except Exception:
        return ""

# Configuration from environment variables
SEARCH_SERVICE_NAME = os.environ.get('SEARCH_SERVICE_NAME', 'saxmegamind-search')
SEARCH_API_KEY = os.environ.get('SEARCH_API_KEY')
SEARCH_INDEX_NAME = os.environ.get('SEARCH_INDEX_NAME', 'ustaxpublic')
STORAGE_CONNECTION_STRING = os.environ.get('AzureWebJobsStorage')

# eCFR API configuration
ECFR_BASE_URL = "https://www.ecfr.gov"
USC_BASE_URL = "https://uscode.house.gov"

# Initialize Azure Search client lazily/safely for environments where SDK may be missing
search_endpoint = f"https://{SEARCH_SERVICE_NAME}.search.windows.net"
try:
    if SEARCH_API_KEY and SearchClient and AzureKeyCredential:
        search_client = SearchClient(
            endpoint=search_endpoint,
            index_name=SEARCH_INDEX_NAME,
            credential=AzureKeyCredential(SEARCH_API_KEY)
        )
    else:
        search_client = None
except Exception:
    search_client = None

def get_storage_client():
    """Initialize storage client for state management"""
    try:
        if STORAGE_CONNECTION_STRING and BlobServiceClient:
            return BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
    except Exception:
        pass
    return None

def get_last_processed_state():
    """Retrieve last processed state from blob storage"""
    try:
        blob_service_client = get_storage_client()
        if not blob_service_client:
            return {}
        
        container_name = "tax-ingestor-state"
        blob_name = "last_processed.json"
        
        container_client = blob_service_client.get_container_client(container_name)
        if not container_client.exists():
            container_client.create_container()
        
        blob_client = container_client.get_blob_client(blob_name)
        
        if blob_client.exists():
            content = blob_client.download_blob().readall()
            return json.loads(content)
        
    except Exception as e:
        logging.warning(f"Could not retrieve state: {e}")
    
    return {}

def save_last_processed_state(state: dict):
    """Save processing state to blob storage"""
    try:
        blob_service_client = get_storage_client()
        if not blob_service_client:
            logging.info("No storage client, skipping state save")
            return
        
        container_name = "tax-ingestor-state"
        blob_name = "last_processed.json"
        
        container_client = blob_service_client.get_container_client(container_name)
        if not container_client.exists():
            container_client.create_container()
        
        blob_client = container_client.get_blob_client(blob_name)
        
        content = json.dumps(state, indent=2)
        blob_client.upload_blob(content, overwrite=True)
        
        logging.info(f"State saved: {state}")
        
    except Exception as e:
        logging.error(f"Could not save state: {e}")

def check_usc_updates():
    """Check US Code for Title 26 updates (robust pattern).
    Returns (release_point, zip_url) where release_point is like '119-36'.
    """
    # Allow explicit override
    try:
        env_xml = os.environ.get('USC_XML_URL')
        if env_xml:
            m = re.search(r'(\d+-\d+)', env_xml)
            rel = m.group(1) if m else datetime.now(timezone.utc).date().isoformat()
            _write_diag(f"_diag/usc_selected_{rel}.txt", env_xml)
            return rel, env_xml
    except Exception:
        pass
    try:
        url = f"{USC_BASE_URL}/download/download.shtml"
        response = _http_request("GET", url, timeout=60, retries=4)
        content = response.text
        # Accept links that include download/releasepoints/... or releasepoints/...
        m = re.search(r'href=["\']((?:download/)?releasepoints/[^"\']*xml_usc26@(\d+-\d+)\.zip)["\']', content, re.IGNORECASE)
        if not m:
            logging.error("Could not find Title 26 XML ZIP link on USC downloads page")
            _write_diag(f"_diag/usc_no_link_{datetime.now(timezone.utc).isoformat()}.txt", "no-link")
            return None, None
        path = m.group(1)
        release_point = m.group(2)
        download_url = f"{USC_BASE_URL}/{path}"
        logging.info(f"USC discovered release {release_point} at {download_url}")
        _write_diag(f"_diag/usc_selected_{release_point}.txt", download_url)
        return release_point, download_url
    except Exception as e:
        logging.error(f"Error checking USC updates: {e}")
        _write_diag(f"_diag/usc_exception_{datetime.now(timezone.utc).isoformat()}.txt", str(e))
        return None, None

def check_ecfr_updates():
    """Check eCFR for Title 26 updates"""
    try:
        # Get current version info for Title 26 with retries
        response = _http_request(
            "GET",
            f"{ECFR_BASE_URL}/api/versioner/v1/versions/title-26.json",
            timeout=30,
            retries=4
        )
        data = response.json()
        # Get the latest version date
        # The API returns a list of content_versions; pick the max by date
        versions = []
        if isinstance(data, dict) and 'content_versions' in data:
            versions = data['content_versions']
        elif isinstance(data, list):
            versions = data
        if versions:
            # Extract valid ISO dates and pick the latest
            def _date_of(item):
                try:
                    return item.get('date') or item.get('issue_date') or item.get('amendment_date') or ''
                except Exception:
                    return ''
            # Sort by date string descending
            versions_sorted = sorted(versions, key=lambda x: _date_of(x), reverse=True)
            latest = versions_sorted[0]
            version_date = _date_of(latest)
            if not version_date:
                return None, None
            download_url = f"{ECFR_BASE_URL}/api/versioner/v1/full/{version_date}/title-26.xml"
            return version_date, download_url
        return None, None
    except Exception as e:
        logging.error(f"Error checking eCFR updates: {e}")
        return None, None

def parse_usc_xml_to_documents(xml_content: str, release_point: str) -> List[Dict[str, Any]]:
    """Parse USC XML content into search documents"""
    documents = []
    
    try:
        root = ET.fromstring(xml_content)
        
        # Navigate through USC XML structure
        for section in root.findall('.//section'):
            section_num = section.get('num', '')
            section_id = f"26-USC-{section_num}"
            
            # Extract heading
            heading = section.find('.//heading')
            title = heading.text if heading is not None else f"Section {section_num}"
            
            # Extract content
            content_parts = []
            for elem in section.iter():
                if elem.text:
                    content_parts.append(elem.text.strip())
            
            content = ' '.join(content_parts)[:5000]  # Limit content length
            
            # Create document with learning-ready fields
            doc = {
                "id": hashlib.md5(f"USC-26-{section_num}-{release_point}".encode()).hexdigest()[:16],
                "document_type": "USC",
                "source": "USC",
                "title_number": "26",
                "section_id": section_id,
                "section_number": section_num,
                "title": title,
                "content": content,
                "summary": content[:300] + "..." if len(content) > 300 else content,
                "release_point": release_point,
                "indexed_date": datetime.now(timezone.utc).isoformat(),
                
                # Learning-ready fields
                "view_count": 0,
                "thumbs_up_count": 0,
                "thumbs_down_count": 0,
                "answer_confidence": 0.0,
                "last_viewed_at": None,
                "last_feedback_at": None,
                "last_indexed_at": datetime.now(timezone.utc).isoformat(),
                "department_tags": [],
                "gpt_cached_answer": None,
                "boost_manual": 0,
                
                # Metadata for search
                "complexity_score": calculate_complexity(content),
                "keywords": extract_keywords(content),
                "references": extract_references(content),
                "forms_mentioned": extract_forms(content),
                "@search.action": "mergeOrUpload"
            }
            
            documents.append(doc)
        
    except Exception as e:
        logging.error(f"Error parsing USC XML: {e}")
    
    return documents

def parse_ecfr_xml_to_documents(xml_content: str, version_date: str) -> List[Dict[str, Any]]:
    """Parse eCFR XML content into search documents"""
    documents = []
    
    try:
        root = ET.fromstring(xml_content)
        
        # Navigate through eCFR XML structure
        for section in root.findall('.//DIV5[@N]'):  # eCFR uses DIV5 for sections
            section_num = section.get('N', '')
            section_id = f"26-CFR-{section_num}"
            
            # Extract heading
            head = section.find('.//HEAD')
            title = head.text if head is not None else f"Section {section_num}"
            
            # Extract content
            content_parts = []
            for para in section.findall('.//P'):
                if para.text:
                    content_parts.append(para.text.strip())
            
            content = ' '.join(content_parts)[:5000]  # Limit content length
            
            # Create document with learning-ready fields
            doc = {
                "id": hashlib.md5(f"CFR-26-{section_num}-{version_date}".encode()).hexdigest()[:16],
                "document_type": "CFR",
                "source": "eCFR",
                "title_number": "26",
                "section_id": section_id,
                "section_number": section_num,
                "title": title,
                "content": content,
                "summary": content[:300] + "..." if len(content) > 300 else content,
                "effective_date": version_date,
                "indexed_date": datetime.now(timezone.utc).isoformat(),
                
                # Learning-ready fields
                "view_count": 0,
                "thumbs_up_count": 0,
                "thumbs_down_count": 0,
                "answer_confidence": 0.0,
                "last_viewed_at": None,
                "last_feedback_at": None,
                "last_indexed_at": datetime.now(timezone.utc).isoformat(),
                "department_tags": [],
                "gpt_cached_answer": None,
                "boost_manual": 0,
                
                # Metadata for search
                "complexity_score": calculate_complexity(content),
                "keywords": extract_keywords(content),
                "references": extract_references(content),
                "forms_mentioned": extract_forms(content),
                "@search.action": "mergeOrUpload"
            }
            
            documents.append(doc)
        
    except Exception as e:
        logging.error(f"Error parsing eCFR XML: {e}")
    
    return documents

def calculate_complexity(text: str) -> int:
    """Calculate complexity score (0-100) based on text characteristics"""
    if not text:
        return 0
    
    sentences = re.split(r'[.!?]+', text)
    avg_sentence_length = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
    
    words = text.split()
    avg_word_length = sum(len(w) for w in words) / max(len(words), 1)
    
    subsection_depth = len(re.findall(r'\([a-zA-Z0-9]+\)', text))
    has_formulas = bool(re.search(r'[\+\-\*\/=]|\d+%|\$\d+', text))
    
    score = min(100, int(
        (avg_sentence_length * 2) +
        (avg_word_length * 5) +
        (subsection_depth * 3) +
        (30 if has_formulas else 0)
    ))
    
    return score

def extract_keywords(text: str, limit: int = 20) -> List[str]:
    """Extract important keywords for search indexing"""
    stop_words = {'the', 'and', 'or', 'of', 'to', 'in', 'for', 'a', 'an', 'is', 'be',
                  'by', 'on', 'with', 'as', 'at', 'from', 'this', 'that', 'shall',
                  'such', 'any', 'all', 'under', 'section', 'subsection'}
    
    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    
    word_freq = {}
    for word in words:
        if len(word) > 3 and word not in stop_words:
            word_freq[word] = word_freq.get(word, 0) + 1
    
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    return [word for word, freq in sorted_words[:limit]]

def extract_references(text: str) -> List[str]:
    """Extract references to other sections and laws"""
    references = []
    
    # Section references (e.g., "section 501(c)(3)")
    section_refs = re.findall(r'section\s+(\d+(?:\([a-zA-Z0-9]+\))*)', text, re.IGNORECASE)
    references.extend(section_refs[:10])
    
    # Public Law references (e.g., "Pub. L. 99-514")
    pub_laws = re.findall(r'Pub\.\s*L\.\s*(\d+-\d+)', text, re.IGNORECASE)
    references.extend(pub_laws[:5])
    
    return list(set(references))

def extract_forms(text: str) -> List[str]:
    """Extract IRS form references"""
    forms = re.findall(r'Form\s+(\d+[A-Z]*(?:-[A-Z]+)?)', text, re.IGNORECASE)
    return list(set(forms))[:10]

def index_documents(documents: List[Dict[str, Any]], batch_size: int = 100):
    """Index documents to Azure Cognitive Search"""
    if not search_client:
        logging.error("Search client not initialized")
        return False
    
    try:
        total = len(documents)
        indexed = 0
        
        for i in range(0, total, batch_size):
            batch = documents[i:i+batch_size]
            
            # Upload batch
            result = search_client.upload_documents(documents=batch)
            
            indexed += len(batch)
            logging.info(f"Indexed {indexed}/{total} documents")
            
            # Small delay between batches
            time.sleep(0.5)
        
        return True
        
    except Exception as e:
        logging.error(f"Error indexing documents: {e}")
        return False

# ---------------- USC (GPO XML) ingestion helpers ----------------

def _usc_iter_sections(root: ET.Element):
    """Yield USC sections (heuristic: tags named 'section')."""
    for e in root.iter():
        if e.tag.split('}')[-1].lower() == 'section':
            yield e

def _usc_extract(sec: ET.Element):
    """Return (section_id, heading, content)."""
    # section @num attribute is common in USC XML
    section_num = sec.get('num', '')
    section_id = section_num.strip()
    # heading text
    heading_el = None
    for c in sec.iter():
        if c.tag.split('}')[-1].lower() == 'heading':
            heading_el = c
            break
    heading = (heading_el.text or '').strip() if heading_el is not None else (f"Section {section_id}" if section_id else '')
    # gather text
    parts = []
    for elem in sec.iter():
        if elem.text:
            t = elem.text.strip()
            if t:
                parts.append(t)
    content = ' '.join(parts).strip()
    return section_id, heading, content

def _chunk_text(text: str, target: int = 4000, overlap: int = 400):
    if not text:
        return []
    chunks = []
    i = 0
    n = len(text)
    while i < n:
        j = min(n, i + target)
        chunks.append(text[i:j])
        if j == n:
            break
        i = max(j - overlap, i + 1)
    return chunks

def _usc_build_docs(section_id: str, heading: str, content: str, version: str, source_url: str) -> List[Dict[str, Any]]:
    content_clean = re.sub(r"\s+", " ", content or "").strip()
    summary = (content_clean[:300] + '...') if len(content_clean) > 300 else content_clean
    keys = extract_keywords(content_clean[:2000]) if 'extract_keywords' in globals() else []
    refs_internal = re.findall(r"section\s+(\d+(?:\([a-zA-Z0-9]+\))*)", content_clean, re.IGNORECASE)[:20]
    refs_forms = re.findall(r"Form\s+(\d+[A-Z]*(?:-[A-Z]+)?)", content_clean, re.IGNORECASE)[:10]
    chunks = _chunk_text(content_clean)
    docs: List[Dict[str, Any]] = []
    for idx, ch in enumerate(chunks or ['']):
        docs.append({
            'id': f"usc:26:{section_id}:{idx}",
            'doc_type': 'USC',
            'title_number': '26',
            'section_id': section_id,
            'section_title': heading or f'Section {section_id}',
            'chunk_index': idx,
            'content': ch,
            'summary': summary,
            'keywords': keys,
            'internal_references': refs_internal,
            'public_laws': [],
            'usc_references': [],
            'cfr_references': [],
            'forms_mentioned': refs_forms,
            'page_numbers': [],
            'content_length': len(ch),
            'complexity_score': calculate_complexity(ch) if 'calculate_complexity' in globals() else 0,
            'subsection_level': len(section_id.split('.')),
            'parent_section': section_id.split('.')[0] if '.' in section_id else None,
            'source_url': source_url,
            'version': version,
            'indexed_date': datetime.now(timezone.utc).isoformat(),
            'isDeleted': False
        })
    return docs

# ---------------- CFR (GPO bulk) ingestion helpers ----------------

def _cfr_iter_sections(root: ET.Element):
    """Yield elements that represent a CFR section using broad heuristics."""
    # Prefer explicit SECTION tags
    for e in root.iter():
        if e.tag.split('}')[-1].upper() == 'SECTION':
            yield e
    # Fallback: any node with a SECTNO child
    for e in root.iter():
        if e.tag.split('}')[-1].upper() == 'SECTION':
            continue
        for c in e:
            if c.tag.split('}')[-1].upper() == 'SECTNO':
                yield e
                break

def _cfr_extract(sec: ET.Element):
    """Return (section_id, heading, content) from a section element or None."""
    section_id = ''
    heading = ''
    parts: List[str] = []

    for c in sec.iter():
        if c.tag.split('}')[-1].upper() == 'SECTNO':
            raw = (c.text or '').strip()
            section_id = re.sub(r'^§\s*', '', raw)
            break
    if not section_id:
        return None

    # Heading in SUBJECT or HEAD
    for c in sec.iter():
        ln = c.tag.split('}')[-1].upper()
        if ln in ('SUBJECT', 'HEAD'):
            heading = (c.text or '').strip()
            if heading:
                break

    for p in sec.iter():
        if p.tag.split('}')[-1].upper() == 'P':
            txt = (p.text or '').strip()
            if txt:
                parts.append(txt)
    content = ' '.join(parts).strip()
    return section_id, heading, content

def _cfr_chunk(text: str, target: int = 4000, overlap: int = 400) -> List[str]:
    if not text:
        return []
    chunks = []
    i = 0
    n = len(text)
    while i < n:
        j = min(n, i + target)
        chunks.append(text[i:j])
        if j == n:
            break
        i = max(j - overlap, i + 1)
    return chunks

def _cfr_build_docs(section_id: str, heading: str, content: str, version: str) -> List[Dict[str, Any]]:
    content_clean = re.sub(r"\s+", " ", content or "").strip()
    summary = (content_clean[:300] + '...') if len(content_clean) > 300 else content_clean
    # Lightweight keyword/ref extraction (reuse earlier helpers if desired)
    keys = extract_keywords(content_clean[:2000]) if 'extract_keywords' in globals() else []
    refs = {
        'internal': re.findall(r"section\s+(\d+(?:\([a-zA-Z0-9]+\))*)", content_clean, re.IGNORECASE)[:20],
        'forms': re.findall(r"Form\s+(\d+[A-Z]*(?:-[A-Z]+)?)", content_clean, re.IGNORECASE)[:10]
    }
    chunks = _cfr_chunk(content_clean)
    docs: List[Dict[str, Any]] = []
    for idx, ch in enumerate(chunks or ['']):
        docs.append({
            'id': f"cfr:26:{section_id}:{idx}",
            'doc_type': 'CFR',
            'title_number': '26',
            'section_id': section_id,
            'section_title': heading or f'Section {section_id}',
            'chunk_index': idx,
            'content': ch,
            'summary': summary,
            'keywords': keys,
            'internal_references': refs['internal'],
            'public_laws': [],
            'usc_references': [],
            'cfr_references': [],
            'forms_mentioned': refs['forms'],
            'page_numbers': [],
            'content_length': len(ch),
            'complexity_score': calculate_complexity(ch) if 'calculate_complexity' in globals() else 0,
            'subsection_level': len(section_id.split('.')),
            'parent_section': section_id.split('.')[0] if '.' in section_id else None,
            'source_url': '',
            'version': version,
            'indexed_date': datetime.now(timezone.utc).isoformat(),
            'isDeleted': False
        })
    return docs

def _discover_latest_gpo_cfr_url() -> str:
    """Return a recent available GPO ECFR Title 26 XML URL.
    Strategy: try recent dates (last 180 days) via HTTP HEAD until one returns 200.
    """
    try:
        base = "https://www.govinfo.gov/bulkdata/ECFR/title-26"
        today = datetime.now(timezone.utc).date()
        for delta in range(0, 365):
            d = today - timedelta(days=delta)
            ds = d.isoformat()
            url = f"{base}/{ds}/ECFR-title26-{ds}.xml"
            try:
                resp = requests.head(url, timeout=30)
                if resp.status_code == 200:
                    logging.info(f"CFR autodiscovery selected {url}")
                    return url
            except Exception as _:
                continue
        logging.warning("CFR autodiscovery failed to find a recent snapshot (last 180 days)")
        return ""
    except Exception as e:
        logging.warning(f"Failed to autodiscover GPO CFR URL: {e}")
        return ""

def _write_diag(name: str, text: str):
    try:
        bsc = get_storage_client()
        if not bsc:
            logging.warning("_write_diag: no storage client")
            return
        container = 'tax-documents'
        container_client = bsc.get_container_client(container)
        if not container_client.exists():
            container_client.create_container()
        blob_client = container_client.get_blob_client(name)
        blob_client.upload_blob(text, overwrite=True)
        logging.info(f"_write_diag wrote {name}")
    except Exception as e:
        logging.error(f"_write_diag failed for {name}: {e}")

def _usc_pdf_fallback(usc_release: str | None = None):
    """Optional fallback: download USC PDF and convert to JSONL using pdfminer.six if available.
    Requires env USC_PDF_URL or discoverable link. Best-effort only.
    """
    try:
        if pdf_extract_text is None:
            _write_diag(f"_diag/usc_pdf_skip_{datetime.now(timezone.utc).isoformat()}.txt", "pdfminer not available")
            return
        # Determine PDF URL
        pdf_url = os.environ.get('USC_PDF_URL')
        if not pdf_url:
            # Try to discover a plausible PDF link from the downloads page
            page = _http_request("GET", f"{USC_BASE_URL}/download/download.shtml", timeout=60, retries=3).text
            m = re.search(r'href=["\'](releasepoints/[^"\']*usc26[^"\']*\.pdf)["\']', page, re.IGNORECASE)
            if m:
                pdf_url = f"{USC_BASE_URL}/{m.group(1)}"
        if not pdf_url:
            _write_diag(f"_diag/usc_pdf_no_url_{datetime.now(timezone.utc).isoformat()}.txt", "no-url")
            return
        if not _http_head_ok(pdf_url, timeout=30, retries=2):
            _write_diag(f"_diag/usc_pdf_head_not_ok_{datetime.now(timezone.utc).isoformat()}.txt", pdf_url)
            return
        # Download PDF to /tmp
        tmp_path = f"/tmp/usc26_{usc_release or 'pdf'}.pdf"
        with open(tmp_path, 'wb') as f:
            resp = _http_request("GET", pdf_url, timeout=300, retries=3)
            f.write(resp.content)
        text = pdf_extract_text(tmp_path) or ''
        if not text.strip():
            _write_diag(f"_diag/usc_pdf_empty_{datetime.now(timezone.utc).isoformat()}.txt", pdf_url)
            return
        # Chunk and upload as JSONL
        jsonl = StringIO()
        chunks = _chunk_text(re.sub(r"\s+", " ", text).strip(), target=3500, overlap=400)
        for idx, ch in enumerate(chunks or ['']):
            doc = {
                'id': f"usc:26:pdf:{usc_release or 'NA'}:{idx}",
                'doc_type': 'USC',
                'title_number': '26',
                'section_id': None,
                'section_title': f'USC Title 26 PDF chunk {idx}',
                'chunk_index': idx,
                'content': ch,
                'summary': (ch[:300] + '...') if len(ch) > 300 else ch,
                'keywords': extract_keywords(ch[:2000]) if 'extract_keywords' in globals() else [],
                'internal_references': [],
                'forms_mentioned': extract_forms(ch) if 'extract_forms' in globals() else [],
                'version': usc_release or 'pdf',
                'indexed_date': datetime.now(timezone.utc).isoformat(),
                'isDeleted': False
            }
            jsonl.write(json.dumps(doc, ensure_ascii=False) + "\n")
        bsc = get_storage_client()
        if not bsc:
            _write_diag(f"_diag/usc_pdf_error_{datetime.now(timezone.utc).isoformat()}.txt", "no storage client")
            return
        container = 'tax-documents'
        blob_name = f"USC/usc26_pdf_{usc_release or datetime.now(timezone.utc).date().isoformat()}.jsonl"
        cc = bsc.get_container_client(container)
        if not cc.exists():
            cc.create_container()
        bc = cc.get_blob_client(blob_name)
        bc.upload_blob(jsonl.getvalue(), overwrite=True)
        _write_diag(f"_diag/usc_pdf_uploaded_{datetime.now(timezone.utc).isoformat()}.txt", blob_name)
        logging.info(f"Uploaded USC PDF JSONL to {container}/{blob_name}")
    except Exception as e:
        logging.error(f"USC PDF fallback failed: {e}")
        _write_diag(f"_diag/usc_pdf_exception_{datetime.now(timezone.utc).isoformat()}.txt", str(e))

def ingest_cfr_from_gpo():
    """Download CFR Title 26 XML from GPO (auto-discover if not configured), convert to JSONL, upload, trigger indexer."""
    # Start from env if provided, but validate it; otherwise fall back to autodiscovery
    env_url = os.environ.get('CFR_XML_URL')
    cfr_xml_url = env_url
    if env_url and not _http_head_ok(env_url):
        logging.warning(f"Provided CFR_XML_URL not reachable (HEAD != 200): {env_url}; falling back to autodiscovery")
        _write_diag(f"_diag/cfr_env_url_invalid_{datetime.now(timezone.utc).isoformat()}.txt", env_url)
        cfr_xml_url = None
    if not cfr_xml_url:
        cfr_xml_url = _discover_latest_gpo_cfr_url()
    if not cfr_xml_url:
        # Fallback to eCFR API full XML for Title 26
        ecfr_version, ecfr_url = check_ecfr_updates()
        if not ecfr_version or not ecfr_url:
            logging.info("No CFR XML URL available; skipping CFR ingestion")
            _write_diag(f"_diag/cfr_no_url_{datetime.now(timezone.utc).isoformat()}.txt", "no-url")
            return
        try:
            _write_diag(f"_diag/cfr_selected_{ecfr_version}.txt", ecfr_url)
            logging.info(f"Downloading CFR XML from eCFR {ecfr_url}")
            resp = _http_request("GET", ecfr_url, timeout=300, retries=4)
            # Parse to documents suitable for JSONL upload
            ecfr_docs = parse_ecfr_xml_to_documents(resp.text, ecfr_version)
            jsonl = StringIO()
            for d in ecfr_docs:
                jsonl.write(json.dumps(d, ensure_ascii=False) + "\n")
            bsc = get_storage_client()
            if not bsc:
                logging.error("No storage client; cannot upload CFR JSONL")
                _write_diag(f"_diag/cfr_error_{ecfr_version}.txt", "no storage client")
                return
            container = 'tax-documents'
            blob_name = f"CFR/cfr26_{ecfr_version}.jsonl"
            cc = bsc.get_container_client(container)
            if not cc.exists():
                cc.create_container()
            bc = cc.get_blob_client(blob_name)
        bc.upload_blob(jsonl.getvalue(), overwrite=True)
            _write_diag(f"_diag/cfr_uploaded_{ecfr_version}.txt", blob_name)
            logging.info(f"Uploaded CFR JSONL to {container}/{blob_name}")
            # Update state timestamps
            st = get_last_processed_state() or {}
            st['last_cfr_index_time'] = datetime.now(timezone.utc).isoformat()
            save_last_processed_state(st)
            # Trigger indexer
            if SEARCH_SERVICE_NAME and SEARCH_API_KEY:
                url = f"https://{SEARCH_SERVICE_NAME}.search.windows.net/indexers/ustaxpublic-cfr-indexer-v3/run?api-version=2024-05-01-preview"
                r = requests.post(url, headers={'api-key': SEARCH_API_KEY, 'Content-Length': '0'}, data=b'')
                if r.status_code in (200, 202):
                    logging.info("Triggered CFR indexer run")
                else:
                    logging.warning(f"Failed to trigger CFR indexer: {r.status_code} {r.text}")
                    _write_diag(f"_diag/cfr_indexer_err_{ecfr_version}.txt", f"{r.status_code} {r.text}")
            else:
                logging.warning("SEARCH_SERVICE_NAME or SEARCH_API_KEY not set; not triggering indexer")
                _write_diag(f"_diag/cfr_indexer_skip_{ecfr_version}.txt", "no search creds")
        except Exception as e:
            logging.error(f"CFR ingestion (eCFR fallback) failed: {e}")
            _write_diag(f"_diag/cfr_exception_{datetime.now(timezone.utc).isoformat()}.txt", str(e))
        return
    # Determine version
    m = re.search(r"(\d{4}-\d{2}-\d{2})", cfr_xml_url)
    version = os.environ.get('CFR_VERSION') or (m.group(1) if m else datetime.now(timezone.utc).date().isoformat())
    try:
        _write_diag(f"_diag/cfr_selected_{version}.txt", cfr_xml_url)
        logging.info(f"Downloading CFR XML from {cfr_xml_url}")
        resp = _http_request("GET", cfr_xml_url, timeout=300, retries=4)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        total_sections = 0
        total_docs = 0
        # Build JSONL in memory and upload
        jsonl = StringIO()
        for sec in _cfr_iter_sections(root):
            extracted = _cfr_extract(sec)
            if not extracted:
                continue
            sid, head, content = extracted
            if not content:
                continue
            docs = _cfr_build_docs(sid, head, content, version)
            for d in docs:
                jsonl.write(json.dumps(d, ensure_ascii=False) + "\n")
            total_sections += 1
            total_docs += len(docs)
        _write_diag(f"_diag/cfr_counts_{version}.txt", f"sections={total_sections}, docs={total_docs}")
        logging.info(f"CFR: sections={total_sections}, docs={total_docs}")
        # Upload to Blob
        bsc = get_storage_client()
        if not bsc:
            logging.error("No storage client; cannot upload CFR JSONL")
            _write_diag(f"_diag/cfr_error_{version}.txt", "no storage client")
            return
        container = 'tax-documents'
        blob_name = f"CFR/cfr26_{version}.jsonl"
        cc = bsc.get_container_client(container)
        if not cc.exists():
            cc.create_container()
        bc = cc.get_blob_client(blob_name)
        bc.upload_blob(jsonl.getvalue(), overwrite=True)
        _write_diag(f"_diag/cfr_uploaded_{version}.txt", blob_name)
        logging.info(f"Uploaded CFR JSONL to {container}/{blob_name}")
        # Update state timestamps
        st = get_last_processed_state() or {}
        st['last_cfr_index_time'] = datetime.now(timezone.utc).isoformat()
        save_last_processed_state(st)
        # Trigger indexer
        if SEARCH_SERVICE_NAME and SEARCH_API_KEY:
            url = f"https://{SEARCH_SERVICE_NAME}.search.windows.net/indexers/ustaxpublic-cfr-indexer-v3/run?api-version=2024-05-01-preview"
            r = requests.post(url, headers={'api-key': SEARCH_API_KEY, 'Content-Length': '0'}, data=b'')
            if r.status_code in (200, 202):
                logging.info("Triggered CFR indexer run")
            else:
                logging.warning(f"Failed to trigger CFR indexer: {r.status_code} {r.text}")
                _write_diag(f"_diag/cfr_indexer_err_{version}.txt", f"{r.status_code} {r.text}")
        else:
            logging.warning("SEARCH_SERVICE_NAME or SEARCH_API_KEY not set; not triggering indexer")
            _write_diag(f"_diag/cfr_indexer_skip_{version}.txt", "no search creds")
    except Exception as e:
        logging.error(f"CFR ingestion failed: {e}")
        _write_diag(f"_diag/cfr_exception_{version}.txt", str(e))
@app.timer_trigger(schedule="0 0 * * 0", arg_name="timer", run_on_startup=False)
def WeeklyTaxIngestion(timer: func.TimerRequest) -> None:
    """Main function triggered weekly to ingest tax data"""
    
    logging.info("Starting weekly tax data ingestion")
    try:
        acct = _parse_account_name_from_conn(STORAGE_CONNECTION_STRING or '')
        _write_diag(f"_diag/heartbeat_{datetime.now(timezone.utc).isoformat()}.txt", f"storage_account={acct}")
    except Exception as e:
        logging.warning(f"heartbeat diag failed: {e}")
    
    # Get last processed state
    state = get_last_processed_state()
    last_usc_release = state.get('last_usc_release', '')
    last_ecfr_version = state.get('last_ecfr_version', '')
    
    documents_to_index = []
    updates_found = False
    
    # Check and process USC updates
    logging.info("Checking USC Title 26 updates...")
    usc_release, usc_url = check_usc_updates()
    
    if usc_release and usc_release != last_usc_release:
        logging.info(f"New USC release found: {usc_release} (was {last_usc_release})")
        
        try:
            # Validate link first
            if not _http_head_ok(usc_url, timeout=30, retries=3):
                logging.warning(f"USC ZIP not reachable (HEAD != 200): {usc_url}")
                _write_diag(f"_diag/usc_head_not_ok_{usc_release}.txt", usc_url)
            else:
                # Download USC Title 26 ZIP
                response = _http_request("GET", usc_url, timeout=300, retries=4)
                if response.status_code == 200:
                    import io
                    # Validate content-type or magic header to ensure it's a ZIP, not an HTML error like docnotfound.xhtml
                    ct = (response.headers.get('Content-Type') or '').lower()
                    if ('zip' not in ct) and not response.content[:2] == b'PK':
                        # Likely HTML error or redirect to docnotfound
                        snippet = response.text[:500] if 'html' in ct or response.content[:1] != b'P' else ''
                        _write_diag(f"_diag/usc_invalid_zip_{usc_release}.txt", f"content_type={ct}\n{snippet}")
                        logging.warning(f"USC URL did not return a ZIP: {usc_url} ({ct})")
                        # Try PDF fallback
                        _usc_pdf_fallback(usc_release)
                    else:
                        with zipfile.ZipFile(io.BytesIO(response.content)) as zip_file:
                            xml_candidates = [f for f in zip_file.namelist() if f.lower().endswith('.xml')]
                            # Prefer a file that contains 'usc' and '26' in the name
                            target_xml = None
                            for name in xml_candidates:
                                lname = name.lower()
                                if 'usc' in lname and '26' in lname:
                                    target_xml = name
                                    break
                            if not target_xml and xml_candidates:
                                target_xml = xml_candidates[0]
                            if not target_xml:
                                raise ValueError("USC ZIP did not contain any XML files")
                            xml_content = zip_file.read(target_xml)
                        _write_diag(f"_diag/usc_xml_selected_{usc_release}.txt", target_xml)
                        root = ET.fromstring(xml_content)
                        # Build JSONL in memory
                        jsonl = StringIO()
                        total_sections = 0
                        total_docs = 0
                        for sec in _usc_iter_sections(root):
                            sid, head, content = _usc_extract(sec)
                            if not sid or not content:
                                continue
                            docs = _usc_build_docs(sid, head, content, usc_release, usc_url)
                            for d in docs:
                                jsonl.write(json.dumps(d, ensure_ascii=False) + "\n")
                            total_sections += 1
                            total_docs += len(docs)
                        logging.info(f"USC: sections={total_sections}, docs={total_docs}")
                        # Upload to Blob
                        blob_service_client = get_storage_client()
                        if not blob_service_client:
                            logging.error("No storage client; cannot upload USC JSONL")
                            _write_diag(f"_diag/usc_error_{usc_release}.txt", "no storage client")
                        else:
                            container = 'tax-documents'
                            blob_name = f"USC/usc26_{usc_release}.jsonl"
                            container_client = blob_service_client.get_container_client(container)
                            if not container_client.exists():
                                container_client.create_container()
                            blob_client = container_client.get_blob_client(blob_name)
                            blob_client.upload_blob(jsonl.getvalue(), overwrite=True)
                            _write_diag(f"_diag/usc_uploaded_{usc_release}.txt", blob_name)
                            logging.info(f"Uploaded USC JSONL to {container}/{blob_name}")
                            # Update state timestamps
                            state['last_usc_index_time'] = datetime.now(timezone.utc).isoformat()
                            save_last_processed_state(state)
                            # Trigger USC indexer
                            if SEARCH_SERVICE_NAME and SEARCH_API_KEY:
                                url = f"https://{SEARCH_SERVICE_NAME}.search.windows.net/indexers/ustaxpublic-usc-indexer-v3/run?api-version=2024-05-01-preview"
                                r = requests.post(url, headers={'api-key': SEARCH_API_KEY, 'Content-Length': '0'}, data=b'')
                                if r.status_code in (200, 202):
                                    logging.info("Triggered USC indexer run")
                                else:
                                    logging.warning(f"Failed to trigger USC indexer: {r.status_code} {r.text}")
                                    _write_diag(f"_diag/usc_indexer_err_{usc_release}.txt", f"{r.status_code} {r.text}")
                            else:
                                logging.warning("SEARCH_SERVICE_NAME or SEARCH_API_KEY not set; not triggering USC indexer")
                                _write_diag(f"_diag/usc_indexer_skip_{usc_release}.txt", "no search creds")
                        # Update state
                        state['last_usc_release'] = usc_release
                        updates_found = True
                else:
                    # Fallback to PDF if XML zip fetched but cannot be processed
                    _usc_pdf_fallback(usc_release)
        
        except Exception as e:
            logging.error(f"Error processing USC data: {e}")
            _write_diag(f"_diag/usc_process_exception_{usc_release}.txt", str(e))
            # Fallback to USC PDF attempt
            _usc_pdf_fallback(usc_release)
    
    # Check and process eCFR updates
    logging.info("Checking eCFR Title 26 updates...")
    ecfr_version, ecfr_url = check_ecfr_updates()
    
    if ecfr_version and ecfr_version != last_ecfr_version:
        logging.info(f"New eCFR version found: {ecfr_version} (was {last_ecfr_version})")
        
        try:
            # Download eCFR Title 26 XML
            response = requests.get(ecfr_url, timeout=300)
            if response.status_code == 200:
                xml_content = response.text
                
                # Parse to documents
                ecfr_docs = parse_ecfr_xml_to_documents(xml_content, ecfr_version)
                documents_to_index.extend(ecfr_docs)
                
                state['last_ecfr_version'] = ecfr_version
                updates_found = True
                
                logging.info(f"Parsed {len(ecfr_docs)} eCFR documents")
        
        except Exception as e:
            logging.error(f"Error processing eCFR data: {e}")
    
    # Index documents if we have any
        if documents_to_index:
            logging.info(f"Indexing {len(documents_to_index)} documents...")
            
            if index_documents(documents_to_index):
                # Save state after successful indexing (eCFR path)
                state['last_cfr_index_time'] = datetime.now(timezone.utc).isoformat()
                save_last_processed_state(state)
                logging.info("Indexing completed successfully")
            else:
                logging.error("Indexing failed")
    else:
        logging.info("No updates found")
    
    # CFR ingestion via GPO bulk XML (weekly)
    try:
        ingest_cfr_from_gpo()
    except Exception as e:
        logging.error(f"CFR ingestion error: {e}")

    logging.info("Weekly tax data ingestion completed")

# Manual trigger for testing
@app.function_name("ManualTaxIngestion")
@app.route(route="ingest", methods=["POST"])
def ManualTaxIngestion(req: func.HttpRequest) -> func.HttpResponse:
    """Manual HTTP trigger for testing the ingestion process"""
    
    logging.info("Manual tax ingestion triggered")
    
    # Call the timer function logic
    WeeklyTaxIngestion(None)
    
    return func.HttpResponse("Tax ingestion completed", status_code=200)

# Public status endpoint for website
@app.function_name("Status")
@app.route(route="status", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def Status(req: func.HttpRequest) -> func.HttpResponse:
    try:
        st = get_last_processed_state() or {}
        payload = {
            'last_usc_release': st.get('last_usc_release'),
            'last_cfr_version': st.get('last_ecfr_version'),
            'last_usc_index_time': st.get('last_usc_index_time'),
            'last_cfr_index_time': st.get('last_cfr_index_time'),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        return func.HttpResponse(json.dumps(payload), status_code=200, mimetype='application/json')
    except Exception as e:
        return func.HttpResponse(json.dumps({'error': str(e)}), status_code=500, mimetype='application/json')
