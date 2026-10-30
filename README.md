# OpenCode Configuration & Auto-Sync System

This repository contains personal configuration files, commands, agents, and plugins for OpenCode, along with an automated Git synchronization system using Systemd.

## Features

- **Automated Git Sync**: Automatically stages, commits, and pushes configuration updates to the remote repository.
- **24-Hour Rate Limiting**: Ensures synchronization runs at most once every 24 hours, preventing redundant commits and API calls.
- **Systemd User Timer**: Runs reliably in user-space without requiring `root`/`sudo` or external cron daemons.
- **Clean Repository**: Runtime logs and state timestamps are kept strictly outside the repository in `~/.local/state/opencode-auto-sync/` to avoid cluttering git history.

---

## Secrets & Environment Variables

OpenCode resolves `{env:NAME}` in `opencode.json` from the environment of the
**background service process** (`opencode service`). It does **not** load any
`.env` file, and an unset variable silently substitutes an empty string — a
missing token usually shows up as a server that stops authenticating rather
than an error.

This repository therefore uses **file substitution** as its standard:

```jsonc
"mcp": {
  "servers": {
    "penpot": {
      "type": "remote",
      "url": "https://design.penpot.app/mcp/stream?userToken={file:.secrets/penpot-token}"
    }
  }
}
```

### Secret files

Secrets live in **`.secrets/` inside this configuration folder**, one value per
file, referenced with `{file:.secrets/<name>}` (relative to the config file).

The set of secret files is **derived from `opencode.json`**: any value of the
form `{file:.secrets/<name>}` is a secret the setup script expects to exist.
There is no hardcoded list to keep in sync, so adding a new server with a new
`{file:...}` reference is all that is needed.

```bash
./scripts/setup-secrets.sh          # prompts only for missing values
./scripts/setup-secrets.sh --check  # report only; exits 1 if anything is missing
```

The script creates `.secrets/` (mode 700), writes values with mode 600 and no
trailing newline, and warns if `.secrets/` is not git-ignored. A trailing `\n`
silently breaks HTTP header auth, so `--check` flags it.

### Rules

- **Never** put tokens in `opencode.json`, `cli.json`, or `~/.zshrc` — repo
  files are committed to the remote, and `.zshrc` ends up in shell listings.
- **Never** name a secret file `*.env`: the permissions in `opencode.json` deny
  reading `*.env`.
- `.secrets/` sits inside this repository but is **excluded by `.gitignore`**
  (a blocklist). Never remove that rule, and never `git add -f`
  files from it — the auto-sync pushes everything git will stage unless it is
  ignored.
- `{file:...}` accepts `~/`, absolute, or config-file-relative paths. A missing
  file silently substitutes an empty string.

### Changing a secret or the config

Substitution happens when config loads, so restart the background service and
verify afterwards:

```bash
opencode service restart
opencode mcp list    # penpot should show: connected
```

If you fall back to `{env:NAME}` for some variable, export it in `~/.zshrc`
**and** restart the service — the running service keeps the environment it was
started with.

### Fresh machine checklist

1. Clone this repository and run `./scripts/setup.sh` (auto-sync).
2. Run `./scripts/setup-secrets.sh` to recreate `.secrets/*` — git does not
   sync the values (an empty directory is not tracked either, so the script
   creates it).
3. `opencode service restart && opencode mcp list` to verify every server
   reconnects.

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
