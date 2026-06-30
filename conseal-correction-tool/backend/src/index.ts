import "./config/env"; // loads dotenv first
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "./config/env";
import { getDb } from "./db/client";

import documentRoutes from "./routes/documents";
import detectionRoutes from "./routes/detection";
import spanRoutes from "./routes/spans";
import consistencyRoutes from "./routes/consistency";
import auditRoutes from "./routes/audit";
import exportRoutes from "./routes/export";

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.use("/api/documents", documentRoutes);
app.use("/api/documents/:id/detect", detectionRoutes);
app.use("/api/documents/:id/spans", spanRoutes);
app.use("/api/documents/:id/consistency", consistencyRoutes);
app.use("/api/documents/:id/audit", auditRoutes);
app.use("/api/documents/:id", exportRoutes);

// Catch-all 404
app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

// Global error handler — never expose stack traces
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
});

// Initialize DB on startup
getDb();

app.listen(config.port, () => {
  console.log(`[conseal-backend] listening on http://localhost:${config.port}`);
});

export default app;
