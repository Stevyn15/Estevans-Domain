import { useCallback, useEffect, useRef } from 'react';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as ScreenOrientation from 'expo-screen-orientation';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import { File, Paths } from 'expo-file-system';
import { GAME_HTML } from './src/gameHtml.generated';
import { BridgeMessage, isInternalNavigation, parseMessage } from './src/bridge';
import { purchaseProduct } from './src/purchases';
import { saveConsent, wipeSecure } from './src/secure';

// The page is loaded from memory with a fake https origin so localStorage persists and CSP/CORS behave.
const SOURCE = { html: GAME_HTML, baseUrl: 'https://game.pixelrealms.invalid/' };
const NATIVE_INFO = `window.__NATIVE__ = ${JSON.stringify({ platform: Platform.OS, testPayments: __DEV__ })}; true;`;

export default function App() {
  const web = useRef<WebView>(null);

  const send = useCallback((msg: object) => {
    web.current?.injectJavaScript(`window.__fromNative && window.__fromNative(${JSON.stringify(msg)}); true;`);
  }, []);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    activateKeepAwakeAsync().catch(() => {});
    // Deep links (pixelrealms://daily, pixelrealms://seed/abc, https invite links) -> forwarded to the game, which re-validates them.
    Linking.getInitialURL().then((u) => u && setTimeout(() => send({ type: 'deeplink', url: u }), 1500));
    const sub = Linking.addEventListener('url', ({ url }) => send({ type: 'deeplink', url }));
    return () => sub.remove();
  }, [send]);

  const onMessage = useCallback(async (e: WebViewMessageEvent) => {
    const m: BridgeMessage | null = parseMessage(e.nativeEvent.data);
    if (!m) return;                                   // silently drop anything malformed / unknown
    const reply = (extra: object) => 'id' in m && m.id && send({ id: m.id, ...extra });
    try {
      switch (m.type) {
        case 'haptic':
          if (m.kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          else await Haptics.impactAsync(m.kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'share': {
          const r = await Share.share({ message: m.url ? `${m.text} ${m.url}` : m.text });
          reply({ ok: r.action !== Share.dismissedAction });
          break;
        }
        case 'shareFile': {
          const f = new File(Paths.cache, m.filename);
          if (f.exists) f.delete();
          f.create();
          f.write(Uint8Array.from(atob(m.b64), (c) => c.charCodeAt(0)));
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: m.mime, dialogTitle: m.text });
          f.delete();                                // don't leave user clips lying around in the cache
          reply({ ok: true });
          break;
        }
        case 'openUrl': await Linking.openURL(m.url); break;
        case 'purchase': { const r = await purchaseProduct(m.productId); reply({ ok: r.ok, receipt: r.receipt }); break; }
        case 'consent': await saveConsent(m.consent); break;
        case 'wipe': await wipeSecure(); break;
      }
    } catch {
      reply({ ok: false });
    }
  }, [send]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <WebView
        ref={web}
        source={SOURCE}
        style={styles.web}
        originWhitelist={['https://game.pixelrealms.invalid', 'about:blank']}
        onShouldStartLoadWithRequest={(req) => isInternalNavigation(req.url)}   // block navigation away from the game
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={NATIVE_INFO}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        geolocationEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        bounces={false}
        overScrollMode="never"
        scrollEnabled={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        allowsLinkPreview={false}
        cacheEnabled={false}
        incognito={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#0b1020' }, web: { flex: 1, backgroundColor: '#0b1020' } });
