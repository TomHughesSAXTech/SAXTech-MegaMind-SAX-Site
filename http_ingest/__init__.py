import azure.functions as func
import json
import os, sys

# Ensure we can import the app module from package root
CURRENT_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)
import function_app as appmod


def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        # Call the weekly ingestion logic directly
        appmod.WeeklyTaxIngestion(None)
        return func.HttpResponse("Tax ingestion completed", status_code=200)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)
