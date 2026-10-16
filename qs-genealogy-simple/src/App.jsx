import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import testData from './mesgen_test_data.json';

// Data 

const LOTS = testData.lots || [];
const OPS = testData.ops || [];
const OP_BY_ID = new Map(OPS.map((o) => [o.id, o]));
const HIST = new Map(Object.entries(testData.hist || {}));

// Search Modes

const SEARCH_MODES = [
  {
    key: 'lot',
    label: 'Lot / Batch',
    placeholder: 'Lot ID(s): one, or paste a batch separated by commas / spaces / new lines',
  },
  { key: 'equipment', label: 'Equipment', placeholder: 'Equipment, e.g. EQ_ (partial match, several allowed)' },
  { key: 'operator', label: 'Operator', placeholder: 'Operator ID (partial match, several allowed)' },
  { key: 'operation', label: 'Operation ID', placeholder: 'Operation UUID: full or partial' },
];

const INITIAL_SAVED_VIEWS = [
  {
    id: '1',
    name: `Initial Lot (${LOTS[0] || 'None'})`,
    graph: 'trace',
    mode: 'lot',
    query: LOTS[0] || '',
    direction: 'Both',
    depth: 20,
  },
  {
    id: '2',
    name: `Equipment (${OPS[0]?.equipment || 'N/A'})`,
    graph: 'timeline',
    mode: 'equipment',
    query: OPS[0]?.equipment || '',
    direction: 'Both',
    depth: 3,
  },
  {
    id: '3',
    name: `Operator (${OPS[0]?.operator || 'N/A'})`,
    graph: 'operator',
    mode: 'operator',
    query: OPS[0]?.operator || '',
    direction: 'Both',
    depth: 1,
  },
  {
    id: '4',
    name: 'Sample Batch (4 Lots)',
    graph: 'timeline',
    mode: 'lot',
    query: LOTS.slice(0, 4).join(', '),
    direction: 'Both',
    depth: 20,
  },
];

// trace graph building

const MAX_LANES = 24;
const parseTerms = (q) =>
  q
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

function buildTrace({ mode, query, direction, depth, showParallel }) {
  const empty = { nodes: [], edges: [], lots: [], rows: [], opCount: 0, parallelOps: 0, truncated: 0 };
  const terms = parseTerms(query);
  if (!terms.length) return empty;

  const up = direction === 'Downstream' ? 0 : depth;
  const down = direction === 'Upstream' ? 0 : depth;

  const anchors = new Map();
  const focusOps = new Set();

  if (mode === 'lot') {
    LOTS.forEach((l) => {
      if (terms.some((t) => l.toLowerCase().includes(t))) anchors.set(l, 'all');
    });
  } else {
    const field = mode === 'equipment' ? 'equipment' : mode === 'operator' ? 'operator' : 'id';
    OPS.forEach((op) => {
      if (!terms.some((t) => String(op[field]).toLowerCase().includes(t))) return;
      focusOps.add(op.id);
      op.lots.forEach((l) => {
        const history = HIST.get(l) || [];
        const idx = history.indexOf(op.id);
        if (idx !== -1) {
          if (!anchors.has(l)) anchors.set(l, new Set());
          anchors.get(l).add(idx);
        }
      });
    });
  }

  let displayed = LOTS.filter((l) => anchors.has(l));
  const truncated = Math.max(0, displayed.length - MAX_LANES);
  displayed = displayed.slice(0, MAX_LANES);
  if (!displayed.length) return empty;
  const displayedSet = new Set(displayed);

  const nodes = new Map();
  const edges = new Map();
  const rows = [];

  const lotNode = (lot, k, lane, stub) => {
    const id = `${lot}#${k}`;
    if (!nodes.has(id)) {
      nodes.set(id, { id, kind: 'lot', lot, k, label: `${lot} (Seq ${k + 1})`, lane, stub: !!stub });
    }
    return id;
  };
  const opNode = (op) => {
    const id = `op:${op.id}`;
    if (!nodes.has(id)) {
      nodes.set(id, { id, kind: 'op', op, parallel: op.lots.length > 1, focus: focusOps.has(op.id) });
    }
    return id;
  };
  const addEdge = (from, to, parallel) => edges.set(`${from}->${to}`, { from, to, parallel });

  displayed.forEach((lot, lane) => {
    const history = HIST.get(lot) || [];
    const a = anchors.get(lot);
    const kept = new Set();
    if (a === 'all') history.forEach((_, i) => kept.add(i));
    else
      a.forEach((idx) => {
        for (let i = Math.max(0, idx - up); i <= Math.min(history.length - 1, idx + down); i++) kept.add(i);
      });

    [...kept]
      .sort((x, y) => x - y)
      .forEach((i) => {
        const op = OP_BY_ID.get(history[i]);
        if (!op) return;
        const from = lotNode(lot, i, lane);
        const o = opNode(op);
        const to = lotNode(lot, i + 1, lane);
        addEdge(from, o, op.lots.length > 1);
        addEdge(o, to, op.lots.length > 1);
        rows.push({
          lot,
          seq: i + 1,
          opId: op.id,
          equipment: op.equipment,
          operator: op.operator,
          location: op.location,
          parallelLots: op.lots.filter((x) => x !== lot),
        });
      });
  });

  if (showParallel) {
    [...nodes.values()]
      .filter((n) => n.kind === 'op')
      .forEach((n) => {
        n.op.lots.forEach((p) => {
          if (displayedSet.has(p)) return;
          const hist = HIST.get(p) || [];
          const k = hist.indexOf(n.op.id);
          if (k !== -1) {
            addEdge(lotNode(p, k, undefined, true), n.id, true);
          }
        });
      });
  }

  const nodeList = [...nodes.values()];
  return {
    nodes: nodeList,
    edges: [...edges.values()],
    lots: displayed,
    rows,
    opCount: nodeList.filter((n) => n.kind === 'op').length,
    parallelOps: nodeList.filter((n) => n.kind === 'op' && n.parallel).length,
    showParallel,
    truncated,
  };
}

// layout 

const LOT_W = 230;
const LOT_H = 46;
const OP_W = 310;
const OP_H = 100;
const COL_GAP = 90;
const LANE_H = 190;
const MIN_GAP = 26;

