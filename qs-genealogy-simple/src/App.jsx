import React, { useState } from 'react';

// 1. Lineage Process Chain Data
const LINEAGE_STEPS = [
  { id: 'RAW-01', step: '1. Raw Material', name: 'LLZO Powder', machine: 'Calcination Oven 01', status: 'PASS', details: 'D50 particle size: 1.2µm' },
  { id: 'SLURRY-02', step: '2. Slurry Prep', name: 'Separator Slurry', machine: 'Mixer Ceramic 02', status: 'ALERT', details: 'Viscosity drift +18.4%' },
  { id: 'COAT-03', step: '3. Roll Coating', name: 'Ceramic Separator', machine: 'Slot-Die Coater 03', status: 'PASS', details: 'Film thickness: 18.6µm' },
  { id: 'STACK-04', step: '4. Cell Stacking', name: '24-Layer Stack', machine: 'Robotic Stacker 01', status: 'PASS', details: 'Alignment error: <10µm' },
  { id: 'WELD-05', step: '5. Tab Laser Weld', name: 'Pouch Assembly', machine: 'Laser Welder 04', status: 'PASS', details: 'Weld energy: 450W' },
  { id: 'CELL-06', step: '6. Final Cell', name: 'Finished Cell', machine: 'EIS Tester 12', status: 'FAIL', details: 'Internal short during C/3 loop' },
];

export default function App() {
  const [selectedStep, setSelectedStep] = useState(LINEAGE_STEPS[1]); // Defaults to slurry alert
  const [showCulprit, setShowCulprit] = useState(false);
  const [depthHops, setDepthHops] = useState(20);
  const [showJson, setShowJson] = useState(false);

  // Latency calculation formulas
  const neo4jMs = Math.max(2, Math.round(1.5 + depthHops * 0.08));
  const closureMs = Math.max(3, Math.round(2.5 + depthHops * 0.2));
  const sqlMs = Math.min(9999, Math.round(6 * Math.pow(1.07, depthHops)));

  const sampleJson = {
    endpoint: "/api/v1/lineage/traverse?unitId=CELL-QS-9841&engine=NEO4J",
    executionTimeMs: neo4jMs,
    totalHops: depthHops,
    rootCauseCulprit: "SLURRY-02 (Mixer Ceramic 02)"
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">QuantumScape Battery Lineage Explorer</h1>
          <p className="text-xs text-slate-400">Track-and-trace traversal architecture & benchmark demo</p>
        </div>
        <button
          onClick={() => setShowJson(!showJson)}
          className="text-xs font-mono bg-slate-800 hover:bg-slate-700 text-cyan-400 px-3 py-1.5 rounded border border-slate-700 transition"
        >
          {showJson ? 'Hide API Contract' : 'View API Contract (JSON)'}
        </button>
      </div>

      {/* API JSON Viewer (Collapsible) */}
      {showJson && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-mono text-slate-400 mb-2">Unified API Response Contract (/traverse):</p>
          <pre className="bg-slate-950 p-3 rounded text-xs font-mono text-emerald-400 overflow-x-auto">
            {JSON.stringify(sampleJson, null, 2)}
          </pre>
        </div>
      )}

      {/* 1. Manufacturing Lineage Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          Step 1: Trace Battery Genealogy (Click a step to inspect)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {LINEAGE_STEPS.map((s) => {
            const isSelected = selectedStep.id === s.id;
            const isHighlighted = showCulprit && s.id === 'SLURRY-02';

            return (
              <button
                key={s.id}
                onClick={() => setSelectedStep(s)}
                className={`text-left p-3 rounded-lg border text-xs transition ${
                  isHighlighted
                    ? 'bg-rose-950/80 border-rose-500 ring-2 ring-rose-500'
                    : isSelected
                    ? 'bg-slate-800 border-blue-500 ring-1 ring-blue-500'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] text-slate-400">{s.step}</div>
                <div className="font-bold text-slate-100 truncate mt-0.5">{s.name}</div>
                <span className={`inline-block mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                  s.status === 'PASS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  s.status === 'ALERT' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  'bg-rose-950 text-rose-300 border border-rose-800'
                }`}>
                  {s.status}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Step Inspector */}
        <div className="mt-4 p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between text-xs gap-3">
          <div>
            <span className="text-slate-400">Selected Node: </span>
            <span className="font-mono font-bold text-cyan-400">{selectedStep.id} ({selectedStep.name})</span>
          </div>
          <div>
            <span className="text-slate-400">Equipment: </span>
            <span className="font-mono text-slate-200">{selectedStep.machine}</span>
          </div>
          <div>
            <span className="text-slate-400">Inline Note: </span>
            <span className="font-mono text-amber-300">{selectedStep.details}</span>
          </div>
        </div>
      </div>

      {/* 2. Failure Cohort Common Ancestor Intersector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Step 2: Failure Cohort Root-Cause Intersector
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Find shared upstream machines/batches between failing cells</p>
          </div>
          <button
            onClick={() => {
              setShowCulprit(true);
              setSelectedStep(LINEAGE_STEPS[1]);
            }}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition"
          >
            Find Common Failure Point
          </button>
        </div>

        {showCulprit ? (
          <div className="p-3 bg-rose-950/30 border border-rose-800/60 rounded-lg text-xs flex items-center justify-between">
            <span className="text-rose-200">
              🚨 <b>Common Upstream Bottleneck:</b> Batch <b>SLURRY-02</b> mixed on <b>Mixer Ceramic 02</b> (Viscosity +18.4% variance).
            </span>
            <span className="text-rose-400 font-mono text-[11px] font-bold">100% Correlation</span>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">Click the button above to run ancestry intersection.</div>
        )}
      </div>

      {/* 3. Three-Way Architecture Benchmark */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Step 3: Database Architecture Benchmark
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Compare traversal query speeds as graph depth grows</p>
          </div>
          <div className="flex items-center space-x-2 text-xs bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
            <span className="text-slate-300">Depth:</span>
            <input
              type="range"
              min="5"
              max="100"
              value={depthHops}
              onChange={(e) => setDepthHops(parseInt(e.target.value))}
              className="accent-blue-500 w-24"
            />
            <span className="font-mono text-cyan-400 font-bold w-12 text-right">{depthHops} hops</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Neo4j */}
          <div className="p-4 rounded-lg bg-slate-950/60 border border-blue-500/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-white">Neo4j Graph DB</span>
              <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded font-mono">Best Pick</span>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 my-1">{neo4jMs} ms</div>
            <p className="text-[11px] text-slate-400">Pointer dereference. Fast, stable traversal regardless of depth.</p>
          </div>

          {/* Closure Table */}
          <div className="p-4 rounded-lg bg-slate-950/60 border border-purple-500/30">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-white">Closure Table</span>
              <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded font-mono">Fast Read</span>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 my-1">{closureMs} ms</div>
            <p className="text-[11px] text-slate-400">Fast reads, but suffers huge write-amplification on frequent inserts.</p>
          </div>

          {/* Recursive SQL */}
          <div className="p-4 rounded-lg bg-slate-950/60 border border-amber-500/30">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-white">Recursive SQL</span>
              <span className="text-[10px] bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded font-mono">Current QS</span>
            </div>
            <div className={`text-2xl font-bold font-mono my-1 ${sqlMs > 1000 ? 'text-rose-400' : 'text-amber-400'}`}>
              {sqlMs >= 9999 ? '> 10,000 ms' : `${sqlMs} ms`}
            </div>
            <p className="text-[11px] text-slate-400">Exponential joins slow down quickly past 15–20 hops.</p>
          </div>
        </div>
      </div>
    </div>
  );
}