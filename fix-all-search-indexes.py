#!/usr/bin/env python3
"""
Comprehensive Azure AI Search Index Fix
Fixes all indexes in saxmegamind-search service:
- auditorpublic
- ld-documents  
- sop-documents
- ustaxpublic

Resolves:
1. Invalid normalizer configurations
2. Missing vectorizers for text-embedding-3-small
3. Missing semantic search configurations
4. Field configuration issues
5. Scoring profiles
"""

import json
import subprocess
import sys
import time
from typing import Dict, Any, List, Optional

class AzureSearchIndexFixer:
    def __init__(self, service_name: str, resource_group: str):
        self.service_name = service_name
        self.resource_group = resource_group
        self.api_version = "2023-11-01"
        self.api_key = None
        
    def get_search_key(self) -> str:
        """Get the admin key for the search service"""
        cmd = f"az search admin-key show --service-name {self.service_name} --resource-group {self.resource_group} --query primaryKey -o tsv"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        self.api_key = result.stdout.strip()
        return self.api_key
    
    def get_all_indexes(self) -> List[str]:
        """Get list of all indexes in the service"""
        import requests
        url = f"https://{self.service_name}.search.windows.net/indexes?api-version={self.api_version}"
        headers = {"api-key": self.api_key}
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return [idx['name'] for idx in response.json()['value']]
        return []
    
    def get_index_schema(self, index_name: str) -> Dict:
        """Get the current schema for an index"""
        import requests
        url = f"https://{self.service_name}.search.windows.net/indexes/{index_name}?api-version={self.api_version}"
        headers = {"api-key": self.api_key}
        response = requests.get(url, headers=headers)
        return response.json() if response.status_code == 200 else {}
    
    def analyze_index_issues(self, schema: Dict, index_name: str) -> Dict:
        """Analyze an index schema for issues"""
        issues = {
            'normalizer_issues': [],
            'missing_vectorizer': False,
            'missing_semantic': False,
            'field_issues': [],
            'vector_fields': [],
            'missing_scoring': False
        }
        
        # Check fields
        for field in schema.get('fields', []):
            # Check for invalid normalizers
            if 'normalizer' in field:
                if field['normalizer'] not in ['standard', 'lowercase', 'uppercase', 'asciifolding']:
                    issues['normalizer_issues'].append({
                        'field': field['name'],
                        'invalid_normalizer': field['normalizer']
                    })
            
            # Track vector fields
            if field.get('type') == 'Collection(Edm.Single)':
                issues['vector_fields'].append({
                    'name': field['name'],
                    'dimensions': field.get('dimensions'),
                    'profile': field.get('vectorSearchProfile')
                })
        
        # Check for vectorizer in vector search config
        vector_config = schema.get('vectorSearch', {})
        if issues['vector_fields'] and 'vectorizers' not in vector_config:
            issues['missing_vectorizer'] = True
        
        # Check for semantic configuration
        if 'semantic' not in schema:
            issues['missing_semantic'] = True
            
        # Check for scoring profiles
        if not schema.get('scoringProfiles'):
            issues['missing_scoring'] = True
            
        return issues
    
    def create_fixed_schema(self, current_schema: Dict, index_name: str) -> Dict:
        """Create a fixed version of the index schema"""
        fixed_schema = current_schema.copy()
        
        # Fix normalizer issues
        for field in fixed_schema.get('fields', []):
            # Remove invalid normalizers
            if 'normalizer' in field and field.get('normalizer') not in ['standard', 'lowercase', 'uppercase', 'asciifolding']:
                del field['normalizer']
            
            # Add lowercase normalizer for appropriate fields
            if (field.get('type') == 'Edm.String' and 
                field.get('filterable') == True and 
                field.get('searchable') != True and
                field.get('key') != True and
                'normalizer' not in field):
                field['normalizer'] = 'lowercase'
        
        # Add/Fix vector search configuration
        if 'vectorSearch' not in fixed_schema:
            fixed_schema['vectorSearch'] = {}
        
        # Ensure algorithms are defined
        if 'algorithms' not in fixed_schema['vectorSearch']:
            fixed_schema['vectorSearch']['algorithms'] = []
        
        # Add HNSW algorithm if not present
        hnsw_exists = any(algo['name'] == 'hnsw-algorithm' for algo in fixed_schema['vectorSearch']['algorithms'])
        if not hnsw_exists:
            fixed_schema['vectorSearch']['algorithms'].append({
                "name": "hnsw-algorithm",
                "kind": "hnsw",
                "hnswParameters": {
                    "metric": "cosine",
                    "m": 4,
                    "efConstruction": 400,
                    "efSearch": 500
                }
            })
        
        # Add vectorizers for text-embedding-3-small
        if 'vectorizers' not in fixed_schema['vectorSearch']:
            fixed_schema['vectorSearch']['vectorizers'] = []
        
        # Check if vectorizer exists
        vectorizer_exists = any(v['name'] == 'openai-text-embedding-3-small' for v in fixed_schema['vectorSearch']['vectorizers'])
        if not vectorizer_exists:
            fixed_schema['vectorSearch']['vectorizers'].append({
                "name": "openai-text-embedding-3-small",
                "kind": "azureOpenAI",
                "azureOpenAIParameters": {
                    "resourceUri": "https://saxmegamindopenai.openai.azure.com",
                    "deploymentId": "text-embedding-3-small",
                    "apiKey": "<Will use managed identity or key vault>",
                    "modelName": "text-embedding-3-small"
                }
            })
        
        # Update/Add vector profiles
        if 'profiles' not in fixed_schema['vectorSearch']:
            fixed_schema['vectorSearch']['profiles'] = []
        
        # Update existing profiles or add new one
        profile_updated = False
        for profile in fixed_schema['vectorSearch']['profiles']:
            if profile.get('name') in ['vector-profile', 'vector-config']:
                profile['algorithmConfigurationName'] = 'hnsw-algorithm'
                profile['vectorizer'] = 'openai-text-embedding-3-small'
                profile_updated = True
                break
        
        if not profile_updated:
            fixed_schema['vectorSearch']['profiles'].append({
                "name": "vector-profile",
                "algorithmConfigurationName": "hnsw-algorithm", 
                "vectorizer": "openai-text-embedding-3-small"
            })
        
        # Add semantic search configuration based on index type
        if 'semantic' not in fixed_schema:
            semantic_config = self.get_semantic_config_for_index(index_name, fixed_schema['fields'])
            if semantic_config:
                fixed_schema['semantic'] = semantic_config
        
        # Add scoring profiles
        if not fixed_schema.get('scoringProfiles'):
            fixed_schema['scoringProfiles'] = self.get_scoring_profiles_for_index(index_name)
        
        return fixed_schema
    
    def get_semantic_config_for_index(self, index_name: str, fields: List[Dict]) -> Optional[Dict]:
        """Get appropriate semantic configuration based on index name and fields"""
        field_names = [f['name'] for f in fields]
        
        # Default configuration
        config = {
            "configurations": [{
                "name": "semantic-config",
                "prioritizedFields": {}
            }]
        }
        
        # Set title field
        if 'title' in field_names:
            config["configurations"][0]["prioritizedFields"]["titleField"] = {"fieldName": "title"}
        elif 'name' in field_names:
            config["configurations"][0]["prioritizedFields"]["titleField"] = {"fieldName": "name"}
        elif 'subject' in field_names:
            config["configurations"][0]["prioritizedFields"]["titleField"] = {"fieldName": "subject"}
        
        # Set content fields
        content_fields = []
        for field in ['content', 'description', 'body', 'text', 'summary']:
            if field in field_names:
                content_fields.append({"fieldName": field})
        
        if content_fields:
            config["configurations"][0]["prioritizedFields"]["prioritizedContentFields"] = content_fields
        
        # Set keyword fields
        keyword_fields = []
        for field in ['tags', 'keywords', 'categories', 'topics']:
            if field in field_names:
                keyword_fields.append({"fieldName": field})
        
        if keyword_fields:
            config["configurations"][0]["prioritizedFields"]["prioritizedKeywordsFields"] = keyword_fields
        
        # Return config only if we have at least some fields configured
        if any(key in config["configurations"][0]["prioritizedFields"] 
               for key in ['titleField', 'prioritizedContentFields']):
            return config
        
        return None
    
    def get_scoring_profiles_for_index(self, index_name: str) -> List[Dict]:
        """Get appropriate scoring profiles based on index type"""
        profiles = []
        
        # Add relevance boosting profile
        profiles.append({
            "name": "relevance-boost",
            "text": {
                "weights": {
                    "title": 3,
                    "content": 2,
                    "tags": 1.5
                }
            }
        })
        
        # Add freshness profile if date fields exist
        profiles.append({
            "name": "freshness",
            "functions": [{
                "type": "freshness",
                "fieldName": "lastModified",
                "boost": 2,
                "interpolation": "linear",
                "freshness": {
                    "boostingDuration": "P30D"
                }
            }]
        })
        
        return profiles
    
    def update_index(self, index_name: str, schema: Dict) -> bool:
        """Update an index with the fixed schema"""
        import requests
        
        url = f"https://{self.service_name}.search.windows.net/indexes/{index_name}?api-version={self.api_version}&allowIndexDowntime=true"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        response = requests.put(url, headers=headers, json=schema)
        
        if response.status_code in [200, 201, 204]:
            return True
        else:
            print(f"  ❌ Error updating {index_name}: {response.status_code}")
            print(f"     {response.text[:200]}")
            return False
    
    def fix_all_indexes(self):
        """Main function to fix all indexes"""
        print(f"🔧 Azure AI Search Index Comprehensive Fix")
        print(f"   Service: {self.service_name}")
        print(f"   Resource Group: {self.resource_group}")
        print("=" * 60)
        
        # Get admin key
        print("\n📋 Getting search service admin key...")
        if not self.get_search_key():
            print("❌ Failed to get admin key")
            return False
        print("✅ Admin key retrieved")
        
        # Get all indexes
        print("\n📚 Fetching all indexes...")
        indexes = self.get_all_indexes()
        print(f"✅ Found {len(indexes)} indexes: {', '.join(indexes)}")
        
        # Process each index
        results = {}
        for index_name in indexes:
            print(f"\n{'='*60}")
            print(f"📊 Processing index: {index_name}")
            print("-" * 40)
            
            # Get current schema
            print(f"  📖 Fetching schema...")
            current_schema = self.get_index_schema(index_name)
            
            if not current_schema:
                print(f"  ❌ Failed to fetch schema")
                results[index_name] = 'failed'
                continue
            
            # Save backup
            backup_file = f'backup-{index_name}-{int(time.time())}.json'
            with open(backup_file, 'w') as f:
                json.dump(current_schema, f, indent=2)
            print(f"  💾 Backup saved to {backup_file}")
            
            # Analyze issues
            print(f"  🔍 Analyzing issues...")
            issues = self.analyze_index_issues(current_schema, index_name)
            
            print(f"  📝 Issues found:")
            if issues['normalizer_issues']:
                print(f"     • Normalizer issues: {len(issues['normalizer_issues'])} fields")
            if issues['missing_vectorizer']:
                print(f"     • Missing vectorizer for text-embedding-3-small")
            if issues['missing_semantic']:
                print(f"     • Missing semantic search configuration")
            if issues['missing_scoring']:
                print(f"     • Missing scoring profiles")
            if issues['vector_fields']:
                print(f"     • Vector fields: {len(issues['vector_fields'])}")
            
            # Create fixed schema
            print(f"  🔨 Creating fixed schema...")
            fixed_schema = self.create_fixed_schema(current_schema, index_name)
            
            # Save fixed schema
            fixed_file = f'fixed-{index_name}.json'
            with open(fixed_file, 'w') as f:
                json.dump(fixed_schema, f, indent=2)
            print(f"  💾 Fixed schema saved to {fixed_file}")
            
            # Update index
            print(f"  📤 Updating index...")
            if self.update_index(index_name, fixed_schema):
                print(f"  ✅ Index {index_name} successfully updated!")
                results[index_name] = 'success'
            else:
                results[index_name] = 'failed'
        
        # Summary
        print(f"\n{'='*60}")
        print("📊 SUMMARY")
        print("-" * 40)
        for index_name, status in results.items():
            icon = "✅" if status == 'success' else "❌"
            print(f"  {icon} {index_name}: {status}")
        
        return all(status == 'success' for status in results.values())

