# Nous

A local, LLM-native workspace for thought. Goals, evidence, assumptions, questions, decisions and artifacts persist as linked objects across Map, Branches, Evidence, Decisions and Document views.

## Run locally

Requires Node.js 24 or later. No dependencies need installing.

```sh
npm start
```

Open http://localhost:4179. On Windows, you can also open `Start.cmd`.

## Connect OpenAI and Claude

Open Connections beside Ask, paste your own OpenAI or Anthropic API key, then choose **Check and save**. Nous checks the key against the provider and lists the models it can use. Choose a provider and an available model beside Ask. Local commands work without provider credentials. API billing is separate from ChatGPT and Claude subscriptions.

Keys are kept in this browser: for the current tab only, or on this device if you tick **Remember on this device**. **Forget key** removes it. Each request sends your key in an `X-Provider-Key` header to the Nous server, which passes it to the provider and never stores it. For local use only, you can instead copy `.env.example` to `.env.local` and add keys there; they are used when no browser key is saved, and are excluded from Git.

The local server binds to `127.0.0.1` and serves an explicit allowlist of public assets. This prototype is intended for single-user local use.

## Vercel hosting

Import this repository into Vercel using the repository root (recommended) or `app` as the Root Directory. The explicit `vercel.json` routes requests through `vercel-entry.mjs` to `server.cjs`, not the browser's `app.js`. Node.js 24 is required. No custom build command is needed.

The hosted version serves the same workspace and local commands. Visitors bring their own API keys, and usage is billed to their own provider accounts. The hosted server ignores `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` even if they are set in Vercel, so the deployment never spends the owner's credit; a request without a browser key gets a 401 asking for one. Keys travel over HTTPS and are never logged or stored on the server. `OPENAI_MODEL` and `ANTHROPIC_MODEL` still set the default models. Private `.env.local` files are neither bundled nor read on Vercel. This prototype does not include application authentication or usage quotas.

Vercel's deployment, branch and production domains are accepted through its system environment variables. For additional aliases or a custom domain, set `NOUS_ALLOWED_HOSTS` to a comma-separated list of exact hostnames, without a protocol or path. Hosted API requests must use the same HTTPS origin. Changes to environment variables require redeployment.

## Features

- Visible shared goal, context and constraints.
- Persistent typed objects, branching and linked provenance.
- Decision states with human review.
- Multiple views over the same workspace objects.
- Progressive OpenAI and Claude answers, validated before adding draft objects.
- Map pan, zoom, fit and fullscreen controls.
- Ask dictation and specialist audio tools using OpenAI.
- Browser storage for workspace data and IndexedDB for saved audio.
- Desktop layout fits 1280 × 1024 without page scrolling; long content scrolls within panels.

## Validation

```sh
npm test
```

Tests use synthetic provider responses and microphone fixtures. They do not make paid generation calls or capture real audio. Live speech accuracy depends on the microphone, browser and selected provider.

## Project structure

- `app/`: runnable frontend and local Node server.
- `tests/`: isolated provider, streaming, request lifecycle and dictation checks.
- `visuals/`: article screenshots and captions from earlier design stages; they do not show every subsequent UI refinement.
- `docs/`: visual adaptation notes and the UX review.

The seed project and research evidence are fictional. AI output is saved as draft material requiring review. The map's core connectors are illustrative; additional objects appear as cards. This is an interaction prototype, not a multi-user production service.

Third-party notices are preserved in `app/vendor/` and `app/assets/fonts/`. The supplied Nous artwork and Figma-derived assets retain their original ownership; no blanket open-source licence is applied to them.
