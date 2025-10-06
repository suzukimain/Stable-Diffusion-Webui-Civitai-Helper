import gradio as gr
import requests
from modules import script_callbacks

# Fetch model names from Civitai API
def fetch_models(query: str):
    if not query:
        return []
    params = {
        "query": query,
        "sort": "Most Downloaded",
        "limit": 10,
    }
    try:
        response = requests.get("https://civitai.com/api/v1/models", params=params, timeout=10)
        data = response.json()
        return [item["name"] for item in data.get("items", [])]
    except Exception as e:
        print("Civitai API error:", e)
        return []


# Fetch tags from Civitai API
def fetch_tags(query: str):
    if not query:
        return []
    params = {
        "query": query,
        "limit": 10,
    }
    try:
        response = requests.get("https://civitai.com/api/v1/tags", params=params, timeout=10)
        data = response.json()["items"]
        sorted_tags = sorted(
        data, key=lambda x: x.get("modelCount", 0), reverse=True
        )
        return [tag["name"] for tag in sorted_tags]
    except Exception as e:
        print("Civitai Tag API error:", e)
        return []


def on_ui_tabs():
    return []


# Add FastAPI endpoint for suggestions
def on_app_started(demo, app):
    @app.get("/civitai_suggest")
    async def civitai_suggest(q: str = ""):
        return {"results": fetch_models(q)}
    
    @app.get("/civitai_tag_suggest")
    async def civitai_tag_suggest(q: str = ""):
        return {"results": fetch_tags(q)}


script_callbacks.on_ui_tabs(on_ui_tabs)
script_callbacks.on_app_started(on_app_started)