# SwiftType releases

Live app: https://www.murdawkmedia.com/swifttype/

Since 2026-11-05, SwiftType is a static app within the existing `murdawk-media`
Cloudflare Workers asset deployment. The standalone `swifttype` Pages project
was deleted after production acceptance. Its old pages.dev address is retired.
No new Pages project, Worker, DNS record or backend is needed.

## Build and import

Source history stays independent. Nostr remains the authoritative source host;
GitHub is a passive mirror. Keep source publication separate from a hosting
release and preserve any unpublished reviewed changes.

From the reviewed SwiftType checkout:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run e2e
```

The browser tests require Playwright Chromium. They use mock speech recognition
and do not establish real microphone/provider acceptance. The development server
and build both use `/swifttype/`.

From the studio website checkout, import that exact reviewed build:

```sh
node scripts/import-swifttype.mjs /path/to/reviewed-swifttype/dist
npm test
npx tsc --noEmit
npm run build
```

Review the generated `public/swifttype/`, `public/_headers` and
`apps/swifttype-release.json`. The website keeps the built assets locally so
ordinary website builds need neither SwiftType's checkout nor its dependencies.
The importer refuses to overwrite a different existing site header policy;
review and merge policy changes explicitly before importing.

Deploy the reviewed website with the owner's authenticated Wrangler session:

```sh
wrangler deploy --keep-vars
```

Only `murdawk-media` is the hosting target. Preserve its existing custom domain,
DNS, compatibility settings, bindings and preview controls.

## Acceptance and recovery

Verify the canonical app URL, apex and trailing-slash redirects, Lab link,
every served app file, image/CSS/JS content types, scoped security headers,
keyboard quote advancement, stats, themes and desktop/mobile layout. Recheck the
existing website routes. Voice remains opt-in and browser/provider-dependent.

Preserve `Cache-Control: public, no-transform` on `/swifttype/*`. It prevents the
studio domain's automatic analytics beacon from being injected into SwiftType;
do not relax the app CSP to admit that beacon. The rest of the website keeps its
existing policy.

Record the current and previous Workers version IDs and retain verified source
and artifact recovery before release. The former Pages project must not be used
as a deploy target. Keep local environment files, logs and credentials out of
source and all public artifacts.
