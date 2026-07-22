# MMMHAK Project Agent Rules

## Git Commit Rule (MANDATORY)

After **every code change** made to this project, you MUST:

1. `git add` the modified files
2. `git commit` with a descriptive message following the format:
   - `fix: <brief description>` for bug fixes
   - `feat: <brief description>` for new features
   - `refactor: <brief description>` for refactoring
   - `chore: <brief description>` for maintenance tasks
3. `git push origin master` to push to GitHub

**No exceptions.** Even single-file changes must be committed and pushed before ending your turn.

### Commit Message Format
`
<type>: <short summary>

<optional body with detailed explanation of what and why>
`

### What to include in git add
- All source files modified during the task
- Do NOT add: `__pycache__/`, `*.pyc`, scratch test files, `.env`
- The `.gitignore` already handles most exclusions

## General Rules
- Always verify `git status` before finishing a task to ensure no modified files were left uncommitted.
- If a task touches multiple files, commit them together in one logical commit when possible.
