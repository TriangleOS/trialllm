# Triangle LLM — regional API foundation

This repository is the Triangle-owned API foundation intended to connect the existing Triangle Africa website ([trianglellm.lovable.app](https://trianglellm.lovable.app)) and native clients to a model deployment in an authorized African region.

**This is application and inference infrastructure, not a Triangle-trained foundation model.** It does not contain model weights, training data, or model-training code. The API uses a server-configured OpenAI-compatible inference endpoint. Triangle must select a model, verify its license and regional hosting, benchmark target languages, and separately decide whether to fine-tune or train weights.

## Included

- TypeScript/Express API with JWT verification against an OIDC issuer's JWKS.
- Fail-closed regional middleware: the authenticated token must have the issuer-signed `triangle_region_id` claim matching the deployment's `TRIANGLE_REGION_ID`.
- `/v1/region` for the frontend to display the trusted assigned region.
- `/v1/chat/completions` with validated request limits, server-selected model, a fixed server-configured inference URL, optional server-side inference token, streaming and non-streaming responses, and no application-level prompt persistence.
- CORS allowlisting, security headers, and rate limiting.
- Lovable frontend client helper in `integrations/lovable/triangleApi.ts`.
- Deployment and Claude Code integration notes.

## Local development

Requires Node.js 20+.

```bash
cp .env.example .env
npm install
npm run dev
```

Configure the OIDC issuer, audience, region, and OpenAI-compatible model endpoint in `.env`. The token used for requests must be issued by that OIDC issuer and contain a trusted `triangle_region_id` claim. No demo token or fake model response is provided.

```bash
npm run typecheck
npm run build
npm start
```

## API

### `GET /healthz`
Unauthenticated process health only. It does not report credentials, model endpoints, or regional infrastructure details.

### `GET /v1/region`
Requires a valid bearer JWT and region authorization. Returns the region enforced by this deployment, not a client-selected region.

### `POST /v1/chat/completions`
Requires a valid bearer JWT and region authorization. Request uses OpenAI chat-completions shape:

```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": false,
  "temperature": 0.4,
  "max_tokens": 700
}
```

The backend ignores any client `model` field and substitutes `TRIANGLE_MODEL_ID`. It does not accept a client region, provider URL, or upstream credential. `stream: true` streams the configured model server's SSE response. The user's JWT is never forwarded to the model server.

## Regional deployment requirements

Deploy a separate API and inference endpoint in each region. Configure `TRIANGLE_REGION_ID` and `MODEL_BASE_URL` for that deployment, and configure the identity provider to issue the matching region claim only after trusted account/tenant policy checks. Assignments must be managed by trusted administrators, not by the website/mobile client.

Do not route through a central proxy that receives all regional prompts if that conflicts with the residency promise. Keep model service, vector/document storage, logs, backups, telemetry, and inference credentials regional and review their retention settings. This API scaffold has no document/RAG storage; integrate it with AnythingLLM only after the actual deployment and authentication topology is selected.

## Lovable integration

Copy `integrations/lovable/triangleApi.ts` into the existing Lovable project and use the project's authenticated user's access token. Set the API base URL to the regional API chosen by trusted deployment configuration. Do not put an AnythingLLM admin key, model key, or service credential in Lovable secrets exposed to client bundles. The frontend displays the region returned by `/v1/region`; it must not send a region header to select routing.

A browser-visible API URL is not secret. Authentication, verified signed region claim, CORS, rate limits, and backend policy are required. CORS is not authentication.

## Model ownership and what remains

Calling an openly licensed or commercial model through this API does not make the weights Triangle's proprietary model. A branded product using a third-party model is still Triangle's product, but the model remains subject to its own terms. To create a model Triangle can claim as proprietary, Triangle must have appropriate rights to training data and model outputs, choose a base-model license that permits the planned use, conduct domain/language evaluation, and commission or perform continued pretraining/fine-tuning (or train from scratch), then establish ownership and licensing with legal review. Fine-tuned weights may remain derivative of the base model and may not be exclusively ownable. Training from scratch is a substantially larger data, compute, and research undertaking.

TriangleOS/Qwen3 is a fork of upstream Qwen3 source, not evidence that Triangle owns or trained Qwen weights. Verify the exact checkpoint license from the model publisher before deployment; repository metadata alone is not model-weight licensing.

## Security and production checklist

- Configure production TLS, trusted reverse-proxy settings, secret management, network policies, model allowlists and monitoring.
- Ensure the OIDC issuer actually signs the region claim; do not copy a browser-provided region into the claim.
- Add account provisioning/admin tooling, revocation, tenant/workspace authorization, audit records without prompt content, and automated security tests before launch.
- Define privacy notice, consent, retention, deletion, incident response, and applicable regional legal requirements.
- This starter does not yet implement AnythingLLM's mobile registration/SSE contract, document operations, RAG, billing, or training pipelines. See `CLAUDE.md` for a repository-specific implementation plan.
- Review the AnythingLLM server's MIT notice and the separate AnythingLLM Mobile GPL-3.0-or-later obligations before shipping derivatives. This repository does not relicense either upstream project.
