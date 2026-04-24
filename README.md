# SwiftType

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