function computeLayout(trace) {
  const { nodes, edges } = trace;
  if (!nodes.length) return { nodes: [], edges: [], bounds: null };

  const map = new Map(
    nodes.map((n) => [n.id, { ...n, w: n.kind === 'op' ? OP_W : LOT_W, h: n.kind === 'op' ? OP_H : LOT_H }])
  );
  const preds = new Map();
  const succs = new Map();
  map.forEach((_, id) => {
    preds.set(id, []);
    succs.set(id, []);
  });
  edges.forEach((e) => {
    succs.get(e.from).push(e.to);
    preds.get(e.to).push(e.from);
  });

  const indeg = new Map();
  map.forEach((_, id) => indeg.set(id, preds.get(id).length));
  const queue = [...map.keys()].filter((id) => indeg.get(id) === 0);
  const order = [];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    seen.add(id);
    succs.get(id).forEach((s) => {
      indeg.set(s, indeg.get(s) - 1);
      if (indeg.get(s) === 0) queue.push(s);
    });
  }
  map.forEach((_, id) => {
    if (!seen.has(id)) order.push(id);
  });

  const layer = new Map();
  order.forEach((id) => {
    const p = preds.get(id).filter((x) => layer.has(x));
    layer.set(id, p.length ? Math.max(...p.map((x) => layer.get(x))) + 1 : 0);
  });
  [...order].reverse().forEach((id) => {
    const s = succs.get(id).filter((x) => layer.get(x) > layer.get(id));
    if (s.length) layer.set(id, Math.min(...s.map((x) => layer.get(x))) - 1);
  });

  const uniq = [...new Set(layer.values())].sort((a, b) => a - b);
  const colOf = new Map(uniq.map((l, i) => [l, i]));
  const cols = uniq.map(() => []);
  map.forEach((n, id) => {
    n.col = colOf.get(layer.get(id));
    cols[n.col].push(n);
  });
  const colW = cols.map((c) => Math.max(...c.map((n) => n.w)));
  const colX = [];
  let x = 0;
  colW.forEach((w, i) => {
    colX[i] = x;
    x += w + COL_GAP;
  });

  const laneY = (n) => (n.lane ?? 0) * LANE_H;
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const opBase = new Map();
  map.forEach((n) => {
    if (n.kind !== 'op') return;
    const mains = preds.get(n.id).map((id) => map.get(id)).filter((p) => !p.stub);
    opBase.set(n.id, mains.length ? mean(mains.map(laneY)) : 0);
  });
  const stubCount = new Map();
  map.forEach((n) => {
    if (n.kind !== 'lot') return;
    if (n.stub) {
      const opId = succs.get(n.id)[0];
      const t = stubCount.get(opId) || 0;
      stubCount.set(opId, t + 1);
      const off = (t % 2 === 0 ? 1 : -1) * (Math.floor(t / 2) + 1) * (LOT_H + 30);
      n.desired = (opBase.get(opId) ?? 0) + off;
    } else {
      n.desired = laneY(n);
    }
  });

  cols.forEach((c) => {
    c.forEach((n) => {
      if (n.kind !== 'op') return;
      const mains = preds.get(n.id).map((id) => map.get(id)).filter((p) => !p.stub && p.cy != null);
      n.desired = mains.length ? mean(mains.map((p) => p.cy)) : opBase.get(n.id) || 0;
    });
    let bottom = -Infinity;
    [...c]
      .sort((a, b) => a.desired - b.desired)
      .forEach((n) => {
        n.cy = Math.max(n.desired, bottom + MIN_GAP + n.h / 2);
        bottom = n.cy + n.h / 2;
      });
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  map.forEach((n) => {
    n.x = colX[n.col] + (colW[n.col] - n.w) / 2;
    n.y = n.cy - n.h / 2;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y - 20);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  });

  return {
    nodes: [...map.values()],
    edges,
    bounds: { minX, minY, w: maxX - minX, h: maxY - minY },
  };
}

// SVG and export 

function edgePath(a, b) {
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  if (x2 - x1 < 30) return `M${x1},${y1} C${x1 + 70},${y1} ${x2 - 70},${y2} ${x2},${y2}`;
  if (Math.abs(y2 - y1) < 1) return `M${x1},${y1} L${x2},${y2}`;
  const xm = x1 + Math.min(45, (x2 - x1) / 2);
  const s = y2 > y1 ? 1 : -1;
  const r = Math.min(8, Math.abs(y2 - y1) / 2, xm - x1, x2 - xm);
  return `M${x1},${y1} L${xm - r},${y1} Q${xm},${y1} ${xm},${y1 + s * r} L${xm},${y2 - s * r} Q${xm},${y2} ${xm + r},${y2} L${x2},${y2}`;
}

function downloadBlob(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSvgAsPng(svgEl, filename) {
  if (!svgEl) return;
  const vp = svgEl.querySelector('[data-viewport]');
  if (!vp) return;
  const bb = vp.getBBox();
  const pad = 40;
  const w = Math.ceil(bb.width + pad * 2);
  const h = Math.ceil(bb.height + pad * 2);
  const ns = 'http://www.w3.org/2000/svg';
  const clone = svgEl.cloneNode(true);
  clone.querySelector('[data-viewport]').setAttribute('transform', `translate(${pad - bb.x},${pad - bb.y})`);
  clone.setAttribute('xmlns', ns);
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  clone.removeAttribute('style');
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', w);
  bg.setAttribute('height', h);
  bg.setAttribute('fill', svgEl.getAttribute('data-bg') || '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' })
  );
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    }, 'image/png');
  };
  img.src = url;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// login

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) onLogin(username);
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-zinc-300 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center text-zinc-900 mb-6">Login</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">User</label>
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
            <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Password</label>
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

// graph canvas

