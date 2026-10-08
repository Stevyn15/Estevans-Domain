// One-command setup for a fresh clone:  npm run setup
import { spawnSync } from 'node:child_process';

const run = (cmd, args, cwd = '.') => { console.log(`\n$ ${cmd} ${args.join(' ')}${cwd !== '.' ? `   (in ${cwd})` : ''}`); const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } }); if (r.status !== 0) { console.error(`\n✖ failed: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1); } };

const major = Number(process.versions.node.split('.')[0]);
if (major < 20) { console.error(`✖ Node 20+ required (you have ${process.versions.node}). Install from https://nodejs.org`); process.exit(1); }

run('npm', ['install']);
run('npm', ['install'], 'mobile');
run('npm', ['run', 'build:game'], 'mobile');
spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });   // pre-commit checks
if (!process.env.CLAUDE_CODE_REMOTE) run('npx', ['playwright', 'install', 'chromium']);

console.log(`
✔ Setup complete.

  npm start            play the web version   → http://localhost:8080
  cd mobile && npm start   run the phone app (scan the QR with the Expo Go app)
  npm run verify       lint + unit tests + browser end-to-end tests + mobile typecheck
  npm run store:assets generate store screenshots + IAP/listing files in store/
  npm run release:check  pre-launch gate (fails until placeholders are replaced)
`);
