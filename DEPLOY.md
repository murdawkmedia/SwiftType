# Cloudflare Pages releases

Live app: https://swifttype.pages.dev/

Nostr main is the authoritative source. GitHub is a passive distribution mirror
with Actions disabled. The existing Cloudflare Pages project keeps its URL and
legacy production branch label, master. Its Git-triggered production and preview
builds are disabled; deploy reviewed releases directly using Wrangler.

From a clean accepted Nostr checkout, install the lockfile dependencies and run:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run e2e
wrangler pages deploy dist --project-name swifttype --branch master --commit-hash "$(git rev-parse HEAD)" --commit-dirty=false
```

The browser suite needs the matching Playwright Chromium installation and uses
mock speech recognition. It does not access a real microphone. Authenticate
Wrangler privately to the project owner's existing Cloudflare account. Never
copy local environment files, raw logs or credentials into source or dist.

Verify the production release commit, every served asset, configured security
headers, desktop/mobile keyboard flow and voice/error controls. Browser-level
speech processing and microphone permissions depend on the user's browser;
a mock test does not establish real microphone acceptance. Keep the previous
Cloudflare deployment ID and verified source bundle for rollback.
