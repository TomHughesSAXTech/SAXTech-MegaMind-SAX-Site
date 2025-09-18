#!/usr/bin/env python3
"""
Fix Azure AI Search Index Configuration
Resolves:
1. Invalid normalizer configuration
2. Missing vectorizer configuration
"""

import json
import subprocess
import sys
from typing import Dict, Any, List

def get_search_key(service_name: str, resource_group: str) -> str:
    """Get the admin key for the search service"""
    cmd = f"az search admin-key show --service-name {service_name} --resource-group {resource_group} --query primaryKey -o tsv"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

def get_index_schema(service_name: str, index_name: str, api_key: str) -> Dict:
    """Get the current index schema"""
    import requests
    
    url = f"https://{service_name}.search.windows.net/indexes/{index_name}?api-version=2023-11-01"
    headers = {"api-key": api_key}
    
    response = requests.get(url, headers=headers)
    return response.json()

def create_fixed_index_schema(current_schema: Dict) -> Dict:
    """Create a fixed version of the index schema"""
    
    # Copy the current schema
    fixed_schema = current_schema.copy()
    
    # Fix fields with normalizer issues
    for field in fixed_schema['fields']:
        # Remove invalid normalizer configurations
        if 'normalizer' in field and field.get('normalizer') not in ['standard', 'lowercase', 'uppercase', 'asciifolding']:
            del field['normalizer']
            
        # For filterable string fields, add lowercase normalizer if appropriate
        if (field.get('type') == 'Edm.String' and 
            field.get('filterable') == True and 
            field.get('searchable') != True and
            field.get('key') != True):
            field['normalizer'] = 'lowercase'
    
    # Add vectorizer configuration for vector fields
    if 'vectorSearch' not in fixed_schema:
        fixed_schema['vectorSearch'] = {}
    
    # Ensure we have the algorithms defined
    if 'algorithms' not in fixed_schema['vectorSearch']:
        fixed_schema['vectorSearch']['algorithms'] = [
            {
                "name": "hnsw-algorithm",
                "kind": "hnsw",
                "hnswParameters": {
                    "metric": "cosine",
                    "m": 4,
                    "efConstruction": 400,
                    "efSearch": 500
                }
            }
        ]
    
    # Add vectorizers configuration (for Azure OpenAI integration)
    if 'vectorizers' not in fixed_schema['vectorSearch']:
        fixed_schema['vectorSearch']['vectorizers'] = [
            {
                "name": "openai-vectorizer",
                "kind": "azureOpenAI",
                "azureOpenAIParameters": {
                    "resourceUri": "https://saxmegamindopenai.openai.azure.com",
                    "deploymentId": "text-embedding-ada-002",
                    "apiKey": "YOUR_OPENAI_KEY",  # This should be configured in the service
                    "modelName": "text-embedding-ada-002"
                }
            }
        ]
    
    # Update profiles to use vectorizers
    if 'profiles' not in fixed_schema['vectorSearch']:
        fixed_schema['vectorSearch']['profiles'] = []
    
    # Update or add the vector profile with vectorizer
    profile_found = False
    for profile in fixed_schema['vectorSearch']['profiles']:
        if profile['name'] == 'vector-profile':
            profile['algorithmConfigurationName'] = 'hnsw-algorithm'
            profile['vectorizer'] = 'openai-vectorizer'
            profile_found = True
            break
    
    if not profile_found:
        fixed_schema['vectorSearch']['profiles'].append({
            "name": "vector-profile",
            "algorithmConfigurationName": "hnsw-algorithm",
            "vectorizer": "openai-vectorizer"
        })
    
    # Add semantic search configuration if not present
    if 'semantic' not in fixed_schema:
        fixed_schema['semantic'] = {
            "configurations": [
                {
                    "name": "semantic-config",
                    "prioritizedFields": {
                        "titleField": {
                            "fieldName": "title"
                        },
                        "prioritizedContentFields": [
                            {
                                "fieldName": "content"
                            },
                            {
                                "fieldName": "summary"
                            }
                        ],
                        "prioritizedKeywordsFields": [
                            {
                                "fieldName": "tags"
                            },
                            {
                                "fieldName": "keywords"
                            }
                        ]
                    }
                }
            ]
        }
    
    return fixed_schema

def update_index(service_name: str, index_name: str, api_key: str, schema: Dict) -> bool:
    """Update the index with the fixed schema"""
    import requests
    
    url = f"https://{service_name}.search.windows.net/indexes/{index_name}?api-version=2023-11-01&allowIndexDowntime=true"
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json"
    }
    
    response = requests.put(url, headers=headers, json=schema)
    
    if response.status_code in [200, 201, 204]:
        return True
    else:
        print(f"Error updating index: {response.status_code}")
        print(response.text)
        return False

def main():
    """Main function to fix the search index"""
    
    # Configuration
    SERVICE_NAME = "saxtechmegamindsearch3"
    RESOURCE_GROUP = "SAXTech-AI"
    INDEX_NAME = "itglue-comprehensive-index"
    
    print(f"🔧 Fixing Azure AI Search Index: {INDEX_NAME}")
    print(f"   Service: {SERVICE_NAME}")
    print(f"   Resource Group: {RESOURCE_GROUP}")
    print()
    
    # Get admin key
    print("📋 Getting search service admin key...")
    api_key = get_search_key(SERVICE_NAME, RESOURCE_GROUP)
    
    if not api_key:
        print("❌ Failed to get admin key")
        return 1
    
    # Get current schema
    print("📖 Fetching current index schema...")
    current_schema = get_index_schema(SERVICE_NAME, INDEX_NAME, api_key)
    
    # Save backup
    with open('index-schema-backup.json', 'w') as f:
        json.dump(current_schema, f, indent=2)
    print("💾 Saved backup to index-schema-backup.json")
    
    # Create fixed schema
    print("🔨 Creating fixed schema...")
    fixed_schema = create_fixed_index_schema(current_schema)
    
    # Save fixed schema for review
    with open('index-schema-fixed.json', 'w') as f:
        json.dump(fixed_schema, f, indent=2)
    print("💾 Saved fixed schema to index-schema-fixed.json")
    
    # Show changes
    print("\n📝 Schema Changes:")
    print("   ✅ Removed invalid normalizer configurations")
    print("   ✅ Added lowercase normalizer to appropriate fields")
    print("   ✅ Added Azure OpenAI vectorizer configuration")
    print("   ✅ Updated vector profiles with vectorizer")
    print("   ✅ Added semantic search configuration")
    
    # Ask for confirmation
    print("\n⚠️  This will update the index configuration.")
    response = input("Do you want to proceed? (yes/no): ")
    
    if response.lower() != 'yes':
        print("❌ Update cancelled")
        return 0
    
    # Update the index
    print("\n📤 Updating index...")
    if update_index(SERVICE_NAME, INDEX_NAME, api_key, fixed_schema):
        print("✅ Index successfully updated!")
    else:
        print("❌ Failed to update index")
        return 1
    
    return 0

if __name__ == "__main__":
    # Install required packages
    try:
        import requests
    except ImportError:
        print("Installing required package: requests")
        subprocess.run([sys.executable, "-m", "pip", "install", "requests"], check=True)
        import requests
    
    sys.exit(main())