#!/bin/bash
#
# LIV8 Command Center — Native macOS App Launcher
# ===============================================
# Double-click to open the Command Center as a real desktop app window.
# It runs the AI agents, Freshdesk tickets, and everything else on YOUR laptop.
# Nothing runs in the cloud. AI is local via Ollama (cloud keys optional fallback).

set -e
cd "$(dirname "$0")"

echo ""
echo "=================================================="
echo "  LIV8 Command Center — starting the desktop app"
echo "=================================================="
echo ""

# --- 1. Node.js -----------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed."
  echo "   Install the LTS version from https://nodejs.org, then try again."
  echo ""
  read -p "Press Return to close..."
  exit 1
fi
echo "✅ Node.js $(node -v)"

# --- 2. Ollama (free local AI) -------------------------------------------
if command -v ollama >/dev/null 2>&1; then
  echo "✅ Ollama installed"
  if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "   Starting Ollama..."
    ollama serve >/tmp/ollama-liv8.log 2>&1 &
    for i in {1..15}; do
      curl -s http://localhost:11434/api/tags >/dev/null 2>&1 && break
      sleep 1
    done
  fi
  MODEL="${OLLAMA_MODEL:-llama3.1}"
  if ! ollama list 2>/dev/null | grep -q "$MODEL"; then
    echo "   First-time: downloading the '$MODEL' model (a few GB, one time)..."
    ollama pull "$MODEL" || echo "   ⚠️  Could not pull $MODEL — run later: ollama pull $MODEL"
  else
    echo "✅ Ollama model '$MODEL' ready"
  fi
else
  echo "⚠️  Ollama not installed. Install from https://ollama.com/download for free local AI."
  echo "   (The app still runs and will use any cloud API keys you add.)"
fi

# --- 3. Backend settings (.env) ------------------------------------------
if [ ! -f "server/.env" ]; then
  echo ""
  echo "🔧 First run: creating server/.env"
  cp server/.env.example server/.env
  /usr/bin/sed -i '' 's|^AI_PROVIDER=.*|AI_PROVIDER=ollama|' server/.env 2>/dev/null || true
  if ! grep -q '^OLLAMA_BASE_URL=' server/.env; then
    printf '\nOLLAMA_BASE_URL=http://localhost:11434\nOLLAMA_MODEL=llama3.1\n' >> server/.env
  fi
  echo "   👉 Opening server/.env — paste your FRESHDESK_DOMAIN, FRESHDESK_API_KEY"
  echo "      and FRESHDESK_AGENT_ID so your tickets load. Save and close it."
  open -W -e server/.env || open server/.env
  read -p "Press Return once you've saved your Freshdesk details (or to skip)..."
fi

# --- 4. Dependencies (first run only) ------------------------------------
if [ ! -d "node_modules" ] || [ ! -d "node_modules/electron" ]; then
  echo ""
  echo "📦 Installing app dependencies (one time, includes Electron ~150MB)..."
  npm install
fi
if [ ! -d "server/node_modules" ]; then
  echo ""
  echo "📦 Installing backend dependencies (one time)..."
  (cd server && npm install)
fi

# --- 5. Build the UI, then open the native window ------------------------
echo ""
echo "🔨 Building the latest UI..."
npm run build

echo ""
echo "🚀 Opening LIV8 Command Center..."
echo "   Keep this window open while you work — closing the app closes the engine."
echo "=================================================="
echo ""

npm run app
