# FedCM Identity Handler — Explainer

**Authors:**
Suresh Potti (sureshpotti@microsoft.com)

## Participate

- https://github.com/w3c-fedid/FedCM/issues/80
- https://github.com/w3c-fedid/FedCM/pull/815 (spec PR)

## Summary

This document describes the **FedCM Identity Handler**, a proposed feature that would allow Identity Providers (IDPs) to register a Service Worker capable of intercepting credentialed FedCM requests (accounts, id_assertion, disconnect).

## Status

This explainer documents a **proposed addition** to the FedCM specification, tracked in [PR #815](https://github.com/w3c-fedid/FedCM/pull/815). The proposal would let an IDP-controlled Service Worker intercept FedCM's credentialed fetches (accounts, id_assertion, disconnect).

The underlying request was discussed in the WG on [23 September 2025](https://github.com/w3c-fedid/meetings/blob/main/2025/2025-09-23-FedCM-notes.md) and editors agreed to pursue it; the credentialed-endpoints-only scoping cleared privacy review. Spec mechanics — registration model, internal-field preservation, header allowlist, and the dispatch shape (re-using `FetchEvent` vs. a new dedicated event) — are still being worked out. See [Open Design Discussions](#open-design-discussions).

## Problem Statement

The credentialed FedCM endpoints (accounts, id_assertion, disconnect) authenticate the user to the IDP using cookies. Today these requests have `service-workers mode: "none"`, so the IDP has no programmable seam between FedCM and its own network stack. The discussion on [Issue #80](https://github.com/w3c-fedid/FedCM/issues/80) surfaced four concrete problems this creates.

### 1. Bearer-token theft on the IDP cookie

**Challenge.** The cookies sent on the accounts and id_assertion calls are **bearer credentials** — anyone in possession of the bytes can replay them, often for the lifetime of the session (months). Token theft is a primary cause of identity-related security incidents, and modern enterprise IDPs increasingly require the cookie to be accompanied by a fresh, device-bound, proof-of-possession assertion before they will honor it. Microsoft Entra, for example, only accepts its `ESTSAUTH*` cookies if an `x-ms-RefreshTokenCredential` JWT — containing the device-wide SSO token and a server-issued nonce, signed by a TPM-backed device key — is attached to the request. Today the only way to get that header onto a FedCM-style call is via a browser extension (Chrome) or a non-standard browser API (Edge); see the [Platform Authentication explainer](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/PlatformAuthentication/explainer.md). FedCM as specified gives no place for that proof to be attached.

**How SW interception helps.** If FedCM's credentialed calls were routed through an IDP-controlled Service Worker — via a `fetch` event, a dedicated identity event, or another dispatch shape still under discussion — the SW could compute its proof (DPoP, mTLS-style signature, Entra's device-key JWT, WebAuthn-derived assertion, etc.) and attach it as a request header before forwarding the request to the network. The bearer cookie alone would no longer be sufficient to replay the call — the attacker would also need the device-resident private key.

> **Why not just "OAuth profile + DPoP at code redemption"?** [aaronpk's OAuth profile for FedCM](https://github.com/aaronpk/oauth-fedcm-profile) shows that DPoP-bound *RP* tokens can already be obtained without browser changes by treating the FedCM response as an authorization code and DPoP-binding the subsequent code→token exchange. That solves RP-side token binding but does **not** address the IDP-cookie bearer problem (the cookie sent on the accounts call is still a plain bearer), and the extra round trip is costly for bundle apps that talk to many IDP-issued resources (e.g., Teams). SW interception is targeted at the gap the OAuth-profile path leaves open.

### 2. Hard failures during IDP outages

**Challenge.** When the IDP backend is degraded — a regional incident, a partial accounts-service outage, a brief maintenance window — the FedCM call fails outright and the user sees a sign-in failure. The IDP has no opportunity to apply the resiliency patterns (regional failover, last-known-good cached account data) it routinely uses on its own surface.

**How SW interception helps.** The SW is a first-class place to implement these patterns: catch the network error, retry against a backup region, or fall back to a cached account list that's recent enough to render the FedCM account chooser. The FedCM contract with the RP is unchanged; the user sees a working flow instead of a hard failure.

### 3. Geographic / sovereignty-aware routing

**Challenge.** Some IDPs are required (by data-residency regulations or by tenant configuration) to route a given user's authentication traffic to a specific regional service. The FedCM `config.json` declares a single set of endpoint URLs per IDP origin and is fetched without user context, so there is no point at which the IDP can pick a region based on the actual signed-in user before the accounts call goes out.

**How SW interception helps.** The SW runs in the IDP origin and has access to IDP-side state (cookies, IndexedDB) that identifies the user. It can rewrite the outbound request URL to a regional endpoint at the moment the FedCM call happens, without changing the public `config.json` or requiring per-tenant config files.

### 4. Bridging non-FedCM identity backends

**Challenge.** An IDP with an existing identity backend whose wire format does not exactly match FedCM's accounts / id_assertion shape would otherwise have to deploy a server-side translation layer in front of every FedCM endpoint. This is operationally heavy and slows adoption — especially for IDPs experimenting with FedCM alongside an existing OIDC / SAML stack.

**How SW interception helps.** The SW can act as the translation layer at the edge: receive the FedCM-shaped request, call the IDP's existing backend in its native format, and synthesize a FedCM-shaped `Response` to return via `respondWith()`. No backend rewrite is required to participate in FedCM.

## Proposed Solution

### Candidate Approaches Considered

Three approaches to opening the SW seam were evaluated before converging on the current direction.

#### Approach A — Flip `service-workers mode` to `"all"` and let standard SW dispatch handle it

The most conservative spec change: replace `service-workers mode: "none"` with `"all"` on FedCM's credentialed requests. Fetch's *HTTP fetch* algorithm would then call the Service Worker spec's [*Handle Fetch*](https://www.w3.org/TR/service-workers/#handle-fetch), which fires a `FetchEvent` at the controlling SW.

**Why this cannot work as a spec-only change.** *Handle Fetch* resolves the dispatch target via the request's **client** — but FedCM sets `request's client = null` uniformly on every endpoint ([disconnect](Q:/Feature-Work/FedCM-SW/original_index.bs#L589), [well-known](Q:/Feature-Work/FedCM-SW/original_index.bs#L1187), [config](Q:/Feature-Work/FedCM-SW/original_index.bs#L1228), [accounts](Q:/Feature-Work/FedCM-SW/original_index.bs#L1353), [account picture](Q:/Feature-Work/FedCM-SW/original_index.bs#L1434), [id_assertion](Q:/Feature-Work/FedCM-SW/original_index.bs#L1503), [client_metadata](Q:/Feature-Work/FedCM-SW/original_index.bs#L1707)). With no client, the standard *Handle Fetch* algorithm has nothing to dispatch through — the request would still flow straight to the network. The `client = null` choice is structural (FedCM requests are initiated by the UA in response to the FedCM API call, not by any document-bound subresource fetch), so it cannot simply be relaxed. Additional spec machinery is required to define **how** the SW is found in the first place.

#### Approach B — Browser-side dispatch layer that calls the SW directly, bypassing standard `Handle Fetch`

A prototype along these lines exists at [Chromium CL 7206662](https://chromium-review.googlesource.com/c/chromium/src/+/7206662). It introduces a FedCM-specific `URLLoaderFactory` that:

1. Looks up the IDP's SW registration by URL **scope** (storage-key based, not client-based).
2. Builds a `FetchAPIRequest` from the FedCM internal request.
3. Invokes `ServiceWorkerFetchDispatcher` directly to fire a `fetch` event at the IDP's SW.
4. Falls back to the network factory if no SW is registered or the SW does not respond.

This implements the missing dispatch primitive in the browser. However, the corresponding **spec direction** — extending Fetch / Service Worker so the *spec* can dispatch a `FetchEvent` to a SW with no controlling client — was not endorsed by reviewers on the [Chromium service-worker-discuss thread](https://groups.google.com/a/chromium.org/g/service-worker-discuss/c/t9d33x6l718):

- **No initiating client** (Ben Kelly). Standard SW semantics dispatch `FetchEvent` to the SW controlling the *initiating client*. FedCM has no initiating client, and the dispatch target is the *destination* origin's SW — the same dispatch shape used by the deprecated [foreign fetch](https://github.com/whatwg/fetch/issues/506), which the SW WG removed for similar reasons.
- **Risk to deployed SWs.** Any IDP SW with a generic `fetch` handler would suddenly receive FedCM requests it was not written to handle. The opt-in is implicit (the SW exists), not explicit.
- **Procedural asks** (Dominic Farolino). A formal spec design section, Chrome security / privacy review, cross-vendor review, and TAG review were called out as prerequisites before reusing `FetchEvent` for this dispatch shape.

CL 7206662 remains useful as a reference for the browser-side dispatch primitives, but the spec path of "reuse `FetchEvent` via *Handle Fetch*" was not pursued on the basis of the thread feedback.

#### Approach C — Dedicated event, modeled on Payment Handler (current direction)

The shape suggested by reviewers in the SW WG thread, and currently captured in [PR #815](https://github.com/w3c-fedid/FedCM/pull/815): introduce a purpose-built event (`IdentityRequestEvent`) that the SW must explicitly listen for. The dispatch model is borrowed directly from the [Payment Handler API](https://w3c.github.io/web-based-payment-handler/), which faces the same shape of problem (UA-initiated request, destination-origin SW, no controlling client) and resolves it the same way — Payment Handler dispatches `"paymentrequest"` (and `"canmakepayment"`) using the Service Worker spec's [*Fire Functional Event ... on registration*](https://www.w3.org/TR/service-workers/#fire-functional-event) primitive, which targets a `ServiceWorkerRegistration`'s active worker directly **without** going through *Handle Fetch* or `request's client`. That is exactly the gap that blocks Approach A, and Approach C borrows the same primitive for FedCM. (The corresponding registration surface — how the SW gets associated with a specific IDP config in the first place — is a separate question, captured in [Open Design Discussions §a](#a-service-worker-registration).)

The dedicated-event design makes the unusual dispatch model **explicit at the API surface** rather than overloading `FetchEvent`. It addresses each of the Approach B concerns:

- The new event has no client-resolution dependency — dispatch is anchored to whichever IDP-config-to-SW-registration binding the registration surface (see [§a](#a-service-worker-registration)) defines, and fired directly on that registration.
- Pre-existing IDP SWs that only listen for `fetch` are not affected; only SWs that explicitly register the new event type participate.
- Being a different event entirely sidesteps the "is this foreign fetch in disguise?" critique against reusing `FetchEvent`.

This is the approach described in *How It Works* below. The detailed tradeoff comparison between Approach B and Approach C is recorded in [Open Design Discussions §d](#d-dispatch-shape--fetchevent-vs-a-dedicated-event); registration-shape options are in [§a](#a-service-worker-registration); and field-preservation mechanics are in [§b](#b-keeping-lock-down-properties-intact-when-fetch-is-called-from-the-sw).

### How It Works

This section describes **Approach C** in detail.

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
  switch (event.endpoint) {
    case 'accounts':
      // Outage resiliency: try the network, fall back to a recent cache
      // snapshot so the FedCM account chooser still renders during a
      // partial backend outage. (See Problem 2.)
      event.respondWith(
        fetch(event.request)
          .then(response => {
            if (response.ok) {
              caches.open('fedcm').then(c => c.put(event.request, response.clone()));
            }
            return response;
          })
          .catch(() => caches.match(event.request))
      );
      break;

    case 'id_assertion':
      // Token binding: attach a fresh DPoP proof so the IDP only honors
      // the session cookie when accompanied by the device-resident key.
      // (See Problem 1.)
      event.respondWith((async () => {
        const proof = await generateDPoPProof(event.request.url, 'POST');
        const augmented = new Request(event.request, {
          headers: { ...event.request.headers, 'DPoP': proof }
        });
        return fetch(augmented);
      })());
      break;

    case 'disconnect':
      // Bridging a non-FedCM backend: forward to the IDP's existing
      // revocation endpoint (which doesn't return the FedCM-required
      // shape) and synthesize a {account_id} response so the UA can
      // remove the account from its connected accounts set.
      event.respondWith((async () => {
        const body = await event.request.clone().text();
        const accountId = new URLSearchParams(body).get('account_hint');
        const upstream = await fetch('/internal/revoke', {
          method: 'POST',
          body
        });
        if (!upstream.ok) {
          // Surface the failure; the UA will remove all accounts for
          // this (RP, IDP) pair, per the spec's failure handling.
          return upstream;
        }
        return Response.json({ account_id: accountId });
      })());
      break;
  }
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

### Discussion: Privacy Attacks Considered

The credentialed-endpoints-only scoping in [Selective Endpoint Policy](#selective-endpoint-policy) is the result of explicit attack analysis on Issue #80. Two attacks were considered:

**Attack A — RP iframes IDP, then invokes FedCM.** The RP embeds the IDP in an iframe so the IDP's SW (or storage) sees the RP's identity, then invokes FedCM; the IDP SW correlates the RP with the user on the accounts call. **Conclusion:** this attack does not introduce new surface. Browsers already partition IndexedDB (and other SW-accessible storage) by top-frame origin, so an iframed IDP cannot stash RP context that a top-frame FedCM SW can read. To the extent IDP↔RP correlation is possible today via unpartitioned cookies or pop-ups, that correlation channel exists with or without SW interception.

**Attack B — uncredentialed endpoint logs the RP, credentialed endpoint reads it.** If SW interception were enabled on uncredentialed endpoints (e.g., `client_metadata`), the IDP SW could record the RP identity from that call (which legitimately includes the RP's `client_id`) and read it back during the subsequent accounts call — combining user identity (via cookies on the accounts call) and RP identity in the same SW context. **Conclusion:** real attack. Resolved by restricting SW interception to credentialed endpoints only (accounts, id_assertion, disconnect) and continuing to fetch configuration / metadata / well-known endpoints UA-direct with the existing privacy properties.

The privacy reviewer for the WG cleared the credentialed-only proposal on this basis.

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

On the UA-direct path, the browser stamps `Sec-Fetch-Dest: webidentity` — a forbidden header JavaScript cannot set — so the IDP can confirm the request came from the FedCM API, not from page-initiated script. The SW path must preserve the same guarantee: `event.request.destination` is `"webidentity"` (read-only to the SW), and the header must reach the IDP unchanged when the SW forwards the request. Otherwise the SW path silently weakens a marker the UA-direct path provides.

> **Why preserve `Sec-Fetch-Dest: webidentity` if the SW is already attaching a PoP proof?**
>
> A reasonable question — if the SW attaches a DPoP / Entra-JWT / mTLS-style proof, does the UA-stamped `Sec-Fetch-Dest: webidentity` marker still matter? Three reasons it does:
>
> 1. **Not every IDP attaches PoP.** SW interception is opt-in, and even an IDP that ships a SW may not attach a proof to every request. The spec must work for IDPs that rely only on cookies. `Sec-Fetch-Dest: webidentity` is the universal CSRF marker that lets *any* IDP server tell a real FedCM call apart from a page-initiated XHR — independent of whether a PoP scheme is in play.
>
> 2. **PoP and `Sec-Fetch-Dest` answer different questions.** PoP says "this request came from a holder of this device's private key." `Sec-Fetch-Dest: webidentity` says "this request came through the FedCM API surface, with the UA's mediation and consent UI." An IDP may legitimately want both: a credential is only honored if it is *both* device-bound *and* arriving on the FedCM path — so the server can be sure the matching consent flow ran. PoP alone does not vouch for the path the request took.
>
> 3. **The cookie-scope invariant is unrelated to PoP.** The UA-stamped opaque `origin` is what causes the cookie layer to send only `SameSite=None` cookies. If the SW path resets `origin` to `https://idp.example`, *all* same-site cookies (`Lax`, `Strict`) are sent on the wire — a data exposure that PoP does not undo. Preserving the lock-down protects this property regardless of whether the IDP attaches a proof.
>
> Put differently: PoP is an *IDP-defined* assertion about the client. The lock-down (`Sec-Fetch-Dest`, opaque origin, `redirect mode: "error"`, `referrer policy: "no-referrer"`) is a *UA-vouched* set of properties about how the request was made. They are layered defenses, not substitutes.

When the SW forwards the request via `fetch(event.request)`, that preservation is at risk — passing through the public `Request` constructor / Fetch algorithm can reset some of the UA-set internal fields. How the spec preserves these fields end-to-end across SW forwarding is an open design question — see [Open Design Discussions §b](#b-keeping-lock-down-properties-intact-when-fetch-is-called-from-the-sw).

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
- **Dedicated manager extending `ServiceWorkerRegistration` (e.g., `registration.identity`).** Follow the architectural pattern used by the [Payment Handler API](https://w3c.github.io/web-based-payment-handler/) — and similar features like Periodic Background Sync and Notifications — by extending `ServiceWorkerRegistration` with a dedicated interface. Payment Handler does this with `registration.paymentManager`, on which the page calls `paymentManager.instruments.set(instrumentKey, ...)` to declare what the handler can serve. FedCM would do the same with `registration.identity` (an `IdentityProviderManager`) and `registration.identity.register(configURL)`. This creates a one-to-one mapping between the IDP config URL and the SW registration, so functional events are only dispatched to workers that have intentionally opted in for that specific provider. (`configURL` is used here because it is the unique identifier for an `IdentityProviderConfig`.) This addresses the semantic mismatch of using the implicit `Match Service Worker Registration` algorithm for internal UA requests that lack a controlled client. It also provides a clear lifecycle: unlinking via `registration.identity.unregister(configURL)`, or implicitly through removal of the parent registration. **Of the options listed here, this is the closest precedent to Payment Handler's shape and the most direct fit for the dispatch primitive Approach C relies on.**

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

### d) Dispatch Shape — `FetchEvent` vs. a Dedicated Event

How should the FedCM credentialed call surface inside the SW? The two shapes under consideration are:

- **Reuse `FetchEvent`.** The browser routes the FedCM internal request through the standard SW dispatch path; the IDP's existing `fetch` handler sees the request (distinguished by `Sec-Fetch-Dest: webidentity` and `request.destination === "webidentity"`) and decides whether to handle it.
- **Introduce a dedicated event** (e.g., `IdentityRequestEvent`). The browser dispatches a purpose-built event the SW must explicitly listen for; SWs that only have a `fetch` handler are not invoked.

The tradeoffs were discussed on the [Chromium service-worker-discuss thread](https://groups.google.com/a/chromium.org/g/service-worker-discuss/c/t9d33x6l718). At a high level:

| Aspect | `FetchEvent` reuse | Dedicated event |
|---|---|---|
| Spec surface | Smallest — a flag flip on `service-workers mode` plus the augmenting-header rules | Larger — new IDL, new dispatch algorithm |
| Opt-in model | Implicit — any SW with a `fetch` handler that happens to match the URL would intercept | Explicit — only SWs that register the new event type participate |
| Risk to deployed SWs | Pre-existing IDP SWs deployed for caching / push / offline would suddenly receive FedCM requests they were not written to handle | None — the new event is invisible to existing handlers |
| Alignment with SW architecture | Concerns raised on the thread that FedCM's request — which has no controlled client and is dispatched to the *destination* origin's SW rather than an *initiating* origin's SW — does not fit standard subresource-fetch semantics, and resembles the deprecated [foreign fetch](https://github.com/whatwg/fetch/issues/506) | A dedicated event makes the unusual dispatch model explicit at the API level rather than overloading `FetchEvent` |
| Reviewer asks | The thread (D. Farolino, B. Kelly) called for a formal spec design doc, Chrome security/privacy review, other-vendor review, and TAG review before reusing `FetchEvent` for this | Largely sidesteps the "is this foreign fetch in disguise?" critique by being a different event entirely |

**Status.** No final decision. The dedicated-event direction is currently captured in [PR #815](https://github.com/w3c-fedid/FedCM/pull/815) and is the shape used in this explainer's examples, but the choice is not settled.

## References

- [FedCM Specification](https://fedidcg.github.io/FedCM/)
- [FedCM Identity Handler section](https://fedidcg.github.io/FedCM/#identity-handler)
- [Spec PR #815 — Enabling IDP Interception in FedCM Request](https://github.com/w3c-fedid/FedCM/pull/815)
- [GitHub Issue #80 — SW interception for FedCM](https://github.com/w3c-fedid/FedCM/issues/80)
- [WG meeting notes (23 Sept 2025) — agreement to pursue SW interception](https://github.com/w3c-fedid/meetings/blob/main/2025/2025-09-23-FedCM-notes.md)
- [Chromium service-worker-discuss thread — FedCM SW interception](https://groups.google.com/a/chromium.org/g/service-worker-discuss/c/t9d33x6l718)
- [Service Worker Specification](https://w3c.github.io/ServiceWorker/)
- [Fetch Specification](https://fetch.spec.whatwg.org/)
- [DPoP (RFC 9449)](https://www.rfc-editor.org/rfc/rfc9449)
- [HTTP Message Signatures (RFC 9421)](https://www.rfc-editor.org/rfc/rfc9421)
- [HTTP Integrity Fields (RFC 9530)](https://www.rfc-editor.org/rfc/rfc9530)
