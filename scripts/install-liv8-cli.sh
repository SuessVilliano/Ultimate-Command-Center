#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$HOME/.local/bin"
mkdir -p "$BIN"

for name in liv8-start liv8-status liv8-stop; do
  chmod +x "$ROOT/scripts/$name"
  ln -sf "$ROOT/scripts/$name" "$BIN/$name"
done

ZSHRC="$HOME/.zshrc"
LINE='export PATH="$HOME/.local/bin:$PATH"'
if [[ ! -f "$ZSHRC" ]] || ! grep -Fq '$HOME/.local/bin' "$ZSHRC"; then
  printf '\n# LIV8 CLI\n%s\n' "$LINE" >> "$ZSHRC"
fi

export PATH="$BIN:$PATH"
printf '\n✅ LIV8 CLI installed\n'
printf 'Commands:\n'
printf '  liv8-start          Start/check the whole LIV8 stack\n'
printf '  liv8-start --update Pull the three repos before starting\n'
printf '  liv8-start --no-obs Start without opening OBS Studio\n'
printf '  liv8-status         Show local + public service health\n'
printf '  liv8-stop           Stop Clippedit + Command Center dev services\n'
printf '\nRun this once now:\n  source ~/.zshrc\n  liv8-start\n'
