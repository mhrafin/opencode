# OpenCode Configuration & Auto-Sync System

This repository contains personal configuration files, commands, agents, and plugins for OpenCode, along with an automated Git synchronization system using Systemd.

## Features

- **Automated Git Sync**: Automatically stages, commits, and pushes configuration updates to the remote repository.
- **24-Hour Rate Limiting**: Ensures synchronization runs at most once every 24 hours, preventing redundant commits and API calls.
- **Systemd User Timer**: Runs reliably in user-space without requiring `root`/`sudo` or external cron daemons.
- **Clean Repository**: Runtime logs and state timestamps are kept strictly outside the repository in `~/.local/state/opencode-auto-sync/` to avoid cluttering git history.

---

## Auto-Sync System Setup

### Prerequisites
- Linux with `systemd` (user sessions enabled)
- `git` configured with your user name and email in this repository
- SSH authentication configured for pushing to your remote repository (`origin`)

### Installation
Run the setup script once from the repository root:
```bash
./scripts/setup.sh
```

This script will:
1. Verify git and remote connectivity.
2. Generate and install the user-level systemd service (`opencode-auto-sync.service`) and timer (`opencode-auto-sync.timer`).
3. Enable and start the timer (set to check every 2 hours; the worker script strictly enforces the 24-hour interval between actual syncs).

---

## Monitoring & Management

### Check Timer Status
To see when the next sync is scheduled or check systemd timer status:
```bash
systemctl --user status opencode-auto-sync.timer
```

### View Execution Logs
All output and sync history are logged outside the repo:
```bash
cat ~/.local/state/opencode-auto-sync/sync.log
```
You can also view logs via systemd journaling:
```bash
journalctl --user -u opencode-auto-sync.service
```

### Manual Trigger
To run a manual sync check immediately:
```bash
./scripts/opencode-auto-sync.sh
```

### Disabling / Removing the Sync
To stop and disable the auto-sync timer:
```bash
systemctl --user disable --now opencode-auto-sync.timer
```
To remove the systemd unit files:
```bash
rm ~/.config/systemd/user/opencode-auto-sync.*
systemctl --user daemon-reload
```
