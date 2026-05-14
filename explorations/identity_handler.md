# FedCM Identity Handler — Explainer

**Authors:**
Suresh Potti (sureshpotti@microsoft.com)

## Participate

- https://github.com/w3c-fedid/FedCM/issues/80
- https://github.com/w3c-fedid/FedCM/pull/815 (spec PR)

## Summary

This document describes the **FedCM Identity Handler**, a feature that allows Identity Providers (IDPs) to register a Service Worker that intercepts credentialed FedCM requests (accounts, id_assertion, disconnect). The Service Worker receives a dedicated `IdentityRequestEvent` — distinct from `FetchEvent` — providing a purpose-built, secure interception mechanism for federated identity flows.

## Status

This explainer documents a **proposed addition** to the FedCM specification, tracked in [PR #815](https://github.com/w3c-fedid/FedCM/pull/815). The proposal introduces a new `IdentityRequestEvent` dispatched to an IDP-controlled Service Worker for credentialed FedCM endpoints.

## Problem Statement

Based on IDP feedback documented in [GitHub Issue #80](https://github.com/w3c-fedid/FedCM/issues/80), Identity Providers need programmable control over FedCM requests. Use cases raised include:

- **Request signing (DPoP):** Add proof-of-possession assertions to prevent token theft — *"Bearer tokens have an inherent problem that they can be stolen"*
- **Multi-domain failover:** Route requests to backup servers when primary IDP infrastructure fails
- **Token caching during outages:** Graceful degradation when IDP servers are temporarily unavailable
- **Geographic routing:** Direct requests to regional/sovereign identity services based on user location
- **Legacy system integration:** Wrap non-FedCM identity services with FedCM-compatible interfaces

Currently, FedCM requests bypass Service Workers entirely (`service-workers mode: "none"`), preventing IDPs from leveraging these programmable capabilities.

## Proposed Solution

### How It Works

#### 1. IDP Registers a Service Worker for FedCM

The IDP makes its Service Worker available to the FedCM dispatch path. The Service Worker is hosted at the IDP origin and only sees `identityrequest` events when it has explicitly indicated that it is intended to handle them.

The precise registration surface — how the IDP signals that intent to the user agent — is an open design question. See [Open Design Discussions §a](#a-service-worker-registration) for the options under consideration.

#### 2. Browser Dispatches `IdentityRequestEvent` to the SW

When the browser needs to fetch an IDP endpoint (accounts, token, disconnect), it first dispatches an `IdentityRequestEvent` to the registered SW:

```webidl
enum IdentityRequestEndpoint {
    "accounts",
    "id_assertion",
    "disconnect"
};

[Exposed=ServiceWorker]
interface IdentityRequestEvent : ExtendableEvent {
    constructor(DOMString type, IdentityRequestEventInit eventInitDict);

    readonly attribute IdentityRequestEndpoint endpoint;
    readonly attribute Request request;

    [RaisesException] undefined respondWith(Promise<Response> r);
};

dictionary IdentityRequestEventInit : ExtendableEventInit {
    required IdentityRequestEndpoint endpoint;
    required Request request;
};
```

**Key properties:**
- `endpoint` — An `IdentityRequestEndpoint` enum value: `"accounts"`, `"id_assertion"`, or `"disconnect"`
- `request` — A `Request` object with the original URL, method, body (for POST), and
- `destination: "webidentity"` (which sets `Sec-Fetch-Dest: webidentity`)
- `respondWith(promise)` — The SW provides a `Response` to the browser, same pattern as `FetchEvent.respondWith()`

#### 3. SW Handles the Event

```javascript
// /idp-sw.js — IDP's Identity Handler Service Worker

self.addEventListener('identityrequest', (event) => {
  if (event.endpoint === 'accounts') {
    // Add DPoP proof header to the accounts request
    const augmented = new Request(event.request, {
      headers: { ...event.request.headers, 'DPoP': generateDPoPProof() }
    });
    event.respondWith(fetch(augmented));
    return;
  }

  if (event.endpoint === 'id_assertion') {
    // Add DPoP proof to token request
    const augmented = new Request(event.request, {
      headers: { ...event.request.headers, 'DPoP': generateDPoPProof() }
    });
    event.respondWith(fetch(augmented));
    return;
  }

  // For endpoints not handled, the browser falls back to normal network fetch
});
```

#### 4. Fallback to Network

If the SW does not call `respondWith()`, rejects the promise, returns a non-OK response, returns a response of a disallowed type, or times out (default 10 seconds), the browser **transparently falls back** to a normal network fetch — as if the SW did not exist. This ensures the feature is purely additive: IDPs that opt in get SW capabilities, but failures never break the FedCM flow.

### Selective Endpoint Policy

Only credentialed authentication endpoints are dispatched to the SW:

| Endpoint | SW Dispatch | Reason |
|----------|-----------|--------|
| `/accounts` | ✅ Yes | User account data — benefits from caching and augmentation |
| `/token` (id_assertion) | ✅ Yes | Token generation — can use DPoP, custom logic |
| `/disconnect` | ✅ Yes | Account management — graceful error handling |
| `/.well-known/web-identity` | ❌ No | IDP discovery — privacy protection |
| `/config.json` | ❌ No | Configuration — privacy protection |
| `/client_metadata` | ❌ No | RP metadata — privacy protection |

### Augmenting Headers

When the SW forwards a FedCM request, it may attach additional headers (e.g., a `DPoP` proof).
Headers UA-set on the FedCM internal request (`Accept`, `Sec-Fetch-*`, `Cookie`, `Origin`,
`Referer`) must **not** be overridden by the SW.

The exact set of header names the SW is permitted to add, and the process for growing that
set, is still being worked out — see [Open Design Discussions §c](#c-other-areas-of-active-discussion).

### Response Type Restriction

The `Response` returned to `respondWith` must have a [response type](https://fetch.spec.whatwg.org/#concept-response-type) of `"basic"` (the response came from a same-origin fetch — i.e., from the IDP's own network endpoint) or `"default"` (the SW constructed the response directly, e.g., via `new Response(...)`, rather than fetching it). Responses of type `"cors"`, `"opaque"`, `"opaqueredirect"`, or `"error"` are rejected. This ensures the response can only originate from the IDP's own origin (or from same-origin SW code), matching the UA-direct path which uses `redirect mode: "error"` on requests whose URL targets the IDP.

### Why a Dedicated Event (Not FetchEvent)?

| Aspect | `FetchEvent` approach | `IdentityRequestEvent` approach |
|--------|----------------------|-------------------------------|
| Opt-in | Implicit (any SW intercepts) | Explicit (IDP-controlled opt-in) |
| Scoping | SW sees ALL fetches from its origin | SW only receives identity events |
| API surface | Generic request/response | Purpose-built: `endpoint`, `request`, `respondWith()` |
| Augmentation policy | Open (any header) | Block-by-default allowlist |
| Intent signaling | SW may not know it's a FedCM request | Clear `identityrequest` event type |

The dedicated event approach provides clearer separation of concerns — the IDP explicitly opts in, and the SW receives a purpose-built event for identity flows.

## Benefits

### DPoP (Demonstration of Proof-of-Possession)

The primary motivating use case. DPoP binds tokens to the specific client that requested them, preventing token theft:

```javascript
self.addEventListener('identityrequest', (event) => {
  if (event.endpoint === 'id_assertion') {
    const dpopProof = await generateDPoPProof(event.request.url, 'POST');
    const augmented = new Request(event.request, {
      headers: { ...event.request.headers, 'DPoP': dpopProof }
    });
    event.respondWith(fetch(augmented));
  }
});
```

### Graceful Degradation During Outages

```javascript
self.addEventListener('identityrequest', (event) => {
  if (event.endpoint === 'accounts') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            // Cache successful response
            caches.open('fedcm-cache').then(c => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          // Network failed — serve stale cache
          const cached = await caches.match(event.request);
          if (cached) return cached;
          throw new Error('No cached accounts available');
        })
    );
  }
});
```

### RP Transparency

RPs require **zero changes**. The FedCM API contract is unchanged:

```javascript
// Standard FedCM usage — works identically with or without Identity Handler
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

## Privacy Considerations

### Configuration Endpoints Are Protected

Configuration endpoints (`/.well-known`, `/config.json`, `/client_metadata`) are **not** dispatched to the SW for privacy reasons:

- These endpoints are fetched with privacy-preserving properties (`credentials: "omit"`, opaque origin, no referrer)
- If intercepted, the SW could correlate user identity (via cookies from its own origin) with RP identity (from `client_metadata` URL parameters)
- Keeping these endpoints out of SW scope preserves the privacy boundary

### IDP Trust Model

The Identity Handler SW runs at the IDP's origin and sees the same information that IDP servers already see:
- `/accounts` (GET) — no RP identity visible (opaque origin)
- `/token` (POST) — RP client_id in the POST body (already visible to IDP server)
- `/disconnect` (POST) — RP client_id in the POST body (already visible to IDP server)

No new information is exposed beyond what the IDP server already receives. The SW has the same visibility as the IDP backend.

### User Consent

User consent is still required before any tokens are issued. The SW cannot bypass the FedCM consent UI — it only augments the network layer between the browser and the IDP server.

## Security Considerations

### Origin Isolation

The Identity Handler SW is registered at the IDP origin and can only intercept requests destined for that origin:

```
✅ idp.example's SW intercepts: requests TO idp.example/accounts
❌ idp.example's SW cannot intercept: requests TO other-idp.com/accounts
❌ rp.com's SW cannot intercept: requests TO idp.example/accounts
```

Cross-origin Service Worker interception is architecturally impossible.

### Sec-Fetch-Dest: webidentity

FedCM requests include `Sec-Fetch-Dest: webidentity`, a forbidden header that cannot be set by JavaScript. The `Request` object exposed to the SW has `destination: "webidentity"`, which the SW can **read** but cannot **set**. IDPs can validate this header server-side to confirm requests genuinely originate from the FedCM API.

> The UA sets a number of internal fields on the FedCM request (`client`, `origin`, `destination`, `redirect mode`, `credentials mode`, `referrer policy`, `mode`, etc.) that together determine the on-the-wire shape — including `Sec-Fetch-Dest: webidentity`, the cookie scope (`SameSite=None`-only), and the value of the `Origin:` header. These fields are expected to remain intact end-to-end. However, when the SW forwards the request via `fetch(event.request)`, some of these fields may get reset as the request passes through the public `Request` constructor / Fetch algorithm, which can change the on-the-wire behavior. How the spec preserves these fields across SW forwarding is an open design question — see [Open Design Discussions §b](#b-keeping-lock-down-properties-intact-when-fetch-is-called-from-the-sw).

### Redirect Prevention

FedCM requests use `redirect mode: "error"` — the SW cannot redirect requests to different URLs. In addition, the response-type filter rejects any response whose origin differs from the IDP's, so the SW cannot launder a cross-origin response back into the FedCM flow either.

### Robust Fallback

The implementation uses a "skip flag" pattern for fallback:
1. If SW dispatch fails → emit console warning
2. Set `skip_identity_handler` flag → bypass SW on retry
3. Re-issue the same request via normal network fetch
4. Clear the flag for future requests

This ensures that SW failures never block authentication — the flow degrades gracefully to the non-SW path.

## Developer Experience

**IDP developers** opt in by:
1. Registering a Service Worker that handles FedCM (mechanism under discussion — see [Open Design Discussions §a](#a-service-worker-registration))
2. Implementing an `identityrequest` event handler in their SW
3. Using standard web APIs (Fetch, Cache, Crypto) within the handler, subject to the augmenting header allowlist

**RP developers**: No changes required. Completely transparent.

**Debugging**: Console warnings are emitted when the SW fails:
- "FedCM: No identity handler service worker registration found for the provider. Falling back to network."
- "FedCM: The identity handler service worker has no active version. Falling back to network."
- "FedCM: The identity handler service worker failed to start. Falling back to network."
- "FedCM: The identity handler response had a non-ok status (NNN). Falling back to network."

## Open Design Discussions

The following design questions are still being worked out in [PR #815](https://github.com/w3c-fedid/FedCM/pull/815). They are recorded here so the explainer can be discussed independently of the spec text.

### a) Service Worker Registration

How does an IDP register a Service Worker for FedCM, and how does the UA know which registration to dispatch `identityrequest` events to?

Options under consideration include:

- **Opt-in flag on the existing registration.** The IDP registers its SW with the standard `navigator.serviceWorker.register(...)` API and passes a new option (e.g., `acceptsFedCM: true`) on `RegistrationOptions`. SWs without the flag are invisible to FedCM dispatch. Lowest spec and IDP cost; the SW lifecycle remains owned by the IDP page.
- **Dedicated FedCM-only registration.** A separate `registerForFedCM(...)` API stores the FedCM SW in a parallel registry that is invisible to `getRegistration()` / `getRegistrations()`. Strongest registry-level isolation but a much larger spec surface (new IDL, new lifecycle algorithms, cross-cutting interactions with `Clients`, `BroadcastChannel`, push, etc.), and IDPs run two SWs with shared-state coordination.
- **Separate FedCM storage partition.** Adds a separate storage partition on top of the dedicated registration. Maximal isolation, but IDPs cannot share keys / caches / preferences across the two SWs without runtime `postMessage` choreography.
- **Dedicated manager extending `ServiceWorkerRegistration` (e.g., `registration.identity`).** Follow the architectural pattern used by features like the Periodic Background Sync API and the Notification API: extend `ServiceWorkerRegistration` with a dedicated interface — for example, `registration.identity` (an `IdentityProviderManager`). To enable FedCM interception, the IDP would call `registration.identity.register(configURL)` explicitly. This creates a one-to-one mapping between the IDP config URL and the SW registration, so functional events are only dispatched to workers that have intentionally opted in for that specific provider. (`configURL` is used here because it is the unique identifier for an `IdentityProviderConfig`.) This addresses the semantic mismatch of using the implicit `Match Service Worker Registration` algorithm for internal UA requests that lack a controlled client. It also provides a clear lifecycle: unlinking via `registration.identity.unregister(configURL)`, or implicitly through removal of the parent registration.

Reviewer concerns this section needs to resolve:

- Pre-existing SWs (deployed for caching, push, offline) must not accidentally be invoked for FedCM if they add an `identityrequest` listener.
- FedCM-purposed SWs should not be reachable by unrelated platform features that look up the same registration.
- The unregistration story should be clear (logout, `Clear-Site-Data`, IDP removal of opt-in).

Two earlier shapes were explored and have been backed out:

- **SW URL declared in the IDP `config.json` (e.g., `"identity_handler": { "service_worker": "/sw.js" }`).** Backed out for a privacy reason. The config file is fetched **per FedCM invocation** with the RP's `client_id` in the request path (`client_metadata`) or otherwise associated with a specific RP call; declaring the SW *inside* the config means the IDP can effectively encode RP-specific values (e.g., `/sw-for-rp-A.js` vs. `/sw-for-rp-B.js`) into the SW script URL that the browser will then register. That collapses the cross-site privacy boundary FedCM is designed to preserve — the SW (and the IDP server that serves the SW script) would learn which RP the user is interacting with, which is exactly what the config-vs-well-known two-tier file system exists to prevent.
- **SW URL declared in the IDP well-known file (`/.well-known/web-identity`).** Backed out for operational reasons. The well-known file is the IDP's *origin-wide* contract — it must be stable, single-valued, and is fetched without any user / RP context. Encoding a SW script URL there means: (a) **deployment friction** — every SW script-URL change requires editing a top-level well-known file, which on many corporate IDPs requires a separate sign-off and rollout path than the SW build pipeline that produces `/sw.js`; (b) **no scoping** — the well-known file applies to all FedCM configs on the origin, so an IDP cannot opt different configs in/out separately; (c) **lifecycle coupling** — the SW becomes implicitly registered by the UA on first FedCM use, with no Document-owned `register()` call, leaving no natural place for the IDP page to gate registration on user state (logged-in vs. not), call `await registration` for readiness, or run `skipWaiting()` / install logic in tandem with the rest of the IDP's SW.
- **UA-driven SW registration (browser registers / unregisters the FedCM SW on the IDP's behalf, e.g., on first FedCM invocation or when the config / well-known file changes).** Backed out because it breaks the standard `[[SERVICE-WORKERS]]` ownership model in several ways: (a) **no owning client** — every other path to `register()` runs from a Document or DedicatedWorker that owns the registration's lifecycle, but a UA-driven registration has no such owner, leaving questions like "what triggers `updatefound`?" / "when does the UA call `update()`?" / "how does `Clear-Site-Data` interact with a UA-owned registration?" without natural answers; (b) **scope semantics** — SW scope is derived from the script URL and the registering client; with no client, the spec has to invent FedCM-specific scope rules; (c) **silent SW execution** — a SW registered without the IDP page's knowledge can run install / activate handlers that the IDP did not expect or authorize, which is a footgun for IDPs that already deploy SWs for other purposes; (d) **DevTools / introspection gap** — UA-injected registrations do not naturally surface in `getRegistrations()` or in the DevTools Application > Service Workers panel without bespoke handling, making it hard for IDP developers to verify what is installed and debug failures; (e) **no upgrade story** — when the IDP wants to change its FedCM SW, there is no analog of the standard re-`register()` + `skipWaiting()` flow, so the UA has to define a new update mechanism.

The currently considered options above (opt-in flag, dedicated `registerForFedCM`, separate partition, `registration.identity` manager) all share the property that **the SW is registered through the standard `navigator.serviceWorker.register(...)` pipeline owned by an IDP page**, not declared in a config or well-known file and not injected by the UA. This keeps the SW lifecycle in the hands of IDP code that already has a controlled client, and avoids the RP-correlation channel, the well-known operational issues, and the ownership-model problems described above.

### b) Keeping Lock-Down Properties Intact When `fetch` Is Called From the SW

When the UA constructs the FedCM internal request, it sets a deliberately hardened shape:

| Property | Value | Why |
|---|---|---|
| `client` | `null` | No ambient authority leaks |
| `origin` | fresh **opaque origin** | Cookie layer treats this as cross-site to the IDP → only `SameSite=None` cookies are sent |
| `destination` | `"webidentity"` | Stamps `Sec-Fetch-Dest: webidentity` on the wire (the FedCM CSRF marker) |
| `redirect mode` | `"error"` | Prevents IDP-controlled redirects |
| `referrer policy` | `"no-referrer"` | Prevents RP origin leakage to IDP |
| `mode` | `"no-cors"` | Bypasses CORS preflight |
| `credentials mode` | `"include"` | Sends the IDP session cookie |
| `Accept` | UA-set per endpoint | Forces request / response shape |

When the SW handles the dispatched `identityrequest` event and forwards the request to the network via `fetch(event.request)`, the internal request fields `client`, `origin`, and `destination` are not exposed (or only read-only) through the public `Request` interface today and can be reset as the request flows through the [Fetch](https://fetch.spec.whatwg.org/) `Request` constructor. If they are reset, the wire-level consequences are:

| Wire | UA-direct | Naive `fetch(event.request)` |
| --- | --- | --- |
| `Sec-Fetch-Dest` | `webidentity` | `empty` ❌ |
| `Sec-Fetch-Site` | `cross-site` | `same-origin` ❌ |
| `Origin` | `null` | `https://idp.example` ❌ |
| `Cookie` scope | `SameSite=None` only | All cookies, including `SameSite=Lax` / `Strict` ❌ |

The IDP server would no longer be able to tell the SW-mediated request apart from a page-initiated XHR, the FedCM CSRF marker (`Sec-Fetch-Dest: webidentity`) would be gone, and Lax / Strict cookies would be exposed.

Approaches under consideration:

- **Transparent field carry-through.** Define `event.request` so that the internal request fields survive a subsequent `fetch(event.request)` invocation in the SW, without requiring any new JS-visible API.
- **Fetch / Request spec changes.** Extend the public `Request` constructor / Fetch algorithm so that the locked-down properties round-trip through the standard SW forwarding path.
- **Dedicated forwarding helper.** Introduce a purpose-built method on `IdentityRequestEvent` that invokes [=fetching=] directly on the UA's stored internal request, bypassing the public `Request` constructor entirely. The helper would also be the natural place to enforce the augmenting-header allowlist.

Whichever approach is chosen, the spec requires the same end-state: the request that hits the wire after SW forwarding is byte-for-byte equivalent to the UA-direct request (optionally with allowlisted augmenting headers added).

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
