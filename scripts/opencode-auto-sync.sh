#!/usr/bin/env bash

STATE_DIR="$HOME/.local/state/opencode-auto-sync"
mkdir -p "$STATE_DIR"
LAST_RUN_FILE="$STATE_DIR/last_run"
LOG_FILE="$STATE_DIR/sync.log"

# Redirect all stdout and stderr to the log file
exec >> "$LOG_FILE" 2>&1

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Sync check started ==="

NOW=$(date +%s)
INTERVAL=86400 # 24 hours in seconds

if [ -f "$LAST_RUN_FILE" ]; then
    LAST_RUN=$(cat "$LAST_RUN_FILE")
    ELAPSED=$((NOW - LAST_RUN))
    if [ "$ELAPSED" -lt "$INTERVAL" ]; then
        HOURS_LEFT=$(( (INTERVAL - ELAPSED + 3599) / 3600 ))
        echo "Skipped: Less than 24 hours have passed since last run (~${HOURS_LEFT}h remaining)."
        exit 0
    fi
fi

REPO_DIR="/home/raf/.config/opencode"
if [ ! -d "$REPO_DIR" ]; then
    echo "ERROR: Repository directory $REPO_DIR does not exist."
    exit 1
fi

cd "$REPO_DIR" || exit 1

echo "Running git auto-sync..."
git add -A

if ! git diff --cached --quiet; then
    git commit -m "Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Changes committed."
else
    echo "No changes to commit."
fi

if git push; then
    echo "Push successful."
    echo "$NOW" > "$LAST_RUN_FILE"
else
    echo "ERROR: git push failed."
    exit 1
fi

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Sync completed successfully ==="
