import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCircle2, Clock3, Hash, Loader2, Play, RefreshCw, Send, ShieldCheck, Users, Wifi, WifiOff, XCircle } from 'lucide-react';
import { API_URL } from '../config';

const STATUS_STYLES = {
  working: 'text-cyan-300 bg-cyan-500/15', queued: 'text-yellow-300 bg-yellow-500/15',
  awaiting_approval: 'text-orange-300 bg-orange-500/15', approved: 'text-green-300 bg-green-500/15',
  completed: 'text-green-300 bg-green-500/15', blocked: 'text-red-300 bg-red-500/15'
};

function Inbox() {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(true);
  const bottomRef = useRef(null);

  const isNiftyChannel = activeChannel.startsWith('nifty:');
  const niftyChatId = isNiftyChannel ? activeChannel.slice(6) : null;

  const loadChannels = useCallback(async () => {
    const [teamResponse, niftyResponse] = await Promise.allSettled([
      fetch(`${API_URL}/api/team/channels`),
      fetch(`${API_URL}/api/nifty/mcp/chats`)
    ]);

    const merged = [];
    if (teamResponse.status === 'fulfilled' && teamResponse.value.ok) {
      const data = await teamResponse.value.json();
      merged.push(...((data.channels || []).map(channel => ({ ...channel, source: 'command-center' }))));
    }
    if (niftyResponse.status === 'fulfilled' && niftyResponse.value.ok) {
      const data = await niftyResponse.value.json();
      merged.push(...((data.chats || []).map(chat => ({
        id: `nifty:${chat.id}`,
        rawId: chat.id,
        name: chat.name,
        description: chat.description || 'Nifty conversation',
        message_count: '',
        source: 'nifty',
        lastMessageAt: chat.lastMessageAt
      }))));
    }

    if (!merged.length) throw new Error('No inbox sources available');
    setChannels(merged);
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      const messageUrl = isNiftyChannel
        ? `${API_URL}/api/nifty/mcp/chats/${encodeURIComponent(niftyChatId)}/messages?limit=150`
        : `${API_URL}/api/team/messages?channel=${encodeURIComponent(activeChannel)}`;

      const responses = await Promise.all([
        fetch(messageUrl), fetch(`${API_URL}/api/team/tasks?limit=50`), fetch(`${API_URL}/api/team/status`)
      ]);
      if (!responses.every(response => response.ok)) throw new Error('Team workspace unavailable');
      const [messageData, taskData, statusData] = await Promise.all(responses.map(response => response.json()));
      setMessages(messageData.messages || []);
      setTasks(taskData.tasks || []);
      setStatus(statusData);
      setConnected(true);
    } catch (error) {
      console.error(error);
      setConnected(false);
    }
  }, [activeChannel, isNiftyChannel, niftyChatId]);

  useEffect(() => { loadChannels().catch(() => setConnected(false)); }, [loadChannels]);
  useEffect(() => { loadWorkspace(); const interval = setInterval(loadWorkspace, 15000); return () => clearInterval(interval); }, [loadWorkspace]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async event => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    const content = message.trim();
    setMessage('');
    setSending(true);
    try {
      const url = isNiftyChannel ? `${API_URL}/api/nifty/mcp/message` : `${API_URL}/api/team/messages`;
      const body = isNiftyChannel
        ? { text: content, chatId: niftyChatId }
        : { content, channelId: activeChannel, userId: 'jamaur' };
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Message failed');
      await loadWorkspace();
    } catch (error) {
      setMessage(content);
      window.alert(error.message);
    } finally { setSending(false); }
  };

  const runTeam = async () => {
    setRunning(true);
    try {
      const response = await fetch(`${API_URL}/api/team/run`, { method: 'POST' });
      if (!response.ok) throw new Error('Proactive run failed');
      await loadWorkspace();
    } catch (error) { window.alert(error.message); } finally { setRunning(false); }
  };

  const approveTask = async id => {
    const response = await fetch(`${API_URL}/api/team/tasks/${id}/approve`, { method: 'POST' });
    if (response.ok) await loadWorkspace();
  };

  const activeTasks = useMemo(() => tasks.filter(task => ['working', 'queued', 'awaiting_approval', 'blocked'].includes(task.status)), [tasks]);
  const currentChannel = channels.find(channel => channel.id === activeChannel);

  return (
    <div className="h-[calc(100vh-7rem)] min-h-[620px] grid grid-cols-[240px_minmax(0,1fr)_340px] gap-4 animate-slide-in">
      <aside className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-white font-semibold"><Users className="w-5 h-5 text-purple-400" /> Team Inbox</div>
          <div className={`mt-2 flex items-center gap-1.5 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}{connected ? 'Command Center + Nifty online' : 'One or more sources disconnected'}
          </div>
        </div>
        <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100%-82px)]">
          {channels.map(channel => <button key={channel.id} onClick={() => setActiveChannel(channel.id)} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 ${activeChannel === channel.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}><Hash className="w-4 h-4" /><span className="truncate">{channel.name}</span>{channel.source === 'nifty' && <span className="ml-auto text-[9px] uppercase tracking-wide opacity-70">Nifty</span>}{channel.source !== 'nifty' && channel.message_count !== '' && <span className="ml-auto text-[10px] opacity-60">{channel.message_count}</span>}</button>)}
        </nav>
      </aside>

      <main className="rounded-xl border border-white/10 bg-white/5 flex flex-col min-w-0 overflow-hidden">
        <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div><div className="flex items-center gap-2"><h2 className="text-white font-semibold">#{currentChannel?.name || activeChannel}</h2>{isNiftyChannel && <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-purple-500/15 text-purple-300">Nifty live</span>}</div><p className="text-xs text-gray-500">{currentChannel?.description}</p></div>
          <button onClick={() => { loadChannels(); loadWorkspace(); }} className="p-2 rounded-lg hover:bg-white/10 text-gray-400"><RefreshCw className="w-4 h-4" /></button>
        </header>
        <section className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 && <div className="h-full grid place-items-center text-gray-500">No messages in this channel yet.</div>}
          {messages.map(item => <article key={item.id} className="flex gap-3"><div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${item.author_type === 'user' ? 'bg-purple-600' : 'bg-cyan-500/15 text-cyan-300'}`}>{item.author_type === 'user' ? (item.author_name?.[0]?.toUpperCase() || 'U') : <Bot className="w-5 h-5" />}</div><div className="min-w-0"><div className="flex items-baseline gap-2"><span className="text-sm font-semibold text-white">{item.author_name}</span><span className="text-[11px] text-gray-600">{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span></div><p className="mt-1 text-sm text-gray-300 whitespace-pre-wrap leading-6">{item.content}</p>{item.metadata?.status && <span className={`inline-block mt-2 px-2 py-1 rounded text-[11px] ${STATUS_STYLES[item.metadata.status] || 'bg-white/10 text-gray-300'}`}>{item.metadata.status.replaceAll('_', ' ')}</span>}</div></article>)}
          <div ref={bottomRef} />
        </section>
        <form onSubmit={sendMessage} className="p-4 border-t border-white/10"><div className="flex gap-2 rounded-xl bg-black/20 border border-white/10 p-2 focus-within:border-purple-500/60"><textarea value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(event); } }} placeholder={isNiftyChannel ? 'Reply in Nifty without leaving Command Center...' : 'Assign work, ask for an update, or message the team...'} rows={2} className="flex-1 resize-none bg-transparent text-sm text-white placeholder-gray-600 outline-none px-2 py-1" /><button disabled={sending || !message.trim()} className="self-end p-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button></div></form>
      </main>

      <aside className="rounded-xl border border-white/10 bg-white/5 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between"><div><h3 className="text-white font-semibold">Agent Work Queue</h3><p className="text-xs text-gray-500 mt-1">Real ownership and completion state</p></div><button onClick={runTeam} disabled={running} className="p-2 rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50">{running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}</button></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center"><Stat label="Working" value={status?.counts?.working || 0} /><Stat label="Approval" value={status?.counts?.awaiting_approval || 0} /><Stat label="Blocked" value={status?.counts?.blocked || 0} /></div>
          <div className={`mt-3 text-xs flex items-center gap-2 ${status?.proactive?.isRunning ? 'text-green-400' : 'text-yellow-400'}`}><Clock3 className="w-3.5 h-3.5" />Proactive engine {status?.proactive?.isRunning ? 'running' : 'stopped'}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeTasks.length === 0 && <div className="py-12 text-center text-sm text-gray-500">No active work. Run a proactive cycle or assign work in chat.</div>}
          {activeTasks.map(task => <div key={task.id} className="p-3 rounded-lg border border-white/10 bg-black/15"><div className="flex gap-2 justify-between"><span className="text-xs text-gray-500">#{task.id} · {task.assigned_agent_name || task.assigned_agent_id || 'Routing'}</span><StatusIcon status={task.status} /></div><h4 className="mt-1 text-sm text-white font-medium line-clamp-2">{task.title}</h4><span className={`inline-block mt-2 px-2 py-1 rounded text-[10px] ${STATUS_STYLES[task.status] || 'bg-white/10 text-gray-300'}`}>{task.status.replaceAll('_', ' ')}</span>{task.status === 'awaiting_approval' && <button onClick={() => approveTask(task.id)} className="mt-2 w-full py-1.5 rounded bg-green-600/20 text-green-300 hover:bg-green-600/30 text-xs flex items-center justify-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Approve prepared action</button>}{task.error && <p className="mt-2 text-xs text-red-300">{task.error}</p>}</div>)}
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }) { return <div className="rounded-lg bg-black/20 p-2"><div className="text-lg text-white font-semibold">{value}</div><div className="text-[10px] text-gray-500">{label}</div></div>; }
function StatusIcon({ status }) { if (status === 'blocked') return <XCircle className="w-4 h-4 text-red-400" />; if (['completed', 'approved'].includes(status)) return <CheckCircle2 className="w-4 h-4 text-green-400" />; if (status === 'working') return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />; return <Clock3 className="w-4 h-4 text-yellow-400" />; }

export default Inbox;
