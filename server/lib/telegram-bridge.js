/**
 * LIV8 Command Center - Telegram Bridge
 *
 * Bridges voice (Meta glasses) ↔ Telegram messaging:
 * 1. Send messages to Telegram chats on user's behalf
 * 2. Receive replies via polling/webhook and queue for voice readback
 * 3. Monitor signal channels for trading signals
 * 4. Forward refined trades to Kraken Pro Telegram bot
 *
 * Architecture:
 *   Glasses (voice) → "tell Juno to check signals"
 *   → /api/telegram/send → Telegram Bot API → chat message
 *   → Telegram reply → /api/telegram/updates → spoken through glasses
 */

import { getSetting, setSetting } from './database.js';

// Telegram Bot API base URL
const TG_API = 'https://api.telegram.org/bot';

// Message queue for glasses readback
const messageQueue = [];

// Signal history (in-memory + persisted to DB)
const signalHistory = [];

// Last processed update ID for polling
let lastUpdateId = 0;

// Configured channels
let channels = {};

/**
 * Initialize Telegram bridge with bot token and channel configs
 */
export function initTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('Telegram bridge: No TELEGRAM_BOT_TOKEN configured');
    return false;
  }

  // Load channel IDs from env
  channels = {
    juno: {
      id: process.env.TELEGRAM_JUNO_CHAT_ID || null,
      name: 'Juno / OpenClaw',
      type: 'bot',
    },
    signals: {
      id: process.env.TELEGRAM_SIGNALS_CHAT_ID || null,
      name: 'Smart Auto Trader',
      type: 'signals',
    },
    kraken: {
      id: process.env.TELEGRAM_KRAKEN_CHAT_ID || null,
      name: 'Kraken Pro',
      type: 'trading',
    },
    community: {
      id: process.env.TELEGRAM_COMMUNITY_CHAT_ID || null,
      name: 'Community',
      type: 'general',
    },
  };

  // Load saved channel IDs from database
  try {
    const saved = getSetting('telegram_channels', null);
    if (saved) {
      const savedChannels = JSON.parse(saved);
      for (const [key, val] of Object.entries(savedChannels)) {
        if (channels[key] && val.id) {
          channels[key].id = val.id;
        }
      }
    }
  } catch {}

  console.log('Telegram bridge initialized. Channels:', Object.entries(channels)
    .filter(([, v]) => v.id)
    .map(([k, v]) => `${k}(${v.id})`)
    .join(', ') || 'none configured');

  return true;
}

/**
 * Get bot token
 */
function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

/**
 * Call Telegram Bot API
 */
