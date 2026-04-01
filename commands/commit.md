---
description: Analyzes git changes and intelligently splits them into logical commits
---

Analyze my current git changes and create well-structured commits. Follow these steps carefully:

## Step 1: Gather Context

Run the following shell commands to understand the current state:

!git status
!git diff --word-diff

## Step 2: Get Untracked File Contents

From the `git status` output above, identify all **untracked files** (listed under "Untracked files:"). For each untracked file or directory, read its contents:

- For individual untracked files: use `cat <file>`
- For untracked directories: use `find <dir> -type f | head -50` to list files, then `cat` each relevant file

Run those cat/find commands now for every untracked item found in step 1.

## Step 3: Plan Commits

Based on all the context gathered above, decide how many commits to make. Group changes by:
- **Feature or concern**: Changes that belong to the same feature or fix go together
- **File type or layer**: e.g., config changes separate from business logic, tests separate from implementation (unless trivial)
- **Untracked new files**: Group new files with the related tracked changes if they're part of the same feature; otherwise commit them separately

Think through the grouping explicitly. State:
1. How many commits you will make
2. What each commit will contain
3. What the commit message for each will be (use conventional commits format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, etc.)

## Step 4: Execute Commits One by One

For each planned commit, run the git add and git commit commands sequentially. Only `git add` the specific files/hunks that belong to that commit — do not `git add .` unless all remaining changes belong to a single commit.

Example pattern:
```
git add path/to/file1 path/to/file2
git commit -m "feat: add user authentication flow"
```

After all commits are done, run `git log --oneline -10` to show the result.
