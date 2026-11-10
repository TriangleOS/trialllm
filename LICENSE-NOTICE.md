# Licensing and ownership notice

This notice describes what this repository contains. It is not a legal opinion.

## Code written for TriangleOS

The gateway (`cloudflare/pages/`), regional API (`src/`), SDK (`sdk/`), mobile app (`mobile/`),
integrations, infrastructure files and the model code in `model/` were written for TriangleOS.
All rights reserved, Finsec Associates Limited, trading as TriangleOS, subject to the contributor
IP assignments listed as open in `model/PROPRIETARY_MODEL_PROGRAM.md` (Gate 0).

## Third-party software used as tools

Runtime and build dependencies keep their own licences and notices, which must be preserved in any
distribution: jose, Express, zod, FastAPI, Uvicorn, PyTorch, NumPy, Expo, React Native, React,
supabase-js, cloudflared, Vitest, TypeScript and their transitive dependencies. These are libraries
and tools, not model weights or training data.

## Model weights

- `model/triangle_model.py` defines a small byte-level Transformer that starts from random weights.
- **No trained weights exist yet.** No checkpoint is in this repository, and none may be committed.
- No upstream model code or weights (Qwen, Llama, DialoGPT or others) are used in this training path.
  The separate Qwen3 fine-tune in `TriangleOS/Triangle-LLM` is a different model and must credit Qwen.
- A future checkpoint is only as owned as its training data allows. See the gates in
  `model/PROPRIETARY_MODEL_PROGRAM.md` before calling any model "proprietary", "owned" or "exclusive".

## Not used

- `anythingllm-mobile` (GPL-3.0-or-later): no code from it is in `mobile/`. The Expo app here was written
  from scratch so it does not take on copyleft terms. If the separate fork is ever shipped, its own GPL
  obligations apply to it.
- AnythingLLM server (MIT) is not included. It can run separately as an optional RAG layer.
