// App-wide constants. Replace the example.com URLs before shipping (stores require real, reachable pages).
export const APP = {
  name: 'Pixel Realms',
  shareUrl: 'https://example.com/pixelrealms',
  privacyUrl: 'https://example.com/pixelrealms/privacy',
  termsUrl: 'https://example.com/pixelrealms/terms',
  supportEmail: 'support@example.com',
  scheme: 'pixelrealms',
  // Simulated purchases. MUST be false in any build that reaches real users: the web build then refuses to
  // 'sell' anything, and native builds defer to the store (see mobile/src/purchases.ts).
  testPayments: true,
  policyVersion: 1,         // bump when the privacy policy/terms change materially -> re-prompt consent
  epoch: Date.UTC(2026, 0, 1), // day #1 of the daily challenge
};