def main():
    """Main execution function"""
    # Configuration
    SERVICE_NAME = "saxmegamind-search"
    RESOURCE_GROUP = "SAXTech-AI"
    
    print("🚀 SAX MegaMind Search Index Comprehensive Fix")
    print("=" * 60)
    print("\n📝 This script will:")
    print("  • Fix invalid normalizer configurations")
    print("  • Add text-embedding-3-small vectorizer")
    print("  • Configure semantic search")
    print("  • Add scoring profiles")
    print("  • Update vector search profiles")
    print("\n⚠️  Indexes to be updated:")
    print("  • auditorpublic")
    print("  • ld-documents")
    print("  • sop-documents")
    print("  • ustaxpublic")
    
    response = input("\nDo you want to proceed? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Update cancelled")
        return 0
    
    # Run the fixer
    fixer = AzureSearchIndexFixer(SERVICE_NAME, RESOURCE_GROUP)
    success = fixer.fix_all_indexes()
    
    if success:
        print("\n🎉 All indexes successfully updated!")
    else:
        print("\n⚠️  Some indexes failed to update. Check the logs above.")
        
    return 0 if success else 1

if __name__ == "__main__":
    # Install required packages
    try:
        import requests
    except ImportError:
        print("Installing required package: requests")
        subprocess.run([sys.executable, "-m", "pip", "install", "requests"], check=True)
        import requests
    
    sys.exit(main())