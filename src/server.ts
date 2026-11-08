import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config as loadDotenv } from "dotenv";
import { env } from "./config.js";
import { authenticate } from "./middleware/auth.js";
import { requireAssignedRegion } from "./middleware/region.js";
import { chatRouter } from "./routes/chat.js";

loadDotenv();
const settings = env();
const app = express();

// Only trust the explicitly configured number of reverse-proxy hops.
app.set("trust proxy", settings.trustProxyHops);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Native clients may omit Origin; authorization still applies.
    if (!origin || settings.allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  credentials: false,
  maxAge: 600,
}));
app.use(express.json({ limit: "64kb", strict: true }));

app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));

app.get("/v1/region", authenticate, requireAssignedRegion, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ regionId: res.locals.triangleRegionId });
});

app.use("/v1", authenticate, requireAssignedRegion, chatRouter);

// Return generic errors only. Do not log request content, tokens, or provider responses.
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return res.end();
  if (error instanceof SyntaxError) return res.status(400).json({ error: "Invalid JSON body" });
  if (error instanceof Error && error.message === "Origin not allowed") {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  console.error("Unhandled API error");
  return res.status(500).json({ error: "Internal service error" });
});

const server = app.listen(settings.port, "0.0.0.0", () => {
  console.log(`Triangle regional API listening on port ${settings.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
