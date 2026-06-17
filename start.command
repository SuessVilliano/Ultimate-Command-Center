#!/bin/bash
#
# LIV8 Command Center — Local Launcher (macOS)
# ============================================
# Double-click this file to run the entire Command Center on YOUR laptop.
# It starts the backend (AI agents + Freshdesk + tickets) and the frontend,
# then opens the app in your browser. Nothing runs in the cloud.
#
# AI runs locally through Ollama (free, private). Cloud keys are optional fallback.

set -e

# Always run from the folder this script lives in (so double-click works anywhere).
cd "$(dirname "$0")"
ROOT="$(pwd)"

echo ""
echo "=========================================="
echo "  LIV8 Command Center — Local Launch"
echo "=========================================="
echo ""

# ---------------------------------------------------------------------------
# 1. Node.js check
# ---------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed."
  echo "   Install it from https://nodejs.org (choose the LTS version),"
  echo "   then double-click this file again."
  echo ""
  read -p "Press Return to close..."
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ---------------------------------------------------------------------------
# 2. Ollama (local AI) — install hint + auto-start + model check
# ---------------------------------------------------------------------------
if command -v ollama >/dev/null 2>&1; then
  echo "✅ Ollama is installed"

  # Start the Ollama server in the background if it isn't already answering.
  if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "   Starting Ollama server..."
    ollama serve >/tmp/ollama-liv8.log 2>&1 &
    # Wait up to ~15s for it to come online.
    for i in {1..15}; do
      if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then break; fi
      sleep 1
    done
  fi

  # Make sure a default model is available so agents actually answer.
  MODEL="${OLLAMA_MODEL:-llama3.1}"
  if ! ollama list 2>/dev/null | grep -q "$MODEL"; then
    echo "   First-time setup: downloading the '$MODEL' model (a few GB, one time)..."
    ollama pull "$MODEL" || echo "   ⚠️  Could not pull $MODEL — you can do it later with: ollama pull $MODEL"
  else
    echo "✅ Ollama model '$MODEL' ready"
  fi
else
  echo "⚠️  Ollama is not installed (the free local AI engine)."
  echo "   Install it from https://ollama.com/download, then run: ollama pull llama3.1"
  echo "   The app will still run and use your cloud API keys as a fallback."
fi

# ---------------------------------------------------------------------------
# 3. Backend environment file
# ---------------------------------------------------------------------------
if [ ! -f "server/.env" ]; then
  echo ""
  echo "🔧 First run: creating server/.env from the template."
  cp server/.env.example server/.env

  # Default this local install to Ollama-first with cloud fallback.
  /usr/bin/sed -i '' 's|^AI_PROVIDER=.*|AI_PROVIDER=ollama|' server/.env 2>/dev/null || true
  if ! grep -q '^OLLAMA_BASE_URL=' server/.env; then
    printf '\n# Local AI (Ollama) — free, private, on-device\nOLLAMA_BASE_URL=http://localhost:11434\nOLLAMA_MODEL=llama3.1\n' >> server/.env
  fi

  echo ""
  echo "   👉 Opening server/.env so you can paste your FRESHDESK_DOMAIN,"
  echo "      FRESHDESK_API_KEY and FRESHDESK_AGENT_ID (so tickets load)."
  echo "      Save and close the editor, then come back here."
  open -W -e server/.env || open server/.env
  echo ""
  read -p "Press Return once you've saved your Freshdesk details (or to skip for now)..."
fi

# ---------------------------------------------------------------------------
# 4. Install dependencies (only when missing)
# ---------------------------------------------------------------------------
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 Installing frontend dependencies (one time, ~1-2 min)..."
  npm install
fi
if [ ! -d "server/node_modules" ]; then
  echo ""
  echo "📦 Installing backend dependencies (one time, ~1-2 min)..."
  (cd server && npm install)
fi

# ---------------------------------------------------------------------------
# 5. Launch — backend + frontend together
# ---------------------------------------------------------------------------
echo ""
echo "🚀 Starting LIV8 Command Center..."
echo "   Backend:  http://localhost:3005"
echo "   App:      http://localhost:3000  (opening automatically)"
echo ""
echo "   Leave this window open while you work. Close it to stop the app."
echo "=========================================="
echo ""

# Open the app once the frontend is up (Vite also auto-opens; this is a safety net).
( for i in {1..30}; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then open http://localhost:3000; break; fi
    sleep 1
  done ) &

# Runs `vite` + `node server/server.js` concurrently (defined in package.json).
npm run start:all
