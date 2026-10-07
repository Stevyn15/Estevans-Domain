// Validation of messages coming FROM the WebView. The web content is our own code, but treat it as
// untrusted anyway: a bug, an injected script or a tampered bundle must not be able to do more than the
// allowlisted actions below (no arbitrary URLs, no huge payloads, no unknown products).
import { PRODUCT_IDS } from './productIds.generated';

export type BridgeMessage =
  | { type: 'haptic'; kind: 'light' | 'heavy' | 'success' }
  | { type: 'share'; id?: string; text: string; url?: string }
  | { type: 'shareFile'; id?: string; filename: string; mime: string; b64: string; text?: string }
  | { type: 'openUrl'; url: string }
  | { type: 'purchase'; id?: string; productId: string }
  | { type: 'consent'; consent: { version: number; ts: number; analytics: boolean } }
  | { type: 'wipe' };

const MAX_SMALL = 16 * 1024;              // 16 KB for ordinary messages
const MAX_FILE_B64 = 24 * 1024 * 1024;    // ~18 MB clip
const ALLOWED_MIME = /^(video\/(mp4|webm)|application\/json)$/;
const SAFE_FILENAME = /^[\w.-]{1,64}$/;
const SAFE_URL = /^(https:\/\/[^\s]{1,300}|mailto:[^\s]{1,200})$/;
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const optStr = (v: unknown, max: number) => v === undefined || isStr(v, max);
const optId = (v: unknown) => v === undefined || (typeof v === 'string' && /^m\d{1,9}$/.test(v));

export function parseMessage(raw: unknown): BridgeMessage | null {
  if (typeof raw !== 'string') return null;
  let m: any;
  try {
    if (raw.length > MAX_FILE_B64 + MAX_SMALL) return null;
    m = JSON.parse(raw);
  } catch { return null; }
  if (!m || typeof m !== 'object' || typeof m.type !== 'string') return null;
  if (m.type !== 'shareFile' && raw.length > MAX_SMALL) return null;
  if (!optId(m.id)) return null;

  switch (m.type) {
    case 'haptic': return ['light', 'heavy', 'success'].includes(m.kind) ? { type: 'haptic', kind: m.kind } : null;
    case 'share': return isStr(m.text, 500) && optStr(m.url, 300) && (!m.url || SAFE_URL.test(m.url)) ? { type: 'share', id: m.id, text: m.text, url: m.url } : null;
    case 'shareFile':
      return isStr(m.filename, 64) && SAFE_FILENAME.test(m.filename) && isStr(m.mime, 40) && ALLOWED_MIME.test(m.mime)
        && isStr(m.b64, MAX_FILE_B64) && /^[A-Za-z0-9+/=]+$/.test(m.b64) && optStr(m.text, 200)
        ? { type: 'shareFile', id: m.id, filename: m.filename, mime: m.mime, b64: m.b64, text: m.text } : null;
    case 'openUrl': return isStr(m.url, 300) && SAFE_URL.test(m.url) ? { type: 'openUrl', url: m.url } : null;
    case 'purchase': return isStr(m.productId, 64) && PRODUCT_IDS.includes(m.productId) ? { type: 'purchase', id: m.id, productId: m.productId } : null;
    case 'consent': {
      const c = m.consent;
      return c && Number.isInteger(c.version) && Number.isFinite(c.ts) && typeof c.analytics === 'boolean'
        ? { type: 'consent', consent: { version: c.version, ts: c.ts, analytics: c.analytics } } : null;
    }
    case 'wipe': return { type: 'wipe' };
    default: return null;
  }
}

/** Only these URLs may be navigated to inside the WebView (the bundled page itself). Everything else opens outside or is blocked. */
export const isInternalNavigation = (url: string) => url === 'about:blank' || url.startsWith('https://game.pixelrealms.invalid');
