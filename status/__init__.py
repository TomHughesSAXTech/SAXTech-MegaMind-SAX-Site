import azure.functions as func
import json
import os, sys
from datetime import datetime, timezone

# Lazy import of function_app inside main to avoid module import-time failures

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        CURRENT_DIR = os.path.dirname(__file__)
        ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir))
        if ROOT_DIR not in sys.path:
            sys.path.append(ROOT_DIR)
        try:
            from function_app import get_last_processed_state
        except Exception:
            from app_core import get_last_processed_state
        st = get_last_processed_state() or {}
        payload = {
            'last_usc_release': st.get('last_usc_release'),
            'last_cfr_version': st.get('last_ecfr_version'),
            'last_usc_index_time': st.get('last_usc_index_time'),
            'last_cfr_index_time': st.get('last_cfr_index_time'),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        return func.HttpResponse(json.dumps(payload), mimetype='application/json', status_code=200)
    except Exception as e:
        return func.HttpResponse(json.dumps({'error': str(e)}), mimetype='application/json', status_code=500)
