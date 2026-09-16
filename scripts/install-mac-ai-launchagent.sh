#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UCC="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER="$UCC/scripts/run-mac-ai-worker.sh"
LABEL="com.liv8.commandcenter.mac-ai"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/.liv8/logs"
UID_NUM="$(id -u)"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
chmod +x "$RUNNER" 2>/dev/null || true

if ! "$RUNNER" --check >/dev/null 2>&1; then
  if ! grep -q '^LIV8_MAC_BRIDGE_TOKEN=' "$UCC/server/.env" 2>/dev/null; then
    echo "⚠️  LIV8_MAC_BRIDGE_TOKEN is not present in $UCC/server/.env"
    echo "The LaunchAgent can be installed now, but the worker cannot connect until that token exists."
  fi
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$RUNNER</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/mac-ai-worker.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/mac-ai-worker-error.log</string>
</dict>
</plist>
EOF

chmod 600 "$PLIST"
launchctl bootout "gui/$UID_NUM/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID_NUM" "$PLIST"
launchctl kickstart -k "gui/$UID_NUM/$LABEL" >/dev/null 2>&1 || true

echo "✅ LIV8 Mac AI LaunchAgent installed"
echo "   $PLIST"
echo "   Logs: $LOG_DIR/mac-ai-worker.log"
