# FedCM Identity Handler — Explainer

**Authors:**
Suresh Potti (sureshpotti@microsoft.com)

## Participate

- https://github.com/w3c-fedid/FedCM/issues/80
- https://fedidcg.github.io/FedCM/#identity-handler

## Summary

This document describes the **FedCM Identity Handler**, a feature that allows Identity Providers (IDPs) to declare a Service Worker in their FedCM `config.json` that intercepts credentialed FedCM requests (accounts, id_assertion, disconnect). The Service Worker receives a dedicated `IdentityRequestEvent` — distinct from `FetchEvent` — providing a purpose-built, secure interception mechanism for federated identity flows.

## Status

This explainer documents a **proposed addition** to the FedCM specification. The proposal introduces a new `identity_handler` field in the IDP config and a corresponding `IdentityRequestEvent` dispatched to the IDP's Service Worker.

**Key difference from generic SW interception:** Rather than changing `service-workers mode` from `"none"` to `"all"` on FedCM requests (which would use the standard `FetchEvent` pathway), this proposal introduces a dedicated event type that the browser dispatches only when an IDP explicitly opts in via their config. This provides clearer intent signaling, tighter scoping, and a purpose-built API surface.

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

#### 1. IDP Declares a Service Worker in Config

The IDP adds an `identity_handler` field to their FedCM `config.json`:

```json
{
  "accounts_endpoint": "/accounts",
  "id_assertion_endpoint": "/token",
  "disconnect_endpoint": "/disconnect",
  "login_url": "/login",
  "identity_handler": {
    "service_worker": "/idp-sw.js"
  }
}
```

When the browser fetches this config, it registers the declared Service Worker at the IDP origin. If the IDP later removes `identity_handler` from their config, the browser automatically unregisters the SW (fire-and-forget cleanup).

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
- `request` — A full `Request` object with the original URL, method, body (for POST), and `destination: "webidentity"` (which sets `Sec-Fetch-Dest: webidentity`)
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

If the SW does not call `respondWith()`, rejects the promise, returns a non-OK response, or times out (default 10 seconds), the browser **transparently falls back** to a normal network fetch — as if the SW did not exist. This ensures the feature is purely additive: IDPs that opt in get SW capabilities, but failures never break the FedCM flow.

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

### Why a Dedicated Event (Not FetchEvent)?

| Aspect | `FetchEvent` approach | `IdentityRequestEvent` approach |
|--------|----------------------|-------------------------------|
| Opt-in | Implicit (any SW intercepts) | Explicit (`identity_handler` in config) |
| Scoping | SW sees ALL fetches from its origin | SW only receives identity events |
| API surface | Generic request/response | Purpose-built: `endpoint`, `request`, `respondWith()` |
| Browser control | Browser sets `service-workers mode` | Browser controls registration lifecycle |
| Cleanup | SW persists until unregistered | Auto-unregistered when IDP removes config |
| Intent signaling | SW may not know it's a FedCM request | Clear `identityrequest` event type |

The dedicated event approach provides clearer separation of concerns — the IDP explicitly declares intent in their config, and the browser manages the SW lifecycle.

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

## Limitations

### No Complete Offline Authentication

This proposal does **not** enable complete offline authentication:

1. Configuration endpoints (`/.well-known`, `/config.json`) are fetched **before** the SW-enabled endpoints
2. If config fetch fails (network offline, cache expired), the entire FedCM flow fails before reaching the SW
3. SW only helps with **partial outages** — config servers reachable, auth servers down

### SW Must Be Registered via Config

Unlike generic SW registration (where visiting `idp.example` is sufficient), the Identity Handler SW is registered **by the browser** when it parses the `identity_handler` field in `config.json`. This means:
- The IDP must include `identity_handler` in their config
- The browser manages registration and unregistration lifecycle
- The SW is scoped specifically for identity request handling

### Timeout Enforcement

The browser enforces a timeout (default 10 seconds) on the `respondWith()` promise. If the SW does not respond in time, the browser falls back to network. This prevents slow or hung SWs from blocking authentication.

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

### Redirect Prevention

FedCM requests use `redirect mode: "error"` — the SW cannot redirect requests to different URLs. This prevents token theft via redirect attacks.

### Robust Fallback

The implementation uses a "skip flag" pattern for fallback:
1. If SW dispatch fails → emit console warning
2. Set `skip_identity_handler` flag → bypass SW on retry
3. Re-issue the same request via normal network fetch
4. Clear the flag for future requests

This ensures that SW failures never block authentication — the flow degrades gracefully to the non-SW path.

## Developer Experience

**IDP developers** opt in by:
1. Adding `"identity_handler": {"service_worker": "/sw.js"}` to their FedCM config
2. Implementing an `identityrequest` event handler in their SW
3. Using standard web APIs (Fetch, Cache, Crypto) within the handler

**RP developers**: No changes required. Completely transparent.

**Debugging**: Console warnings are emitted when the SW fails:
- "FedCM: No identity handler service worker registration found for the provider. Falling back to network."
- "FedCM: The identity handler service worker has no active version. Falling back to network."
- "FedCM: The identity handler service worker failed to start. Falling back to network."
- "FedCM: The identity handler response had a non-ok status (NNN). Falling back to network."

## References

- [FedCM Specification](https://fedidcg.github.io/FedCM/)
- [FedCM Identity Handler section](https://fedidcg.github.io/FedCM/#identity-handler)
- [Service Worker Specification](https://w3c.github.io/ServiceWorker/)
- [Fetch Specification](https://fetch.spec.whatwg.org/)
- [GitHub Issue #80 — SW interception for FedCM](https://github.com/w3c-fedid/FedCM/issues/80)
- [DPoP (RFC 9449)](https://www.rfc-editor.org/rfc/rfc9449)
