# Pages Functions handoff for `llm.triangleos.com`

This directory is an **API gateway package**, not an LLM runtime or training host. Merge the `functions/` routes into the existing Cloudflare Pages project serving `llm.triangleos.com`; keep its present frontend build output and configure its custom domain there. The code must not replace the current Lovable website or any existing Pages site.

## API consumers

One regional API is intended for TriangleOS portals that are allowed to use the same audience and policy. Each browser/mobile/desktop portal authenticates with the approved OIDC provider and sends its short-lived bearer access token. The API validates issuer, audience, signature, expiration and the issuer-signed `triangle_region_id` claim, then checks the claim against that deployment. A user cannot select or override region in a request.

- `GET https://llm.triangleos.com/v1/region`
- `GET https://llm.triangleos.com/v1/models`
- `POST https://llm.triangleos.com/v1/chat/completions`

The API uses an OpenAI-compatible chat-completions shape for easier portal integration. It does not expose a model/provider URL or credential to clients. `stream: true` currently returns an explicit 501 because the included inference prototype does not implement token streaming.

## Cloudflare Pages configuration

1. Confirm the existing Pages project, production branch, build command, output directory, and any current routes before modifying it. Do not overwrite the site build or DNS settings.
2. Copy/merge `functions/` from this folder into the Pages project source root. Pages expects a top-level `functions/` folder; if this repository remains a monorepo, configure the Pages project root to `cloudflare/pages` and point its static asset build/output to the existing portal build. Verify with a preview deployment before production.
3. Set non-secret vars in the Pages settings: `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`, `TRIANGLE_REGION_ID`, `TRIANGLE_ALLOWED_ORIGINS`, `TRIANGLE_MODEL_ORIGIN`, and optionally `TRIANGLE_PUBLIC_MODEL_ID`.
4. Store `TRIANGLE_INFERENCE_TOKEN` using Pages secret settings. Configure the identical value in the region-local inference service's secret manager. Do not place secrets in `wrangler.toml`, source, Lovable, or Git.
5. The OIDC provider must mint the region claim only from trusted user/tenant assignment. Never derive that signed claim from a client header, a query parameter, or IP geolocation.
6. Configure `llm.triangleos.com` as a custom domain on the Pages project. Confirm the identity provider, model origin, DNS, TLS, and all inference/data services are approved for the region.
7. Set Cloudflare rate limiting/WAF rules for the `/v1/chat/completions` route and appropriate account/session limits. Pages instance-local memory is not a distributed quota mechanism.
8. Validate wrong-region, no-region, invalid-token, oversized-body, model-outage, rate-limit, CORS, and unavailable-region cases before launch.

`TRIANGLE_MODEL_ORIGIN` must be a fixed operator-configured HTTPS origin in a controlled network. It is not accepted from requests. Ensure that origin is protected from public access; Cloudflare-to-origin should use a secured private tunnel/ingress, mTLS/workload identity where available, or equivalent network controls. A shared bearer secret alone is only a starter, not complete workload identity.

## Model runtime boundary

Cloudflare Pages Functions validates and authorizes requests but does not train or run this PyTorch model. The initial prototype is in `../../model/`, uses random initialization and requires a separately operated Triangle-controlled inference host with GPU/CPU resources. It is a research proof-of-plumbing and will not produce useful answers until trained on an authorized corpus. Do not deploy the random checkpoint as a product model.

## Lovable and portals

The existing Lovable frontend can copy/adapt `../../integrations/lovable/triangleApi.ts`. Other portals can call the same endpoints using the same OIDC audience. Do not expose the inference token. Mobile example code is in `../../integrations/mobile/triangleApi.ts`; the actual React Native application needs this adapter integrated with its auth/session and UI, and needs device testing and licensing review.

For data isolation, provision one Pages API deployment and one private inference/data plane per sovereignty region, each with a distinct `TRIANGLE_REGION_ID`, allowed-origin list and secrets. Do not use a central inference proxy if it would transfer prompt data across regions.
