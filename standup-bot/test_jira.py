import os
import json
from dotenv import load_dotenv
from atlassian import Jira

load_dotenv()

jira = Jira(
    url=os.environ.get("JIRA_URL"),
    username=os.environ.get("JIRA_EMAIL"),
    password=os.environ.get("JIRA_API_TOKEN"),
    cloud=True
)

print(f"Connecting to: {os.environ.get('JIRA_URL')}")
print(f"As User: {os.environ.get('JIRA_EMAIL')}")

try:
    # 1. Get raw project data
    projects = jira.projects()
    
    if not projects:
        print("\n⚠️  The connection worked, but Jira returned ZERO projects.")
        print("Action: Go to Jira in your browser and create a 'Software' project first.")
    else:
        print(f"\n✅ Success! Found {len(projects)} project(s):")
        for p in projects:
            print(f"- Name: {p['name']} | Key: {p['key']}")

except Exception as e:
    print(f"\n❌ Error during deep debug: {e}")