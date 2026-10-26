# Security Policy

## Reporting a vulnerability
Please **do not open a public issue** for security problems.
Report privately via GitHub: **Security → Report a vulnerability** on this repository, or contact the maintainer through the email on the [GitHub profile](https://github.com/imawais-engineer). Include steps to reproduce and impact. You can expect an acknowledgement within 72 hours.

## Secrets hygiene
- No credentials, API keys, tokens, keystores or `.env` files are committed. Configuration goes through environment variables; see `.env.example` where present.
- Every push, pull request and a weekly full-history run are scanned with [gitleaks](https://github.com/gitleaks/gitleaks) (`.github/workflows/security-scan.yml`).
- If a secret is ever exposed it is **rotated first**, then removed from history.

## Supported versions
Only the latest `main` branch is supported.
