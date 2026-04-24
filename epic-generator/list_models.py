
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY not set in .env")
    exit(1)
genai.configure(api_key=api_key)

print("="*80)
print("AVAILABLE GEMINI MODELS")
print("="*80)

try:
    models = genai.list_models()
    print(f"\nFound {len(list(models))} models:\n")

    models = genai.list_models()
    for model in models:
        print(f"Model: {model.name}")
        print(f"  Display Name: {model.display_name}")
        print(f"  Description: {model.description}")
        print(f"  Supported Methods: {model.supported_generation_methods}")
        print()

except Exception as e:
    print(f"Error listing models: {e}")
    print("\nTrying alternative method...")

    # Try to get specific model
    try:
        for model_name in ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro', 'models/gemini-pro']:
            try:
                model = genai.get_model(f"models/{model_name}")
                print(f"✓ {model_name} is available")
            except:
                print(f"✗ {model_name} is NOT available")
    except Exception as e2:
        print(f"Alternative method also failed: {e2}")
