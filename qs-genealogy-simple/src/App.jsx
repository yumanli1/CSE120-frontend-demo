import React, { useState, useRef } from 'react';

const API_BASE_URL = 'http://localhost:8000';

export default function App() {
  // Authentication State (Section 1 Wireframe)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('data-engineer');
  const [password, setPassword] = useState('••••••••');

  // Query and Configuration State (Section 2 Right Sidebar)
  const [unitId, setUnitId] = useState('UNIT-123');
  const [endpointType, setEndpointType] = useState('ancestors');
  const [backend, setBackend] = useState('recursive-sql');
  const [maxDepth, setMaxDepth] = useState(20);

  // Traversal & Telemetry Data
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [resultsList, setResultsList] = useState(['material-1', 'process-1']);
  const [selectedNode, setSelectedNode] = useState('process-1');
  const [clientLatency, setClientLatency] = useState(null);

  // Saved Views (Section 2 Left Sidebar)
  const [savedViews, setSavedViews] = useState([
    { id: 1, title: 'Anode Slurry Run #104', unit: 'UNIT-104', backend: 'neo4j', depth: 25 },
    { id: 2, title: 'Cell Formation Audit', unit: 'UNIT-123', backend: 'recursive-sql', depth: 20 },
    { id: 3, title: 'Separator Roll Defects', unit: 'UNIT-509', backend: 'closure-table', depth: 40 },
  ]);

  // Graph Canvas Pan & Zoom State (Section 2 Center)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Handle Login Submission
  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setIsAuthenticated(true);
    }
  };

  // Fetch Live Traversal from FastAPI
  const handleQuery = async () => {
    setLoading(true);
    setApiError(null);
    const start = performance.now();

    try {
      const res = await fetch(
        `${API_BASE_URL}/units/${unitId}/${endpointType}?backend=${backend}&max_depth=${maxDepth}`
      );
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const end = performance.now();
      setClientLatency((end - start).toFixed(1));

      const items = data[endpointType] || [];
      setResultsList(items);
      setSelectedNode(items.length > 0 ? items[items.length - 1] : null);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Graph Mouse Pan Event Handlers
  const handleMouseDown = (e) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  // -------------------------------------------------------------
  // SECTION 1: LOGIN VIEW WIREFRAME
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
  // SECTION 2: WORKSPACE & INTERACTIVE WIREFRAME
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
          {clientLatency && (
            <span className="text-zinc-600 font-mono hidden sm:inline">
              Latency: <b>{clientLatency}ms</b>
            </span>
          )}
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
                { id: Date.now(), title: `Query ${unitId}`, unit: unitId, backend, depth: maxDepth }
              ])
            }
            className="mt-2 w-full py-1.5 bg-zinc-800 hover:bg-zinc-900 border border-zinc-600 text-zinc-300 text-[11px] rounded transition"
          >
            + Bookmark Current View
          </button>
        </aside>

        {/* Center: Graph View (Google Maps style zoom/pan) */}
        <main
          className="flex-1 bg-zinc-600 rounded relative overflow-hidden flex flex-col border border-zinc-500 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Canvas HUD Overlay */}
          <div className="absolute top-3 left-3 bg-zinc-800/90 backdrop-blur px-3 py-1.5 rounded text-xs text-zinc-300 font-mono pointer-events-none border border-zinc-700 z-10">
            Graph View — Navigable, Zoom in/out like Google Maps
          </div>

          {/* Zoom Controls Overlay */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
            <button
              onClick={() => setZoomLevel((z) => Math.min(2, z + 0.15))}
              className="w-8 h-8 bg-zinc-800/90 hover:bg-black text-white font-bold rounded flex items-center justify-center text-sm border border-zinc-700 shadow"
            >
              +
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.15))}
              className="w-8 h-8 bg-zinc-800/90 hover:bg-black text-white font-bold rounded flex items-center justify-center text-sm border border-zinc-700 shadow"
            >
              -
            </button>
            <button
              onClick={() => {
                setZoomLevel(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="w-8 h-8 bg-zinc-800/90 hover:bg-black text-zinc-400 hover:text-white text-[10px] rounded flex items-center justify-center border border-zinc-700 shadow font-mono"
            >
              Reset
            </button>
          </div>

          {/* Pannable/Zoomable Canvas Area */}
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-75"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
            }}
          >
            {resultsList.length === 0 ? (
              <div className="text-zinc-400 text-xs font-mono">
                No active nodes. Run a query from the right panel.
              </div>
            ) : (
              <div className="flex items-center space-x-6">
                {/* Target Unit Node */}
                <div
                  onClick={() => setSelectedNode(unitId)}
                  className={`p-4 rounded-lg border-2 shadow-lg cursor-pointer transition ${
                    selectedNode === unitId
                      ? 'bg-zinc-900 border-white text-white ring-2 ring-white'
                      : 'bg-zinc-800 border-zinc-400 text-zinc-200 hover:border-white'
                  }`}
                >
                  <div className="text-[10px] font-mono text-zinc-400 uppercase">Target Unit</div>
                  <div className="text-sm font-bold font-mono">{unitId}</div>
                </div>

                {/* Render Traversal Ancestors / Predecessors */}
                {resultsList.map((nodeName, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono text-zinc-300">hop #{idx + 1}</span>
                      <div className="w-8 h-[2px] bg-zinc-300 my-1"></div>
                    </div>

                    <div
                      onClick={() => setSelectedNode(nodeName)}
                      className={`p-4 rounded-lg border-2 shadow-lg cursor-pointer transition ${
                        selectedNode === nodeName
                          ? 'bg-zinc-900 border-white text-white ring-2 ring-white'
                          : 'bg-zinc-800 border-zinc-400 text-zinc-200 hover:border-white'
                      }`}
                    >
                      <div className="text-[10px] font-mono text-zinc-400 uppercase">
                        {endpointType === 'ancestors' ? 'Ancestor' : 'Predecessor'}
                      </div>
                      <div className="text-sm font-bold font-mono">{nodeName}</div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Column: Filters, Parameters, Entry Fields */}
        <aside className="w-72 bg-zinc-700 text-zinc-200 rounded flex flex-col border border-zinc-600 p-4 space-y-4 overflow-y-auto">
          <div className="font-semibold text-xs uppercase tracking-wider text-zinc-300 pb-2 border-b border-zinc-600">
            Filters, Parameters, Entry Fields
          </div>

          {/* Unit ID Field */}
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

          {/* Traversal Type */}
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

          {/* Database Engine */}
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

          {/* Max Depth */}
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

          {/* Action Button */}
          <button
            onClick={handleQuery}
            disabled={loading}
            className="w-full py-2 bg-zinc-900 hover:bg-black text-white font-medium text-xs rounded transition uppercase tracking-wider"
          >
            {loading ? 'Traversing...' : 'Execute Traversal'}
          </button>

          {/* Error Message */}
          {apiError && (
            <div className="p-2.5 bg-zinc-800 border border-zinc-500 rounded text-[11px] text-zinc-300 font-mono">
              <b>Error:</b> {apiError}
            </div>
          )}

          {/* Inspector Box */}
          {selectedNode && (
            <div className="mt-4 pt-3 border-t border-zinc-600 space-y-1.5 text-xs font-mono">
              <span className="text-zinc-400 text-[10px] uppercase block">Selected Element</span>
              <div className="p-2 bg-zinc-800 rounded border border-zinc-600">
                <div className="text-white font-bold">{selectedNode}</div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Status: 200 OK • Depth: {maxDepth}
                </div>
              </div>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}