# Nous API keys

## Hosted Nous runs only on the visitor's own provider key

**Id:** 1ff2fad5-9a7b-435d-9c9d-b32621125845
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** maintainer request for bring-your-own-key, 2026-10-09; implementation in the nous repository (aapostoliadis/nous, commit 8df5642)
**Revisit when:** Nous adds user accounts, billing, or a shared-key trial tier on the hosted site

On the hosted deployment (Vercel, `VERCEL=1`), every model call uses the
OpenAI or Anthropic key the visitor enters in Connections. The browser
sends it per request in the `X-Provider-Key` header, never in the body or
URL. The server forwards it to the provider for that one call and keeps
nothing. With no key the API answers 401 and names the missing vendor.
Deployment environment keys are ignored when hosted. Run locally, Nous
still falls back to `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` from the
environment or `.env.local`, so the single-user local setup keeps working.

**Reason:** `/api/ask`, `/api/models` and `/api/audio` are public and
unauthenticated, and before this change they spent the deployment
owner's provider credit for anyone who found the site. With visitors'
own keys, each person pays for their own usage.

**Which parts are confirmed:** the choice itself (the maintainer asked
for visitors' own keys), the problem it answered (the public endpoints
spending the owner's credit, raised as the top issue in a review of the
live site), and the implementation (commit 8df5642). Inferred: why each
alternative below lost. No reason was given for any of them when the
choice was made.

**Rejected alternative:** keep the deployment keys behind a shared
passcode. It was offered as the other answer to the same problem, and
own keys were picked instead. Inferred reason: everyone holding the
passcode would still spend the owner's credit.

**Rejected alternative:** keep the deployment keys and bound the cost
with an IP rate limit or provider spend caps. Both were on the list of
fixes for the same issue. Inferred reason: they cap the owner's spend
without ending it.

**Rejected alternative:** the browser calls OpenAI/Anthropic directly
and skips the Nous server. It was named at design time without a
recorded reason. Inferred reason: provider request building, streaming
and audio handling already live in the server (`app/providers.cjs`,
`app/server.cjs`) and serve local mode too, so passing the visitor's key
through that code keeps one path for both modes. The cost is that
visitors must trust the deployment with their key in transit.

**Rejected alternative:** keep the local-only `/api/connections/anthropic`
route, which wrote an Anthropic key into `.env.local` (it already
refused requests when hosted). It was removed in the same change and
now answers 405. No reason was recorded. Inferred reason: once both
modes take the key from the browser per request, a second, Anthropic-only
way to store a key on disk was redundant.

**Consequence:** `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` were removed
from the Vercel project's Production and Preview environments on
2026-10-10, once the new build was live. Removing them does not revoke
them; the keys themselves still need rotating at each provider.

## Browser keeps the key for the tab unless the user opts in

**Id:** b8867946-0186-400e-a3a0-77c9929d9011
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** implementation in the nous repository (aapostoliadis/nous, commit 8df5642, `app/connections.js`)
**Revisit when:** Nous gains server-side accounts that could hold keys, or the key is ever read by code outside `connections.js`
**See:** nous-api-keys.md#hosted-nous-runs-only-on-the-visitors-own-provider-key — 1ff2fad5-9a7b-435d-9c9d-b32621125845 — as of 2026-10-10

Before a key is kept, it is checked against the provider's model
catalogue. It then goes into `sessionStorage` and is gone when the tab
closes. A "Remember on this device" checkbox moves it to `localStorage`
instead. Forget clears both.

**Reason:** a key that dies with the tab is the safer default on a
shared or borrowed machine. People on their own device can still choose
convenience explicitly.

**Which parts are confirmed:** the behaviour, read from `connections.js`.
The reason above and the one under the alternative are inferred: none
was stated when this was built.

**Rejected alternative:** `localStorage` by default. The opt-in checkbox
shows it was considered. Inferred reason: it would leave a billable
credential on disk, with no expiry, for every visitor, including those
who never meant to keep it.

## No server-side model allowlist on the hosted proxy

**Id:** d8f0cee8-18bf-4d40-be1a-f7658d6029d8
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** design review during the bring-your-own-key change, 2026-10-09; nous repository (aapostoliadis/nous, commit 8df5642)
**Verification:** corroborated — `ask()` in `app/providers.cjs` rejects a model missing from the catalogue listed for the request's own key
**Revisit when:** the hosted site ever spends a key it does not get from the request (a shared or sponsored key)
**See:** nous-api-keys.md#hosted-nous-runs-only-on-the-visitors-own-provider-key — 1ff2fad5-9a7b-435d-9c9d-b32621125845 — as of 2026-10-10

The hosted proxy accepts any model id that the visitor's key can list.
It does not restrict requests to a fixed set of cheap models.

**Reason:** the server already rejects a model that is not in the
catalogue returned for that key. The visitor pays for their own calls,
so an allowlist would only limit them without protecting anyone else's
money.

**Rejected alternative:** a fixed allowlist of models. It was planned as
cost protection while the deployment's own keys were in use, and
dropped once those keys stopped being used.

## No server-wide lock on model requests

**Id:** 47d25392-f124-4f0d-b599-6c01613c4225
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** maintainer request to remove the lock, 2026-10-10; nous repository (aapostoliadis/nous, commit 90d972c)
**Revisit when:** the hosted site ever spends a key it does not get from the request, or a provider call starts sharing server-side state between visitors
**See:** nous-api-keys.md#hosted-nous-runs-only-on-the-visitors-own-provider-key — 1ff2fad5-9a7b-435d-9c9d-b32621125845 — as of 2026-10-10

`app/server.cjs` lets any number of `/api/ask` and `/api/audio` requests
run at once. Until commit 90d972c it held one global busy flag per server
instance: while one request ran, every other visitor on that instance
got a 409. Each browser tab still stops its own user from sending a
second request while one is in flight; that check is client-side only.

**Reason:** with every visitor paying through their own key, the lock
protected no shared budget, but it let one visitor's slow request block
everyone else on the same instance. `tests/verify-hosting.cjs` now sends
two requests at once and expects both to succeed.

**Which parts are confirmed:** the removal (the maintainer asked for it)
and the 409 behaviour it ended, read from the code before the change.
Inferred: why the lock was added. Nothing recorded says; it fits a
single-user local tool, or capping spend on the deployment's own keys.

**Alternatives:** unknown. A lock per key or per visitor was not
discussed.
