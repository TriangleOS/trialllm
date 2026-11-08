import type { NextFunction, Request, Response } from "express";
import { env } from "../config.js";

/** Region claim must be signed by the configured issuer from trusted account policy. */
export function requireAssignedRegion(_req: Request, res: Response, next: NextFunction) {
  const settings = env();
  const identity = res.locals.triangleIdentity;
  if (!identity || typeof identity.triangle_region_id !== "string") {
    return res.status(403).json({ error: "No regional access is assigned to this account" });
  }
  if (identity.triangle_region_id !== settings.regionId) {
    return res.status(403).json({ error: "This account cannot access this regional service" });
  }
  // Use only server config after comparing the trusted issuer-signed claim.
  res.locals.triangleRegionId = settings.regionId;
  return next();
}
