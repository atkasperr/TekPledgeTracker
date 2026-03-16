import openai

openai.api_key = "sk-"

client = openai.OpenAI(api_key="sk-")

try:
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Hello!"}]
    )
    print("API key works! Response:", response.choices[0].message.content)
except Exception as e:
    print("API key test failed:", e)