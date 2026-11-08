# Triangle LLM — application, edge gateway, and from-scratch model research

This repository now has two distinct parts:

1. A Node/Express regional API foundation that currently proxies an OpenAI-compatible inference service.
2. A new **from-scratch model research scaffold** under `model/` and a Cloudflare Pages Functions gateway under `cloudflare/pages/functions/`.

## Important: what is and is not proprietary

The new model code defines and initializes a small decoder-only Transformer and can train it from a Triangle-supplied corpus. It uses no pretrained checkpoint and downloads no model weights or datasets. That is a technical starting point for creating original weights. **It does not include training data, trained weights, a capable production model, or proof that Triangle has legally exclusive rights to a model.** The initialized model is random and unusable until trained.

Cloudflare Pages/Workers is an edge API and static-site runtime; it is **not a GPU training or LLM-inference environment**. The Pages gateway routes to a separately operated Triangle inference service. The included PyTorch/FastAPI service is a prototype requiring a Triangle-controlled GPU host or equivalent compute. PyTorch, Python, Cloudflare and operating-system runtimes are external tools/infrastructure, not pretrained model resources. A literal no-external-dependencies requirement is incompatible with operating on Cloudflare and using a practical training stack.

“Proprietary” has both a technical and legal meaning. Original architecture/weights/data alone do not automatically establish legal ownership. Establish chain of title, work-for-hire/assignment agreements, lawful data rights, third-party notices, checkpoint and tokenizer provenance, and local legal advice before making exclusivity or ownership claims. This repository does not provide legal advice or certify that any claim is lawful.

## Contents

- `cloudflare/pages/functions/_middleware.ts`: JWT signature/issuer/audience and signed region-claim checks for Pages Functions.
- `cloudflare/pages/functions/v1/region.ts`: returns the region assigned to the authenticated user.
- `cloudflare/pages/functions/v1/chat/completions.ts`: validates chat input and proxies only to the configured private inference origin, using a separate service token.
- `cloudflare/pages/wrangler.toml.example`: Pages runtime settings. Merge Functions into the current Pages project’s source/build; do not replace the existing `llm.triangleos.com` site output unintentionally.
- `model/triangle_model.py`: original small decoder-only Transformer definition.
- `model/train.py`: deterministic-seed next-byte prediction training from a local UTF-8 corpus, with corpus hash and configuration in checkpoint metadata.
- `model/serve.py`: private FastAPI inference prototype with shared-token and region checks; never expose this directly to browsers.
- `model/requirements.txt`: runtime/training dependencies (not model weights).
- `model/PROPRIETARY_MODEL_PROGRAM.md`: data rights, training, evaluation, legal and release gates.
- `integrations/lovable/triangleApi.ts`: browser-side API client for the existing Lovable frontend.

The existing Node API remains available; it still proxies an external OpenAI-compatible endpoint. Do not confuse that API path with the new from-scratch model prototype.

## From-scratch model setup

Use only a corpus Triangle has rights to use, with consent/terms documented. Do not download a public corpus or pretrained model for this “from-scratch” path. Keep raw text out of Git and out of the web/API deployment.

```bash
cd model
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
# Place an authorized UTF-8 corpus outside Git, then:
python train.py --data /secure/path/triangle_corpus.txt --out /secure/path/triangle-checkpoint.pt --steps 1000
```

This compact implementation is for engineering validation, not a production-scale foundation model. It uses byte-level tokenization (no external tokenizer or tokenizer vocabulary), causal self-attention, and next-byte training. Training quality depends on data rights, volume, language representation, hardware, and rigorous testing. Train/evaluate first in a secured environment; do not commit corpora or checkpoints.

Run the prototype inference service in the same private network as the model checkpoint:

```bash
export TRIANGLE_MODEL_CHECKPOINT=/secure/path/triangle-checkpoint.pt
export TRIANGLE_REGION_ID=example-region
export TRIANGLE_INFERENCE_TOKEN='use-a-long-random-secret-from-a-secret-manager'
uvicorn serve:app --host 0.0.0.0 --port 8000
```

Never expose this port to the public Internet. Terminate TLS at a trusted private ingress and configure Cloudflare to reach only that ingress. The prototype token is a shared service credential; rotate it, store it in a secret manager, and plan stronger workload identity/mTLS for production.

## Cloudflare Pages Functions setup

1. Back up the current Pages project configuration and verify what currently serves `llm.triangleos.com`.
2. Add/merge `cloudflare/pages/functions/` into the **existing** Pages project source so its current static/site build output remains intact. Do not replace the existing site's output with this API scaffold.
3. Set the Pages project’s `TRIANGLE_REGION_ID`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`, `TRIANGLE_ALLOWED_ORIGIN`, and `TRIANGLE_MODEL_ORIGIN` variables. `TRIANGLE_MODEL_ORIGIN` must be the private-region inference ingress, not a public third-party model API.
4. Add `TRIANGLE_INFERENCE_TOKEN` as a Cloudflare secret, and set the same value in the private inference service’s secret manager.
5. The identity provider must issue the signed `triangle_region_id` claim only from trusted admin/tenant policy. The client cannot choose it.
6. Configure DNS/custom domain and private ingress routing for the actual Pages project. Verify that inference traffic reaches only the matching region and is not routed through cross-region logs/proxies.
7. Test with wrong/missing claims, wrong region, oversized requests, invalid JWTs, unavailable model host, and no silent region fallback before enabling production traffic.

The example Wrangler config is a template, not proof the existing Pages project is configured or deployable. Cloudflare deployment and account bindings must be supplied by the project owner.

## Cloudflare API contract

- `GET /v1/region` — bearer token required; returns the deployment region after checking the signed user claim.
- `POST /v1/chat/completions` — bearer token required; accepts `{messages, stream?, temperature?, max_tokens?}`. The gateway picks the model service; callers cannot set the model, region or upstream URL. The current model prototype serves non-streaming requests only and returns 501 for streaming until real token streaming is implemented.
- The gateway forwards a server-side inference token and deployment region to the private model service. It never forwards the browser JWT to the model host.

The included inference prototype is not a hardened production service. Add request quotas, observability that excludes prompts, workload identity, TLS validation, model-artifact integrity and vulnerability review before production.

## Existing web app

Copy or adapt `integrations/lovable/triangleApi.ts` in the existing Lovable project and use the authenticated user's access token. Set the API base URL to the configured API hostname. Do not send region selection as an authorization control and do not put model-service secrets in frontend variables. Preserve the existing website and UI; this repository does not replace it.

## Legal/technical release gates

Before describing a shipped model as Triangle-owned/proprietary, complete `model/PROPRIETARY_MODEL_PROGRAM.md`, have counsel review the jurisdiction-specific position, audit every source/data/code dependency, keep signed contributor and employee IP assignments, establish dataset rights and deletion controls, record training runs and hashes, assess model memorization/security, and document the exact weights/checkpoint ownership. Fine-tunes may carry base-model rights; this particular scaffold avoids base weights but still requires data and contributor rights. There is no code-only step that guarantees exclusive legal status.
