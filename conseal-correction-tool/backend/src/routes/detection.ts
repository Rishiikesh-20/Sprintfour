import { Router, Request, Response } from "express";
import { runDetectionPipeline } from "../services/detectionPipeline";
import { ParsedAnnotation } from "../utils/parseAnnotatedText";

const router = Router({ mergeParams: true });

// POST /api/documents/:id/detect
// Accepts optional body { preloadedAnnotations } to skip LLM and use pre-parsed spans
router.post("/", async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { preloadedAnnotations } = req.body as { preloadedAnnotations?: ParsedAnnotation[] };
  try {
    const result = await runDetectionPipeline(id, preloadedAnnotations);
    res.status(200).json({ spans: result.spans });
  } catch (err: unknown) {
    const isNotFound =
      err instanceof Error && (err as NodeJS.ErrnoException & { code?: string }).code === "NOT_FOUND";
    if (isNotFound) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Document not found" } });
      return;
    }
    console.error("[detection] pipeline error:", err);
    res.status(500).json({ error: { code: "DETECTION_FAILED", message: "PII detection failed" } });
  }
});

export default router;
