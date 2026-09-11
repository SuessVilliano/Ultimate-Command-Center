const SILENCE_MS = 1800;

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
  patchOperatorChatFetch();
}

installOperatorRuntime();
