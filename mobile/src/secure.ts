// OS-level secure storage (iOS Keychain / Android Keystore). Use it for anything sensitive: auth tokens,
// the consent record, future account IDs. Game progress stays in the WebView's storage.
import * as SecureStore from 'expo-secure-store';

const CONSENT_KEY = 'pr.consent.v1';
const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };   // not synced to iCloud / other devices

export const saveConsent = (c: object) => SecureStore.setItemAsync(CONSENT_KEY, JSON.stringify(c), opts);
export const getConsent = async () => { const v = await SecureStore.getItemAsync(CONSENT_KEY, opts); return v ? JSON.parse(v) : null; };
export const wipeSecure = () => SecureStore.deleteItemAsync(CONSENT_KEY, opts);
