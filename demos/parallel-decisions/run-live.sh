#!/usr/bin/env bash
# Starts the bookmark-demos Worker with PARALLEL_API_KEY taken from the
# environment. The value is written to a temporary .dev.vars for Wrangler
# and is never printed. Without the variable, the demo serves the missing-key
# state and does not call Parallel.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT="${PORT:-8787}"
DEV_VARS="$ROOT/.dev.vars"
BACKUP=""
WROTE=0

cleanup() {
  if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then
    mv "$BACKUP" "$DEV_VARS"
  elif [[ "$WROTE" == "1" ]]; then
    rm -f "$DEV_VARS"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -f "$DEV_VARS" ]]; then
  BACKUP="$(mktemp)"
  cp "$DEV_VARS" "$BACKUP"
fi

umask 077
if [[ -n "${PARALLEL_API_KEY:-}" ]]; then
  printf 'PARALLEL_API_KEY=%s\n' "$PARALLEL_API_KEY" > "$DEV_VARS"
  WROTE=1
  echo "PARALLEL_API_KEY is set. The value is not printed."
else
  # Keep any other local bindings, but do not leave a key in place.
  if [[ -n "$BACKUP" ]]; then
    grep -v '^PARALLEL_API_KEY=' "$BACKUP" > "$DEV_VARS" || true
    WROTE=1
  fi
  echo "PARALLEL_API_KEY is not set. The UI will say the key is missing and will not invent a decision."
fi

echo "Open http://127.0.0.1:${PORT}/demos/parallel-decisions/"
# Stay in this shell so the EXIT trap restores or deletes .dev.vars.
# `exec` would replace Bash and skip that cleanup when Wrangler exits.
npx wrangler dev --port "$PORT" --ip 0.0.0.0 --show-interactive-dev-session=false
status=$?
exit "$status"
