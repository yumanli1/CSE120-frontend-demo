import React, { useState, useEffect, useRef } from 'react';

// Mock dataset
const INITIAL_SAVED_VIEWS = [
  { id: '1', name: 'Saved View 1', unit: 'UNIT-01', type: 'GraphType1', mode: 'upstream', depth: 15 },
  { id: '2', name: 'Saved View 2', unit: 'LOT-402', type: 'GraphType2', mode: 'upstream', depth: 25 },
  { id: '3', name: 'Saved View 3', unit: 'ROLL-88', type: 'GraphType1', mode: 'downstream', depth: 10 },
  { id: '4', name: 'Saved View 4', unit: 'PACK-09', type: 'GraphType3', mode: 'downstream', depth: 30 },
];

const MOCK_DATASET = {
  'UNIT-01': {
    nodes: [
      { id: 'UNIT-01', x: 0, y: 0, stage: 'Cell Stacking', type: 'Pouch Cell', status: 'Passed', depth: 0 },
      { id: 'ROLL-88', x: 2, y: 0.25, stage: 'Calendaring', type: 'Cathode Roll', status: 'Passed', depth: 1 },
      { id: 'SEP-12', x: 2, y: -0.25, stage: 'Sintering', type: 'Solid Separator', status: 'Passed', depth: 1 },
      { id: 'SLURRY-04', x: 4, y: 0.25, stage: 'Planetary Mixing', type: 'Cathode Slurry', status: 'Inspected', depth: 2 },
      { id: 'RAW-LITHIUM-09', x: 6, y: 0.25, stage: 'Precursor Ingest', type: 'Raw Material', status: 'Passed', depth: 3 }
    ],
    edges: [
      ['ROLL-88', 'UNIT-01'],
      ['SEP-12', 'UNIT-01'],
      ['SLURRY-04', 'ROLL-88'],
      ['RAW-LITHIUM-09', 'SLURRY-04']
    ]
  },
  'LOT-402': {
    nodes: [
      { id: 'LOT-402', x: 0, y: 0, stage: 'Anode Slurry Mix', type: 'Slurry Batch', status: 'Passed', depth: 0 },
      { id: 'RAW-GRAPHITE-11', x: 3, y: 0, stage: 'Milling & Blending', type: 'Carbon Black', status: 'Passed', depth: 1 }
    ],
    edges: [
      ['RAW-GRAPHITE-11', 'LOT-402']
    ]
  },
  'ROLL-88': {
    nodes: [
      { id: 'ROLL-88', x: 0, y: 0, stage: 'Calendaring', type: 'Cathode Roll', status: 'Passed', depth: 0 },
      { id: 'SLURRY-04', x: 2.5, y: 0, stage: 'Coating Line', type: 'Cathode Slurry', status: 'Passed', depth: 1 },
      { id: 'RAW-LITHIUM-09', x: 5, y: 0, stage: 'Raw Material Mix', type: 'Raw Precursor', status: 'Passed', depth: 2 }
    ],
    edges: [
      ['SLURRY-04', 'ROLL-88'],
      ['RAW-LITHIUM-09', 'SLURRY-04']
    ]
  },
  'PACK-09': {
    nodes: [
      { id: 'PACK-09', x: 0, y: 0, stage: 'Module Enclosure', type: 'Pack Assembly', status: 'Passed', depth: 0 },
      { id: 'UNIT-01', x: 2, y: 0.2, stage: 'Cell Weld', type: 'Pouch Cell', status: 'Passed', depth: 1 },
      { id: 'UNIT-02', x: 2, y: -0.2, stage: 'Cell Weld', type: 'Pouch Cell', status: 'Passed', depth: 1 },
      { id: 'BMS-104', x: 4, y: 0, stage: 'Controller Flash', type: 'BMS Unit', status: 'Inspected', depth: 2 }
    ],
    edges: [
      ['UNIT-01', 'PACK-09'],
      ['UNIT-02', 'PACK-09'],
      ['BMS-104', 'PACK-09']
    ]
  }
};

