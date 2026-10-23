# SwiftType

Live app: [swifttype.pages.dev](https://swifttype.pages.dev/).

## Source and distribution

The [Nostr repository](https://gitworkshop.dev/npub17j3f7cuhcvjqnf7d80x6rt9hmkkhdguwg4l2th0h4qnhqketr63s6xakwv/git.shakespeare.diy/swifttype) is authoritative.
The [MurdawkMedia GitHub repository](https://github.com/murdawkmedia/SwiftType) is a passive distribution mirror. Use GitWorkshop for contributions.
With ngit installed: `git clone nostr://npub17j3f7cuhcvjqnf7d80x6rt9hmkkhdguwg4l2th0h4qnhqketr63s6xakwv/git.shakespeare.diy/swifttype`.

The existing Cloudflare Pages site is preserved. Releases deploy directly from
the reviewed Nostr commit; see [DEPLOY.md](DEPLOY.md).


SwiftType is a free, privacy-focused speed test for keyboard input and opt-in browser voice recognition.

## Privacy model

- Keyboard mode runs in the browser and does not send keystrokes to a SwiftType server.
- Voice mode is opt-in. SwiftType asks the browser for speech recognition and prefers on-device recognition when the browser supports it.
- Some browsers may process speech through their own speech service. SwiftType does not run a backend, store audio, keep results, or require a paid API key.
- No Gemini key, account, telemetry service, or app-owned analytics are required.

## Run locally

Prerequisites: Node.js 18 or newer.

```bash
npm ci
npm run dev
```

## Verify

```bash
npm run typecheck
npm test
npm run build
npm run e2e
```

Cloudflare Pages should build from the repository root and publish the `dist` directory.
