#!/bin/bash
#
# LIV8 Command Center — Build the installable Mac app (.app + .dmg)
# =================================================================
# Run this ONCE to produce a real app you can drag into Applications.
# After that you just open it from Launchpad/Applications — no Terminal needed.

set -e
cd "$(dirname "$0")"

echo ""
echo "=================================================="
echo "  Building LIV8 Command Center.app"
echo "=================================================="
echo ""

# --- Node check -----------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed. Get the LTS from https://nodejs.org, then retry."
  read -p "Press Return to close..."
  exit 1
fi
echo "✅ Node.js $(node -v)"

# --- Install deps (first time) -------------------------------------------
if [ ! -d "node_modules" ] || [ ! -d "node_modules/electron" ]; then
  echo "📦 Installing app + build tools (one time, a few minutes)..."
  npm install
fi
if [ ! -d "server/node_modules" ]; then
  echo "📦 Installing backend dependencies (one time)..."
  (cd server && npm install)
fi

# --- Build ----------------------------------------------------------------
echo ""
echo "🔨 Building the app... (this can take a few minutes)"
npm run dist

echo ""
echo "=================================================="
echo "✅ Done!  Your app and installer are in the 'release' folder."
echo ""
echo "   • Drag 'LIV8 Command Center.dmg' open → drag the app into Applications."
echo "   • First open: right-click the app → Open → Open (one time, to pass Gatekeeper)."
echo "=================================================="
echo ""

# Reveal the output in Finder.
open release 2>/dev/null || true
read -p "Press Return to close..."