// login page
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-zinc-300 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center text-zinc-900 mb-6">
          Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
              User
            </label>
            <input
              type="text"
              placeholder="Enter User ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:border-zinc-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:border-zinc-800"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-zinc-900 hover:bg-black text-white text-sm font-semibold rounded transition shadow-sm cursor-pointer"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

// Plotly Canvas Component
function PlotlyCanvas({ targetUnit, graphType = 'GraphType1', isDarkMode, containerId = 'plotly-canvas-div' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!window.Plotly || !containerRef.current) return;

    const dataObj = MOCK_DATASET[targetUnit] || {
      nodes: [
        { id: targetUnit, x: 0, y: 0, stage: 'Origin Stage', type: 'Unit', status: 'Passed', depth: 0 },
        { id: 'Step-01', x: 2, y: 0.2, stage: 'Sub-Assembly', type: 'Component', status: 'Passed', depth: 1 },
        { id: 'Step-02', x: 4, y: -0.2, stage: 'Coating Roll', type: 'Batch', status: 'Inspected', depth: 2 },
        { id: 'Step-03', x: 6, y: 0.2, stage: 'Calendaring', type: 'Step', status: 'Passed', depth: 3 },
        { id: 'Step-04', x: 8, y: 0, stage: 'Precursor', type: 'Raw Material', status: 'Passed', depth: 4 },
      ],
      edges: [
        ['Step-01', targetUnit],
        ['Step-02', 'Step-01'],
        ['Step-03', 'Step-02'],
        ['Step-04', 'Step-03'],
      ]
    };

    const bgColor = isDarkMode ? '#18181b' : '#e4e4e7';
    const textColor = isDarkMode ? '#f4f4f5' : '#09090b';
    const gridColor = isDarkMode ? '#27272a' : '#d4d4d8';

    let traces = [];
    let layout = {
      paper_bgcolor: bgColor,
      plot_bgcolor: bgColor,
      autosize: true,
      margin: { l: 50, r: 50, t: 40, b: 40 },
      font: { color: textColor, family: 'sans-serif' }
    };

    // Interactive DAG Network Tree
    if (graphType === 'GraphType1') {
      const nodeMap = new Map();
      dataObj.nodes.forEach((n) => nodeMap.set(n.id, n));

      const edgeX = [];
      const edgeY = [];
      dataObj.edges.forEach(([parent, child]) => {
        const pNode = nodeMap.get(parent);
        const cNode = nodeMap.get(child);
        if (pNode && cNode) {
          edgeX.push(pNode.x, cNode.x, null);
          edgeY.push(pNode.y, cNode.y, null);
        }
      });

      const nodeLineColor = isDarkMode ? '#f4f4f5' : '#000000';
      const nodeFill = isDarkMode ? '#27272a' : '#ffffff';
      const edgeColor = isDarkMode ? '#a1a1aa' : '#71717a';

      traces = [
        {
          type: 'scatter',
          x: edgeX,
          y: edgeY,
          mode: 'lines',
          line: { color: edgeColor, width: 2 },
          hoverinfo: 'none',
          showlegend: false,
        },
        {
          type: 'scatter',
          x: dataObj.nodes.map((n) => n.x),
          y: dataObj.nodes.map((n) => n.y),
          mode: 'markers+text',
          text: dataObj.nodes.map((n) => n.id),
          textposition: 'top center',
          textfont: { size: 12, color: textColor },
          marker: {
            size: 26,
            color: nodeFill,
            line: { color: nodeLineColor, width: 2 },
          },
          hoverinfo: 'text',
          hovertext: dataObj.nodes.map((n) => `<b>${n.id}</b><br>Stage: ${n.stage}<br>Status: ${n.status}`),
          showlegend: false,
        },
      ];

      layout = {
        ...layout,
        dragmode: 'pan',
        xaxis: { showgrid: false, zeroline: false, showticklabels: false },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [-0.6, 0.6] },
      };
    } 
    // Genealogy Depth Hierarchy (Horizontal Bar Chart)
    else if (graphType === 'GraphType2') {
      const sortedNodes = [...dataObj.nodes].sort((a, b) => b.depth - a.depth);
      traces = [
        {
          type: 'bar',
          orientation: 'h',
          y: sortedNodes.map((n) => n.id),
          x: sortedNodes.map((n) => n.depth),
          text: sortedNodes.map((n) => `Depth ${n.depth} • ${n.stage}`),
          textposition: 'auto',
          marker: {
            color: isDarkMode ? '#3f3f46' : '#a1a1aa',
            line: { color: isDarkMode ? '#71717a' : '#27272a', width: 1.5 }
          },
          hoverinfo: 'text',
          hovertext: sortedNodes.map((n) => `<b>${n.id}</b><br>Type: ${n.type}<br>Depth: ${n.depth}`),
        }
      ];

      layout = {
        ...layout,
        title: { text: `Lineage Traversal Depth: ${targetUnit}`, font: { size: 14, color: textColor } },
        xaxis: { title: 'Traversal Depth (Hops)', gridcolor: gridColor, zerolinecolor: gridColor, dtick: 1 },
        yaxis: { automargin: true }
      };
    } 
    // Process Status Breakdown (Donut Chart)
    else if (graphType === 'GraphType3') {
      const statusCounts = {};
      dataObj.nodes.forEach((n) => {
        statusCounts[n.status] = (statusCounts[n.status] || 0) + 1;
      });

      traces = [
        {
          type: 'pie',
          hole: 0.5,
          labels: Object.keys(statusCounts),
          values: Object.values(statusCounts),
          textinfo: 'label+percent',
          hoverinfo: 'label+value+percent',
          marker: {
            colors: isDarkMode ? ['#52525b', '#27272a', '#3f3f46'] : ['#e4e4e7', '#a1a1aa', '#d4d4d8'],
            line: { color: isDarkMode ? '#f4f4f5' : '#000000', width: 1.5 }
          },
          textfont: { color: textColor }
        }
      ];

      layout = {
        ...layout,
        title: { text: `Unit Status Composition (${targetUnit})`, font: { size: 14, color: textColor } },
        showlegend: true,
        legend: { orientation: 'h', y: -0.15, font: { color: textColor } }
      };
    } 
    // Manufacturing Stage Pipeline Sequence (Scatter Plot)
    else if (graphType === 'GraphType4') {
      traces = [
        {
          type: 'scatter',
          mode: 'lines+markers+text',
          x: dataObj.nodes.map((n) => n.stage),
          y: dataObj.nodes.map((n) => n.depth),
          text: dataObj.nodes.map((n) => n.id),
          textposition: 'top center',
          line: { color: isDarkMode ? '#a1a1aa' : '#52525b', width: 2, dash: 'dot' },
          marker: {
            size: 16,
            color: isDarkMode ? '#e4e4e7' : '#18181b',
            symbol: 'diamond'
          },
          hoverinfo: 'text',
          hovertext: dataObj.nodes.map((n) => `<b>${n.id}</b><br>Stage: ${n.stage}<br>Depth: ${n.depth}`),
          showlegend: false
        }
      ];

      layout = {
        ...layout,
        title: { text: `Assembly Sequence Pipeline: ${targetUnit}`, font: { size: 14, color: textColor } },
        xaxis: { title: 'Process Stage', gridcolor: gridColor, zeroline: false },
        yaxis: { title: 'Genealogy Depth', gridcolor: gridColor, zeroline: false, dtick: 1 }
      };
    }

    const config = {
      responsive: true,
      scrollZoom: true,
      displayModeBar: false,
    };

    window.Plotly.newPlot(containerRef.current, traces, layout, config);

    if (window.Plotly.Plots) {
      window.Plotly.Plots.resize(containerRef.current);
    }
  }, [targetUnit, graphType, isDarkMode]);

  return <div id={containerId} ref={containerRef} className="w-full h-full" />;
}

