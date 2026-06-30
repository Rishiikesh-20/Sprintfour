import { Router, Request, Response } from "express";
import { createDocument, getDocument } from "../models/document";
import { getSpansByDocument } from "../models/span";
import { parseAnnotatedText } from "../utils/parseAnnotatedText";

const router = Router();

// POST /api/documents — create a document from raw text or [[text|type]] annotated text
router.post("/", (req: Request, res: Response) => {
  const { filename, rawText } = req.body as { filename?: string; rawText?: string };
  if (!rawText) {
    res.status(400).json({ error: { code: "MISSING_TEXT", message: "rawText is required" } });
    return;
  }

  const parsed = parseAnnotatedText(rawText);
  const doc = createDocument(
    filename ?? "untitled.txt",
    parsed.plainText,
    parsed.isAnnotated ? parsed.annotations : undefined
  );
  res.status(201).json({
    document: doc,
    isAnnotated: parsed.isAnnotated,
    preloadedAnnotations: parsed.isAnnotated ? parsed.annotations : undefined,
  });
});

// GET /api/documents/:id — fetch document + current spans
router.get("/:id", (req: Request, res: Response) => {
  const doc = getDocument(req.params["id"]!);
  if (!doc) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Document not found" } });
    return;
  }
  const spans = getSpansByDocument(doc.id);
  res.json({ document: doc, spans });
});

export default router;
