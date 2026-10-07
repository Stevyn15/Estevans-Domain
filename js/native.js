// Bridge between the game (web) and the React Native shell (mobile/). In a plain browser every call
// falls back to a web API, so the same code runs everywhere.
//
// SECURITY: the native side treats every message from here as untrusted input and validates it
// (see mobile/src/bridge.ts). Messages going the other way (native -> web) are also re-validated.

export const isNative = typeof window !== 'undefined' && !!window.ReactNativeWebView;
export const nativeInfo = () => window.__NATIVE__ || {};

const pending = new Map();
let seq = 0;
const listeners = new Set();
export const onNativeEvent = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

window.__fromNative = (msg) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); clearTimeout(p.t); p.resolve(msg); return; }
  listeners.forEach((f) => f(msg));
};

export function toNative(msg) { if (isNative) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }

export function nativeCall(type, payload = {}, timeout = 120000) {
  if (!isNative) return Promise.resolve({ ok: false, error: 'not-native' });
  return new Promise((resolve) => {
    const id = `m${++seq}`;
    const t = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: 'timeout' }); }, timeout);
    pending.set(id, { resolve, t });
    toNative({ type, id, ...payload });
  });
}

export const haptic = (kind = 'light') => { if (isNative) toNative({ type: 'haptic', kind }); else navigator.vibrate?.(kind === 'heavy' ? 30 : 12); };

export async function shareText(text, url) {
  if (isNative) return (await nativeCall('share', { text, url }, 60000)).ok;
  try { if (navigator.share) { await navigator.share({ text, url }); return true; } } catch { return false; }
  try { await navigator.clipboard.writeText(`${text} ${url || ''}`.trim()); return 'copied'; } catch { return false; }
}

export function openLink(url) {
  if (!/^(https:\/\/|mailto:)/.test(url)) return;
  if (isNative) toNative({ type: 'openUrl', url }); else window.open(url, '_blank', 'noopener,noreferrer');
}

const toBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

export async function shareFile(blob, filename, text) {
  if (isNative) return (await nativeCall('shareFile', { filename, mime: blob.type || 'video/mp4', b64: await toBase64(blob), text }, 120000)).ok;
  const file = new File([blob], filename, { type: blob.type });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return true; } } catch { /* fall through to download */ }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'saved';
}
