#!/bin/bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UCC="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$UCC/server/.env"

read_env() {
  local key="$1" value=""
  if [[ -f "$ENV_FILE" ]]; then
    value="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
  fi
  printf '%s' "$value"
}

export LIV8_COMMAND_API_URL="${LIV8_COMMAND_API_URL:-$(read_env LIV8_COMMAND_API_URL)}"
export LIV8_COMMAND_API_URL="${LIV8_COMMAND_API_URL:-https://liv8-command-center-api.onrender.com}"
export LIV8_MAC_BRIDGE_TOKEN="${LIV8_MAC_BRIDGE_TOKEN:-$(read_env LIV8_MAC_BRIDGE_TOKEN)}"
export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-$(read_env OLLAMA_BASE_URL)}"
export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"

if [[ -z "$LIV8_MAC_BRIDGE_TOKEN" ]]; then
  echo "LIV8_MAC_BRIDGE_TOKEN is missing. Add it to $ENV_FILE before starting the Mac AI relay." >&2
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js is required for the LIV8 Mac AI worker." >&2
  exit 1
fi

exec "$NODE_BIN" "$UCC/scripts/mac-ai-worker.mjs"
