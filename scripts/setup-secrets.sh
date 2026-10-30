#!/usr/bin/env bash
set -euo pipefail

# Creates <repo>/.secrets and prompts only for secrets referenced by opencode.json
# but not yet present on disk. Secret references use the form:
#   {file:.secrets/<name>}
#
# Usage:
#   ./scripts/setup-secrets.sh           # prompt for missing secrets
#   ./scripts/setup-secrets.sh --check   # report status only, exit 1 if any missing

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$REPO_DIR/opencode.json"
SECRETS_DIR="$REPO_DIR/.secrets"

CHECK_ONLY=0
case "${1:-}" in
    --check) CHECK_ONLY=1 ;;
    "")      ;;
    *)       echo "Usage: $0 [--check]" >&2; exit 2 ;;
esac

if [[ ! -f "$CONFIG" ]]; then
    echo "ERROR: config not found: $CONFIG" >&2
    exit 1
fi

# Discover {file:.secrets/<name>} references. Text-based on purpose: works for
# JSON and JSONC and needs no jq dependency.
WANTED=()
mapfile -t WANTED < <(
    { grep -oE '\{file:\.secrets/[^}]+\}' "$CONFIG" || true; } \
        | sed -e 's|^{file:\.secrets/||' -e 's|}$||' \
        | sort -u
)

if ((${#WANTED[@]} == 0)); then
    echo "No {file:.secrets/...} references found in $CONFIG — nothing to do."
    exit 0
fi

MISSING=()
for NAME in "${WANTED[@]}"; do
    [[ -e "$SECRETS_DIR/$NAME" ]] || MISSING+=("$NAME")
done

if ((CHECK_ONLY)); then
    echo "Secrets referenced by $CONFIG:"
    for NAME in "${WANTED[@]}"; do
        FILE="$SECRETS_DIR/$NAME"
        if [[ ! -e "$FILE" ]]; then
            echo "  MISSING  $NAME"
        elif [[ -s "$FILE" ]] && [[ "$(tail -c 1 "$FILE" | wc -l)" -eq 1 ]]; then
            echo "  WARN     $NAME (trailing newline may break HTTP header auth)"
        else
            echo "  ok       $NAME"
        fi
    done
    ((${#MISSING[@]} == 0)) || exit 1
    exit 0
fi

echo "=== Setting up opencode secrets in $SECRETS_DIR ==="

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
echo "✓ Secrets directory: $SECRETS_DIR (mode 700)"

# .gitignore is a blocklist — make sure .secrets/ can never be staged.
if ! git -C "$REPO_DIR" check-ignore -q ".secrets/" 2>/dev/null; then
    echo "WARNING: .secrets/ is not git-ignored — fix .gitignore before adding values." >&2
fi

if ((${#MISSING[@]} == 0)); then
    echo "✓ All ${#WANTED[@]} referenced secret(s) already exist — nothing to prompt for."
    echo
    echo "=== Secrets setup complete! ==="
    exit 0
fi

for NAME in "${MISSING[@]}"; do
    FILE="$SECRETS_DIR/$NAME"

    if [[ "$NAME" == *.env ]]; then
        echo "ERROR: secret '$NAME' must not end in .env (opencode.json denies reading *.env)." >&2
        exit 1
    fi

    mkdir -p "$(dirname "$FILE")"
    chmod 700 "$(dirname "$FILE")"

    echo
    echo "Enter the value for '$NAME' (referenced by: opencode.json)"
    while true; do
        read -r -s -p "  $NAME: " VALUE
        echo
        if [[ -z "$VALUE" ]]; then
            echo "  ERROR: value must not be empty."
            continue
        fi
        read -r -s -p "  confirm: " VALUE_CONFIRM
        echo
        if [[ "$VALUE" != "$VALUE_CONFIRM" ]]; then
            echo "  ERROR: values do not match, try again."
            continue
        fi
        break
    done

    printf '%s' "$VALUE" > "$FILE"
    chmod 600 "$FILE"
    unset VALUE VALUE_CONFIRM
    echo "✓ $NAME written to $FILE (mode 600)"
done

echo
echo "=== Secrets setup complete! ==="
echo "Apply config/secret changes with:  opencode service restart"
echo "Verify MCP servers with:           opencode mcp list"
