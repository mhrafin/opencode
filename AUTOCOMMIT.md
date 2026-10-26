# git-autocommit

`bin/git-autocommit` commits and pushes this repo **at most once per 24 hours**.
A systemd user timer polls every 30 minutes; the script itself decides whether
to act.

## Files

| Path | Purpose |
|---|---|
| `bin/git-autocommit` | the script (this repo) |
| `~/.config/systemd/user/git-autocommit@.service` | runs it for one repo |
| `~/.config/systemd/user/git-autocommit@.timer` | polls every 30 min |
| `~/.local/state/git-autocommit/*.lastrun` | the 24h gate timestamp |
| `~/.local/state/git-autocommit/autocommit.log` | the log (rotates at 5 MB) |

The script lives inside the repo it manages, so the first run that commits
anything will also commit the script itself. That is intended. The gate
timestamp and the log stay **outside** the repo so a running log never creates
commit noise.

## How the gate works

The timer fires every 30 minutes, but the script decides whether to act:

1. It reads the timestamp in `~/.local/state/git-autocommit/<repo-path-with-underscores>.lastrun`.
2. If that run was **less than `INTERVAL_HOURS` ago** (default 24), it exits 0
   having changed nothing.
3. Otherwise it runs the prerequisite checks, commits, pushes, and only then
   writes a new timestamp.

A skipped tick costs one `git status` and a log line, not a commit.

## Prerequisites checked before anything is staged

- `git` is installed and new enough
- the repo directory exists and is a git work tree
- a remote is configured and has a URL
- `user.name` / `user.email` are set
- no unfinished merge, rebase, or cherry-pick is in progress
- the remote is reachable and credentials work (`git ls-remote`)

Any failure logs `PREREQUISITE FAILED: ...` and exits 1 without touching the index.

## Behaviour worth knowing

- **`git add -A`** stages new files, deletions, and modifications.
- **Only a successful push stamps the gate.** A failed push exits 2 and leaves
  the gate open, so the next tick retries.
- **A commit left behind by a failed push is not stranded.** If the tree is
  clean but commits are unpushed, the script pushes them without creating an
  empty commit.
- **Retries.** Push is attempted `RETRIES` times (default 3, 30 s apart). Between
  attempts it runs `git pull --rebase --autostash`, so a competing push on the
  remote does not cause a rejection loop.

## Use it

```bash
# check state without changing anything
SHOW_STATUS=1 bin/git-autocommit ~/.config/opencode

# preview what would be staged (stops before git add)
DRY_RUN=1 FORCE=1 bin/git-autocommit ~/.config/opencode

# run right now, ignoring the 24h gate
FORCE=1 bin/git-autocommit ~/.config/opencode

# a different interval
INTERVAL_HOURS=12 bin/git-autocommit ~/.config/opencode

# tail the log
tail -f ~/.local/state/git-autocommit/autocommit.log
```

## Enable the timer

```bash
systemctl --user daemon-reload
systemctl --user enable --now 'git-autocommit@home-raf-.config-opencode.timer'

# confirm it is armed and when it fires next
systemctl --user list-timers 'git-autocommit@*' --all
```

Add another repo by enabling the template with its escaped path:

```bash
systemd-escape --path /path/to/repo          # -> home-raf-projects-foo
systemctl --user enable --now "git-autocommit@$(systemd-escape --path /path/to/repo).timer"
```

`Persistent=true` in the timer means ticks missed while the machine was off run
once on the next boot, so a 24h cadence survives suspend. User units need
`loginctl enable-linger <user>` to run while logged out.

## Note for this repo

`.gitignore` here is an allowlist: `*` ignores everything, then `!` whitelists
paths. Anything added to the repo must be whitelisted there or `git add -A`
will skip it. `!bin/` and `!AUTOCOMMIT.md` were added for this script.
