# Claude Code implementation handoff

The Triangle Africa website already exists at https://trianglellm.lovable.app. This repository (`TriangleOS/trialllm`) contains an initial regional API foundation; it is not itself a trained model or a completed production deployment.

Related repositories inspected:
- `TriangleOS/anything-llm`: fork of AnythingLLM, MIT. Existing Express/Prisma server and mobile endpoints at `server/endpoints/mobile`.
- `TriangleOS/anythingllm-mobile`: fork of AnythingLLM Mobile, GPL-3.0-or-later. React Native Android client; source includes device registration and SSE chat integration.
- `TriangleOS/Qwen3`: fork of upstream Qwen3 source, not evidence Triangle owns the weights.
- `TriangleOS/searxng`: possible optional self-hosted web search; only add after residency and egress review.

## Required work

1. Read this repository README, source, environment example, and API tests. Preserve the existing site and integrations.
2. Adapt the API scaffold to the actual Lovable project's auth/session mechanism. Establish a secure server-to-server or browser-to-API flow without exposing model or AnythingLLM admin credentials. The frontend must use `GET /v1/region` for display and must not choose an authoritative region.
3. Decide whether this API is the primary chat backend or an API gateway to a region-local AnythingLLM server. If AnythingLLM is used, preserve its actual user/workspace auth model and `/api/mobile` contract; don't pretend a model chat-completions endpoint provides AnythingLLM's RAG, documents, agents, or mobile device registration.
4. For AnythingLLM web and mobile routes, add server-enforced region and workspace/tenant authorization after authenticated identity is established. Audit workspace listing/content, documents, threads, streaming chat, registrations, device-token validation and any data-bearing endpoints. Deny missing/anonymous/unassigned identities in Triangle production. Never trust a request header/body for region assignment.
5. For mobile, inspect and adapt `TriangleOS/anythingllm-mobile`'s `src/utils/AnythingLLMExternal`, `src/utils/AiProviders/delegatedProvider`, and `src/screens/ConnectToInstance`. Its client uses `/api/mobile`, `x-anythingllm-mobile-device-token`, and `send/stream-chat` SSE, not this repo's proposed OpenAI route by default. Keep access scoped to the signed-in user and assigned region, and revoke devices. Do not place shared server keys in the app.
6. Review mobile local chat/document storage, Firebase analytics/crash reporting, external provider selection, web search, scheduled tasks, voice recognition, and model download sources. Document data flows and disable or gate anything that violates Triangle policy.
7. Add backend tests for JWT issuer/audience/signature failures, absent/mismatched region claim, client region override attempts, request validation, model upstream failure, streaming, workspace authorization, mobile device revocation and no cross-region failover. Add integration tests for Lovable auth.
8. Create deployment manifests per region with independent API/model/data services and secrets. Set the IdP-issued signed `triangle_region_id` claim from trusted account policy. Never use geolocation/client input as authorization. Define regional backups/logging/telemetry and retention.
9. Keep inference model, checkpoint license, tokenizer, training data, and fine-tune rights documented independently from app licenses. Do not market a third-party model as trained or owned by Triangle unless evidence and rights support that claim.
10. Run tests, lint, typecheck, and builds; report actual results and outstanding blockers. Do not claim production-ready or deployment-complete without real credentials, model endpoint, infrastructure, legal review, and residency/security audit.

## Proprietary-model path

This repo is serving infrastructure, not training infrastructure. Propose a separate governed model program: data-rights inventory and consent, language/task benchmarks across the target markets, evaluation baseline, licensed base-checkpoint selection, adaptation plan, compute budget, reproducible training/evaluation pipeline, model cards and dataset documentation, release/artifact controls, and legal review of ownership and derivative licenses. Do not silently download or deploy a model based on a repository name alone.

## Licensing blocker

AnythingLLM main repository is MIT-licensed. AnythingLLM Mobile's current repository is GPL-3.0-or-later (README notes pre-1.2.0 releases remain under MIT). Review obligations with counsel before distribution. Do not relicense upstream content. Existing TriangleOS/Qwen3 is a fork, not a transfer of upstream model ownership.
