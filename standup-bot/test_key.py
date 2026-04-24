import os
from dotenv import load_dotenv
import openai

# 1. Load the Environment
load_dotenv()
api_key = os.environ.get("OPENAI_API_KEY")

print("------------------------------------------------")
# 2. Check if Key exists
if not api_key:
    print("❌ ERROR: No API Key found.")
    print("Make sure your .env file is saved and has OPENAI_API_KEY=sk-...")
    exit()
else:
    print(f"✅ Key found! It starts with: {api_key[:8]}...")

# 3. Try to talk to OpenAI
print("Attempting to connect to OpenAI...")

try:
    client = openai.OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-5",
        messages=[{"role": "user", "content": "Say 'Connection Successful'"}],
    )
    print(f"🎉 SUCCESS: {response.choices[0].message.content}")
    print("------------------------------------------------")

except openai.RateLimitError:
    print("ERROR: Rate Limit / Quota Exceeded")
    print("SOLUTION: You need to add $5 credit at platform.openai.com/account/billing")
    print("Note: A 'ChatGPT Plus' subscription does NOT count for this.")

except openai.AuthenticationError:
    print("ERROR: Invalid API Key")
    print("SOLUTION: Generate a new key and paste it carefully into .env")

except Exception as e:
    print(f"ERROR: {e}")
   