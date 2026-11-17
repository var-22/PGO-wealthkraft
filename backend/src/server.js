import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { warmSample } from "./services/portfolio.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Browser safeguards on every answer: the app only loads its own files, can't be framed by another
// site, and nothing personal is kept in shared caches.
app.use((req, res, next) => {
  res.set({
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  if (req.secure) res.set("Strict-Transport-Security", "max-age=15552000");
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use(authRouter);
app.use(portfolioRouter);

// In production the built app is served from here too, so the browser only ever talks to one origin.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "frontend", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist, {
    setHeaders(res, file) {
      // Built files carry a fingerprint in their name and never change; the page, the service
      // worker and the manifest must be re-checked every time so a new release shows up at once.
      if (file.includes(`${path.sep}assets${path.sep}`)) res.set("Cache-Control", "public, max-age=31536000, immutable");
      else if (/(index\.html|sw\.js|manifest\.webmanifest)$/.test(file)) res.set("Cache-Control", "no-cache");
    },
  }));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(JSON.stringify({ level: "error", event: "unhandled", message: err.message }));
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const port = Number(process.env.PORT) || 4100;
app.listen(port, () => {
  console.log(`pgo backend listening on http://localhost:${port}`);
  warmSample(); // today's figures for the sample portfolio, worked out before anyone asks
});