const PALETTES = {
  light: {
    canvas: '#e9ecef',
    lotFill: '#eef0f2',
    lotStroke: '#6b7280',
    stubStroke: '#a3a8b0',
    lotText: '#111827',
    opFill: '#f4f5f6',
    opStroke: '#9ca3af',
    opText: '#1f2937',
    parFill: '#f1faf5',
    parStroke: '#3f9f72',
    edge: '#6b7280',
    green: '#3f9f72',
    ctrlBg: '#ffffff',
    ctrlText: '#111827',
    ctrlBorder: '#d4d4d8',
  },
  dark: {
    canvas: '#18181b',
    lotFill: '#27272a',
    lotStroke: '#a1a1aa',
    stubStroke: '#71717a',
    lotText: '#f4f4f5',
    opFill: '#222226',
    opStroke: '#71717a',
    opText: '#e4e4e7',
    parFill: '#10261b',
    parStroke: '#34a56f',
    edge: '#a1a1aa',
    green: '#34a56f',
    ctrlBg: '#27272a',
    ctrlText: '#f4f4f5',
    ctrlBorder: '#3f3f46',
  },
};

function GraphCanvas({ layout, isDarkMode, containerId, onPivot, resetSignal, emptyText }) {
  const pal = isDarkMode ? PALETTES.dark : PALETTES.light;
  const wrapRef = useRef(null);
  const viewRef = useRef({ x: 0, y: 0, k: 1 });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [overrides, setOverrides] = useState({});
  const [locked, setLocked] = useState(false);

  viewRef.current = view;

  const nodeMap = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const b = layout.bounds;
    if (!b || !size.w || !size.h) return;
    const pad = 50;
    const k = Math.max(0.05, Math.min((size.w - pad * 2) / b.w, (size.h - pad * 2) / b.h, 1.1));
    setView({ k, x: (size.w - b.w * k) / 2 - b.minX * k, y: (size.h - b.h * k) / 2 - b.minY * k });
  }, [layout, size.w, size.h]);

  useEffect(() => {
    setOverrides({});
  }, [layout, resetSignal]);

  useEffect(() => {
    fit();
  }, [fit, resetSignal]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const k = clamp(v.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), 0.05, 3);
        return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (f) =>
    setView((v) => {
      const k = clamp(v.k * f, 0.05, 3);
      const cx = size.w / 2;
      const cy = size.h / 2;
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
    });

  const startDrag = (e, d) => {
    const move = (ev) => {
      const dx = ev.clientX - d.sx;
      const dy = ev.clientY - d.sy;
      if (d.type === 'pan') setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
      else {
        const k = viewRef.current.k;
        setOverrides((o) => ({ ...o, [d.id]: { x: d.ox + dx / k, y: d.oy + dy / k } }));
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onBgDown = (e) => {
    if (e.button !== 0) return;
    startDrag(e, { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y });
  };
  const onNodeDown = (e, n) => {
    e.stopPropagation();
    if (e.button !== 0 || locked) return;
    const cur = overrides[n.id] || { x: n.x, y: n.y };
    startDrag(e, { type: 'node', id: n.id, sx: e.clientX, sy: e.clientY, ox: cur.x, oy: cur.y });
  };

  const P = (id) => {
    const n = nodeMap.get(id);
    if (!n) return { x: 0, y: 0, w: 0, h: 0 };
    const o = overrides[id];
    return { x: o ? o.x : n.x, y: o ? o.y : n.y, w: n.w, h: n.h };
  };

  const ctrlBtn = {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: pal.ctrlBg,
    color: pal.ctrlText,
    border: `1px solid ${pal.ctrlBorder}`,
    borderTop: 'none',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
  };

  const mid = (suffix) => `${containerId}-${suffix}`;

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: pal.canvas, cursor: 'grab', touchAction: 'none' }}
      onPointerDown={onBgDown}
    >
      <svg
        id={`${containerId}-svg`}
        data-bg={pal.canvas}
        width="100%"
        height="100%"
        style={{ display: 'block', userSelect: 'none' }}
      >
        <defs>
          <marker id={mid('arrow-gray')} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,1 L9,5 L0,9 z" fill={pal.edge} />
          </marker>
          <marker id={mid('arrow-green')} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,1 L9,5 L0,9 z" fill={pal.green} />
          </marker>
        </defs>

        <g data-viewport="1" transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {layout.edges.map((e) => {
            const a = P(e.from);
            const b = P(e.to);
            const toLot = e.from.startsWith('op:');
            return (
              <path
                key={`${e.from}->${e.to}`}
                d={edgePath(a, b)}
                fill="none"
                stroke={e.parallel ? pal.green : pal.edge}
                strokeWidth={1.6}
                strokeDasharray={e.parallel ? '6 4' : undefined}
                markerEnd={toLot ? `url(#${mid(e.parallel ? 'arrow-green' : 'arrow-gray')})` : undefined}
              />
            );
          })}

          {layout.nodes.map((n) => {
            const p = P(n.id);
            const common = {
              transform: `translate(${p.x},${p.y})`,
              onPointerDown: (e) => onNodeDown(e, n),
              onDoubleClick: () => onPivot && onPivot(n),
              style: { cursor: locked ? 'pointer' : 'move' },
            };

            if (n.kind === 'lot') {
              return (
                <g key={n.id} {...common}>
                  <title>{`${n.lot}: double-click to trace this lot`}</title>
                  <rect
                    width={n.w}
                    height={n.h}
                    rx={6}
                    fill={pal.lotFill}
                    stroke={n.stub ? pal.stubStroke : pal.lotStroke}
                    strokeWidth={2}
                  />
                  <text
                    x={n.w / 2}
                    y={n.h / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="13"
                    fontWeight="700"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fill={pal.lotText}
                  >
                    {n.label}
                  </text>
                  <circle cx={0} cy={n.h / 2} r={3} fill={pal.lotStroke} />
                  <circle cx={n.w} cy={n.h / 2} r={3} fill={pal.lotStroke} />
                </g>
              );
            }

            const { op } = n;
            const lines = [
              `Seg ID: ${op.id.length > 20 ? `${op.id.slice(0, 18)}…` : op.id}`,
              `Equipment: ${op.equipment}`,
              `Operator: ${op.operator}`,
              `Location: ${op.location}`,
            ];
            return (
              <g key={n.id} {...common}>
                <title>{`Operation ${op.id}: ${op.lots.length} lot(s). Double-click to show all lots`}</title>
                {n.parallel && (
                  <text
                    x={2}
                    y={-7}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fill={pal.green}
                  >
                    {`${op.lots.length} lots in parallel`}
                  </text>
                )}
                <rect
                  width={n.w}
                  height={n.h}
                  rx={6}
                  fill={n.parallel ? pal.parFill : pal.opFill}
                  stroke={n.parallel ? pal.parStroke : pal.opStroke}
                  strokeWidth={n.focus ? 3.5 : 2}
                />
                {lines.map((t, i) => (
                  <text
                    key={t}
                    x={14}
                    y={22 + i * 20}
                    fontSize="11.5"
                    fontWeight="600"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
                    fill={pal.opText}
                  >
                    {t}
                  </text>
                ))}
                <circle cx={0} cy={n.h / 2} r={3} fill={n.parallel ? pal.parStroke : pal.opStroke} />
                <circle cx={n.w} cy={n.h / 2} r={3} fill={n.parallel ? pal.parStroke : pal.opStroke} />
              </g>
            );
          })}
        </g>
      </svg>

      <div
        className="absolute left-2 bottom-2 flex flex-col shadow"
        style={{ borderTop: `1px solid ${pal.ctrlBorder}` }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" title="Zoom in" style={ctrlBtn} onClick={() => zoomBy(1.25)}>
          +
        </button>
        <button type="button" title="Zoom out" style={ctrlBtn} onClick={() => zoomBy(0.8)}>
          −
        </button>
        <button type="button" title="Fit view" style={ctrlBtn} onClick={fit}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" />
          </svg>
        </button>
        <button
          type="button"
          title={locked ? 'Unlock node dragging' : 'Lock node dragging'}
          style={ctrlBtn}
          onClick={() => setLocked((l) => !l)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="2" y="5.5" width="8" height="5.5" rx="1" fill={locked ? 'currentColor' : 'none'} />
            <path d={locked ? 'M3.8 5.5V4a2.2 2.2 0 014.4 0v1.5' : 'M3.8 5.5V4a2.2 2.2 0 014.2-.9'} />
          </svg>
        </button>
      </div>

      {!layout.nodes.length && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-semibold text-red-500">{emptyText}</span>
        </div>
      )}
    </div>
  );
}

// timeline and usage graphs

const GRAPH_TYPES = [
  { key: 'trace', label: 'Trace Graph' },
  { key: 'timeline', label: 'Lot Timeline' },
  { key: 'equipment', label: 'Equipment Usage' },
  { key: 'operator', label: 'Operator Workload' },
];

const OP_INDEX = new Map(OPS.map((o, i) => [o.id, i]));

function ChartFrame({ id, pal, width, height, emptyText, isEmpty, children }) {
  return (
    <div className="relative w-full h-full overflow-auto" style={{ background: pal.canvas }}>
      {isEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-semibold text-red-500">{emptyText}</span>
        </div>
      ) : (
        <svg id={`${id}-svg`} data-bg={pal.canvas} width={width} height={height} style={{ display: 'block', userSelect: 'none' }}>
          <g data-viewport="1">{children}</g>
        </svg>
      )}
    </div>
  );
}

