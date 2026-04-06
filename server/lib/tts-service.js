/**
 * LIV8 Command Center - Unified TTS Service
 * Priority: OpenAI TTS (best quality) → Kokoro (free/open-source) → Edge TTS (legacy fallback)
 */

import OpenAI from 'openai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

let openaiClient = null;
let kokoroInstance = null;
let kokoroLoading = false;
let kokoroFailed = false;

// Voice mapping: friendly name → provider-specific voice ID
const VOICE_MAP = {
  // OpenAI voices (natural, expressive)
  'alloy': { openai: 'alloy', kokoro: 'af_heart', edge: 'en-US-AvaMultilingualNeural' },
  'ash': { openai: 'ash', kokoro: 'af_heart', edge: 'en-US-AndrewMultilingualNeural' },
  'coral': { openai: 'coral', kokoro: 'af_heart', edge: 'en-US-EmmaMultilingualNeural' },
  'nova': { openai: 'nova', kokoro: 'af_nova', edge: 'en-US-JennyNeural' },
  'sage': { openai: 'sage', kokoro: 'af_heart', edge: 'en-US-AriaNeural' },
  'shimmer': { openai: 'shimmer', kokoro: 'af_heart', edge: 'en-US-AvaMultilingualNeural' },
  // Juno's default voice
  'juno': { openai: 'nova', kokoro: 'af_nova', edge: 'en-US-AvaMultilingualNeural' },
};

// Edge TTS voice IDs pass through directly
function isEdgeVoice(voice) {
  return voice && (voice.includes('Neural') || voice.includes('Multilingual'));
}

/**
 * Initialize TTS providers
 */
export function initTTS() {
  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    openaiClient = new OpenAI({ apiKey: openaiKey });
    console.log('TTS: OpenAI provider ready');
  }

  // Kokoro loads lazily on first use (heavy model)
  console.log('TTS: Kokoro will load on first use');
  console.log('TTS: Edge TTS available as fallback');

  return {
    openai: !!openaiClient,
    kokoro: 'lazy',
    edge: true
  };
}

/**
 * Load Kokoro model (lazy, one-time)
 */
async function loadKokoro() {
  if (kokoroInstance) return kokoroInstance;
  if (kokoroFailed) return null;
  if (kokoroLoading) {
    // Wait for existing load
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (kokoroInstance || kokoroFailed) break;
    }
    return kokoroInstance;
  }

  kokoroLoading = true;
  try {
    const { KokoroTTS } = await import('kokoro-js');
    kokoroInstance = await KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      { dtype: 'q8' }
    );
    console.log('TTS: Kokoro model loaded successfully');
    return kokoroInstance;
  } catch (e) {
    console.error('TTS: Kokoro failed to load:', e.message);
    kokoroFailed = true;
    return null;
  } finally {
    kokoroLoading = false;
  }
}

/**
 * Generate TTS audio — tries OpenAI first, then Kokoro, then Edge TTS
 * @param {string} text - Text to speak
 * @param {Object} options - { voice, provider }
 * @returns {Promise<{ audio: Buffer, provider: string, format: string }>}
 */
