# SwiftType

Live app: [murdawkmedia.com/swifttype](https://www.murdawkmedia.com/swifttype/).

## Source and distribution

The [Nostr repository](https://gitworkshop.dev/npub17j3f7cuhcvjqnf7d80x6rt9hmkkhdguwg4l2th0h4qnhqketr63s6xakwv/git.shakespeare.diy/swifttype) is authoritative.
The [MurdawkMedia GitHub repository](https://github.com/murdawkmedia/SwiftType) is a passive distribution mirror. Use GitWorkshop for contributions.
With ngit installed: `git clone nostr://npub17j3f7cuhcvjqnf7d80x6rt9hmkkhdguwg4l2th0h4qnhqketr63s6xakwv/git.shakespeare.diy/swifttype`.

The app is served under `/swifttype/` by the existing Murdawk Media website's
Cloudflare Workers asset deployment. Its former standalone Pages project was
removed on 2026-11-05 after live verification. Keep the source repository separate;
see [DEPLOY.md](DEPLOY.md) for importing a reviewed build into the website.


SwiftType is a free, privacy-focused speed test for keyboard input and opt-in browser voice recognition.

## Privacy model

- Keyboard mode runs in the browser and does not send keystrokes to a SwiftType server.
- Voice mode is opt-in. SwiftType asks the browser for speech recognition and prefers on-device recognition when the browser supports it.
- Some browsers may process speech through their own speech service. SwiftType does not run a backend, store audio, keep results, or require a paid API key.
- No Gemini key, account, telemetry service, or app-owned analytics are required.

## Run locally

Prerequisites: Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open the development server at `/swifttype/`.

## Verify

```bash
npm run typecheck
npm test
npm run build
npm run e2e
```

The build emits `dist` with `/swifttype/` asset URLs. It is imported into the
studio website before that website is deployed; do not recreate a Pages project.

Regression checks cover keyboard navigation, mobile input accuracy, canceled
voice startup, timer delays, partial-quote results and readable theme controls.
