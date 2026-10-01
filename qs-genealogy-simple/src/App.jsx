import React, { useState, useEffect, useRef } from 'react';

// Basic placeholder nodes
const DEFAULT_NODES = ['Node-A', 'Node-B', 'Node-C'];

function PlotlyGraph({ targetUnit, nodesList }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!window.Plotly || !containerRef.current) return;

    const allLabels = [targetUnit, ...nodesList];
    const xCoords = allLabels.map((_, i) => i * 2);
    const yCoords = allLabels.map((_, i) => (i % 2 === 0 ? 0.2 : -0.2));

    const edgeX = [];
    const edgeY = [];
    for (let i = 0; i < allLabels.length - 1; i++) {
      edgeX.push(xCoords[i], xCoords[i + 1], null);
      edgeY.push(yCoords[i], yCoords[i + 1], null);
    }

    const traces = [
      {
        type: 'scatter',
        x: edgeX,
        y: edgeY,
        mode: 'lines',
        line: { color: '#a1a1aa', width: 2 },
        hoverinfo: 'none',
        showlegend: false,
      },
      {
        type: 'scatter',
        x: xCoords,
        y: yCoords,
        mode: 'markers+text',
        text: allLabels,
        textposition: 'top center',
        textfont: { size: 12, color: '#18181b', family: 'sans-serif' },
        marker: {
          size: 22,
          color: '#ffffff',
          line: { color: '#18181b', width: 2 },
        },
        showlegend: false,
      },
    ];

    const layout = {
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      dragmode: 'pan',
      autosize: true,
      margin: { l: 40, r: 40, t: 40, b: 40 },
      xaxis: { showgrid: false, zeroline: false, showticklabels: false },
      yaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [-1, 1] },
    };

    const config = {
      responsive: true,
      scrollZoom: true,
      displayModeBar: false,
    };

    window.Plotly.newPlot(containerRef.current, traces, layout, config);
  }, [targetUnit, nodesList]);

  return <div ref={containerRef} className="w-full h-full min-h-[350px]" />;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

  // Workspace state
  const [unitId, setUnitId] = useState('UNIT-01');
  const [direction, setDirection] = useState('upstream');
  const [nodes, setNodes] = useState(DEFAULT_NODES);

  // -------------------------------------------------------------
  // 1. MINIMAL LOGIN SCREEN (PURE WHITE BACKGROUND, NO EXTRA TEXT)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm border border-zinc-300 bg-white p-8 rounded-lg shadow-sm space-y-6">
          <h1 className="text-2xl font-bold text-center text-zinc-900">Login</h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsAuthenticated(true);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                ID / User
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:border-zinc-800"
                placeholder="User ID"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:border-zinc-800"
                placeholder="Password"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-zinc-900 hover:bg-black text-white text-sm font-semibold rounded transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. MINIMAL WORKSPACE (CLEAN WHITE THEME)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-sans">
      {/* Navigation / Tool Bar */}
      <header className="h-12 bg-white border-b border-zinc-200 px-6 flex items-center justify-between font-bold text-sm">
        <span className="tracking-wide">Navigation / Tool Bar</span>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-3 py-1.5 border border-zinc-300 rounded transition font-normal"
        >
          Logout
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex p-4 gap-4 overflow-hidden">
        {/* Left Column: Saved Views */}
        <aside className="w-52 border border-zinc-200 bg-white rounded-lg p-3 flex flex-col space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-2">
            Saved Views
          </div>
          <div className="flex-1 space-y-1.5 text-xs text-zinc-700">
            <div className="p-2 border border-zinc-200 bg-zinc-50 rounded cursor-pointer hover:border-zinc-400">
              View 1
            </div>
            <div className="p-2 border border-zinc-200 bg-zinc-50 rounded cursor-pointer hover:border-zinc-400">
              View 2
            </div>
          </div>
        </aside>

        {/* Center: Graph View */}
        <main className="flex-1 border border-zinc-200 bg-white rounded-lg flex flex-col overflow-hidden relative">
          <div className="p-3 text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100">
            Graph View
          </div>
          <div className="flex-1 w-full h-full p-2">
            <PlotlyGraph targetUnit={unitId} nodesList={nodes} />
          </div>
        </main>

        {/* Right Column: Filters, Parameters, Entry Fields */}
        <aside className="w-64 border border-zinc-200 bg-white rounded-lg p-4 flex flex-col space-y-4 text-xs">
          <div className="font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-2">
            Filters, Parameters, Entry Fields
          </div>

          <div>
            <label className="block mb-1 font-semibold text-zinc-600">Unit ID</label>
            <input
              type="text"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-zinc-900 focus:outline-none focus:border-zinc-800"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold text-zinc-600">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-zinc-900 focus:outline-none focus:border-zinc-800"
            >
              <option value="upstream">Upstream</option>
              <option value="downstream">Downstream</option>
            </select>
          </div>

          <button
            onClick={() => {
              setNodes(
                direction === 'upstream'
                  ? ['Node-A', 'Node-B', 'Node-C']
                  : ['Node-D', 'Node-E']
              );
            }}
            className="w-full py-2 bg-zinc-900 hover:bg-black text-white font-semibold rounded transition"
          >
            Query Graph
          </button>
        </aside>
      </div>
    </div>
  );
}