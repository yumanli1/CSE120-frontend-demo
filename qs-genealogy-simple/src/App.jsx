import React, { useState, useEffect, useRef } from 'react';

// Mock datasets for standalone demonstration
const MOCK_GENEALOGY = {
  ancestors: ['RAW-SLURRY-BATCH-01', 'MIXER-TANK-04', 'COATED-ROLL-12', 'SLIT-STRIP-88', 'CELL-STACK-02'],
  predecessors: ['CELL-ASSEMBLY-PACK-01', 'MODULE-TRAY-09', 'BATTERY-PACK-FINAL'],
};

// Dedicated Plotly Canvas Component
function PlotlyGraph({ targetUnit, nodesList, endpointType, onNodeSelect, selectedNode }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!window.Plotly || !containerRef.current) return;

    // Build DAG Coordinates
    // Target Unit at x = 0, y = 0
    // Ancestors placed to the left (negative x) or predecessors to the right (positive x)
    const isAncestors = endpointType === 'ancestors';
    const allLabels = isAncestors
      ? [...nodesList].reverse().concat([targetUnit])
      : [targetUnit].concat(nodesList);

    const xCoords = allLabels.map((_, i) => i * 1.8);
    const yCoords = allLabels.map((_, i) => (i % 2 === 0 ? 0.2 : -0.2));

    // Construct Edges (connecting lines between adjacent steps)
    const edgeX = [];
    const edgeY = [];
    for (let i = 0; i < allLabels.length - 1; i++) {
      edgeX.push(xCoords[i], xCoords[i + 1], null);
      edgeY.push(yCoords[i], yCoords[i + 1], null);
    }

    // Node markers styling & selection highlighting
    const markerColors = allLabels.map((lbl) =>
      lbl === selectedNode ? '#ffffff' : lbl === targetUnit ? '#d4d4d8' : '#71717a'
    );
    const markerSizes = allLabels.map((lbl) => (lbl === selectedNode ? 28 : 22));
    const borderColors = allLabels.map((lbl) => (lbl === selectedNode ? '#000000' : '#27272a'));

    // Plotly Traces: 1 for Lines (Edges), 1 for Nodes (Scatter markers)
    const traces = [
      {
        type: 'scatter',
        x: edgeX,
        y: edgeY,
        mode: 'lines',
        line: { color: '#a1a1aa', width: 2.5, dash: 'solid' },
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
        textfont: { family: 'monospace', size: 11, color: '#f4f4f5' },
        hoverinfo: 'text',
        hovertext: allLabels.map((lbl, i) => `<b>Node:</b> ${lbl}<br><b>Sequence:</b> Step ${i + 1}`),
        marker: {
          size: markerSizes,
          color: markerColors,
          line: { color: borderColors, width: 2 },
        },
        showlegend: false,
      },
    ];

    // Plotly Layout (Google Maps style pan/zoom enabled)
    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      hovermode: 'closest',
      dragmode: 'pan', // Pan by dragging like Google Maps
      autosize: true,
      margin: { l: 40, r: 40, t: 40, b: 40 },
      xaxis: {
        showgrid: true,
        zeroline: false,
        showticklabels: false,
        gridcolor: '#52525b',
      },
      yaxis: {
        showgrid: true,
        zeroline: false,
        showticklabels: false,
        gridcolor: '#52525b',
        range: [-1.2, 1.2],
      },
    };

    // Responsive configuration with standard zoom/pan controls
    const config = {
      responsive: true,
      scrollZoom: true, // Zoom in/out with mouse wheel
      displayModeBar: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      displaylogo: false,
    };

    window.Plotly.newPlot(containerRef.current, traces, layout, config);

    // Click event to select nodes
    const graphDiv = containerRef.current;
    const clickHandler = (data) => {
      if (data && data.points && data.points[0]) {
        const clickedLabel = allLabels[data.points[0].pointIndex];
        if (clickedLabel) onNodeSelect(clickedLabel);
      }
    };
    graphDiv.on('plotly_click', clickHandler);

    return () => {
      if (graphDiv && graphDiv.removeAllListeners) {
        graphDiv.removeAllListeners('plotly_click');
      }
    };
  }, [targetUnit, nodesList, endpointType, selectedNode]);

  return <div ref={containerRef} className="w-full h-full min-h-[380px]" />;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('data-engineer');
  const [password, setPassword] = useState('••••••••');

  const [unitId, setUnitId] = useState('UNIT-123');
  const [endpointType, setEndpointType] = useState('ancestors');
  const [backend, setBackend] = useState('recursive-sql');
  const [maxDepth, setMaxDepth] = useState(20);

  const [loading, setLoading] = useState(false);
  const [resultsList, setResultsList] = useState(MOCK_GENEALOGY.ancestors);
  const [selectedNode, setSelectedNode] = useState(MOCK_GENEALOGY.ancestors[0]);
  const [clientLatency, setClientLatency] = useState(8.4);

  const [savedViews, setSavedViews] = useState([
    { id: 1, title: 'Anode Slurry Run #104', unit: 'UNIT-104', backend: 'neo4j', depth: 25 },
    { id: 2, title: 'Cell Formation Audit', unit: 'UNIT-123', backend: 'recursive-sql', depth: 20 },
    { id: 3, title: 'Separator Roll Defects', unit: 'UNIT-509', backend: 'closure-table', depth: 40 },
  ]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim()) setIsAuthenticated(true);
  };

  const handleQuery = () => {
    setLoading(true);
    setTimeout(() => {
      const items = endpointType === 'ancestors' ? MOCK_GENEALOGY.ancestors : MOCK_GENEALOGY.predecessors;
      setResultsList(items);
      setSelectedNode(items[0]);
      const latency = backend === 'recursive-sql' ? (maxDepth * 1.4).toFixed(1) : backend === 'closure-table' ? 4.2 : 2.1;
      setClientLatency(latency);
      setLoading(false);
    }, 200);
  };

  // -------------------------------------------------------------
  // SECTION 1: LOGIN VIEW
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-zinc-200 p-8 rounded-lg shadow-2xl space-y-6 text-zinc-900">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Login</h1>
            <p className="text-xs text-zinc-600 font-mono">
              QuantumScape Genealogy & Benchmark System
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                ID / User
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter Engineer ID or Username"
                className="w-full px-3 py-2.5 bg-zinc-600 text-white placeholder-zinc-300 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2.5 bg-zinc-600 text-white placeholder-zinc-300 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-zinc-900 hover:bg-black text-white font-medium text-sm rounded transition"
            >
              Authenticate & Enter
            </button>
          </form>

          <div className="text-[11px] text-zinc-500 text-center font-mono pt-2 border-t border-zinc-300">
            Internal proof-of-concept testing environment
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SECTION 2: WORKSPACE WITH PLOTLY GRAPH VIEW
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 flex flex-col font-sans select-none">
      {/* Top Navigation / Tool Bar */}
      <header className="h-14 bg-zinc-300 text-zinc-900 border-b border-zinc-400 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <span className="font-bold text-sm uppercase tracking-wider font-mono">
            Navigation / Tool Bar
          </span>
          <span className="text-xs bg-zinc-200 px-2 py-0.5 rounded text-zinc-700 font-mono">
            Session: {username}
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="text-zinc-600 font-mono hidden sm:inline">
            Latency: <b>{clientLatency}ms</b>
          </span>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-3 py-1 bg-zinc-800 hover:bg-black text-white rounded font-medium transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left Column: Saved Views */}
        <aside className="w-56 bg-zinc-700 text-zinc-200 rounded flex flex-col border border-zinc-600 p-3">
          <div className="font-semibold text-xs uppercase tracking-wider text-zinc-300 pb-2 border-b border-zinc-600">
            Saved Views
          </div>

          <div className="flex-1 overflow-y-auto mt-3 space-y-2 text-xs">
            {savedViews.map((view) => (
              <div
                key={view.id}
                onClick={() => {
                  setUnitId(view.unit);
                  setBackend(view.backend);
                  setMaxDepth(view.depth);
                }}
                className="p-2 bg-zinc-800/80 hover:bg-zinc-800 rounded border border-zinc-600 cursor-pointer transition"
              >
                <div className="font-bold text-white truncate">{view.title}</div>
                <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  {view.unit} • {view.backend}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() =>
              setSavedViews([
                ...savedViews,
                { id: Date.now(), title: `Query ${unitId}`, unit: unitId, backend, depth: maxDepth },
              ])
            }
            className="mt-2 w-full py-1.5 bg-zinc-800 hover:bg-zinc-900 border border-zinc-600 text-zinc-300 text-[11px] rounded transition"
          >
            + Bookmark Current View
          </button>
        </aside>

        {/* Center Column: Plotly Graph View */}
        <main className="flex-1 bg-zinc-600 rounded relative overflow-hidden flex flex-col border border-zinc-500">
          <div className="p-2 px-3 bg-zinc-700/80 border-b border-zinc-500 flex items-center justify-between text-xs text-zinc-200 font-mono">
            <span>Plotly Lineage Canvas — Drag to Pan, Scroll to Zoom</span>
            <span className="text-[10px] text-zinc-300">Click any node to inspect</span>
          </div>

          <div className="flex-1 w-full h-full relative">
            <PlotlyGraph
              targetUnit={unitId}
              nodesList={resultsList}
              endpointType={endpointType}
              selectedNode={selectedNode}
              onNodeSelect={(node) => setSelectedNode(node)}
            />
          </div>
        </main>

        {/* Right Column: Parameters & Filters */}
        <aside className="w-72 bg-zinc-700 text-zinc-200 rounded flex flex-col border border-zinc-600 p-4 space-y-4 overflow-y-auto">
          <div className="font-semibold text-xs uppercase tracking-wider text-zinc-300 pb-2 border-b border-zinc-600">
            Filters, Parameters, Entry Fields
          </div>

          <div>
            <label className="block text-[11px] uppercase font-mono text-zinc-300 mb-1">
              Unit ID
            </label>
            <input
              type="text"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-500 rounded text-xs font-mono text-white focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase font-mono text-zinc-300 mb-1">
              Traversal Direction
            </label>
            <select
              value={endpointType}
              onChange={(e) => setEndpointType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-500 rounded text-xs font-mono text-white focus:outline-none"
            >
              <option value="ancestors">Upstream (/ancestors)</option>
              <option value="predecessors">Downstream (/predecessors)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase font-mono text-zinc-300 mb-1">
              Backend Architecture
            </label>
            <select
              value={backend}
              onChange={(e) => setBackend(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-500 rounded text-xs font-mono text-white focus:outline-none"
            >
              <option value="recursive-sql">Recursive SQL</option>
              <option value="closure-table">Closure Table</option>
              <option value="neo4j">Neo4j Graph DB</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-[11px] uppercase font-mono text-zinc-300 mb-1">
              <span>Max Depth</span>
              <span className="text-white font-bold">{maxDepth} hops</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={maxDepth}
              onChange={(e) => setMaxDepth(parseInt(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
          </div>

          <button
            onClick={handleQuery}
            disabled={loading}
            className="w-full py-2 bg-zinc-900 hover:bg-black text-white font-medium text-xs rounded transition uppercase tracking-wider"
          >
            {loading ? 'Plotting...' : 'Execute Traversal'}
          </button>

          {selectedNode && (
            <div className="mt-4 pt-3 border-t border-zinc-600 space-y-1.5 text-xs font-mono">
              <span className="text-zinc-400 text-[10px] uppercase block">Selected Element</span>
              <div className="p-2 bg-zinc-800 rounded border border-zinc-600">
                <div className="text-white font-bold">{selectedNode}</div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Target: {unitId} • Depth: {maxDepth}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}