const SANS = 'ui-sans-serif, system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function LotTimeline({ trace, isDarkMode, containerId, onPivot, emptyText }) {
  const pal = isDarkMode ? PALETTES.dark : PALETTES.light;
  const LABEL_W = 190;
  const COL_W = 62;
  const ROW_H = 34;
  const HEAD_H = 160;

  const model = useMemo(() => {
    if (!trace.rows.length) return null;
    const shown = new Set(trace.rows.map((r) => `${r.lot}|${r.opId}`));
    const opIds = [...new Set(trace.rows.map((r) => r.opId))].sort((a, b) => (OP_INDEX.get(a) ?? 0) - (OP_INDEX.get(b) ?? 0));
    const focus = new Set(trace.nodes.filter((n) => n.kind === 'op' && n.focus).map((n) => n.op.id));
    const mainLots = trace.lots;
    const stubLots = [];
    if (trace.showParallel) {
      opIds.forEach((id) => {
        const op = OP_BY_ID.get(id);
        if (op) {
          op.lots.forEach((l) => {
            if (!mainLots.includes(l) && !stubLots.includes(l)) stubLots.push(l);
          });
        }
      });
      stubLots.sort((a, b) => LOTS.indexOf(a) - LOTS.indexOf(b));
    }
    const rowLots = [...mainLots, ...stubLots];
    const rowOf = new Map(rowLots.map((l, i) => [l, i]));
    const cols = opIds.map((id, c) => {
      const op = OP_BY_ID.get(id);
      const members = op ? op.lots.filter((l) => (mainLots.includes(l) ? shown.has(`${l}|${id}`) : trace.showParallel)) : [];
      return { op, c, members, rows: members.map((l) => rowOf.get(l)) };
    });
    return { rowLots, mainLots, cols, focus };
  }, [trace]);

  if (!model) {
    return <ChartFrame id={containerId} pal={pal} isEmpty emptyText={emptyText} />;
  }
  const { rowLots, mainLots, cols, focus } = model;
  const width = LABEL_W + cols.length * COL_W + 30;
  const height = HEAD_H + rowLots.length * ROW_H + 30;
  const cx = (c) => LABEL_W + c * COL_W + COL_W / 2;
  const cy = (r) => HEAD_H + r * ROW_H + ROW_H / 2;

  return (
    <ChartFrame id={containerId} pal={pal} width={width} height={height}>
      {rowLots.map((l, r) => {
        const main = mainLots.includes(l);
        return (
          <g key={l}>
            {r % 2 === 0 && (
              <rect x={0} y={HEAD_H + r * ROW_H} width={width} height={ROW_H} fill={isDarkMode ? '#ffffff08' : '#00000008'} />
            )}
            <text
              x={LABEL_W - 12}
              y={cy(r)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="12"
              fontWeight={main ? 700 : 500}
              fontFamily={MONO}
              fill={pal.lotText}
              opacity={main ? 1 : 0.6}
              style={{ cursor: 'pointer' }}
              onDoubleClick={() => onPivot && onPivot({ kind: 'lot', lot: l })}
            >
              <title>Double-click to trace this lot</title>
              {l}
            </text>
          </g>
        );
      })}

      {cols.map(
        (col) =>
          col.op && focus.has(col.op.id) && (
            <rect key={`f${col.c}`} x={LABEL_W + col.c * COL_W + 4} y={HEAD_H - 8} width={COL_W - 8} height={rowLots.length * ROW_H + 16} rx={6} fill={pal.green} opacity={0.14} />
          )
      )}

      {rowLots.map((l, r) => {
        const cs = cols.filter((col) => col.members.includes(l)).map((col) => col.c);
        if (cs.length < 2) return null;
        return <line key={`h${l}`} x1={cx(Math.min(...cs))} x2={cx(Math.max(...cs))} y1={cy(r)} y2={cy(r)} stroke={pal.edge} strokeWidth={1.4} opacity={0.55} />;
      })}

      {cols.map((col) => {
        if (!col.op) return null;
        const par = col.op.lots.length > 1;
        const rs = col.rows;
        const label = col.op.equipment;
        return (
          <g key={col.op.id}>
            <title>{`${col.op.equipment} | operator ${col.op.operator} | ${col.op.location} | ${col.op.lots.length} lot(s)\n${col.op.id}`}</title>
            {rs.length > 1 && (
              <line x1={cx(col.c)} x2={cx(col.c)} y1={cy(Math.min(...rs))} y2={cy(Math.max(...rs))} stroke={par ? pal.green : pal.edge} strokeWidth={3} strokeDasharray={par ? '5 3' : undefined} />
            )}
            {col.members.map((l) => {
              const main = mainLots.includes(l);
              return (
                <circle key={l} cx={cx(col.c)} cy={cy(rowLots.indexOf(l))} r={6.5} fill={main ? (par ? pal.green : pal.lotStroke) : pal.canvas} stroke={par ? pal.green : pal.lotStroke} strokeWidth={2}>
                  <title>{`${l}: ${col.op.equipment} (${col.op.operator})`}</title>
                </circle>
              );
            })}
            <text
              transform={`translate(${cx(col.c) + 4},${HEAD_H - 14}) rotate(-55)`}
              fontSize="11"
              fontWeight="600"
              fontFamily={MONO}
              fill={par ? pal.green : pal.opText}
              style={{ cursor: 'pointer' }}
              onDoubleClick={() => onPivot && onPivot({ kind: 'op', op: col.op })}
            >
              {label}
            </text>
          </g>
        );
      })}

      <text x={12} y={24} fontSize="12" fontWeight="700" fontFamily={SANS} fill={pal.lotText}>
        Lots × operations (time runs left to right)
      </text>
      <g transform="translate(12,40)" fontFamily={SANS} fontSize="11" fill={pal.opText}>
        <circle cx={6} cy={6} r={5} fill={pal.lotStroke} stroke={pal.lotStroke} />
        <text x={16} y={10}>single-lot op</text>
        <circle cx={106} cy={6} r={5} fill={pal.green} stroke={pal.green} />
        <text x={116} y={10}>parallel op (joined by bar)</text>
        <circle cx={300} cy={6} r={5} fill={pal.canvas} stroke={pal.lotStroke} strokeWidth={2} />
        <text x={310} y={10}>parallel lot not searched</text>
      </g>
    </ChartFrame>
  );
}

