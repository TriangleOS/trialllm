# Cross-portal integration contract

## Scope and truth in product wording

This package gives web portals, native clients and other authorized TriangleOS applications a **shared regional API contract**. It does not contain trained production model weights. The prototype model code is separate and its untrained random initialization is not suitable for users. Do not advertise a trained or legally exclusive Triangle model until the model program gates are met and the specific claim is approved by counsel.

## One API; regional deployments

Every approved portal calls `https://llm.triangleos.com` (or a region-specific API custom domain if policy requires). The Pages deployment validates signed OIDC access tokens. The identity provider is the authority for account/tenant-region assignment. A request cannot choose the region. Use one matching Pages gateway and private inference/data plane per supported region; don't make a global service proxy prompts across regions.

Required identity token properties: valid signature from configured JWKS, exact issuer and audience, expiration, nonempty subject, signed `triangle_region_id`. Make tokens short-lived and use the owning portal's auth SDK. Pages gateway variables/secrets are deployment-specific.

## HTTP API

### `GET /v1/region`

Bearer token required. Returns `{ "regionId": "..." }` from deployment configuration only after the signed claim matches. Display it in clients; don't let the user set it as a routing override.

### `GET /v1/models`

Bearer token and region authorization required. Returns one public, configured model alias. Never disclose model storage paths or service endpoint credentials.

### `POST /v1/chat/completions`

Bearer token and region authorization required. Example request:

```json
{
  "messages": [{ "role": "user", "content": "Hello" }],
  "stream": false,
  "temperature": 0.6,
  "max_tokens": 256
}
```

Client-supplied `model`, region, URL, service token, or provider keys are not accepted as routing controls. The Pages Function uses fixed deployment configuration and a server-side inference secret. The current research model returns non-streaming OpenAI-compatible response. Streaming is explicitly not supported yet; clients should handle HTTP 501.

## Client packages

- `integrations/lovable/triangleApi.ts` — existing Lovable website; adapt `getAccessToken` to its actual login SDK and preserve current UI.
- `integrations/portals/triangleClient.ts` — shared browser client pattern for other authorized Triangle portals.
- `integrations/mobile/triangleApi.ts` — React Native adapter pattern; wire authentication tokens to secure Keychain/Keystore storage and integrate the call with the existing mobile app's provider/chat flow. This standalone helper is not a full app integration and doesn't replace AnythingLLM's device registration/workspace contracts.

Never put `TRIANGLE_INFERENCE_TOKEN`, model keys, or AnythingLLM admin keys in a browser or mobile bundle. User access tokens should be obtained from the portal's auth SDK and never logged. Provide a clear offline/unavailable state; do not use fabricated completions.

## Cloudflare Pages deployment

Follow `cloudflare/pages/DEPLOYMENT.md`; merge Functions with the existing Pages site's build and custom domain instead of replacing its content. Set `TRIANGLE_ALLOWED_ORIGINS` to exact portal origins. Add gateway rate limits in Cloudflare WAF/rate limiting and inspect all analytics/logging integrations for prompt capture. Set DNS only after preview deployment checks. The model service remains separately hosted and protected; Pages is not GPU inference or model training.

## Production blockers to close

- Set up/verify central identity, account-to-region provisioning, revocation and tenant/workspace authorization.
- Deploy inference per region with secure workload identity, TLS, artifact integrity, GPU capacity, monitoring and no cross-region fallback.
- Add server-side quota/billing and rate limiting; Pages memory must not be used as shared state.
- Decide whether inference service user-data logging is disabled and set operational retention/deletion.
- Complete model/data IP rights, training, evaluations, model card, security/privacy review and legal opinion.
- For the existing mobile fork, review GPL-3.0-or-later distribution obligations and separately implement/test the API adapter. The client example alone is not a release-ready mobile app.
