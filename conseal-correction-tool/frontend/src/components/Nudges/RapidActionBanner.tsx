import React from "react";

interface Props {
  onDismiss: () => void;
}

export function RapidActionBanner({ onDismiss }: Props): React.ReactElement {
  return (
    <div className="fixed top-0 left-0 w-full bg-slate-950 text-white font-mono text-center py-2 text-sm tracking-wide shadow-lg z-50 animate-bounce flex items-center justify-center gap-4">
      <span>
        ▲ SPEED WARNING: REVIEW VELOCITY IS TOO HIGH. AUTOMATION BIAS RISK DETECTED.
        PLEASE VERIFY PREVIOUS HIGH-RISK HIGHLIGHTS.
      </span>
      <button
        onClick={onDismiss}
        className="ml-4 text-slate-400 hover:text-white transition-colors flex-shrink-0"
        aria-label="Dismiss warning"
      >
        ✕
      </button>
    </div>
  );
}
