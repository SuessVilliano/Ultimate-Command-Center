import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'liv8_highlevel_account_mode';
const HighLevelAccountContext = createContext(null);

export function HighLevelAccountProvider({ children }) {
  const [account, setAccount] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'company' ? 'company' : 'personal'; }
    catch { return 'personal'; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, account); } catch {}
  }, [account]);

  const value = useMemo(() => ({
    account,
    isCompany: account === 'company',
    setAccount: next => setAccount(next === 'company' ? 'company' : 'personal'),
  }), [account]);

  return <HighLevelAccountContext.Provider value={value}>{children}</HighLevelAccountContext.Provider>;
}

export function useHighLevelAccount() {
  const value = useContext(HighLevelAccountContext);
  if (value) return value;
  return { account: 'personal', isCompany: false, setAccount: () => {} };
}

export function HighLevelAccountSwitch({ compact = false }) {
  const { account, setAccount } = useHighLevelAccount();
  const modes = [
    { id: 'personal', label: 'Personal', sub: 'Sandbox / Meta SV' },
    { id: 'company', label: 'Company', sub: 'Live · My Book' },
  ];

  return <div className={`rounded-xl border p-1 ${account === 'company' ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-cyan-400/20 bg-cyan-500/5'}`}>
    <div className="flex gap-1">
      {modes.map(mode => {
        const active = account === mode.id;
        return <button key={mode.id} onClick={() => setAccount(mode.id)} className={`rounded-lg px-3 py-2 text-left transition-all ${active ? mode.id === 'company' ? 'bg-emerald-400/15 text-emerald-200 shadow-sm shadow-emerald-500/10' : 'bg-cyan-400/15 text-cyan-200 shadow-sm shadow-cyan-500/10' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}>
          <div className="flex items-center gap-2 text-xs font-bold"><span className={`h-2 w-2 rounded-full ${active ? mode.id === 'company' ? 'bg-emerald-300 animate-pulse' : 'bg-cyan-300' : 'bg-slate-700'}`}/>{mode.label}</div>
          {!compact && <div className="mt-0.5 text-[10px] opacity-70">{mode.sub}</div>}
        </button>;
      })}
    </div>
  </div>;
}

export default HighLevelAccountContext;