function UsageChart({ trace, groupBy, isDarkMode, containerId, onPivot, emptyText }) {
  const pal = isDarkMode ? PALETTES.dark : PALETTES.light;
  const groups = useMemo(() => {
    const m = new Map();
    trace.nodes
      .filter((n) => n.kind === 'op')
      .forEach(({ op }) => {
        const key = op[groupBy];
        if (!m.has(key)) m.set(key, { key, ops: 0, lots: 0, parallelOps: 0 });
        const g = m.get(key);
        g.ops += 1;
        g.lots += op.lots.length;
        if (op.lots.length > 1) g.parallelOps += 1;
      });
    return [...m.values()].sort((a, b) => b.lots - a.lots || b.ops - a.ops);
  }, [trace, groupBy]);

  if (!groups.length) return <ChartFrame id={containerId} pal={pal} isEmpty emptyText={emptyText} />;

  const LABEL_W = 160;
  const BAR_W = 520;
  const ROW_H = 46;
  const TOP = 70;
  const max = Math.max(...groups.map((g) => g.lots), 1);
  const step = max <= 10 ? 1 : max <= 30 ? 5 : 10;
  const ticks = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  const sx = (v) => (v / max) * BAR_W;
  const width = LABEL_W + BAR_W + 190;
  const height = TOP + groups.length * ROW_H + 30;
  const title = groupBy === 'equipment' ? 'Equipment usage' : 'Operator workload';

  return (
    <ChartFrame id={containerId} pal={pal} width={width} height={height}>
      <text x={12} y={24} fontSize="13" fontWeight="700" fontFamily={SANS} fill={pal.lotText}>
        {title} (in the current search result)
      </text>
      <g fontFamily={SANS} fontSize="11" fill={pal.opText}>
        <rect x={12} y={36} width={12} height={10} fill={pal.lotStroke} opacity={0.55} />
        <text x={30} y={45}>operations</text>
        <rect x={110} y={36} width={12} height={10} fill={pal.green} />
        <text x={128} y={45}>lots processed (parallel lots counted)</text>
      </g>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={LABEL_W + sx(t)} x2={LABEL_W + sx(t)} y1={TOP - 8} y2={height - 24} stroke={pal.edge} opacity={0.25} />
          <text x={LABEL_W + sx(t)} y={TOP - 14} textAnchor="middle" fontSize="10" fontFamily={SANS} fill={pal.opText}>
            {t}
          </text>
        </g>
      ))}

      {groups.map((g, i) => {
        const y = TOP + i * ROW_H;
        return (
          <g
            key={g.key}
            style={{ cursor: 'pointer' }}
            onDoubleClick={() => onPivot && onPivot({ kind: groupBy, value: g.key })}
          >
            <title>{`${g.key}\n${g.ops} operation(s), ${g.lots} lot(s), ${g.parallelOps} parallel. Double-click to search it`}</title>
            <text x={LABEL_W - 10} y={y + 20} textAnchor="end" dominantBaseline="central" fontSize="12" fontWeight="700" fontFamily={MONO} fill={pal.lotText}>
              {g.key}
            </text>
            <rect x={LABEL_W} y={y + 4} width={Math.max(2, sx(g.ops))} height={14} fill={pal.lotStroke} opacity={0.55} rx={2} />
            <text x={LABEL_W + sx(g.ops) + 6} y={y + 11} dominantBaseline="central" fontSize="10" fontFamily={SANS} fill={pal.opText}>
              {g.ops}
            </text>
            <rect x={LABEL_W} y={y + 22} width={Math.max(2, sx(g.lots))} height={14} fill={pal.green} rx={2} />
            <text x={LABEL_W + sx(g.lots) + 6} y={y + 29} dominantBaseline="central" fontSize="10" fontWeight="700" fontFamily={SANS} fill={pal.opText}>
              {g.lots}
              {g.parallelOps ? `  (${g.parallelOps} parallel op${g.parallelOps > 1 ? 's' : ''})` : ''}
            </text>
          </g>
        );
      })}
    </ChartFrame>
  );
}

