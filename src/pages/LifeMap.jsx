import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Plus, Search, Link2, Trash2, X, Save, Sparkles, Network, Target,
  Crosshair, Layers, Maximize2, CheckCircle2, Circle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import * as svc from '../services/highestSelfService';

const DOMAINS = {
  self:     { label: 'Self',     color: '#a78bfa' },
  family:   { label: 'Family',   color: '#f59e0b' },
  health:   { label: 'Health',   color: '#2dd4bf' },
  wealth:   { label: 'Wealth',   color: '#60a5fa' },
  creation: { label: 'Creation', color: '#f472b6' },
};
const TYPE_SIZE = { domain: 30, plan: 26, project: 22, idea: 18, note: 16 };

function nodeColor(n) { return n.color || DOMAINS[n.domain]?.color || '#8b93a7'; }

/**
 * LifeMap — the mind-map / web of notes.
 * Canvas force-directed graph: zoom, pan, drag, link, and promote a selected
 * cluster into a Master Plan. Same data as the rest of Highest Self OS.
 */
export default function LifeMap() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const sim = useRef({ nodes: [], links: [], plans: [] });
  const view = useRef({ x: 0, y: 0, scale: 1 });
  const drag = useRef({ mode: null, id: null, sx: 0, sy: 0, moved: false });
  const raf = useRef(null);

  const [, force] = useState(0);
  const rerender = useCallback(() => force(v => v + 1), []);
  const [selected, setSelected] = useState(null);      // node id for edit panel
  const [multi, setMulti] = useState([]);              // ids for cluster -> plan
  const [linkFrom, setLinkFrom] = useState(null);
  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [plans, setPlans] = useState([]);
  const [editBuf, setEditBuf] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ---------- load ---------- */
  useEffect(() => {
    (async () => {
      const g = await svc.getGraph();
      const W = wrapRef.current?.clientWidth || 800;
      const H = wrapRef.current?.clientHeight || 600;
      sim.current.nodes = (g.notes || []).map((n, i) => ({
        ...n,
        x: n.x ?? W / 2 + Math.cos(i) * (120 + i * 12),
        y: n.y ?? H / 2 + Math.sin(i) * (120 + i * 12),
        vx: 0, vy: 0, pulse: Math.random() * Math.PI * 2,
      }));
      sim.current.links = g.links || [];
      setPlans(g.plans || []);
      setLoading(false);
      rerender();
    })();
  }, [rerender]);

  /* ---------- force simulation + render loop ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const w = wrapRef.current.clientWidth, h = wrapRef.current.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const step = () => {
      const { nodes, links } = sim.current;
      const W = wrapRef.current.clientWidth, H = wrapRef.current.clientHeight;
      // repulsion
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy || 0.01;
          const rep = 2600 / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * rep, fy = (dy / d) * rep;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
        // gentle pull to center
        a.vx += (W / 2 - a.x) * 0.0009;
        a.vy += (H / 2 - a.y) * 0.0009;
      }
      // springs
      const idx = Object.fromEntries(nodes.map(n => [n.id, n]));
      for (const l of links) {
        const a = idx[l.from_id], b = idx[l.to_id];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const target = 120;
        const f = (d - target) * 0.02;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      for (const n of nodes) {
        if (drag.current.id === n.id && drag.current.mode === 'node') continue;
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += n.vx; n.y += n.vy;
        n.pulse += 0.05;
      }
      draw(ctx);
      raf.current = requestAnimationFrame(step);
    };

    const draw = (ctx) => {
      const w = wrapRef.current.clientWidth, h = wrapRef.current.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = isDark ? '#0b0f0e' : '#f6f4ef';
      ctx.fillRect(0, 0, w, h);
      const v = view.current;
      ctx.save();
      ctx.translate(v.x, v.y); ctx.scale(v.scale, v.scale);

      const { nodes, links } = sim.current;
      const idx = Object.fromEntries(nodes.map(n => [n.id, n]));
      const q = query.trim().toLowerCase();
      const visible = (n) => (domainFilter === 'all' || n.domain === domainFilter) &&
        (!q || (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q));

      // edges
      ctx.lineWidth = 1.2;
      for (const l of links) {
        const a = idx[l.from_id], b = idx[l.to_id];
        if (!a || !b || !visible(a) || !visible(b)) continue;
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, nodeColor(a) + '66');
        grad.addColorStop(1, nodeColor(b) + '66');
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // nodes
      for (const n of nodes) {
        if (!visible(n)) continue;
        const r = TYPE_SIZE[n.node_type] || 16;
        const c = nodeColor(n);
        const isSel = selected === n.id;
        const inMulti = multi.includes(n.id);
        const isLinkSrc = linkFrom === n.id;
        const glow = 0.5 + 0.5 * Math.sin(n.pulse);
        // halo / glow for a 3D feel
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 8 + glow * 4, 0, Math.PI * 2);
        ctx.fillStyle = c + '22'; ctx.fill();
        if (n.status === 'parked' || n.status === 'archived') ctx.globalAlpha = 0.4;
        // body
        const g = ctx.createRadialGradient(n.x - r / 3, n.y - r / 3, r / 4, n.x, n.y, r);
        g.addColorStop(0, '#ffffffaa'); g.addColorStop(0.15, c); g.addColorStop(1, c + 'cc');
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        // ring
        if (isSel || inMulti || isLinkSrc) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = isLinkSrc ? '#22d3ee' : inMulti ? '#f59e0b' : '#ffffff';
          ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // label
        ctx.fillStyle = isDark ? '#e8ecea' : '#1c2321';
        ctx.font = `${n.node_type === 'domain' ? 700 : 500} ${Math.max(11, r * 0.5)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        const label = (n.title || '').length > 22 ? n.title.slice(0, 21) + '…' : n.title;
        ctx.fillText(label, n.x, n.y + r + 14);
      }
      ctx.restore();
    };

    raf.current = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener('resize', resize); };
  }, [isDark, query, domainFilter, selected, multi, linkFrom]);

  /* ---------- pointer helpers ---------- */
  const toWorld = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const v = view.current;
    return { x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale };
  };
  const hitNode = (wx, wy) => {
    const { nodes } = sim.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]; const r = (TYPE_SIZE[n.node_type] || 16) + 4;
      if ((n.x - wx) ** 2 + (n.y - wy) ** 2 <= r * r) return n;
    }
    return null;
  };

  const onDown = (e) => {
    const { x, y } = toWorld(e.clientX, e.clientY);
    const n = hitNode(x, y);
    drag.current = { mode: n ? 'node' : 'pan', id: n?.id ?? null, sx: e.clientX, sy: e.clientY, moved: false, ox: view.current.x, oy: view.current.y };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d.mode) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
    if (d.mode === 'pan') {
      view.current.x = d.ox + (e.clientX - d.sx);
      view.current.y = d.oy + (e.clientY - d.sy);
    } else if (d.mode === 'node') {
      const { x, y } = toWorld(e.clientX, e.clientY);
      const node = sim.current.nodes.find(n => n.id === d.id);
      if (node) { node.x = x; node.y = y; node.vx = 0; node.vy = 0; }
    }
  };
  const onUp = (e) => {
    const d = drag.current;
    if (d.mode === 'node' && !d.moved) {
      const node = sim.current.nodes.find(n => n.id === d.id);
      if (node) handleNodeClick(node, e.shiftKey);
    } else if (d.mode === 'node' && d.moved) {
      const node = sim.current.nodes.find(n => n.id === d.id);
      if (node && typeof node.id === 'number') svc.updateNote(node.id, { x: Math.round(node.x), y: Math.round(node.y) });
    } else if (d.mode === 'pan' && !d.moved) {
      setSelected(null); setEditBuf(null); setLinkFrom(null);
    }
    drag.current = { mode: null, id: null, sx: 0, sy: 0, moved: false };
  };
  const onWheel = (e) => {
    e.preventDefault();
    const v = view.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const ns = Math.min(3, Math.max(0.3, v.scale * factor));
    v.x = mx - (mx - v.x) * (ns / v.scale);
    v.y = my - (my - v.y) * (ns / v.scale);
    v.scale = ns;
  };

  const handleNodeClick = (node, shift) => {
    if (linkFrom != null && linkFrom !== node.id) {
      svc.linkNotes(linkFrom, node.id).then((l) => { if (l) sim.current.links.push(l); });
      setLinkFrom(null);
      return;
    }
    if (shift) {
      setMulti(m => m.includes(node.id) ? m.filter(i => i !== node.id) : [...m, node.id]);
      return;
    }
    setSelected(node.id);
    setEditBuf({ title: node.title, body: node.body || '', node_type: node.node_type, domain: node.domain, status: node.status });
  };

  /* ---------- actions ---------- */
  const addNote = async () => {
    const W = wrapRef.current.clientWidth, H = wrapRef.current.clientHeight;
    const v = view.current;
    const wx = (W / 2 - v.x) / v.scale, wy = (H / 2 - v.y) / v.scale;
    const n = await svc.createNote({ title: 'New note', node_type: 'note', domain: domainFilter === 'all' ? 'self' : domainFilter, x: Math.round(wx), y: Math.round(wy) });
    sim.current.nodes.push({ ...n, x: wx, y: wy, vx: 0, vy: 0, pulse: 0 });
    setSelected(n.id);
    setEditBuf({ title: n.title, body: '', node_type: n.node_type, domain: n.domain, status: n.status });
  };
  const saveEdit = async () => {
    if (selected == null || !editBuf) return;
    const updated = await svc.updateNote(selected, editBuf);
    const node = sim.current.nodes.find(n => n.id === selected);
    if (node) Object.assign(node, editBuf);
    rerender();
  };
  const removeNode = async () => {
    if (selected == null) return;
    await svc.deleteNote(selected);
    sim.current.nodes = sim.current.nodes.filter(n => n.id !== selected);
    sim.current.links = sim.current.links.filter(l => l.from_id !== selected && l.to_id !== selected);
    setSelected(null); setEditBuf(null);
  };
  const buildMasterPlan = async () => {
    if (multi.length < 2) return;
    const nodes = sim.current.nodes.filter(n => multi.includes(n.id));
    const title = `Master Plan — ${nodes[0].title}`;
    const milestones = nodes.map((n, i) => ({ id: i + 1, title: n.title, done: false }));
    const plan = await svc.createMasterPlan({
      title, summary: `Built from ${nodes.length} connected notes`,
      domain: nodes[0].domain, note_ids: multi, milestones,
    });
    setPlans(p => [plan, ...p]);
    setMulti([]);
  };
  const toggleMilestone = async (plan, mi) => {
    const ms = JSON.parse(plan.milestones_json || '[]');
    ms[mi].done = !ms[mi].done;
    const updated = await svc.updateMasterPlan(plan.id, { milestones: ms });
    setPlans(list => list.map(p => p.id === plan.id ? (updated || { ...p, milestones_json: JSON.stringify(ms) }) : p));
  };
  const removePlan = async (id) => { await svc.deleteMasterPlan(id); setPlans(list => list.filter(p => p.id !== id)); };
  const resetView = () => { view.current = { x: 0, y: 0, scale: 1 }; };

  const card = isDark ? 'bg-[#121817] border-[#243130]' : 'bg-white border-gray-200';
  const selNode = sim.current.nodes.find(n => n.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Network className="w-6 h-6 text-teal-400" /> Life Map
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Your notes as a living web. Drag to explore · scroll to zoom · click a node to edit · shift-click a cluster → build a Master Plan.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={addNote} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> Add note
          </button>
          <button onClick={resetView} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${card} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <Maximize2 className="w-4 h-4" /> Reset view
          </button>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${card}`}>
          <Search className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notes…"
            className={`bg-transparent outline-none text-sm w-40 ${isDark ? 'text-white placeholder-gray-600' : 'text-gray-900'}`} />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <FilterChip active={domainFilter === 'all'} onClick={() => setDomainFilter('all')} label="All" color="#8b93a7" isDark={isDark} />
          {Object.entries(DOMAINS).map(([k, d]) => (
            <FilterChip key={k} active={domainFilter === k} onClick={() => setDomainFilter(k)} label={d.label} color={d.color} isDark={isDark} />
          ))}
        </div>
        {multi.length > 0 && (
          <button onClick={buildMasterPlan} disabled={multi.length < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-medium">
            <Sparkles className="w-4 h-4" /> Build Master Plan ({multi.length})
          </button>
        )}
        {multi.length > 0 && (
          <button onClick={() => setMulti([])} className={`text-xs px-2 py-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>clear</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* canvas */}
        <div ref={wrapRef} className={`relative rounded-2xl border overflow-hidden ${card}`} style={{ height: '62vh', minHeight: 420 }}>
          {loading && <div className={`absolute inset-0 flex items-center justify-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading your web…</div>}
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onWheel={onWheel}
          />
          {linkFrom != null && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-cyan-500 text-white text-xs font-medium shadow-lg">
              Click another node to link · <button className="underline" onClick={() => setLinkFrom(null)}>cancel</button>
            </div>
          )}
        </div>

        {/* side panel */}
        <div className="space-y-4">
          {selNode && editBuf ? (
            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Edit node</span>
                <button onClick={() => { setSelected(null); setEditBuf(null); }} className={isDark ? 'text-gray-500' : 'text-gray-400'}><X className="w-4 h-4" /></button>
              </div>
              <input value={editBuf.title} onChange={e => setEditBuf({ ...editBuf, title: e.target.value })}
                className={`w-full mb-2 px-3 py-2 rounded-lg border bg-transparent text-sm font-medium ${isDark ? 'border-[#243130] text-white' : 'border-gray-200 text-gray-900'}`} />
              <textarea value={editBuf.body} onChange={e => setEditBuf({ ...editBuf, body: e.target.value })} rows={4} placeholder="Notes…"
                className={`w-full mb-2 px-3 py-2 rounded-lg border bg-transparent text-sm ${isDark ? 'border-[#243130] text-gray-200' : 'border-gray-200 text-gray-700'}`} />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Select label="Type" value={editBuf.node_type} onChange={v => setEditBuf({ ...editBuf, node_type: v })}
                  options={['note', 'idea', 'project', 'plan', 'domain']} isDark={isDark} />
                <Select label="Domain" value={editBuf.domain} onChange={v => setEditBuf({ ...editBuf, domain: v })}
                  options={Object.keys(DOMAINS)} isDark={isDark} />
              </div>
              <Select label="Status" value={editBuf.status} onChange={v => setEditBuf({ ...editBuf, status: v })}
                options={['active', 'idea', 'research', 'validated', 'parked', 'archived']} isDark={isDark} />
              <div className="flex items-center gap-2 mt-3">
                <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium"><Save className="w-4 h-4" /> Save</button>
                <button onClick={() => setLinkFrom(selected)} title="Link to another node" className={`px-3 py-2 rounded-lg border ${card} ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}><Link2 className="w-4 h-4" /></button>
                <button onClick={removeNode} className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ) : (
            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center gap-2 mb-2"><Crosshair className="w-4 h-4 text-teal-400" /><span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>How to use</span></div>
              <ul className={`text-xs space-y-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <li>• <b>Drag</b> a node to move it, <b>drag background</b> to pan</li>
                <li>• <b>Scroll / pinch</b> to zoom in and out</li>
                <li>• <b>Click</b> a node to edit; <b>Link</b> to tie notes together</li>
                <li>• <b>Shift-click</b> several nodes, then <b>Build Master Plan</b></li>
              </ul>
            </div>
          )}

          {/* master plans */}
          <div className={`rounded-2xl border p-4 ${card}`}>
            <div className="flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-amber-400" /><span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Master Plans</span></div>
            {plans.length === 0 && <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Shift-click a cluster of notes on the map, then “Build Master Plan” to grow one here.</p>}
            <div className="space-y-3">
              {plans.map(plan => {
                const ms = (() => { try { return JSON.parse(plan.milestones_json || '[]'); } catch { return []; } })();
                const done = ms.filter(m => m.done).length;
                return (
                  <div key={plan.id} className={`rounded-xl border p-3 ${isDark ? 'border-[#243130] bg-[#0e1413]' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ color: DOMAINS[plan.domain]?.color }}>{plan.title}</p>
                        <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{done}/{ms.length} milestones</p>
                      </div>
                      <button onClick={() => removePlan(plan.id)} className="text-gray-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {ms.map((m, mi) => (
                        <button key={mi} onClick={() => toggleMilestone(plan, mi)} className="flex items-center gap-2 text-left w-full">
                          {m.done ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                          <span className={`text-xs ${m.done ? 'line-through opacity-60' : ''} ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{m.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, color, isDark }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active ? 'border-transparent text-white' : isDark ? 'border-[#243130] text-gray-400' : 'border-gray-200 text-gray-500'}`}
      style={active ? { background: color } : {}}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} /> {label}
    </button>
  );
}
function Select({ label, value, onChange, options, isDark }) {
  return (
    <label className="block">
      <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`w-full mt-1 px-2 py-1.5 rounded-lg border bg-transparent text-sm ${isDark ? 'border-[#243130] text-white' : 'border-gray-200 text-gray-900'}`}>
        {options.map(o => <option key={o} value={o} className={isDark ? 'bg-[#121817]' : ''}>{o}</option>)}
      </select>
    </label>
  );
}
