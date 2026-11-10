# Deploying the gateway and model host

Nothing here is deployed yet. Every step below is free on the plans TriangleOS already has, except where marked **COST**.

```
Portal or mobile app --(user's Supabase token)--> llm.triangleos.com/v1/* (Pages Functions)
   --(service token, fixed region)--> Cloudflare Tunnel --> inference container on the IONOS VPS
```

The browser token is never forwarded to the model host, and callers cannot choose the model, region or upstream URL.

## 1. Sign-in (Supabase, shared project `kvpnvqmgxbqxfwqdrrmm`)

There is no separate identity server. The gateway checks the same Supabase access tokens every portal already uses:

- `OIDC_ISSUER=https://kvpnvqmgxbqxfwqdrrmm.supabase.co/auth/v1`, `OIDC_AUDIENCE=authenticated`.
- If the project uses asymmetric JWT signing keys (Supabase dashboard, Settings, JWT Keys), set
  `OIDC_JWKS_URL=https://kvpnvqmgxbqxfwqdrrmm.supabase.co/auth/v1/.well-known/jwks.json`.
  If it still uses the legacy shared secret, leave `OIDC_JWKS_URL` unset and save the JWT secret as the Pages **secret** `SUPABASE_JWT_SECRET`.
- Region access comes from `app_metadata.triangle_region_id`, which only the service role can write (users cannot edit it).
  Give a user access in the SQL Editor, then they sign out and in again:

  ```sql
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"triangle_region_id":"uk-1"}'::jsonb
  where email = 'someone@example.com';
  ```

## 2. Model host on the existing VPS (System 2)

No new server and no open ports. `cloudflared` makes an outbound-only tunnel, so firewalld, NetBird and the SSH rules stay unchanged.

1. Cloudflare Zero Trust, Networks, Tunnels, Create tunnel (free). Add a public hostname such as `inference-uk-1.triangleos.com` pointing to `http://inference:8000`. Copy the tunnel token.
2. Optional but recommended (free up to 50 seats): Zero Trust, Access, add a self-hosted app for that hostname with a **Service Auth** policy and a service token. Put its id and secret in the Pages secrets `TRIANGLE_ACCESS_CLIENT_ID` / `TRIANGLE_ACCESS_CLIENT_SECRET`.
3. On the VPS: clone this repo to `/opt/system2/trialllm`, copy `infra/.env.example` to `/opt/system2/trialllm/.env` (chmod 600), fill it in, put a trained checkpoint at `/opt/system2/trialllm/models/triangle-checkpoint.pt`, then
   `docker compose --env-file /opt/system2/trialllm/.env -f infra/docker-compose.yml up -d --build`.
   Stop: `docker compose -f infra/docker-compose.yml down`. The container is capped at 2 GB RAM and 2 CPUs so n8n and OpenClaw keep running.

Do not start it with a random, untrained checkpoint for real users: it produces noise.

## 3. Pages Functions on llm.triangleos.com

`llm.triangleos.com` is served by an existing Pages project (the Triangle LLM status page). Pages only runs Functions from a top-level `functions/` folder in that project's source, so copy `cloudflare/pages/functions/` and `cloudflare/pages/lib/` into that repository (keep both folders side by side) and add `jose` to its dependencies. Its site build output stays the same; non-`/v1/` paths pass straight through.

Variables and secrets: see `.dev.vars.example`. Check on a preview deployment before production:

- `GET /v1/region` with no token gives 401; with a token from a user without `triangle_region_id` gives 403.
- `GET /v1/region` with an assigned user gives `{ "regionId": "uk-1", ... }`.
- `POST /v1/chat/completions` with `"model": "x"` gives 400; with `"stream": true` gives 501.
- A request with `Origin: https://example.com` gives 403.

## 4. Rate limiting

Pages memory is per-instance, so quotas are not done in code. Add a Cloudflare WAF rate limiting rule for `/v1/chat/completions` (the Free plan includes one rule). Logs must not store prompts or replies; the gateway never logs bodies.

## 5. Mobile

See `mobile/README.md`. Running it on your own phone with Expo Go is free.
**COST:** publishing needs an Apple Developer account (USD 99 a year) and a Google Play account (USD 25 once). EAS cloud builds have a limited free tier.
