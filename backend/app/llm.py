"""统一的 LLM 调用入口。三个模块都只通过这里调模型，换模型只改 .env。

支持任何 OpenAI 兼容接口（通义千问、DeepSeek、智谱、Kimi、OpenAI 等）。
没配置 LLM_API_KEY 时进入演示模式：chat() 返回 None，调用方使用规则兜底。
"""
import base64
import json
import os
from contextvars import ContextVar
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

API_KEY = os.getenv("LLM_API_KEY", "")
BASE_URL = os.getenv("LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
TEXT_MODEL = os.getenv("LLM_MODEL", "qwen-plus")
VISION_MODEL = os.getenv("LLM_VISION_MODEL", "qwen-vl-plus")

_default = OpenAI(api_key=API_KEY, base_url=BASE_URL) if API_KEY else None

# 首次启动页可以选别的模型：前端把接口地址、密钥、模型名放在请求头里，main.py 的中间件写进这里。
# 只在这一次请求里生效，不落盘。没选（推荐）时用 .env 里的配置。
_override: ContextVar[Optional[tuple[OpenAI, str, Optional[str]]]] = ContextVar("llm_override", default=None)


def use(base_url: str, api_key: str, model: str, vision_model: Optional[str] = None):
    return _override.set((OpenAI(api_key=api_key, base_url=base_url, timeout=60), model, vision_model))


def reset(token) -> None:
    _override.reset(token)


def _pick(vision: bool = False) -> tuple[Optional[OpenAI], str]:
    o = _override.get()
    if o:
        # 自定义模型没有单独的视觉模型时，就用同一个模型识图
        return o[0], (o[2] or o[1]) if vision else o[1]
    return _default, VISION_MODEL if vision else TEXT_MODEL


def enabled() -> bool:
    return _pick()[0] is not None


def chat(system: str, user: str, *, json_mode: bool = False, model: Optional[str] = None) -> Optional[str]:
    client, default_model = _pick()
    if not client:
        return None
    resp = client.chat.completions.create(
        model=model or default_model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_object"} if json_mode else None,
        temperature=0.2,
    )
    return resp.choices[0].message.content


def chat_json(system: str, user: str) -> Optional[dict]:
    text = chat(system, user, json_mode=True)
    return json.loads(text) if text else None


def vision_json(system: str, image: bytes, mime: str, prompt: str) -> Optional[dict]:
    client, vision_model = _pick(vision=True)
    if not client:
        return None
    url = f"data:{mime};base64,{base64.b64encode(image).decode()}"
    resp = client.chat.completions.create(
        model=vision_model,
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
