import aiService from '../services/aiService';
import { API_URL } from '../config';

const SILENCE_MS = 1800;

function cleanChatText(value) {
  return typeof value === 'string' ? value.replace(/\*\*/g, '') : value;
}

function patchSpeechRecognition() {
  if (typeof window === 'undefined') return;
  const NativeRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!NativeRecognition || NativeRecognition.__liv8Patched) return;

  function SmartRecognition(...args) {
    const native = new NativeRecognition(...args);
    let silenceTimer = null;

    const clearSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = null;
    };

    const proxy = new Proxy(native, {
      get(target, prop) {
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, prop, value) {
        if (prop === 'onresult' && typeof value === 'function') {
          target.onresult = (event) => {
            value(event);
            clearSilenceTimer();
            let heardSpeech = false;
            for (let i = event.resultIndex || 0; i < event.results.length; i++) {
              const transcript = event.results[i]?.[0]?.transcript || '';
              if (transcript.trim()) heardSpeech = true;
            }
            if (heardSpeech) {
              silenceTimer = setTimeout(() => {
                try { target.stop(); } catch { /* recognition may already be stopped */ }
              }, SILENCE_MS);
            }
          };
          return true;
        }
        if (prop === 'onend' && typeof value === 'function') {
          target.onend = (event) => {
            clearSilenceTimer();
            value(event);
          };
          return true;
        }
        target[prop] = value;
        return true;
      },
    });

    return proxy;
  }

  SmartRecognition.prototype = NativeRecognition.prototype;
  SmartRecognition.__liv8Patched = true;
  window.SpeechRecognition = SmartRecognition;
  window.webkitSpeechRecognition = SmartRecognition;
}

async function callOperator(message, context = {}) {
  const response = await fetch(`${API_URL}/api/operator/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: String(message || '').trim(),
      conversationId: aiService.conversationId || null,
      userId: 'sv',
      operatorMode: true,
      highLevelAccount: localStorage.getItem('liv8_highlevel_account') || 'company',
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      context: {
        ...context,
        source: 'command-center-chat-widget',
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail?.error || `Operator HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = cleanChatText(String(data?.response || '').trim());
  if (!text) throw new Error('Operator returned an empty response');

  return {
    response: text,
    speakText: aiService.extractSpeakText?.(text) || text,
    provider: 'operator',
    model: 'liv8-operator',
    operator: true,
    affiliateContext: data?.affiliateContext,
  };
}

function patchAIService() {
  if (!aiService || aiService.__liv8OperatorPatched) return;
  aiService.__liv8OperatorPatched = true;

  const legacyGenerateResponse = aiService.generateResponse.bind(aiService);
  const legacyCommanderChat = aiService.commanderChat.bind(aiService);
  const legacyDailyBrief = aiService.generateDailyBrief.bind(aiService);
  const legacyGetHistory = aiService.getConversationHistory.bind(aiService);
  const legacyAddToHistory = aiService.addToHistory.bind(aiService);

  aiService.addToHistory = (role, content) => legacyAddToHistory(role, cleanChatText(content));
  aiService.getConversationHistory = () => legacyGetHistory().map(item => ({
    ...item,
    content: cleanChatText(item?.content),
  }));
  aiService.generateDailyBrief = () => cleanChatText(legacyDailyBrief());

  aiService.generateResponse = async (message, context = {}) => {
    try {
      const result = await callOperator(message, context);
      aiService.addToHistory('user', String(message || '').trim());
      aiService.addToHistory('assistant', result.response);
      return result;
    } catch (error) {
      console.warn('Operator unavailable; using legacy AI fallback:', error?.message || error);
      const result = await legacyGenerateResponse(message, context);
      return { ...result, response: cleanChatText(result?.response), speakText: cleanChatText(result?.speakText) };
    }
  };

  aiService.commanderChat = async (message) => {
    try {
      const result = await callOperator(message, { mode: 'commander' });
      aiService.addToHistory('user', String(message || '').trim());
      aiService.addToHistory('assistant', result.response);
      return result;
    } catch (error) {
      console.warn('Operator commander unavailable; using legacy commander:', error?.message || error);
      const result = await legacyCommanderChat(message);
      return { ...result, response: cleanChatText(result?.response) };
    }
  };
}

function patchOperatorChatFetch() {
  if (typeof window === 'undefined' || window.__liv8OperatorFetchPatched) return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'POST' && /\/api\/chat(?:\?|$)/.test(url) && init?.body) {
        const body = JSON.parse(init.body);
        if (body?.message) {
          const nextUrl = url.replace('/api/chat', '/api/operator/chat');
          return originalFetch(nextUrl, {
            ...init,
            body: JSON.stringify({
              ...body,
              operatorMode: true,
              highLevelAccount: localStorage.getItem('liv8_highlevel_account') || 'company',
              clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          });
        }
      }
    } catch {
      // Never break normal fetch behavior because of the operator layer.
    }
    return originalFetch(input, init);
  };

  window.__liv8OperatorFetchPatched = true;
}

export function installOperatorRuntime() {
  if (typeof window === 'undefined') return;
  patchSpeechRecognition();
  patchAIService();
  patchOperatorChatFetch();
  window.__liv8OperatorRuntimeReady = true;
}

installOperatorRuntime();
