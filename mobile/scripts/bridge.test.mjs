// Tests for the native bridge validator. Run: npm test   (compiles bridge.ts on the fly with esbuild)
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import './build-game.mjs';

const dir = mkdtempSync(join(tmpdir(), 'bridge-'));
const r = await build({ entryPoints: [new URL('../src/bridge.ts', import.meta.url).pathname], bundle: true, format: 'esm', write: false });
writeFileSync(join(dir, 'bridge.mjs'), r.outputFiles[0].text);
const { parseMessage, isInternalNavigation } = await import(pathToFileURL(join(dir, 'bridge.mjs')).href);
const J = JSON.stringify; let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok  ', name); };

t('accepts well-formed messages', () => {
  assert.equal(parseMessage(J({ type: 'haptic', kind: 'light' })).type, 'haptic');
  assert.equal(parseMessage(J({ type: 'purchase', id: 'm1', productId: 'bp_premium' })).productId, 'bp_premium');
  assert.equal(parseMessage(J({ type: 'share', text: 'hi', url: 'https://example.com/x?y=1' })).type, 'share');
  assert.equal(parseMessage(J({ type: 'shareFile', filename: 'clip.mp4', mime: 'video/mp4', b64: 'AAAA' })).type, 'shareFile');
  assert.equal(parseMessage(J({ type: 'wipe' })).type, 'wipe');
});
t('rejects unknown products, types and non-strings', () => {
  assert.equal(parseMessage(J({ type: 'purchase', productId: 'free_everything' })), null);
  assert.equal(parseMessage(J({ type: 'exec', cmd: 'rm -rf' })), null);
  assert.equal(parseMessage({ type: 'wipe' }), null); assert.equal(parseMessage('not json'), null); assert.equal(parseMessage(J([1, 2])), null);
});
t('rejects dangerous URLs', () => {
  for (const url of ['javascript:alert(1)', 'http://insecure.example', 'file:///etc/passwd', 'intent://x', 'https://a b.com', 'tel:123']) assert.equal(parseMessage(J({ type: 'openUrl', url })), null, url);
  assert.equal(parseMessage(J({ type: 'openUrl', url: 'mailto:support@example.com' })).type, 'openUrl');
});
t('rejects bad files (path traversal, mime, base64, size)', () => {
  const ok = { type: 'shareFile', filename: 'clip.mp4', mime: 'video/mp4', b64: 'AAAA' };
  for (const bad of [{ filename: '../../etc/passwd' }, { filename: 'a/b.mp4' }, { mime: 'application/x-sh' }, { b64: 'not base64!!' }, { mime: 'text/html' }]) assert.equal(parseMessage(J({ ...ok, ...bad })), null, J(bad));
  assert.equal(parseMessage(J({ ...ok, b64: 'A'.repeat(25 * 1024 * 1024) })), null);
});
t('rejects oversized ordinary messages and bad ids', () => {
  assert.equal(parseMessage(J({ type: 'share', text: 'x'.repeat(600) })), null);
  assert.equal(parseMessage(J({ type: 'haptic', kind: 'light', id: '"; drop' })), null);
});
t('navigation allowlist', () => {
  assert.equal(isInternalNavigation('https://game.pixelrealms.invalid/'), true);
  assert.equal(isInternalNavigation('https://evil.example/'), false);
});
console.log(`\n${n} passed`);