async function tgApi(method, params = {}) {
  const token = getToken();
  if (!token) throw new Error('Telegram bot token not configured');

  const response = await fetch(`${TG_API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
  }
  return data.result;
}

/**
 * Send a message to a Telegram chat
 */
export async function sendMessage(channelKey, text) {
  const channel = channels[channelKey];
  if (!channel?.id) {
    throw new Error(`Channel "${channelKey}" not configured. Set TELEGRAM_${channelKey.toUpperCase()}_CHAT_ID in .env`);
  }

  const result = await tgApi('sendMessage', {
    chat_id: channel.id,
    text,
    parse_mode: 'Markdown',
  });

  return {
    messageId: result.message_id,
    chat: channel.name,
    text,
    sentAt: new Date().toISOString(),
  };
}

/**
 * Get new messages (long polling)
 * Returns messages received since last check
 */
export async function getUpdates() {
  const token = getToken();
  if (!token) return [];

  try {
    const updates = await tgApi('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 5,
      allowed_updates: ['message', 'channel_post'],
    });

    if (!updates.length) return [];

    const messages = [];
    for (const update of updates) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);

      const msg = update.message || update.channel_post;
      if (!msg?.text) continue;

      const chatId = String(msg.chat.id);
      const channelKey = Object.entries(channels).find(([, v]) => String(v.id) === chatId)?.[0] || 'unknown';

      const processed = {
        id: msg.message_id,
        chatId,
        channelKey,
        channelName: channels[channelKey]?.name || msg.chat.title || 'Unknown',
        from: msg.from?.first_name || msg.chat.title || 'Unknown',
        text: msg.text,
        date: new Date(msg.date * 1000).toISOString(),
        isSignal: false,
      };

      // Detect trading signals
      if (channelKey === 'signals' || isTradeSignal(msg.text)) {
        processed.isSignal = true;
        processed.signal = parseSignal(msg.text);
        signalHistory.push(processed);
        // Persist to DB
        try {
          setSetting('signal_history', JSON.stringify(signalHistory.slice(-100)));
        } catch {}
      }

      messages.push(processed);
    }

    return messages;
  } catch (err) {
    console.error('Telegram getUpdates error:', err.message);
    return [];
  }
}

/**
 * Check if a message looks like a trading signal
 */
function isTradeSignal(text) {
  const signalPatterns = [
    /\b(BUY|SELL|LONG|SHORT)\b/i,
    /\b(entry|target|stop.?loss|tp|sl)\b/i,
    /\b(NQ|MNQ|NAS100|SOL|XAUUSD|GOLD|OIL|EUR|GBP|USD)\b/i,
    /\b\d+\.\d+\b.*\b(entry|target|sl)\b/i,
  ];
  return signalPatterns.some(p => p.test(text));
}

/**
 * Parse a trading signal from text
 */
function parseSignal(text) {
  const signal = {
    raw: text,
    direction: null,
    instrument: null,
    entry: null,
    targets: [],
    stopLoss: null,
    timestamp: new Date().toISOString(),
  };

  // Direction
  if (/\b(BUY|LONG)\b/i.test(text)) signal.direction = 'LONG';
  else if (/\b(SELL|SHORT)\b/i.test(text)) signal.direction = 'SHORT';

  // Instrument
  const instruments = ['NQ', 'MNQ', 'NAS100', 'SOLUSDT', 'SOL', 'XAUUSD', 'GOLD', 'OIL', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT', 'BTC', 'ETH', 'ETHUSDT'];
  for (const inst of instruments) {
    if (new RegExp(`\\b${inst}\\b`, 'i').test(text)) {
      signal.instrument = inst.toUpperCase();
      break;
    }
  }

  // Entry price
  const entryMatch = text.match(/entry[:\s]*(\d+\.?\d*)/i);
  if (entryMatch) signal.entry = parseFloat(entryMatch[1]);

  // Targets
  const tpMatches = text.matchAll(/(?:tp|target)\s*\d*[:\s]*(\d+\.?\d*)/gi);
  for (const match of tpMatches) {
    signal.targets.push(parseFloat(match[1]));
  }

  // Stop loss
  const slMatch = text.match(/(?:sl|stop.?loss)[:\s]*(\d+\.?\d*)/i);
  if (slMatch) signal.stopLoss = parseFloat(slMatch[1]);

  return signal;
}

/**
 * Get the message queue (for glasses readback)
 */
export function getMessageQueue() {
  return messageQueue.splice(0);
}

/**
 * Add a message to the readback queue
 */
export function queueForReadback(message) {
  messageQueue.push(message);
}

/**
 * Get signal history
 */
export function getSignalHistory(limit = 20) {
  // Load from DB if empty
  if (signalHistory.length === 0) {
    try {
      const saved = getSetting('signal_history', null);
      if (saved) {
        signalHistory.push(...JSON.parse(saved));
      }
    } catch {}
  }
  return signalHistory.slice(-limit);
}

/**
 * Get configured channels (with IDs masked for frontend)
 */
export function getChannels() {
  return Object.entries(channels).map(([key, val]) => ({
    key,
    name: val.name,
    type: val.type,
    configured: !!val.id,
    chatId: val.id ? `...${String(val.id).slice(-4)}` : null,
  }));
}

/**
 * Update a channel's chat ID
 */
export function setChannelId(key, chatId) {
  if (!channels[key]) {
    channels[key] = { name: key, type: 'custom' };
  }
  channels[key].id = chatId;

  // Persist
  try {
    const toSave = {};
    for (const [k, v] of Object.entries(channels)) {
      if (v.id) toSave[k] = { id: v.id };
    }
    setSetting('telegram_channels', JSON.stringify(toSave));
  } catch {}

  return { key, chatId };
}

/**
 * Format a trading signal for forwarding to Kraken Pro bot
 * Kraken Pro Telegram bot expects specific format
 */
export function formatForKraken(signal) {
  if (!signal?.instrument || !signal?.direction) return null;

  // Map instruments to Kraken pairs
  const krakenMap = {
    'SOL': 'SOLUSD',
    'SOLUSDT': 'SOLUSD',
    'BTC': 'XBTUSD',
    'BTCUSDT': 'XBTUSD',
    'ETH': 'ETHUSD',
    'ETHUSDT': 'ETHUSD',
  };

  const pair = krakenMap[signal.instrument];
  if (!pair) return null; // Can't trade this on Kraken

  const side = signal.direction === 'LONG' ? 'buy' : 'sell';

  return {
    pair,
    side,
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    targets: signal.targets,
    text: `/trade ${side} ${pair}${signal.entry ? ` @ ${signal.entry}` : ''}`,
  };
}

/**
 * Forward a signal to Kraken Pro after AI analysis
 */
export async function forwardToKraken(signalText) {
  if (!channels.kraken?.id) {
    throw new Error('Kraken Pro Telegram chat not configured');
  }

  return await sendMessage('kraken', signalText);
}

export default {
  initTelegram,
  sendMessage,
  getUpdates,
  getMessageQueue,
  queueForReadback,
  getSignalHistory,
  getChannels,
  setChannelId,
  formatForKraken,
  forwardToKraken,
};
