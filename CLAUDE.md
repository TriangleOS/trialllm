# Claude Code handoff — shared Triangle API, not a model ownership claim

Repo: `TriangleOS/trialllm`. Existing website: https://trianglellm.lovable.app. Existing model hostname: `llm.triangleos.com` (verify the current Cloudflare account/project before changing DNS or build settings).

Read `README.md`, `docs/PORTAL_INTEGRATION.md`, `cloudflare/pages/DEPLOYMENT.md`, and `model/PROPRIETARY_MODEL_PROGRAM.md` first.

## Option 4 architecture

Keep three things separated:
1. Triangle-owned API/gateway and auth/routing code in this repo.
2. Model research/training artifacts in `model/`, under restricted access and separate data/IP gates.
3. Upstream product/client integrations (AnythingLLM and AnythingLLM Mobile) in their existing forks, without copying proprietary credentials into them or relicensing upstream work.

Do not call the current randomly initialized tiny byte model a usable LLM. Do not claim Triangle has trained a model until a valid run with authorized data, held-out evaluations and controlled checkpoint exists. Do not make a legal ownership/exclusivity claim without counsel review and chain-of-title evidence.

## Implementation tasks

- Integrate Pages Functions into the existing Cloudflare Pages project without replacing the existing site output or DNS configuration. Verify preview deployment on `llm.triangleos.com`.
- Support multiple exact portal origins via `TRIANGLE_ALLOWED_ORIGINS`; test OPTIONS, auth, CORS and bearer-token flows.
- Implement the published routes: `/v1/region`, `/v1/models`, `/v1/chat/completions`. Validate bodies and reject client-selected regions, upstream URLs, model service credentials and unknown fields. Keep stream behavior explicit until model token streaming exists.
- Add robust distributed rate limiting/quotas using approved Cloudflare controls, response size/time bounds, safe errors, request IDs, dependency timeout, and privacy-preserving metrics. Do not log prompts or outputs.
- Review Cloudflare Pages outbound access to inference origin; constrain origin, use TLS and workload identity/mTLS or equivalent, and make the service non-public. A shared token is prototype-grade only.
- Wire `integrations/lovable/triangleApi.ts` into the actual Lovable auth session; wire `integrations/portals/triangleClient.ts` into other approved web portals and `integrations/mobile/triangleApi.ts` into React Native auth/chat. Do not claim the helper is a complete native app integration. Test device securely stored refresh tokens, logout/revoke, region mismatch, cancel, offline and unavailability.
- Add automated tests for auth/JWKS errors, missing region claim, region mismatch, client override attempts, origin allowlist, request validation, model timeout/error, no cross-region fallback and mobile adapter behavior.
- Train only with Triangle-controlled and documented authorized data. Implement corpus-manifest validation, split-safe preprocessing, reproducible configs, held-out regional-language evaluation, memorization checks, safety/privacy evaluation, checkpoint signing, artifact access control and rollback. Keep datasets/checkpoints out of Git.
- Update deployment docs with exact Pages project settings only after verifying them. Do not invent configured Cloudflare IDs, secrets, model host or identity settings.
- Run CI tests/typecheck/lint and a Cloudflare Pages preview deployment; report exact commands/results and unresolved blockers.

## Legal/technical release gates

`model/PROPRIETARY_MODEL_PROGRAM.md` lists data, contributor, evaluation and legal gates. Preserve all third-party notices. AnythingLLM server is MIT; current AnythingLLM Mobile is GPL-3.0-or-later. Model/runtime dependency terms and model/data rights are distinct from those repositories' app licenses. No implementation can guarantee the legal word “proprietary”; counsel must approve the claim on facts and jurisdiction.

## Project facts (TriangleOS)

- Sign-in is the shared Supabase project `kvpnvqmgxbqxfwqdrrmm`; there is no separate OIDC server. Region access is `app_metadata.triangle_region_id`.
- The model host is the existing IONOS VPS (System 2) behind an outbound-only Cloudflare Tunnel. Do not add paid hosts.
- Only Claude Pro is paid. Warn before anything that can cost money (GPU hosts, app store accounts, EAS builds, paid Cloudflare plans).

## Checks before pushing

```bash
npm ci && npm run typecheck && npm test
(cd sdk && npm ci && npm run build)
(cd mobile && npm ci && npx tsc --noEmit)
pip install -r model/requirements-dev.txt && pytest tests/model
```
