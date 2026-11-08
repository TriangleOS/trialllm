import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config.js";

declare global {
  namespace Express {
    interface Locals {
      triangleIdentity?: JWTPayload & { sub: string; triangle_region_id?: string };
      triangleRegionId?: string;
    }
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export async function authenticate(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = env();
    const match = res.req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Authentication required" });
    jwks ??= createRemoteJWKSet(settings.jwksUrl);
    const { payload } = await jwtVerify(match[1], jwks, {
      issuer: settings.oidcIssuer,
      audience: settings.oidcAudience,
      algorithms: ["RS256", "ES256"],
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return res.status(401).json({ error: "Invalid access token" });
    }
    res.locals.triangleIdentity = payload as JWTPayload & { sub: string; triangle_region_id?: string };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}
