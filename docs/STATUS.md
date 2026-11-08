# Triangle LLM technical foundation status

This repository separates the regional API gateway, portal/mobile client adapters, and from-scratch model research code. It does not contain trained production weights and does not substantiate any legal exclusivity claim. The model scaffold initializes random weights and needs authorized training data, compute, evaluation and legal review.

## Cross-portal package

- `cloudflare/pages/functions/`: OIDC validation, signed region check, model catalog alias and chat proxy.
- `integrations/lovable/triangleApi.ts`: use from the current `trianglellm.lovable.app` frontend after adapting its real auth session.
- `integrations/portals/triangleClient.ts`: shared browser API contract for TriangleOS portals.
- `integrations/mobile/triangleApi.ts`: React Native API-call helper; not a full mobile app modification or store-ready release.
- `cloudflare/pages/DEPLOYMENT.md` and `docs/PORTAL_INTEGRATION.md`: deployment and integration handoff.

## Architecture

Portal/mobile client -> Cloudflare Pages Functions on `llm.triangleos.com` -> private regional model service -> model checkpoint loaded from a Triangle-controlled secure artifact store. OIDC issuer signs the trusted region claim. Run separate gateway/inference/data resources per region. Do not route based on client-selected region and do not silently fail over.

Cloudflare Pages handles web/API edge requests, not PyTorch training or GPU inference. The current model service is a prototype hosted elsewhere; real origin, region, compute, OIDC, secrets, quotas and access policies remain to be configured.

## Complete handoff steps

1. Confirm existing Pages project/source/build/output and custom domain; deploy Functions by merging them, not replacing the current portal site.
2. Configure OIDC issuer/audience/JWKS and trusted account-to-region provisioning.
3. Create regional inference host and secure artifact storage; train only on documented authorized data.
4. Set Pages vars/secrets per `cloudflare/pages/.dev.vars.example` and `cloudflare/pages/DEPLOYMENT.md`.
5. Adapt the Lovable client to its auth SDK; add shared clients to each approved portal. Use the same OIDC audience and backend-enforced policy.
6. Integrate the React Native helper in `TriangleOS/anythingllm-mobile` with secure token handling, the app's chat/provider flow and tested UX. Review current GPL-3.0-or-later terms before distribution.
7. Add rate-limit/WAF controls, private origin access, logging/retention policy, tests, preview deployment, security review and regional residency audit.
8. Close `model/PROPRIETARY_MODEL_PROGRAM.md` gates and obtain legal sign-off before public ownership/exclusivity claims.

See the linked docs for API schemas and safeguards. Never put model/inference or AnythingLLM admin secrets in client code.
