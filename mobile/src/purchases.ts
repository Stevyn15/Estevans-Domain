// In-app purchase seam. Today: a DEV-ONLY simulator. In release builds it REFUSES to grant anything,
// so a build without real store integration can never hand out paid items for free.
//
// To ship: replace `purchaseProduct` with RevenueCat (react-native-purchases):
//   const { customerInfo } = await Purchases.purchaseStoreProduct(product)
// and have YOUR SERVER (or RevenueCat webhooks) be the source of truth for entitlements — then have the game
// fetch entitlements on start instead of trusting this boolean. See docs/SECURITY.md.
import { Alert } from 'react-native';
import { PRODUCT_IDS } from './productIds.generated';

export async function purchaseProduct(productId: string): Promise<{ ok: boolean; receipt?: string }> {
  if (!PRODUCT_IDS.includes(productId)) return { ok: false };
  if (!__DEV__) return { ok: false };     // never simulate in production
  return new Promise((resolve) => {
    Alert.alert('Test purchase (dev build)', `Pretend-buy "${productId}"? No money is charged.`, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve({ ok: false }) },
      { text: 'Buy', onPress: () => resolve({ ok: true, receipt: `dev-${Date.now()}` }) },
    ], { cancelable: true, onDismiss: () => resolve({ ok: false }) });
  });
}
