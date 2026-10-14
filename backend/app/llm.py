"""统一的 LLM 调用入口。三个模块都只通过这里调模型，换模型只改 .env。

支持任何 OpenAI 兼容接口（通义千问、DeepSeek、智谱、Kimi、OpenAI 等）。
没配置 LLM_API_KEY 时进入演示模式：chat() 返回 None，调用方使用规则兜底。
"""
import base64
import json
import os
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

API_KEY = os.getenv("LLM_API_KEY", "")
BASE_URL = os.getenv("LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
TEXT_MODEL = os.getenv("LLM_MODEL", "qwen-plus")
VISION_MODEL = os.getenv("LLM_VISION_MODEL", "qwen-vl-plus")

_client = OpenAI(api_key=API_KEY, base_url=BASE_URL) if API_KEY else None


def enabled() -> bool:
    return _client is not None


def chat(system: str, user: str, *, json_mode: bool = False, model: Optional[str] = None) -> Optional[str]:
    if not _client:
        return None
    resp = _client.chat.completions.create(
        model=model or TEXT_MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_object"} if json_mode else None,
        temperature=0.2,
    )
    return resp.choices[0].message.content


def chat_json(system: str, user: str) -> Optional[dict]:
    text = chat(system, user, json_mode=True)
    return json.loads(text) if text else None


def vision_json(system: str, image: bytes, mime: str, prompt: str) -> Optional[dict]:
    if not _client:
        return None
    url = f"data:{mime};base64,{base64.b64encode(image).decode()}"
    resp = _client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": url}},
                {"type": "text", "text": prompt},
            ]},
        ],
        temperature=0,
    )
    text = resp.choices[0].message.content or ""
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    return json.loads(text)
