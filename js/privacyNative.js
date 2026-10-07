// tiny indirection so privacy.js doesn't depend on the whole native bridge at import time
import { toNative } from './native.js';
export const toToNativeSafe = (type, payload) => { try { toNative({ type, ...payload }); } catch { /* ignore */ } };
