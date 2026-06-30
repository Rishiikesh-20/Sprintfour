import React from "react";

export function RiskLegend(): React.ReactElement {
  return (
    <div className="p-4 border-t border-slate-200 space-y-3">
      <h3 className="font-mono tracking-tight text-slate-900 text-xs uppercase border-b border-slate-200 pb-2">
        Risk Legend
      </h3>
      <div className="space-y-2">
        <LegendRow
          swatch={<span className="inline-block w-3 h-3 bg-slate-950 flex-shrink-0" />}
          label="High — SSN · Phone · Email"
        />
        <LegendRow
          swatch={<span className="inline-block w-3 h-3 bg-slate-700 flex-shrink-0" />}
          label="Medium — Name · Org"
        />
        <LegendRow
          swatch={<span className="inline-block w-3 h-3 border border-dotted border-slate-400 flex-shrink-0" />}
          label="Low — Date · Other"
        />
        <LegendRow
          swatch={
            <span className="inline-block w-3 h-3 border-2 border-slate-950 flex-shrink-0" />
          }
          label="Pattern-flagged"
        />
      </div>
    </div>
  );
}

function LegendRow({ swatch, label }: { swatch: React.ReactElement; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {swatch}
      <span className="font-mono text-xs text-slate-500">{label}</span>
    </div>
  );
}