// table view

function TraceTable({ rows, isDarkMode }) {
  return (
    <div className={`w-full h-full p-4 overflow-auto ${isDarkMode ? 'bg-zinc-900 text-zinc-100' : 'bg-zinc-200 text-zinc-900'}`}>
      <div className={`overflow-x-auto shadow-sm border border-zinc-400/40 rounded ${isDarkMode ? 'bg-zinc-950' : 'bg-white'}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`border-b ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-zinc-100 border-zinc-300 text-zinc-700'} font-semibold uppercase tracking-wider`}>
            <tr>
              <th className="py-2.5 px-3">Lot</th>
              <th className="py-2.5 px-3">Seq</th>
              <th className="py-2.5 px-3">Operation (Seg ID)</th>
              <th className="py-2.5 px-3">Equipment</th>
              <th className="py-2.5 px-3">Operator</th>
              <th className="py-2.5 px-3">Location</th>
              <th className="py-2.5 px-3">Parallel lots</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-zinc-800' : 'divide-zinc-200'}`}>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 px-3 text-center text-red-500 font-semibold">
                  No data available
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={`${r.lot}-${r.seq}`}
                className={`${isDarkMode ? 'hover:bg-zinc-800/60 bg-zinc-950' : 'hover:bg-zinc-50 bg-white'} transition`}
              >
                <td className="py-2 px-3 font-mono font-bold">{r.lot}</td>
                <td className="py-2 px-3 font-mono">{r.seq}</td>
                <td className="py-2 px-3 font-mono">{r.opId}</td>
                <td className="py-2 px-3 font-mono">{r.equipment}</td>
                <td className="py-2 px-3">{r.operator}</td>
                <td className="py-2 px-3">{r.location}</td>
                <td className="py-2 px-3 font-mono">
                  {r.parallelLots.length ? `${r.parallelLots.length}: ${r.parallelLots.join(', ')}` : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// main dashboard

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');

  const [activeTab, setActiveTab] = useState('Data View');
  const [selectedViewId, setSelectedViewId] = useState('1');
  const [viewMode, setViewMode] = useState('Graph');
  const [graphType, setGraphType] = useState('trace');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [mode, setMode] = useState('lot');
  const [draft, setDraft] = useState(INITIAL_SAVED_VIEWS[0]?.query || '');
  const [query, setQuery] = useState(INITIAL_SAVED_VIEWS[0]?.query || '');
  const [direction, setDirection] = useState('Both');
  const [depthValue, setDepthValue] = useState(20);
  const [showParallel, setShowParallel] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);

  const [checkedViews, setCheckedViews] = useState({ 1: true, 2: true, 3: true, 4: true });
  const [exportFormat, setExportFormat] = useState('JSON');

  const trace = useMemo(
    () => buildTrace({ mode, query, direction, depth: depthValue, showParallel }),
    [mode, query, direction, depthValue, showParallel]
  );
  const layout = useMemo(() => computeLayout(trace), [trace]);

  const modeInfo = SEARCH_MODES.find((m) => m.key === mode);
  const emptyText = query.trim() ? 'No data available' : 'Enter a search in the right panel';

  const runSearch = (nextMode = mode, nextDraft = draft) => {
    setMode(nextMode);
    setQuery(nextDraft);
  };

  const applyView = (v) => {
    setSelectedViewId(v.id);
    if (v.graph) setGraphType(v.graph);
    setMode(v.mode);
    setDraft(v.query);
    setQuery(v.query);
    setDirection(v.direction);
    setDepthValue(v.depth);
  };

  const pivot = (n) => {
    let m = 'lot';
    let value = n.lot;
    if (n.kind === 'op') {
      m = 'operation';
      value = n.op.id;
    } else if (n.kind === 'equipment' || n.kind === 'operator') {
      m = n.kind;
      value = n.value;
    }
    setMode(m);
    setDraft(value);
    setQuery(value);
  };

  const renderGraph = (containerId) => {
    if (graphType === 'timeline')
      return <LotTimeline trace={trace} isDarkMode={isDarkMode} containerId={containerId} onPivot={pivot} emptyText={emptyText} />;
    if (graphType === 'equipment' || graphType === 'operator')
      return (
        <UsageChart
          trace={trace}
          groupBy={graphType}
          isDarkMode={isDarkMode}
          containerId={containerId}
          onPivot={pivot}
          emptyText={emptyText}
        />
      );
    return (
      <GraphCanvas
        layout={layout}
        isDarkMode={isDarkMode}
        containerId={containerId}
        onPivot={pivot}
        resetSignal={resetSignal}
        emptyText={emptyText}
      />
    );
  };

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

  const handleSelectAll = () => {
    const allSelected = Object.values(checkedViews).every(Boolean);
    setCheckedViews({ 1: !allSelected, 2: !allSelected, 3: !allSelected, 4: !allSelected });
  };

  const toggleCheck = (id) => {
    setCheckedViews((prev) => ({ ...prev, [id]: !prev[id] }));
    const view = INITIAL_SAVED_VIEWS.find((v) => v.id === id);
    if (view) applyView(view);
  };

  const handleExport = () => {
    const selected = INITIAL_SAVED_VIEWS.filter((v) => checkedViews[v.id]);
    const withTrace = selected.map((v) => ({
      view: v,
      trace: buildTrace({
        mode: v.mode,
        query: v.query,
        direction: v.direction,
        depth: v.depth,
        showParallel: true,
      }),
    }));

    if (exportFormat === 'JSON') {
      const payload = withTrace.map(({ view, trace: t }) => ({
        ...view,
        lots: t.lots,
        operations: t.opCount,
        rows: t.rows,
      }));
      downloadBlob(`lineage_export_${Date.now()}.json`, JSON.stringify(payload, null, 2), 'text/json');
    } else if (exportFormat === 'CSV') {
      const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const header = 'view,lot,seq,operation_id,equipment,operator,location,parallel_lots\n';
      const body = withTrace
        .flatMap(({ view, trace: t }) =>
          t.rows.map((r) =>
            [view.name, r.lot, r.seq, r.opId, r.equipment, r.operator, r.location, r.parallelLots.join(' ')]
              .map(esc)
              .join(',')
          )
        )
        .join('\n');
      downloadBlob(`lineage_export_${Date.now()}.csv`, header + body, 'text/csv');
    } else if (exportFormat === 'PNG') {
      exportSvgAsPng(document.getElementById('export-graph-svg'), `lineage_graph_${Date.now()}.png`);
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

  const tabBtn = (name) =>
    `px-4 py-2 text-sm font-semibold rounded-md border transition-all duration-150 shadow-sm cursor-pointer ${
      activeTab === name
        ? isDarkMode
          ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
          : 'bg-zinc-900 text-white border-zinc-900'
        : isDarkMode
          ? 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white hover:bg-zinc-800'
          : 'bg-white text-zinc-700 border-zinc-300 hover:text-black hover:bg-zinc-100'
    }`;

  const fieldCls = `w-full px-2 py-1.5 ${panelBg} border ${borderTheme} rounded focus:outline-none`;

  return (
    <div className={`h-screen ${bgTheme} font-sans flex flex-col p-6 select-none transition-colors duration-200 overflow-hidden`}>
      <div className="flex-1 flex flex-col min-h-0">
        <header className="flex items-center justify-between pb-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button onClick={() => setActiveTab('Data View')} className={tabBtn('Data View')}>
              Data View
            </button>
            <button onClick={() => setActiveTab('Export')} className={tabBtn('Export')}>
              Export
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-zinc-500">
              User:{' '}
              <span className={`font-semibold ${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {currentUser || 'Engineer'}
              </span>
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

        {/* TAB 1: DATA VIEW */}
        {activeTab === 'Data View' && (
          <div className={`border ${borderTheme} flex-1 flex flex-col min-h-0`}>
            <div className="flex flex-1 min-h-0">
              {/* Left Column: Saved Views */}
              <div className={`w-52 border-r ${borderTheme} flex flex-col ${panelBg} overflow-y-auto flex-shrink-0`}>
                {INITIAL_SAVED_VIEWS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => applyView(item)}
                    title={`${item.mode}: ${item.query}`}
                    className={`h-12 border-b ${borderTheme} text-left px-4 text-sm font-normal transition flex-shrink-0 cursor-pointer ${
                      selectedViewId === item.id
                        ? isDarkMode
                          ? 'bg-zinc-800 font-semibold'
                          : 'bg-zinc-200 font-medium'
                        : isDarkMode
                          ? 'hover:bg-zinc-800/50'
                          : 'hover:bg-zinc-100'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
                <div className={`flex-1 ${panelBg}`} />
              </div>

              {/* Center Column: Full-Height Graph or Table */}
              <div className={`flex-1 border-r ${borderTheme} ${subPanelBg} flex flex-col min-h-0 min-w-0 relative`}>
                {viewMode === 'Graph' ? renderGraph('data-graph') : <TraceTable rows={trace.rows} isDarkMode={isDarkMode} />}
              </div>

              {/* Right Column: Complete Search & Controls Panel */}
              <div className={`w-72 ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-300'} flex flex-col p-4 space-y-4 flex-shrink-0 overflow-y-auto`}>
                <div className="text-left space-y-3 text-xs">
                  {/* Search Mode */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold opacity-75 mb-1">Search by</label>
                    <select
                      value={mode}
                      onChange={(e) => runSearch(e.target.value, draft)}
                      className={fieldCls}
                    >
                      {SEARCH_MODES.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Query Input */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold opacity-75 mb-1">Search query</label>
                    <textarea
                      rows={2}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          runSearch();
                        }
                      }}
                      placeholder={modeInfo?.placeholder}
                      spellCheck={false}
                      className={`w-full px-2.5 py-1.5 text-xs font-mono rounded border ${borderTheme} focus:outline-none select-text ${
                        isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'
                      }`}
                    />
                  </div>

                  {/* Search Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => runSearch()}
                      className="flex-1 py-1.5 text-xs font-semibold rounded bg-zinc-900 text-white hover:bg-black border border-zinc-700 cursor-pointer transition shadow-sm"
                    >
                      Search
                    </button>
                    <button
                      onClick={() => setResetSignal((s) => s + 1)}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition shadow-sm"
                    >
                      Reset Layout
                    </button>
                  </div>

                  {/* Direction */}
                  <div className={`pt-2 border-t border-zinc-500/30 ${mode === 'lot' ? 'opacity-40' : ''}`}>
                    <label className="block text-[10px] uppercase font-bold opacity-75 mb-1">Direction</label>
                    <select
                      value={direction}
                      disabled={mode === 'lot'}
                      onChange={(e) => setDirection(e.target.value)}
                      className={fieldCls}
                    >
                      <option value="Both">Both</option>
                      <option value="Upstream">Upstream (before match)</option>
                      <option value="Downstream">Downstream (after match)</option>
                    </select>
                  </div>

                  {/* Steps around match */}
                  <div className={mode === 'lot' ? 'opacity-40' : ''}>
                    <div className="flex justify-between text-[10px] uppercase font-bold opacity-75 mb-1">
                      <span>Steps around match</span>
                      <span>{depthValue}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={depthValue}
                      disabled={mode === 'lot'}
                      onChange={(e) => setDepthValue(parseInt(e.target.value, 10))}
                      className="w-full cursor-pointer accent-zinc-500"
                    />
                    {mode === 'lot' && <div className="text-[10px] opacity-75 mt-1">Lot search shows the full history.</div>}
                  </div>

                  {/* Parallel lots checkbox */}
                  <label className="flex items-start gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={showParallel}
                      onChange={(e) => setShowParallel(e.target.checked)}
                      className="mt-0.5 accent-zinc-700"
                    />
                    <span>
                      Show parallel lots
                      <span className="block text-[10px] opacity-75">
                        Other lots processed in the same operation (dashed green)
                      </span>
                    </span>
                  </label>

                  {/* Results Count Summary */}
                  <div className="pt-2 border-t border-zinc-500/30 space-y-1 text-[11px]">
                    <div className="font-bold uppercase text-[10px] opacity-75">Result</div>
                    <div>Lots: <span className="font-semibold">{trace.lots.length}</span></div>
                    <div>Operations: <span className="font-semibold">{trace.opCount}</span></div>
                    <div>Parallel operations: <span className="font-semibold">{trace.parallelOps}</span></div>
                    {trace.truncated > 0 && (
                      <div className="text-amber-600 font-semibold">
                        Showing first {MAX_LANES} lots; {trace.truncated} more matched. Narrow the search.
                      </div>
                    )}
                  </div>

                  {/* Lots in graph */}
                  {trace.lots.length > 0 && (
                    <div className="pt-2 border-t border-zinc-500/30">
                      <div className="font-bold uppercase text-[10px] opacity-75 mb-1">Lots in graph</div>
                      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                        {trace.lots.map((l) => (
                          <button
                            key={l}
                            title="Trace only this lot"
                            onClick={() => {
                              runSearch('lot', l);
                              setDraft(l);
                            }}
                            className={`px-1.5 py-0.5 rounded border font-mono text-[10px] cursor-pointer ${
                              isDarkMode ? 'border-zinc-600 hover:bg-zinc-800' : 'border-zinc-500 hover:bg-zinc-200'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-500/30 text-[10px] opacity-75 leading-snug">
                    Trace Graph: drag to pan, scroll to zoom, drag nodes to rearrange. In any graph, double-click a lot to
                    trace it, an operation to see every lot run in it, or an equipment / operator bar to search it.
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div className={`h-10 border-t ${borderTheme} flex items-center justify-between ${panelBg} flex-shrink-0`}>
              <div className={`flex h-full border-r ${borderTheme}`}>
                {GRAPH_TYPES.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => {
                      setGraphType(g.key);
                      setViewMode('Graph');
                    }}
                    className={`h-full px-3 text-xs border-r ${borderTheme} last:border-r-0 transition cursor-pointer ${
                      graphType === g.key && viewMode === 'Graph'
                        ? isDarkMode
                          ? 'bg-zinc-800 font-bold'
                          : 'bg-zinc-300 font-bold'
                        : 'hover:opacity-75'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              <div className={`flex h-full border-l ${borderTheme}`}>
                {['Graph', 'Table'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    className={`h-full px-5 text-xs border-r ${borderTheme} last:border-r-0 transition cursor-pointer ${
                      viewMode === m
                        ? isDarkMode
                          ? 'bg-zinc-800 font-bold'
                          : 'bg-zinc-300 font-bold'
                        : 'hover:opacity-75'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXPORT VIEW */}
        {activeTab === 'Export' && (
          <div className={`border ${borderTheme} flex-1 flex min-h-0`}>
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
                      onChange={() => {}}
                      className="w-4 h-4 cursor-pointer accent-black"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleSelectAll}
                className={`h-11 border-t ${borderTheme} ${
                  isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-200 hover:bg-zinc-300'
                } text-xs font-medium transition flex-shrink-0 cursor-pointer`}
              >
                Select All
              </button>
            </div>

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

              <div className="text-[10px] opacity-75 leading-snug">
                JSON / CSV export the lot histories for every checked view. PNG exports the graph shown on the right.
              </div>
            </div>

            <div className={`flex-1 ${subPanelBg} relative min-h-0 min-w-0`}>
              {renderGraph('export-graph')}
              <div className="absolute top-4 right-4 bg-black/60 text-white text-[11px] px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                Format: {exportFormat} • {GRAPH_TYPES.find((g) => g.key === graphType).label} • {modeInfo?.label}: {query.length > 40 ? `${query.slice(0, 40)}…` : query}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Connection Monitors */}
      <footer className="pt-2 flex flex-col items-end space-y-1 text-xs flex-shrink-0">
        <button
          onClick={() => setIsLoading(!isLoading)}
          title="Click to simulate loading toggle"
          className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition"
        >
          <span>{isLoading ? 'Loading Traversal Data...' : 'Static mesgen Data Loaded'}</span>
          <div className={`w-4 h-4 border ${borderTheme} relative flex items-center justify-center ${isLoading ? 'bg-amber-400' : ''}`}>
            {isLoading ? <span className="text-[10px] font-bold text-black animate-spin">⟳</span> : <span className="text-[10px] opacity-70">●</span>}
          </div>
        </button>

        <button
          onClick={checkBackendHealth}
          title="Click to re-test Backend Connection"
          className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition"
        >
          <span className={backendConnected ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
            {backendConnected ? 'Dataset: smoke scenario (JSON)' : 'Data disconnected'}
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
          <span className={dbConnected ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
            {dbConnected ? 'Local File Mode' : 'Remote DB Mode'}
          </span>
          <div className={`w-4 h-4 border ${borderTheme} relative flex items-center justify-center ${dbConnected ? 'bg-emerald-500' : 'bg-red-500'}`}>
            <span className="text-[9px] font-bold text-white">{dbConnected ? '✓' : '✕'}</span>
          </div>
        </button>
      </footer>
    </div>
  );
}