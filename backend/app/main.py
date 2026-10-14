from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import llm
from .modules import diagnosis, guide, intake, policy
from .schemas import BusinessData, Diagnosis, PolicyGuide

app = FastAPI(title="小企有数 API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"ok": True, "llm": llm.enabled(), "model": llm.TEXT_MODEL if llm.enabled() else None}


# ----- A：录入 -----
@app.post("/api/intake/extract")
async def extract(file: UploadFile = File(...)):
    txs = intake.extract_transactions(await file.read(), file.content_type or "image/jpeg")
    return {"transactions": [t.model_dump(mode="json") for t in txs], "llm": llm.enabled()}


@app.post("/api/intake/next-question")
def next_question(data: BusinessData):
    return {"next": intake.next_question(data)}


# ----- C：政策 -----
@app.post("/api/policy/match")
def policy_match(data: BusinessData):
    return [m.model_dump(mode="json") for m in policy.match(data)]


class Question(BaseModel):
    question: str
    data: Optional[BusinessData] = None  # 带上经营数据时，回答会结合这家店的体检结果
    policy_id: Optional[str] = None      # 从报告里某条政策点进来时，优先检索这条


@app.post("/api/policy/ask")
def policy_ask(q: Question):
    r = policy.ask(q.question, q.data, q.policy_id)
    for s in r["sources"]:
        s["has_guide"] = s["id"] in guide.GUIDES
    return r


@app.post("/api/policy/{policy_id}/guide", response_model=PolicyGuide)
def policy_guide(policy_id: str, data: BusinessData):
    g = guide.build_guide(policy_id, data)
    if g is None:
        raise HTTPException(404, "这条政策还没有引导步骤")
    return g


# ----- B：诊断（串起全流程） -----
@app.post("/api/diagnose", response_model=Diagnosis)
def diagnose(data: BusinessData):
    return diagnosis.diagnose(data, policy.match(data))
