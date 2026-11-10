import { z } from "zod";

export interface ApiConfig {
  port: number;
  trustProxyHops: number;
  allowedOrigins: Set<string>;
  oidcIssuer: string;
  oidcAudience: string;
  jwksUrl: URL;
  regionId: string;
  modelBaseUrl: URL;
  modelApiKey: string | undefined;
  modelId: string;
}

let cached: ApiConfig | undefined;

export function env(): ApiConfig {
  if (cached) return cached;
  const required = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing required server configuration: ${name}`);
    return value;
  };
  const url = (name: string): URL => {
    const value = new URL(required(name));
    if (value.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && value.hostname === "127.0.0.1" && value.protocol === "http:")) {
      throw new Error(`${name} must use HTTPS in production`);
    }
    return value;
  };
  const origins = required("ALLOWED_ORIGINS").split(",").map((x) => x.trim()).filter(Boolean);
  if (!origins.length) throw new Error("ALLOWED_ORIGINS must contain at least one origin");
  const regionId = required("TRIANGLE_REGION_ID");
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/i.test(regionId)) throw new Error("Invalid TRIANGLE_REGION_ID");

  cached = {
    port: Number(process.env.PORT ?? 8787),
    trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
    allowedOrigins: new Set(origins),
    oidcIssuer: required("OIDC_ISSUER"),
    oidcAudience: required("OIDC_AUDIENCE"),
    jwksUrl: url("OIDC_JWKS_URL"),
    regionId,
    modelBaseUrl: url("MODEL_BASE_URL"),
    modelApiKey: process.env.MODEL_API_KEY?.trim() || undefined,
    modelId: required("TRIANGLE_MODEL_ID"),
  };
  if (!Number.isInteger(cached.port) || cached.port < 1 || cached.port > 65535) throw new Error("Invalid PORT");
  if (!Number.isInteger(cached.trustProxyHops) || cached.trustProxyHops < 0 || cached.trustProxyHops > 5) throw new Error("Invalid TRUST_PROXY_HOPS");
  return cached;
}

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1).max(20_000),
  }).strict()).min(1).max(40),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(4096).optional(),
}).strict();
