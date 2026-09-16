import React, { useEffect, useState } from 'react';
import { AlertCircle, Cloud, Eye, EyeOff, Loader2, Lock, Mail, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function VaultLogin() {
  const { login, isLoading, requestMagicLink, cloudConfigured, ownerEmail } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    setParticles(Array.from({ length: 44 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 18 + 10,
      delay: Math.random() * 5,
    })));
  }, []);

  const sendLink = async () => {
    setBusy(true); setError(''); setSent(false);
    const result = await requestMagicLink(ownerEmail);
    if (result.success) setSent(true);
    else setError(result.error || 'Could not send the secure sign-in link.');
    setBusy(false);
  };

  const handleLegacy = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    const result = login(username, password);
    if (!result.success) setError(result.error);
    setBusy(false);
  };

  if (isLoading) return <div className="min-h-screen bg-[#030305] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-500"/></div>;

  return <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030305] px-6 py-10">
    <div className="absolute inset-0 overflow-hidden">
      {particles.map(p => <div key={p.id} className="absolute rounded-full bg-purple-500/20" style={{ left:`${p.x}%`, top:`${p.y}%`, width:p.size, height:p.size, animation:`float ${p.duration}s ease-in-out ${p.delay}s infinite` }}/>) }
    </div>
    <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl"/>
    <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-cyan-600/20 blur-3xl"/>
    <div className="absolute inset-0 opacity-10" style={{backgroundImage:'linear-gradient(rgba(139,92,246,.12) 1px, transparent 1px),linear-gradient(90deg,rgba(139,92,246,.12) 1px, transparent 1px)',backgroundSize:'50px 50px'}}/>

    <div className="relative z-10 w-full max-w-md">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 shadow-2xl shadow-purple-500/20"><Lock className="h-10 w-10 text-white"/></div>
        <h1 className="text-3xl font-bold text-white">LIV8 Command Center</h1>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-400"><Shield className="h-4 w-4"/>Secure owner access</p>
      </div>

      <div className="relative rounded-2xl border border-purple-500/20 bg-[#0a0a0f]/90 p-7 shadow-2xl backdrop-blur-xl">
        <div className="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10"/>
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10"><Cloud className="h-5 w-5 text-cyan-300"/></div>
          <div>
            <div className="text-xs uppercase tracking-[.18em] text-cyan-300">LIV8 owner account</div>
            <div className="mt-1 font-semibold text-white">{ownerEmail}</div>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">Use the same account on your Mac Mini, browser, or work laptop and your synced Command Center state follows you.</p>
          </div>
        </div>

        {cloudConfigured ? <button onClick={sendLink} disabled={busy || sent} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3.5 font-semibold text-white transition hover:from-purple-500 hover:to-cyan-500 disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin"/> : <Mail className="h-5 w-5"/>}
          {sent ? 'Check your email' : 'Email me a secure sign-in link'}
        </button> : <div className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">LIV8 Cloud login is waiting for its production environment configuration.</div>}

        {sent && <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-300">Open the sign-in email on this device. After the link opens Command Center, this device will stay signed in securely.</div>}
        {error && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 flex-none"/>{error}</div>}

        <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-white/10"/><span className="text-[11px] uppercase tracking-wider text-gray-600">existing device fallback</span><div className="h-px flex-1 bg-white/10"/></div>

        {!showLegacy ? <button onClick={() => setShowLegacy(true)} className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white">Use legacy local login</button> : <form onSubmit={handleLegacy} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">Username</label>
            <div className="relative"><input value={username} onChange={e=>setUsername(e.target.value)} className="w-full rounded-xl border border-purple-500/25 bg-white/5 px-4 py-3 pr-10 text-white outline-none focus:border-purple-400" required/><Sparkles className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400/50"/></div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">Password</label>
            <div className="relative"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-purple-500/25 bg-white/5 px-4 py-3 pr-11 text-white outline-none focus:border-purple-400" required/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">{showPassword?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div>
          </div>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 font-semibold text-white hover:bg-white/5 disabled:opacity-50">{busy&&<Loader2 className="h-4 w-4 animate-spin"/>}Unlock existing local session</button>
        </form>}

        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-5 text-center">
          {[['📊','Dashboard'],['🤖','Local AI'],['☁️','Cloud Sync']].map(([icon,label])=><div key={label} className="rounded-lg border border-white/5 bg-white/[.025] p-2"><div>{icon}</div><div className="mt-1 text-[11px] text-gray-500">{label}</div></div>)}
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-gray-700">© 2026 LIV8 Command Center</p>
    </div>

    <style>{`@keyframes float{0%,100%{transform:translate(0,0);opacity:.25}50%{transform:translate(10px,-20px);opacity:.75}}`}</style>
  </div>;
}

export default VaultLogin;
