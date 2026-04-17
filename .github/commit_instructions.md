# Commit + Push Instructions

Use this workflow whenever the user requests **"Commit + Push"**.

## Scope and grouping
- Split changes into **single-topic commits**.
- Prefer commit grouping by player-facing category in this order:
  1. Blocks
  2. Items
  3. Scripts
  4. UI
  5. Docs
  6. Misc (only if uncategorized changes remain)
- Keep unrelated systems in separate commits.

## Commit message format
- Title must be short and high-level.
- Body must list only categories that actually changed.
- **Do not include empty sections.**
- Keep section order fixed: Blocks -> Items -> Scripts -> UI -> Docs -> Misc.
- Use bullet points with concrete file-level or behavior-level details.

## Behavior requirements
- Validate the real diff before drafting messages.
- If files have no real textual diff (noise-only), do not include them.
- Keep wording concise, objective, and implementation-accurate.

## Push behavior
- After commits are created, push to `origin` on the current branch.
- Report commit hashes and push result.
- If push fails, report the exact failure and next recovery step.
