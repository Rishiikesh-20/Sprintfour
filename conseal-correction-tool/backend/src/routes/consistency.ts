import { Router, Request, Response } from "express";
import { getSpansByDocument } from "../models/span";
import { groupByEntity } from "../services/consistencyEngine";

const router = Router({ mergeParams: true });

// GET /api/documents/:id/consistency — grouped duplicate entities
router.get("/", (req: Request, res: Response) => {
  const { id: documentId } = req.params as { id: string };
  const spans = getSpansByDocument(documentId);
  const groups = groupByEntity(spans);
  res.json({ groups });
});

export default router;