export async function generateSpeech(text, options = {}) {
  const { voice, provider: preferredProvider } = options;

  // Determine voice mapping
  const voiceKey = voice?.toLowerCase();
  const mapping = VOICE_MAP[voiceKey] || null;

  // If user explicitly passed an Edge voice ID, skip to edge
  const forceEdge = isEdgeVoice(voice);

  // Try OpenAI first (best quality)
  if (!forceEdge && openaiClient && preferredProvider !== 'kokoro' && preferredProvider !== 'edge') {
    try {
      const openaiVoice = mapping?.openai || 'nova';
      const response = await openaiClient.audio.speech.create({
        model: 'tts-1',
        voice: openaiVoice,
        input: text,
        response_format: 'mp3',
        speed: 1.0
      });

      const arrayBuffer = await response.arrayBuffer();
      const audio = Buffer.from(arrayBuffer);

      if (audio.length > 0) {
        return { audio, provider: 'openai', format: 'audio/mp3', voice: openaiVoice };
      }
    } catch (e) {
      console.warn('TTS OpenAI failed, trying Kokoro:', e.message);
    }
  }

  // Try Kokoro (free, open-source)
  if (!forceEdge && preferredProvider !== 'edge') {
    try {
      const kokoro = await loadKokoro();
      if (kokoro) {
        const kokoroVoice = mapping?.kokoro || 'af_nova';
        const result = await kokoro.generate(text, { voice: kokoroVoice });

        // Convert Float32Array PCM to WAV buffer
        const wavBuffer = float32ToWav(result.audio, result.sampling_rate || 24000);

        if (wavBuffer.length > 0) {
          return { audio: wavBuffer, provider: 'kokoro', format: 'audio/wav', voice: kokoroVoice };
        }
      }
    } catch (e) {
      console.warn('TTS Kokoro failed, falling back to Edge:', e.message);
    }
  }

  // Fallback: Edge TTS
  try {
    const edgeVoice = forceEdge ? voice : (mapping?.edge || 'en-US-AvaMultilingualNeural');
    const tts = new MsEdgeTTS();
    await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const readable = tts.toStream(text);
    const chunks = [];

    await new Promise((resolve, reject) => {
      readable.on('data', (chunk) => {
        if (chunk.audio) chunks.push(chunk.audio);
        else if (Buffer.isBuffer(chunk)) chunks.push(chunk);
      });
      readable.on('end', resolve);
      readable.on('error', reject);
    });

    const audio = Buffer.concat(chunks);
    return { audio, provider: 'edge', format: 'audio/mp3', voice: edgeVoice };
  } catch (e) {
    console.error('TTS all providers failed:', e.message);
    throw new Error('All TTS providers failed');
  }
}

/**
 * Generate speech and return as base64 (for JSON responses)
 */
export async function generateSpeechBase64(text, options = {}) {
  const result = await generateSpeech(text, options);
  return {
    audio: result.audio.toString('base64'),
    provider: result.provider,
    format: result.format,
    voice: result.voice
  };
}

/**
 * Get available voices across all providers
 */
export async function getAvailableVoices() {
  const voices = [];

  // OpenAI voices
  if (openaiClient) {
    const openaiVoices = ['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];
    voices.push(...openaiVoices.map(v => ({
      id: v,
      name: `${v.charAt(0).toUpperCase() + v.slice(1)} (OpenAI)`,
      provider: 'openai',
      quality: 'premium',
      gender: ['nova', 'shimmer', 'coral', 'sage'].includes(v) ? 'Female' : 'Male'
    })));
  }

  // Kokoro voices
  voices.push(
    { id: 'kokoro_af_nova', name: 'Nova (Kokoro)', provider: 'kokoro', quality: 'high', gender: 'Female' },
    { id: 'kokoro_af_heart', name: 'Heart (Kokoro)', provider: 'kokoro', quality: 'high', gender: 'Female' },
    { id: 'kokoro_am_adam', name: 'Adam (Kokoro)', provider: 'kokoro', quality: 'high', gender: 'Male' },
  );

  // Edge TTS voices
  try {
    const tts = new MsEdgeTTS();
    const edgeVoices = await tts.getVoices();
    const english = edgeVoices
      .filter(v => v.Locale.startsWith('en-'))
      .filter(v => v.ShortName.includes('Neural') || v.ShortName.includes('Multilingual'));

    voices.push(...english.map(v => ({
      id: v.ShortName,
      name: `${v.FriendlyName || v.ShortName} (Edge)`,
      provider: 'edge',
      quality: 'standard',
      gender: v.Gender,
      locale: v.Locale
    })));
  } catch (e) {
    // Edge voices unavailable
  }

  return voices;
}

/**
 * Convert Float32Array audio to WAV buffer
 */
function float32ToWav(float32Array, sampleRate = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = float32Array.length * bytesPerSample;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Convert float32 to int16
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    const int16 = sample < 0 ? sample * 32768 : sample * 32767;
    buffer.writeInt16LE(Math.round(int16), headerSize + i * 2);
  }

  return buffer;
}

/**
 * Get current TTS status
 */
export function getTTSStatus() {
  return {
    openai: !!openaiClient,
    kokoro: kokoroInstance ? 'loaded' : kokoroFailed ? 'failed' : 'not_loaded',
    edge: true,
    primary: openaiClient ? 'openai' : 'kokoro'
  };
}

export default {
  initTTS,
  generateSpeech,
  generateSpeechBase64,
  getAvailableVoices,
  getTTSStatus
};
