# FedCM Identity Handler — Explainer

**Authors:**
Suresh Potti (sureshpotti@microsoft.com)

## Participate

- https://github.com/w3c-fedid/FedCM/issues/80
- https://github.com/w3c-fedid/FedCM/pull/815 (spec PR)
- https://fedidcg.github.io/FedCM/#identity-handler

## Summary

This document describes the **FedCM Identity Handler**, a feature that allows Identity Providers
(IDPs) to opt their existing Service Worker into intercepting credentialed FedCM requests
(`accounts`, `id_assertion`, `disconnect`). When opted in, the Service Worker receives a dedicated
`IdentityRequestEvent` — distinct from `FetchEvent` — and can forward the request to the network
using a purpose-built `fetchAugmented()` method that preserves the UA's privileged request
properties while allowing a small, vetted set of augmenting headers (e.g., `DPoP`).

## Status

This explainer documents a **proposed addition** to the FedCM specification, tracked in
[PR #815](https://github.com/w3c-fedid/FedCM/pull/815). The proposal introduces:

1. An **opt-in flag** (`acceptsFedCM: true`) on the existing `ServiceWorkerContainer.register()`
   call, so that only Service Workers that explicitly opt in are reachable by FedCM dispatch.
2. A dedicated `IdentityRequestEvent` dispatched to the opted-in SW.
3. A purpose-built `IdentityRequestEvent.fetchAugmented(init)` method that forwards the UA's
   privileged internal request to the network while letting the SW append a small allowlist of
   augmenting headers.

> **Note — substantial discussion in PR #815.** Earlier drafts of this explainer described a
> *config-based* registration model in which the IDP declared a Service Worker via an
> `identity_handler` field in `config.json` and the browser managed registration / unregistration
> lifecycle. Based on reviewer feedback on PR #815, that approach has been replaced by the
> opt-in flag described in this document. The flag-based model keeps the SW lifecycle in the
> hands of the IDP (via the standard Service Worker registration APIs) while still preventing
> pre-existing SWs from accidentally intercepting FedCM events. See the section
> *[SW Registration Model](#sw-registration-model)* for the full rationale and
> *[Alternatives Considered](#alternatives-considered)* for the design space.

**Key difference from generic SW interception:** Rather than changing the FedCM internal request's
`service-workers mode` from `"none"` to `"all"` (which would route through the standard
`FetchEvent` pathway and *lose* the UA-set privileged properties when the SW called
`fetch(event.request)`), this proposal introduces a dedicated event type plus a dedicated
forwarding method (`fetchAugmented`) that the browser dispatches only when the IDP's SW has
explicitly opted in. This provides clearer intent signaling, tighter scoping, a purpose-built API
surface, and — crucially — byte-for-byte preservation of the UA-direct request shape on the wire.

## Problem Statement

Based on IDP feedback documented in [GitHub Issue #80](https://github.com/w3c-fedid/FedCM/issues/80),
Identity Providers need programmable control over FedCM requests. Use cases raised include:

- **Request signing (DPoP):** Add proof-of-possession assertions to prevent token theft — *"Bearer
  tokens have an inherent problem that they can be stolen."*
- **Multi-domain failover:** Route requests to backup servers when primary IDP infrastructure fails.
- **Token caching during outages:** Graceful degradation when IDP servers are temporarily
  unavailable.
- **Geographic routing:** Direct requests to regional / sovereign identity services based on user
  location.
- **Legacy system integration:** Wrap non-FedCM identity services with FedCM-compatible interfaces.

Currently, FedCM internal requests have `service-workers mode: "none"`, so SW interception is
impossible — IDPs cannot leverage these programmable capabilities.

## Proposed Solution

### 1. IDP Opts Its Service Worker Into FedCM

The IDP registers its Service Worker using the standard
[`ServiceWorkerContainer.register()`](https://w3c.github.io/ServiceWorker/#dom-serviceworkercontainer-register)
API and passes a new `acceptsFedCM` option:

```js
navigator.serviceWorker.register('/sw.js', {
  scope: '/',
  acceptsFedCM: true   // ← opts this SW into FedCM dispatch
});
```

**Spec change in summary:**

- A new boolean `acceptsFedCM` field on `RegistrationOptions` (defaults to `false`).
- A new step in the `dispatch identity handler` algorithm: after `Match Service Worker
  Registration`, if the registration's `acceptsFedCM` is `false`, return null (no SW interception).

A Service Worker without `acceptsFedCM: true` is **invisible** to FedCM dispatch — even if it
adds an `identityrequest` event listener, the UA will never dispatch to it. This preserves the
existing behavior of every SW deployed today.

> **Note — substantial discussion in PR #815: registration isolation.** Reviewer feedback raised
> the concern that pre-existing SWs (e.g., deployed for caching, push, offline) should not
> accidentally be invoked for FedCM, and that FedCM-purposed SWs should not be misused by other
> platform features that look up the same registration. The opt-in flag addresses both concerns
> at minimal spec and IDP cost. Stronger forms of isolation (separate FedCM-only registration
> registry, or even a separate storage partition) were considered and are documented under
> [Alternatives Considered](#alternatives-considered).

### SW Registration Model

The Identity Handler SW is registered the same way any SW is registered: from a page on the IDP
origin, via `navigator.serviceWorker.register(...)`. The only addition is the `acceptsFedCM`
option.

This is a deliberate change from earlier drafts, which proposed that the browser register the SW
automatically based on an `identity_handler` field in `config.json`. The browser-managed model
was rejected because:

1. **Lifecycle ownership is unclear.** The standard SW lifecycle (install / activate / update /
   unregister) is owned by the page that registered the SW. A browser-injected registration with
   no owning page creates novel lifecycle questions (when is it updated? what triggers
   `updatefound`? how does it interact with `Clear-Site-Data`?).
2. **Scope semantics differ.** SW scope is usually derived from the registering script's URL.
   A config-driven registration has no obvious natural scope.
3. **Developer expectations diverge.** SWs registered outside of `navigator.serviceWorker` do not
   appear in `getRegistrations()` and are not visible in DevTools' Service Workers panel without
   special handling. The flag-based model "just works" with existing tooling.

> **Note — substantial discussion in PR #815: unregistration.** Reviewers asked how the SW gets
> unregistered when the IDP no longer wants FedCM interception, and whether `Clear-Site-Data`
> should remove the registration. With the flag-based model, unregistration is the standard
> `registration.unregister()` call (or the IDP removes the `acceptsFedCM` option on a subsequent
> `register()`). `Clear-Site-Data` removes the registration the same way it removes any SW
> registration — there is no separate "FedCM partition" to clear.

### 2. Browser Dispatches `IdentityRequestEvent` to the SW

When the browser needs to fetch an IDP credentialed endpoint (`accounts`, `id_assertion`,
`disconnect`), it constructs a locked-down internal request (see
[*UA-Direct Request Shape*](#ua-direct-request-shape) below) and dispatches an
`identityrequest` event to the registered, opted-in SW:

```webidl
enum IdentityRequestEndpoint {
    "accounts",
    "id-assertion",
    "disconnect"
};

[Exposed=ServiceWorker, SecureContext]
interface IdentityRequestEvent : ExtendableEvent {
    constructor(DOMString type, IdentityRequestEventInit eventInitDict);

    readonly attribute IdentityRequestEndpoint endpoint;
    readonly attribute Request request;
    readonly attribute USVString rpClientId;

    undefined respondWith(Promise<Response> response);
    [NewObject] Promise<Response> fetchAugmented(optional AugmentInit init = {});
};

dictionary IdentityRequestEventInit : ExtendableEventInit {
    required IdentityRequestEndpoint endpoint;
    required Request request;
    USVString rpClientId;
};

dictionary AugmentInit {
    HeadersInit headers;
    AbortSignal signal;
};
```

**Key members:**

- `endpoint` — `"accounts"`, `"id-assertion"`, or `"disconnect"`.
- `request` — A JS `Request` *view* of the UA's privileged internal request. It exposes the URL,
  method, and body (for POST). It does **not** expose the privileged internal slots
  (`client = null`, opaque `origin`, `destination = "webidentity"`) — those are kept in an
  internal `[[StoredRequest]]` slot, not visible to JS.
- `rpClientId` — The RP's client identifier, for endpoints that need it.
- `respondWith(promise)` — Same pattern as `FetchEvent.respondWith()`; the SW returns a `Response`
  to the UA.
- `fetchAugmented(init)` — A purpose-built forwarding method that fetches the *internal* request
  (preserving all UA-set properties) with optional augmenting headers. See
  [*Why `fetchAugmented`*](#why-fetchaugmented).

> **Note — substantial discussion in PR #815: single event vs per-endpoint events.** A reviewer
> recommended three separate events (`accountsrequest`, `identityassertionrequest`,
> `disconnectrequest`) rather than one `identityrequest` event discriminated by an `endpoint`
> field. The single-event design was chosen because (a) it keeps the SW's `addEventListener` set
> small and predictable, (b) it allows IDPs to share common framing logic across endpoints
> (logging, augmentation, error handling) without registering three listeners, and (c) it
> mirrors the precedent of `FetchEvent`, which is also a single event whose target / method are
> discriminating fields. The tradeoff — that an SW receives `identityrequest` events for
> endpoints it doesn't actually intend to handle — is mitigated by the SW's ability to inspect
> `event.endpoint` and call `event.fetchAugmented()` (no augmentation) to forward unchanged.

### 3. SW Handles the Event

The recommended pattern is to call `event.fetchAugmented(...)` from `respondWith`:

```js
// /sw.js — IDP's Service Worker (opted in via acceptsFedCM: true)

self.addEventListener('identityrequest', (event) => {
  if (event.endpoint === 'id-assertion') {
    event.respondWith((async () => {
      const dpop = await generateDPoPProof({
        htm: 'POST',
        htu: event.request.url,
        key: await getDPoPKey(),
      });
      // Forward UA's privileged request augmented with DPoP.
      return event.fetchAugmented({ headers: { DPoP: dpop } });
    })());
    return;
  }

  if (event.endpoint === 'accounts') {
    // Forward unchanged — preserves all UA-set privileged properties.
    event.respondWith(event.fetchAugmented());
    return;
  }

  // For endpoints the SW doesn't handle, simply do nothing.
  // The UA falls back to the normal network fetch.
});
```

### Why `fetchAugmented`?

A naive design would let the SW call `event.respondWith(fetch(event.request))`. **This does not
work** for FedCM, because the FedCM internal request is constructed with deliberately hardened
properties (see [*UA-Direct Request Shape*](#ua-direct-request-shape)) that the public `Request`
constructor does not preserve:

| Internal property | UA-direct value | After `fetch(event.request)` |
| --- | --- | --- |
| `client` | `null` | SW's settings object ❌ |
| `origin` | opaque | IDP origin ❌ |
| `destination` | `"webidentity"` | `""` ❌ |

When these properties are lost, the network stack derives different wire headers:

| Wire | UA-direct | `fetch(event.request)` |
| --- | --- | --- |
| `Sec-Fetch-Dest` | `webidentity` | `empty` ❌ |
| `Sec-Fetch-Site` | `cross-site` | `same-origin` ❌ |
| `Origin` | `null` | `https://idp.example` ❌ |
| `Cookie` scope | `SameSite=None` only | All cookies including Lax / Strict ❌ |

The IDP server cannot tell the SW-mediated request apart from a page-initiated XHR — the FedCM
CSRF marker (`Sec-Fetch-Dest: webidentity`) is gone, and Lax / Strict cookies are now exposed.

`event.fetchAugmented(init)` solves this by holding a reference to the UA's internal request
(in an internal `[[StoredRequest]]` slot) and invoking the Fetch algorithm directly on a clone of
it — **bypassing the `Request` constructor entirely**. The result is a request that is
byte-for-byte identical to the UA-direct request, optionally with extra headers from the
allowlist.

#### Augmenting Header Allowlist (Block-by-Default)

`AugmentInit` accepts only `headers` and `signal` — no `method`, no `body`, no `credentials`, no
`redirect`. The trust model is "augment, not mutate."

Headers passed via `init.headers` must be on the **augmenting header allowlist**:

| Header | Rationale |
| --- | --- |
| `DPoP` | Proof-of-possession of a service-worker-held key. Primary motivating use case. [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449). |
| `Authorization` | Bearer tokens layered on top of the cookie session (MFA step-up, downstream service tokens). |
| `Signature` | HTTP Message Signatures ([RFC 9421](https://www.rfc-editor.org/rfc/rfc9421)). |
| `Signature-Input` | RFC 9421 metadata header accompanying `Signature`. |
| `Content-Digest` | [RFC 9530](https://www.rfc-editor.org/rfc/rfc9530) integrity digest for request body when used with HTTP Message Signatures. |

Any other header name (including `X-Request-Id`, custom `X-*` headers, etc.) causes
`fetchAugmented()` to reject with a `TypeError`. New headers can be added to the allowlist only
via a spec amendment that includes a security review.

> **Note — substantial discussion in PR #815: block-by-default header policy.** Reviewer
> guidance was that augmenting headers should be **allowlisted**, not denylisted, so that the
> trust default is "any header not explicitly listed is forbidden." This forces a security
> review whenever a new use case wants a new header, rather than relying on the spec to keep an
> ever-growing list of forbidden names in sync with new attacks. The five headers above are the
> use cases the spec has explicitly considered and accepted.

Headers that are UA-set on the FedCM internal request (e.g., `Accept`, `Sec-Fetch-*`, `Cookie`,
`Origin`, `Referer`) **cannot be overridden** — even if a future allowlist amendment added them
by mistake, the algorithm's append-only rule rejects any attempt to override a UA-set header.

#### Response Type Restriction

`fetchAugmented()` accepts only responses whose [response type](https://fetch.spec.whatwg.org/#concept-response-type)
is `"basic"` (same-origin) or `"default"` (UA-constructed). Responses of type `"cors"`,
`"opaque"`, `"opaqueredirect"`, or `"error"` are rejected. This matches the UA-direct path:
credentialed FedCM endpoints always target the IDP's own origin with `redirect mode: "error"`,
so the response can only originate from the IDP origin.

> **Note — substantial discussion in PR #815: cross-site redirects.** A reviewer raised the
> concern that letting the SW return arbitrary responses would effectively allow cross-site
> redirects, even though the UA-direct path uses `redirect mode: "error"` to prohibit them. The
> response-type filter is the resolution: any response that originated from a different origin
> (`"cors"` or `"opaque"`) is rejected, so the user agent dialog's origin assumption holds end
> to end.

### 4. Fallback to Network

If the SW does not handle the event, calls `respondWith` with a rejected promise, returns a
non-OK response, returns a response of a disallowed type, or times out (default 10 seconds),
the browser **transparently falls back** to a normal network fetch — as if the SW did not exist
or had not opted in. The feature is purely additive: IDPs that opt in get SW capabilities, but
failures never break the FedCM flow.

The implementation uses a "skip flag" pattern for fallback:

1. If SW dispatch fails → emit console warning.
2. Set `skip_identity_handler` flag → bypass SW on retry.
3. Re-issue the same request via normal network fetch.
4. Clear the flag for future requests.

### UA-Direct Request Shape

When the UA fetches a FedCM credentialed endpoint directly (no SW), it constructs an internal
request with deliberately hardened properties. The same shape is preserved end-to-end by
`fetchAugmented()`:

| Property | Value | Purpose |
| --- | --- | --- |
| `URL` | The endpoint URL (resolved via *computing the manifest URL*) | Target the IDP's endpoint |
| `method` | `GET` (accounts) or `POST` (id-assertion / disconnect) | Per endpoint semantics |
| `redirect mode` | `"error"` | Prevents IDP from redirecting the credentialed fetch elsewhere |
| `client` | `null` | No environment settings object → no ambient authority leaks |
| `service-workers mode` | `"none"` (for the inner network fetch) | Prevents recursive SW interception of the same request |
| `destination` | `"webidentity"` | Stamps `Sec-Fetch-Dest: webidentity` on the wire — the FedCM CSRF marker |
| `origin` | a fresh **opaque origin** | Forces cookie layer to treat as cross-site to the IDP |
| `Accept` header | `application/json` (accounts) or `application/x-www-form-urlencoded` (id-assertion / disconnect) | Forces request / response shape |
| `referrer policy` | `"no-referrer"` | Prevents RP origin leakage to IDP |
| `credentials mode` | `"include"` | Required to send the IDP session cookie |
| `mode` | `"no-cors"` | Bypasses CORS preflight |

The resulting wire request to `idp.example/accounts` (UA-direct, *or* SW-mediated via
`fetchAugmented`):

```http
GET /accounts HTTP/1.1
Host: idp.example
Accept: application/json
Cookie: sid=abc123                       ← SameSite=None cookies only
Sec-Fetch-Dest: webidentity              ← UA-stamped, unforgeable
Sec-Fetch-Site: cross-site
Sec-Fetch-Mode: no-cors
Origin: null
```

### Selective Endpoint Policy

Only credentialed authentication endpoints are dispatched to the SW:

| Endpoint | SW Dispatch | Reason |
| --- | --- | --- |
| `/accounts` | ✅ Yes | User account data — benefits from caching and augmentation |
| `/token` (id-assertion) | ✅ Yes | Token generation — can use DPoP, custom logic |
| `/disconnect` | ✅ Yes | Account management — graceful error handling |
| `/.well-known/web-identity` | ❌ No | IDP discovery — privacy protection |
| `/config.json` | ❌ No | Configuration — privacy protection |
| `/client_metadata` | ❌ No | RP metadata — privacy protection |

Configuration endpoints are fetched with privacy-preserving properties (`credentials: "omit"`,
opaque origin, no referrer) and are deliberately kept out of SW scope to preserve the privacy
boundary between RP identity and IDP cookies.

### Why a Dedicated Event (Not `FetchEvent`)?

| Aspect | `FetchEvent` approach | `IdentityRequestEvent` approach |
| --- | --- | --- |
| Opt-in | Implicit (any SW would intercept once FedCM is in scope) | Explicit (`acceptsFedCM: true`) |
| Scoping | SW sees ALL fetches from its origin | SW only receives identity events |
| Property preservation | `fetch(event.request)` strips internal slots ❌ | `fetchAugmented()` preserves them ✅ |
| Augmentation policy | Open (any header) | Block-by-default allowlist |
| API surface | Generic | Purpose-built: `endpoint`, `request`, `rpClientId`, `fetchAugmented` |
| Intent signaling | SW may not know it's a FedCM request | Clear `identityrequest` event type |

## Benefits

### DPoP (Demonstration of Proof-of-Possession)

The primary motivating use case. DPoP binds tokens to the specific client that requested them,
preventing token theft:

```js
self.addEventListener('identityrequest', (event) => {
  if (event.endpoint === 'id-assertion') {
    event.respondWith((async () => {
      const dpop = await generateDPoPProof({
        htm: 'POST',
        htu: event.request.url,
        key: await getDPoPKey(),
      });
      return event.fetchAugmented({ headers: { DPoP: dpop } });
    })());
  }
});
```

### Graceful Degradation During Outages

```js
self.addEventListener('identityrequest', (event) => {
  if (event.endpoint === 'accounts') {
    event.respondWith((async () => {
      try {
        const response = await event.fetchAugmented();
        if (response.ok) {
          const cache = await caches.open('fedcm-cache');
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw new Error('No cached accounts available');
      }
    })());
  }
});
```

### RP Transparency

RPs require **zero changes**. The FedCM API contract is unchanged:

```js
const credential = await navigator.credentials.get({
  identity: {
    providers: [{
      configURL: "https://idp.example/config.json",
      clientId: "rp_client_123",
      nonce: "random_nonce_value"
    }]
  }
});
console.log('Token:', credential.token);
```

## Limitations

### No Complete Offline Authentication

This proposal does **not** enable complete offline authentication:

1. Configuration endpoints (`/.well-known`, `/config.json`) are fetched **before** the SW-enabled
   endpoints.
2. If config fetch fails (network offline, cache expired), the entire FedCM flow fails before
   reaching the SW.
3. SW only helps with **partial outages** — config servers reachable, auth servers down.

### Augmentation Only, Not Mutation

The SW cannot modify the request URL, method, body, redirect mode, credentials mode, or
referrer. It can only append headers from the allowlist. IDPs that need to substantially rewrite
requests must use generic SW interception on non-FedCM endpoints.

### Timeout Enforcement

The browser enforces a timeout (default 10 seconds) on the `respondWith()` promise. If the SW
does not respond in time, the browser falls back to network. This prevents slow or hung SWs
from blocking authentication.

## Privacy Considerations

### Configuration Endpoints Are Protected

Configuration endpoints (`/.well-known`, `/config.json`, `/client_metadata`) are **not**
dispatched to the SW for privacy reasons:

- These endpoints are fetched with privacy-preserving properties (`credentials: "omit"`, opaque
  origin, no referrer).
- If intercepted, the SW could correlate user identity (via cookies from its own origin) with
  RP identity (from `client_metadata` URL parameters).
- Keeping these endpoints out of SW scope preserves the privacy boundary.

### RP Encoding in Config — Substantial Discussion

> **Note — substantial discussion in PR #815: RP-correlated SW endpoints.** A reviewer raised
> the concern: if the SW (or the config it is derived from) could encode the RP identity, the
> SW would learn the RP and the cross-site privacy boundary FedCM aims to enforce would
> collapse. The current proposal addresses this in two ways:
>
> 1. The SW is registered by the IDP at the IDP origin via the standard SW registration API
>    (`navigator.serviceWorker.register`). There is no FedCM-specific mechanism for the IDP to
>    dynamically inject an RP-keyed SW script or config.
> 2. The credentialed endpoints dispatched to the SW (`accounts`, `id_assertion`, `disconnect`)
>    already have the same RP visibility on the IDP server today: `id_assertion` and
>    `disconnect` carry the RP's `client_id` in the POST body; `accounts` carries no RP identity
>    at all. The SW sees nothing the IDP server does not already see.
>
> This open thread is not fully closed — see [Open Questions](#open-questions).

### IDP Trust Model

The Identity Handler SW runs at the IDP's origin and sees the same information that IDP servers
already see:

- `/accounts` (GET) — no RP identity visible (opaque origin).
- `/token` (POST) — RP `client_id` in the POST body (already visible to IDP server).
- `/disconnect` (POST) — RP `client_id` in the POST body (already visible to IDP server).

No new information is exposed beyond what the IDP server already receives.

### User Consent

User consent is still required before any tokens are issued. The SW cannot bypass the FedCM
consent UI — it only augments the network layer between the browser and the IDP server.

## Security Considerations

### Origin Isolation

The Identity Handler SW is registered at the IDP origin and can only intercept requests destined
for that origin:

```
✅ idp.example's SW intercepts: requests TO idp.example/accounts
❌ idp.example's SW cannot intercept: requests TO other-idp.com/accounts
❌ rp.com's SW cannot intercept: requests TO idp.example/accounts
```

Cross-origin Service Worker interception is architecturally impossible.

### `Sec-Fetch-Dest: webidentity` Preserved End-to-End

FedCM requests include `Sec-Fetch-Dest: webidentity`, a forbidden header that cannot be set by
JavaScript. When the SW forwards via `event.fetchAugmented()`, this header is preserved on the
wire because the algorithm operates on the UA's internal request rather than constructing a new
JS `Request`. IDPs validate this header server-side to confirm requests genuinely originate from
the FedCM API.

### Cookie Scope Preserved

Because `fetchAugmented` preserves the internal request's `client = null` and opaque `origin`,
the Fetch *determine the same-site mode* algorithm continues to return `unset-or-less` for the
forwarded request → only `SameSite=None` cookies are eligible. `SameSite=Lax` and
`SameSite=Strict` cookies remain protected.

### Redirect Prevention

FedCM requests use `redirect mode: "error"` — the SW cannot redirect requests to different URLs
via `fetchAugmented`. In addition, the response-type filter (see
[*Response Type Restriction*](#response-type-restriction)) rejects any response whose origin
differs from the IDP's, so the SW cannot launder a cross-origin response back into the FedCM
flow either.

### Synthetic Event Defense

`fetchAugmented` checks an internal `[[StoredRequest]]` slot that is set only when the UA's
FedCM machinery dispatches the event. If JS code synthesizes an `IdentityRequestEvent` via its
constructor and dispatches it, `[[StoredRequest]]` is null and `fetchAugmented` rejects with a
`TypeError`.

### Robust Fallback

SW failures (no listener, rejection, non-OK response, disallowed response type, timeout) trigger
a transparent fallback to the UA-direct network fetch, with a console warning. SW bugs cannot
block authentication.

## Developer Experience

**IDP developers** opt in by:

1. Adding `acceptsFedCM: true` to their existing `navigator.serviceWorker.register(...)` call.
2. Implementing an `identityrequest` event handler in their SW.
3. Calling `event.fetchAugmented(...)` (optionally with allowlisted headers) and passing the
   result to `event.respondWith(...)`.

**RP developers**: No changes required. Completely transparent.

**Debugging**: Console warnings are emitted when the SW fails:

- "FedCM: No identity handler service worker registration found for the provider. Falling back to network."
- "FedCM: The matched registration is not opted in via acceptsFedCM. Falling back to network."
- "FedCM: The identity handler service worker has no active version. Falling back to network."
- "FedCM: The identity handler service worker failed to start. Falling back to network."
- "FedCM: The identity handler response had a non-ok status (NNN). Falling back to network."
- "FedCM: Header \"X-Foo\" is not on the augmenting header allowlist."

## Alternatives Considered

### Config-Based Browser-Managed Registration (rejected)

Earlier drafts proposed an `identity_handler.service_worker` field in `config.json` that the
browser would parse and use to register the SW automatically. Rejected for the reasons listed
under [*SW Registration Model*](#sw-registration-model): unclear lifecycle ownership, novel
scope semantics, and divergence from developer expectations.

### Separate FedCM-Only SW Registry (deferred)

A stronger isolation option is to create a separate registration registry (`registerForFedCM`)
so that FedCM SWs and general SWs are entirely distinct objects. This is more invasive (new IDL
surface, new lifecycle algorithms, ~10 cross-cutting interactions with `Clients`,
`BroadcastChannel`, push, etc.) and forces IDPs to manage two SWs with shared-state
coordination.

The opt-in flag (Option A) addresses the same two threats the reviewer raised — pre-existing SW
accidental interception, and cross-feature misuse of FedCM SWs — at a fraction of the cost. The
flag-based model is also forward-compatible: if a future threat materializes that the flag
doesn't cover, the spec can evolve toward registry separation. The reverse migration (from
registry separation back to a flag) is much harder once IDPs are running two SWs.

### Separate FedCM Storage Partition (rejected)

A maximal isolation option (separate registry **plus** a separate storage partition keyed by
`(storage key, FedCM)`) was considered. Rejected because:

- IDPs cannot share DPoP keys, session caches, or user preferences between the general and FedCM
  SWs without runtime `postMessage` choreography.
- The threats it addresses (compromised general SW reading FedCM state) require attacker control
  of SW code, which a storage partition does not actually prevent.
- It would require coordination with `[[STORAGE]]`, `[[FETCH]]`, and `[[COOKIES]]` spec editors.

### `fetch(event.request)` from a Generic `FetchEvent` (rejected)

Allowing FedCM requests to flow through the standard `FetchEvent` pathway is the simplest
possible design but loses every UA-set privileged property as soon as the SW does
`fetch(event.request)` — see [*Why `fetchAugmented`*](#why-fetchaugmented). The IDP server can
no longer tell SW-mediated FedCM requests from page-initiated XHRs, the CSRF marker
(`Sec-Fetch-Dest: webidentity`) is gone, and `SameSite=Lax` / `Strict` cookies leak. This is
the central reason a dedicated event and dedicated forwarding method are needed.

## Open Questions

> **Note — substantial discussion in PR #815.** The following questions had non-trivial threads
> in PR review. They are listed here so the explainer can be discussed independently of the
> spec PR.

1. **Unregistration on logout.** Should the spec require / recommend that IDPs unregister the
   FedCM-opted SW on logout, or is the standard SW lifecycle sufficient? (Reviewer:
   yoshisatoyanagisawa.)
2. **Per-endpoint events vs single event.** Should the design be split into three events
   (`accountsrequest`, `identityassertionrequest`, `disconnectrequest`) for clarity? (Reviewer:
   yoshisatoyanagisawa; current design: single event with `endpoint` field.)
3. **RP-correlated SW endpoints.** Are there any indirect paths by which an IDP could
   dynamically derive an RP-keyed SW script or config (e.g., via the
   `client_metadata` exchange)? (Reviewer: npm1.)
4. **Augmenting header allowlist growth.** What is the threshold / process for adding new
   headers? Reviewer-recommended block-by-default keeps the list small, but the spec needs an
   explicit amendment process. (Reviewer: yoshisatoyanagisawa — block-by-default adopted.)
5. **DevTools UX.** All SW-related features need a story for DevTools' Application > Service
   Workers panel. The opt-in flag should surface visibly so IDP developers can verify they
   opted in correctly.
6. **Naming.** `acceptsFedCM` vs `acceptsIdentityRequest` vs `fedcmEnabled` — bikeshed.

## References

- [FedCM Specification](https://fedidcg.github.io/FedCM/)
- [FedCM Identity Handler section](https://fedidcg.github.io/FedCM/#identity-handler)
- [Spec PR #815 — Enabling IDP Interception in FedCM Request](https://github.com/w3c-fedid/FedCM/pull/815)
- [GitHub Issue #80 — SW interception for FedCM](https://github.com/w3c-fedid/FedCM/issues/80)
- [Service Worker Specification](https://w3c.github.io/ServiceWorker/)
- [Fetch Specification](https://fetch.spec.whatwg.org/)
- [DPoP (RFC 9449)](https://www.rfc-editor.org/rfc/rfc9449)
- [HTTP Message Signatures (RFC 9421)](https://www.rfc-editor.org/rfc/rfc9421)
- [HTTP Integrity Fields (RFC 9530)](https://www.rfc-editor.org/rfc/rfc9530)
