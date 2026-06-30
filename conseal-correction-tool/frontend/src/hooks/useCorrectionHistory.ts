import { useEffect, useCallback, useRef } from "react";
import { useConsealStore } from "../state/store";

interface Options {
  onUndo?: () => void;
  onRedo?: () => void;
}

export function useCorrectionHistory(options?: Options) {
  const storeUndo = useConsealStore((s) => s.undo);
  const storeRedo = useConsealStore((s) => s.redo);
  const canUndo = useConsealStore((s) => s.past.length > 0);
  const canRedo = useConsealStore((s) => s.future.length > 0);

  // Refs prevent stale closures in the keyboard handler without re-registering listeners
  const onUndoRef = useRef(options?.onUndo);
  const onRedoRef = useRef(options?.onRedo);
  useEffect(() => { onUndoRef.current = options?.onUndo; }, [options?.onUndo]);
  useEffect(() => { onRedoRef.current = options?.onRedo; }, [options?.onRedo]);

  const undo = useCallback(() => {
    storeUndo();
    onUndoRef.current?.();
  }, [storeUndo]);

  const redo = useCallback(() => {
    storeRedo();
    onRedoRef.current?.();
  }, [storeRedo]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    },
    [undo, redo]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { undo, redo, canUndo, canRedo };
}
