#!/bin/bash
# Coverage gate: blocks git push if Jest coverage is below 80%.
# Fires via beforeShellExecution hook when 'git push' is detected.

input=$(cat)
command=$(echo "$input" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).command || ''); } catch { console.log(''); }
  });
" 2>/dev/null || echo "")

if echo "$command" | grep -q "git push"; then
  REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)"
  HW6_DIR="$REPO_ROOT/homework-6"

  if [ ! -d "$HW6_DIR" ]; then
    printf '{"permission":"allow"}'
    exit 0
  fi

  cd "$HW6_DIR" || exit 1

  if ! command -v node &>/dev/null; then
    printf '{"permission":"allow"}'
    exit 0
  fi

  echo "[coverage-gate] Running test coverage check..." >&2
  if npm test -- --silent 2>&1 | tail -5 >&2; then
    printf '{"permission":"allow"}'
    exit 0
  else
    printf '{"permission":"deny","user_message":"Push blocked: test coverage is below 80%%. Run npm test to see details.","agent_message":"Coverage gate failed. Fix coverage before pushing."}'
    exit 0
  fi
fi

printf '{"permission":"allow"}'
exit 0
