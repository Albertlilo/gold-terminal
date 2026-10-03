# Security hardening

The API still requires verified Firebase identities and server-side Pro/owner grants. Browser origin checks are defence in depth, not authentication.

## Implemented

- Helmet security headers and removal of the Express version header.
- Exact browser-origin allowlist; production accepts the live Render frontend and optional comma-separated `API_ALLOWED_ORIGINS` (or existing `PUSH_ALLOWED_ORIGINS`). Local Vite origins are development-only.
- Request limit, 16 KB JSON body limit, simple query parser, and generic parser/internal error responses.
- FRED controller failures no longer send internal exception messages to visitors.
- Ignore rules cover `.env` variants and common Firebase/private key files. Ignore rules do not erase previous commits or revoke credentials.
- Patched direct Axios dependency. Frontend dependency audit is clean after patching the affected gRPC dependency.

## Limits and follow-up

The request ceiling is an in-memory per-process limit and does not trust forwarded IP headers. Behind Render it may group many visitors under a proxy; monitor it and add a correctly configured shared or edge limiter before scaling. It is not distributed denial-of-service protection.

Backend production audit still reports seven moderate transitive Firebase Admin dependency advisories with no non-breaking fix. Three high advisories are in development-only file-watching dependencies; the production-only audit reports zero high findings. Avoid force-downgrades. Recheck advisories as upstream packages release fixes.

GitHub remains public at the owner's request. No visibility change was made. Public copies/forks may persist. Secret scanning found no tracked private-key or MongoDB credential patterns; this does not guarantee that historical or untracked secrets were never exposed. Rotate any credential suspected of exposure.

Push and deploy both services before relying on these controls in production. Verify login, owner access, dashboard and phone alerts after deploy. Atlas access restrictions, account MFA, restore testing and independent penetration testing remain separate work.
