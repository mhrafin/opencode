#!/usr/bin/env bash
set -e

REPO_DIR="/home/raf/.config/opencode"

echo "=== Setting up opencode-auto-sync ==="

# 1. Check if git is installed
if ! command -v git &> /dev/null; then
    echo "ERROR: git is not installed."
    exit 1
fi

# 2. Check if repo directory exists and is a git repo
if [ ! -d "$REPO_DIR/.git" ]; then
    echo "ERROR: $REPO_DIR is not a git repository."
    exit 1
fi

cd "$REPO_DIR"

# 3. Check git user config
GIT_NAME=$(git config user.name || true)
GIT_EMAIL=$(git config user.email || true)

if [ -z "$GIT_NAME" ] || [ -z "$GIT_EMAIL" ]; then
    echo "ERROR: Git user.name or user.email is not set in this repository."
    echo "Please configure them using:"
    echo "  git config user.name 'Your Name'"
    echo "  git config user.email 'your@email.com'"
    exit 1
fi

echo "✓ Git user: $GIT_NAME <$GIT_EMAIL>"

# 4. Check remote and SSH connectivity / push capability
REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
if [ -z "$REMOTE_URL" ]; then
    echo "ERROR: No 'origin' remote configured for this repository."
    exit 1
fi

echo "✓ Remote URL: $REMOTE_URL"
echo "Testing connection to remote repository..."
if ! git ls-remote --exit-code origin &> /dev/null; then
    echo "WARNING: Could not verify remote repository via 'git ls-remote'."
    echo "Please ensure your SSH keys or authentication tokens are correctly configured."
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ Remote connection successful."
fi

# 5. Create systemd user service and timer files
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"

SERVICE_FILE="$SYSTEMD_USER_DIR/opencode-auto-sync.service"
TIMER_FILE="$SYSTEMD_USER_DIR/opencode-auto-sync.timer"
WORKER_SCRIPT="$REPO_DIR/scripts/opencode-auto-sync.sh"

chmod +x "$WORKER_SCRIPT"

echo "Creating systemd service: $SERVICE_FILE"
cat << EOF > "$SERVICE_FILE"
[Unit]
Description=OpenCode Auto Git Sync Service
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash "$WORKER_SCRIPT"
EOF

echo "Creating systemd timer: $TIMER_FILE"
cat << EOF > "$TIMER_FILE"
[Unit]
Description=Run OpenCode Auto Git Sync every 2 hours (enforces 24h interval in script)

[Timer]
OnBootSec=5min
OnUnitActiveSec=2h

[Install]
WantedBy=timers.target
EOF

# 6. Reload and enable systemd user timer
echo "Reloading systemd user daemon..."
systemctl --user daemon-reload

echo "Enabling and starting opencode-auto-sync.timer..."
systemctl --user enable --now opencode-auto-sync.timer

echo "=== Setup complete! ==="
echo "You can check status with: systemctl --user status opencode-auto-sync.timer"
echo "You can view logs at: ~/.local/state/opencode-auto-sync/sync.log"