// Lineage Data Table Component
function LineageDataTable({ targetUnit, isDarkMode }) {
  const dataObj = MOCK_DATASET[targetUnit] || {
    nodes: [
      { id: targetUnit, stage: 'Origin Stage', type: 'Unit', status: 'Passed', depth: 0 },
      { id: 'Step-01', stage: 'Slurry Mixing', type: 'Upstream Lot', status: 'Passed', depth: 1 },
      { id: 'Step-02', stage: 'Coating Roll', type: 'Process Step', status: 'Passed', depth: 2 },
      { id: 'Step-03', stage: 'Calendaring', type: 'Process Step', status: 'Inspected', depth: 3 },
      { id: 'Step-04', stage: 'Pouch Cell Assembly', type: 'Downstream Unit', status: 'Passed', depth: 4 },
    ]
  };

  return (
    <div className={`w-full h-full p-6 overflow-auto flex flex-col items-center justify-start ${isDarkMode ? 'bg-zinc-900 text-zinc-100' : 'bg-zinc-200 text-zinc-900'}`}>
      <div className="w-full max-w-4xl overflow-x-auto shadow-sm border border-zinc-400/40 rounded bg-white dark:bg-zinc-950">
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`border-b ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-zinc-100 border-zinc-300 text-zinc-700'} font-semibold uppercase tracking-wider`}>
            <tr>
              <th className="py-2.5 px-3">Depth</th>
              <th className="py-2.5 px-3">Unit / Lot ID</th>
              <th className="py-2.5 px-3">Process Stage</th>
              <th className="py-2.5 px-3">Lineage Type</th>
              <th className="py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {dataObj.nodes.map((row) => (
              <tr key={row.id} className={`${isDarkMode ? 'hover:bg-zinc-800/60 bg-zinc-950' : 'hover:bg-zinc-50 bg-white'} transition`}>
                <td className="py-2.5 px-3 font-mono font-medium">{row.depth}</td>
                <td className="py-2.5 px-3 font-mono font-bold">{row.id}</td>
                <td className="py-2.5 px-3">{row.stage}</td>
                <td className="py-2.5 px-3">{row.type}</td>
                <td className="py-2.5 px-3 text-xs font-normal">
                  {row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Main dashboard
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');

  const [activeTab, setActiveTab] = useState('Data View');
  const [selectedViewId, setSelectedViewId] = useState('1');
  const [activeGraphType, setActiveGraphType] = useState('GraphType1');
  const [viewMode, setViewMode] = useState('Graph'); // 'Graph' | 'Table'

  const [isDarkMode, setIsDarkMode] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);

  const [checkedViews, setCheckedViews] = useState({
    '1': true,
    '2': true,
    '3': true,
    '4': true,
  });
  const [exportFormat, setExportFormat] = useState('JSON');

  const [targetUnit, setTargetUnit] = useState('UNIT-01');
  const [traversalDir, setTraversalDir] = useState('Upstream');
  const [depthValue, setDepthValue] = useState(20);

  const checkBackendHealth = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/data', { method: 'HEAD' });
      setBackendConnected(res.ok);
      setDbConnected(res.ok);
    } catch {
      setBackendConnected((prev) => !prev);
      setDbConnected((prev) => !prev);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedView = INITIAL_SAVED_VIEWS.find((v) => v.id === selectedViewId) || INITIAL_SAVED_VIEWS[0];

  const handleSelectAll = () => {
    const allSelected = Object.values(checkedViews).every(Boolean);
    setCheckedViews({
      '1': !allSelected,
      '2': !allSelected,
      '3': !allSelected,
      '4': !allSelected,
    });
  };

  const toggleCheck = (id) => {
    setCheckedViews((prev) => ({ ...prev, [id]: !prev[id] }));
    setSelectedViewId(id);
    const view = INITIAL_SAVED_VIEWS.find((v) => v.id === id);
    if (view) setTargetUnit(view.unit);
  };

  const handleExport = () => {
    const selectedList = INITIAL_SAVED_VIEWS.filter((v) => checkedViews[v.id]);

    if (exportFormat === 'JSON') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(selectedList, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `lineage_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else if (exportFormat === 'CSV') {
      const header = 'id,name,unit,type,mode,depth\n';
      const rows = selectedList.map((v) => `${v.id},${v.name},${v.unit},${v.type},${v.mode},${v.depth}`).join('\n');
      const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + rows);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `lineage_export_${Date.now()}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else if (exportFormat === 'PNG') {
      const graphElem = document.getElementById('export-plotly-canvas');
      if (window.Plotly && graphElem) {
        window.Plotly.downloadImage(graphElem, {
          format: 'png',
          width: 900,
          height: 600,
          filename: `lineage_graph_${selectedView.unit}`,
        });
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  const bgTheme = isDarkMode ? 'bg-zinc-950 text-white' : 'bg-white text-black';
  const borderTheme = isDarkMode ? 'border-zinc-700' : 'border-black';
  const panelBg = isDarkMode ? 'bg-zinc-900' : 'bg-white';
  const subPanelBg = isDarkMode ? 'bg-zinc-800' : 'bg-zinc-200';

  return (
    <div className={`h-screen ${bgTheme} font-sans flex flex-col p-6 select-none transition-colors duration-200 overflow-hidden`}>
      
      {/* Upper Main Region */}
      <div className="flex-1 flex flex-col min-h-0">
        <header className="flex items-center justify-between pb-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('Data View')}
              className={`px-4 py-2 text-sm font-semibold rounded-md border transition-all duration-150 shadow-sm cursor-pointer ${
                activeTab === 'Data View'
                  ? isDarkMode
                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                    : 'bg-zinc-900 text-white border-zinc-900'
                  : isDarkMode
                    ? 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white hover:bg-zinc-800'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:text-black hover:bg-zinc-100'
              }`}
            >
              Data View
            </button>
            <button
              onClick={() => setActiveTab('Export')}
              className={`px-4 py-2 text-sm font-semibold rounded-md border transition-all duration-150 shadow-sm cursor-pointer ${
                activeTab === 'Export'
                  ? isDarkMode
                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                    : 'bg-zinc-900 text-white border-zinc-900'
                  : isDarkMode
                    ? 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white hover:bg-zinc-800'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:text-black hover:bg-zinc-100'
              }`}
            >
              Export
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-zinc-500">
              User: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{currentUser || 'Engineer'}</span>
            </span>

            <button
              onClick={() => {
                setIsAuthenticated(false);
                setCurrentUser('');
              }}
              className="text-xs text-red-500 hover:underline cursor-pointer"
            >
              Logout
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`px-3 py-1.5 text-xs font-medium border ${borderTheme} rounded transition flex items-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer ${
                isDarkMode ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
              }`}
            >
              {isDarkMode ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>
        </header>

        {/* -------------------- TAB 1: DATA VIEW -------------------- */}
        {activeTab === 'Data View' && (
          <div className={`border ${borderTheme} flex-1 flex flex-col min-h-0`}>
            <div className="flex flex-1 min-h-0">
              
              {/* Left Column: Saved Views */}
              <div className={`w-52 border-r ${borderTheme} flex flex-col ${panelBg} overflow-y-auto flex-shrink-0`}>
                {INITIAL_SAVED_VIEWS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedViewId(item.id);
                      setTargetUnit(item.unit);
                      setActiveGraphType(item.type);
                    }}
                    className={`h-12 border-b ${borderTheme} text-left px-4 text-sm font-normal transition flex-shrink-0 cursor-pointer ${
                      selectedViewId === item.id 
                        ? (isDarkMode ? 'bg-zinc-800 font-semibold' : 'bg-zinc-200 font-medium') 
                        : (isDarkMode ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-100')
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
                <div className={`flex-1 ${panelBg}`} />
              </div>

              {/* Center Column: Plotly Graph OR Table */}
              <div className={`flex-1 border-r ${borderTheme} ${subPanelBg} flex flex-col relative min-h-0 min-w-0`}>
                {viewMode === 'Graph' ? (
                  <div className="w-full h-full">
                    <PlotlyCanvas
                      targetUnit={targetUnit}
                      graphType={activeGraphType}
                      isDarkMode={isDarkMode}
                      containerId="data-plotly-canvas"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full">
                    <LineageDataTable
                      targetUnit={targetUnit}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                )}
              </div>

              {/* Right Column: Context Controls */}
              <div className={`w-64 ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-300'} relative flex flex-col p-4 space-y-4 flex-shrink-0 overflow-y-auto`}>
                <div className="text-left space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold opacity-75 mb-1">Target Unit</label>
                    <input
                      type="text"
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value)}
                      className={`w-full px-2 py-1.5 ${panelBg} border ${borderTheme} rounded font-mono focus:outline-none`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold opacity-75 mb-1">Direction</label>
                    <select
                      value={traversalDir}
                      onChange={(e) => setTraversalDir(e.target.value)}
                      className={`w-full px-2 py-1.5 ${panelBg} border ${borderTheme} rounded focus:outline-none`}
                    >
                      <option value="Upstream">Upstream</option>
                      <option value="Downstream">Downstream</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] uppercase font-bold opacity-75 mb-1">
                      <span>Depth</span>
                      <span>{depthValue}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={depthValue}
                      onChange={(e) => setDepthValue(parseInt(e.target.value))}
                      className="w-full cursor-pointer accent-zinc-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-zinc-500/30 text-[11px] opacity-75">
                    Active View: <span className="font-semibold">{activeGraphType}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div className={`h-10 border-t ${borderTheme} flex items-center justify-between ${panelBg} flex-shrink-0`}>
              {/* Left Group: GraphType 1-4 */}
              <div className={`flex h-full border-r ${borderTheme}`}>
                {['GraphType1', 'GraphType2', 'GraphType3', 'GraphType4'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setActiveGraphType(type);
                      setViewMode('Graph'); // Automatically switch to graph if a graph type is clicked
                    }}
                    className={`h-full px-3 text-xs border-r ${borderTheme} last:border-r-0 transition cursor-pointer ${
                      activeGraphType === type && viewMode === 'Graph'
                        ? (isDarkMode ? 'bg-zinc-800 font-bold' : 'bg-zinc-300 font-bold') 
                        : 'hover:opacity-75'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Right Group: Graph vs Table */}
              <div className={`flex h-full border-l ${borderTheme}`}>
                {['Graph', 'Table'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`h-full px-5 text-xs border-r ${borderTheme} last:border-r-0 transition cursor-pointer ${
                      viewMode === mode 
                        ? (isDarkMode ? 'bg-zinc-800 font-bold' : 'bg-zinc-300 font-bold') 
                        : 'hover:opacity-75'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -------------------- TAB 2: EXPORT VIEW -------------------- */}
        {activeTab === 'Export' && (
          <div className={`border ${borderTheme} flex-1 flex min-h-0`}>
            {/* Left Column: Checkbox List + Select All */}
            <div className={`w-52 border-r ${borderTheme} flex flex-col justify-between ${panelBg} flex-shrink-0`}>
              <div className="overflow-y-auto">
                {INITIAL_SAVED_VIEWS.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleCheck(item.id)}
                    className={`h-12 border-b ${borderTheme} flex items-center justify-between px-4 text-sm cursor-pointer transition ${
                      isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <span>{item.name}</span>
                    <input
                      type="checkbox"
                      checked={!!checkedViews[item.id]}
                      onChange={() => toggleCheck(item.id)}
                      className="w-4 h-4 cursor-pointer accent-black"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleSelectAll}
                className={`h-11 border-t ${borderTheme} ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-200 hover:bg-zinc-300'} text-xs font-medium transition flex-shrink-0 cursor-pointer`}
              >
                Select All
              </button>
            </div>

            {/* Middle Column: Export As Dropdown & Action Button */}
            <div className={`w-44 border-r ${borderTheme} p-3 ${panelBg} flex flex-col space-y-3 flex-shrink-0`}>
              <label className="text-[11px] font-bold uppercase opacity-75">Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className={`w-full border ${borderTheme} p-2 text-xs ${panelBg} cursor-pointer rounded focus:outline-none`}
              >
                <option value="JSON">Export As (JSON)</option>
                <option value="CSV">Export As (CSV)</option>
                <option value="PNG">Export As (PNG)</option>
              </select>

              <button
                onClick={handleExport}
                className={`w-full py-2 text-xs font-semibold border ${borderTheme} rounded ${
                  isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                } transition cursor-pointer`}
              >
                Export Now
              </button>
            </div>

            {/* Center Area: Active Plotly Graph in Export Canvas */}
            <div className={`flex-1 ${subPanelBg} relative flex flex-col items-center justify-center p-2 min-h-0 min-w-0`}>
              <div className="w-full h-full relative">
                <PlotlyCanvas
                  targetUnit={targetUnit}
                  graphType={activeGraphType}
                  isDarkMode={isDarkMode}
                  containerId="export-plotly-canvas"
                />
              </div>

              <div className="absolute top-4 right-4 bg-black/60 text-white text-[11px] px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                Format: {exportFormat} • Unit: {targetUnit} • Type: {activeGraphType}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Buttons */}
      <footer className="pt-2 flex flex-col items-end space-y-1 text-xs flex-shrink-0">
        <button
          onClick={() => setIsLoading(!isLoading)}
          title="Click to simulate loading toggle"
          className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition"
        >
          <span>{isLoading ? 'Loading Traversal Data...' : 'Loading Indicator Text'}</span>
          <div className={`w-4 h-4 border ${borderTheme} relative flex items-center justify-center ${isLoading ? 'bg-amber-400' : ''}`}>
            {isLoading ? (
              <span className="text-[10px] font-bold text-black animate-spin">⟳</span>
            ) : (
              <span className="text-[10px] opacity-70">●</span>
            )}
          </div>
        </button>

        <button
          onClick={checkBackendHealth}
          title="Click to re-test Backend Connection"
          className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition"
        >
          <span className={backendConnected ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500 font-medium'}>
            {backendConnected ? 'Backend Connected (/api/data)' : 'Backend Disconnected'}
          </span>
          <div className={`w-4 h-4 border ${borderTheme} relative flex items-center justify-center ${backendConnected ? 'bg-emerald-500' : 'bg-red-500'}`}>
            <span className="text-[9px] font-bold text-white">{backendConnected ? '✓' : '✕'}</span>
          </div>
        </button>

        <button
          onClick={() => setDbConnected(!dbConnected)}
          title="Click to toggle Database Connection state"
          className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition"
        >
          <span className={dbConnected ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500 font-medium'}>
            {dbConnected ? 'Database Connected (PostgreSQL)' : 'Database Disconnected'}
          </span>
          <div className={`w-4 h-4 border ${borderTheme} relative flex items-center justify-center ${dbConnected ? 'bg-emerald-500' : 'bg-red-500'}`}>
            <span className="text-[9px] font-bold text-white">{dbConnected ? '✓' : '✕'}</span>
          </div>
        </button>
      </footer>

    </div>
  );
}