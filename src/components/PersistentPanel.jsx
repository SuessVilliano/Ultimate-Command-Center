import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function PersistentPanel({ id, title, subtitle, icon: Icon, children, className = '', defaultOpen = true, actions = null }) {
  const key = `liv8-panel:${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved == null ? defaultOpen : saved === '1';
    } catch { return defaultOpen; }
  });

  const toggle = () => setOpen(v => {
    const next = !v;
    try { localStorage.setItem(key, next ? '1' : '0'); } catch {}
    return next;
  });

  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 p-4">
        <button onClick={toggle} className="min-w-0 flex flex-1 items-center gap-3 text-left" aria-expanded={open}>
          {Icon && <Icon className="h-5 w-5 shrink-0 text-cyan-300" />}
          <div className="min-w-0">
            <div className="font-semibold text-white truncate">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-gray-500 truncate">{subtitle}</div>}
          </div>
        </button>
        <div className="flex items-center gap-2">
          {actions}
          <button onClick={toggle} className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:text-white" aria-label={open ? `Collapse ${title}` : `Expand ${title}`}>
            {open ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
          </button>
        </div>
      </div>
      {open && <div className="border-t border-white/10 p-4">{children}</div>}
    </section>
  );
}
