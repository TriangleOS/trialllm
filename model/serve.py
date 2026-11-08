from __future__ import annotations

import hmac
import os
import threading
import time
import uuid
from pathlib import Path

import torch
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from triangle_model import TriangleByteLM

CHECKPOINT_PATH = Path(os.environ["TRIANGLE_MODEL_CHECKPOINT"])
REGION_ID = os.environ["TRIANGLE_REGION_ID"]
SERVICE_TOKEN = os.environ["TRIANGLE_INFERENCE_TOKEN"]
if len(SERVICE_TOKEN) < 32:
    raise RuntimeError("TRIANGLE_INFERENCE_TOKEN must be at least 32 characters")
DEVICE = torch.device(os.environ.get("TRIANGLE_MODEL_DEVICE", "cuda" if torch.cuda.is_available() else "cpu"))

# weights_only avoids arbitrary object unpickling; checkpoint must still be access-controlled.
checkpoint = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=True)
if checkpoint.get("format") != "triangle-byte-lm-v1":
    raise RuntimeError("Unsupported model artifact format")
model = TriangleByteLM(**{k: checkpoint["model_config"][k] for k in ("width", "layers", "heads", "context")})
model.load_state_dict(checkpoint["model_state_dict"])
model.to(DEVICE).eval()
generation_lock = threading.Lock()
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


class Message(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1, max_length=20000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=40)
    stream: bool = False
    temperature: float = Field(default=0.8, ge=0.1, le=1.5)
    max_tokens: int = Field(default=128, ge=1, le=512)
    model: str | None = None


def authorized(authorization: str | None, region: str | None) -> None:
    expected = f"Bearer {SERVICE_TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Service authentication required")
    if region != REGION_ID:
        raise HTTPException(status_code=403, detail="Region mismatch")


def build_prompt(messages: list[Message]) -> str:
    # Explicit, deterministic chat formatting; quality requires a suitably trained corpus.
    return "\n".join(f"{m.role}: {m.content}" for m in messages) + "\nassistant:"


def generate_text(prompt: str, max_tokens: int, temperature: float) -> str:
    token_ids = torch.tensor([[1, *[b + 3 for b in prompt.encode("utf-8")]]], dtype=torch.long, device=DEVICE)
    with generation_lock, torch.inference_mode():
        generated = model.generate(token_ids, max_new_tokens=max_tokens, temperature=temperature, top_k=40)[0]
    new_ids = generated[token_ids.shape[1]:].tolist()
    byte_values = [token - 3 for token in new_ids if 3 <= token <= 258]
    return bytes(byte_values).decode("utf-8", errors="ignore").strip()


@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.post("/v1/chat/completions")
def completion(body: ChatRequest, authorization: str | None = Header(default=None), x_triangle_region: str | None = Header(default=None)):
    authorized(authorization, x_triangle_region)
    if body.stream:
        raise HTTPException(status_code=501, detail="Streaming generation is not implemented")
    text = generate_text(build_prompt(body.messages), body.max_tokens, body.temperature)
    return JSONResponse({
        "id": f"triangle-{uuid.uuid4()}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": "triangle-from-scratch-research-v1",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "length"}],
        "usage": {"prompt_tokens": 0, "completion_tokens": len(text), "total_tokens": len(text)},
        "notice": "Research prototype; output may be incoherent or unsafe.",
    })
