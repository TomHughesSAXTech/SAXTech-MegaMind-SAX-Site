import azure.functions as func
import os, sys

# Do NOT import function_app at module import time; import lazily in main to avoid
# dependency issues during trigger discovery/build on Azure


def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        CURRENT_DIR = os.path.dirname(__file__)
        ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir))
        if ROOT_DIR not in sys.path:
            sys.path.append(ROOT_DIR)
        from function_app import WeeklyTaxIngestion  # lazy import
        WeeklyTaxIngestion(None)
        return func.HttpResponse("Tax ingestion completed", status_code=200)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)
