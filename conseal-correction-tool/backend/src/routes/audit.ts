import { Router, Request, Response } from "express";
import { getAuditLog, writeUndoRedoEntry } from "../services/auditLogService";

const router = Router({ mergeParams: true });

// GET /api/documents/:id/audit — full audit trail, newest first
router.get("/", (req: Request, res: Response) => {
  const log = getAuditLog(req.params["id"]!);
  res.json({ auditLog: log });
});

// POST /api/documents/:id/audit — record a client-side undo or redo session marker
router.post("/", (req: Request, res: Response) => {
  const { id: documentId } = req.params as { id: string };
  const { action } = req.body as { action?: string };

  if (action !== "undo" && action !== "redo") {
    res
      .status(400)
      .json({ error: { code: "INVALID_ACTION", message: "action must be 'undo' or 'redo'" } });
    return;
  }

  writeUndoRedoEntry(documentId, action);
  res.status(201).json({ ok: true });
});

export default router;
