import os
import json

from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),

    base_url="https://openrouter.ai/api/v1"
)


async def enrich_items(items):

    prompt = f"""
You are a receipt parser.

Your task:
- normalize product names
- detect brand
- detect category
- detect promotional item

Return ONLY valid JSON array.

Input:
{json.dumps(items, ensure_ascii=False)}
"""

    response = await client.chat.completions.create(
        model="meta-llama/llama-3.3-70b-instruct:free",

        messages=[
            {
                "role": "system",
                "content": "You return only JSON."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],

        temperature=0
    )

    content = response.choices[0].message.content

    try:
        return json.loads(content)

    except Exception:
        return items