#!/bin/bash
# Prepares cloud sessions so tests, lint and the mobile typecheck work immediately.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
cd "$CLAUDE_PROJECT_DIR"

export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1      # cloud image already ships Chromium (PLAYWRIGHT_BROWSERS_PATH)
npm install --no-audit --no-fund
(cd mobile && npm install --no-audit --no-fund && npm run build:game)
git config core.hooksPath .githooks || true
echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1' >> "${CLAUDE_ENV_FILE:-/dev/null}"
