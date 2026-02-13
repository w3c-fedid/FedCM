# FedCM Service Worker Interception - Explainer

**Authors:**
Suresh Potti (sureshpotti@microsoft.com)

## Participate

https://github.com/w3c-fedid/FedCM/issues/80

## Summary

This document describes how Service Workers can intercept and handle Federated Credential Management (FedCM) network requests, enabling Identity Providers (IDPs) to provide caching, graceful degradation during outages, and custom authentication logic while maintaining security and privacy guarantees.

## Status

This explainer documents a **proposed change** to the FedCM specification. The current FedCM spec sets `service-workers mode: "none"` for all requests. This proposal changes select endpoints to use `service-workers mode: "all"`, enabling IDP Service Worker interception.

**Proposed Spec Changes:**

| Endpoint | Current Spec | Proposed |
|----------|-------------|----------|
| `/accounts` | `service-workers mode: "none"` | `service-workers mode: "all"` |
| `/token` (id_assertion_endpoint) | `service-workers mode: "none"` | `service-workers mode: "all"` |
| `/disconnect` | `service-workers mode: "none"` | `service-workers mode: "all"` |
| `/.well-known/web-identity` | `service-workers mode: "none"` | No change |
| `/config.json` | `service-workers mode: "none"` | No change |
| `/client_metadata` | `service-workers mode: "none"` | No change |

> **Important Distinction - IDP vs RP Interception**: Traditional `service-workers mode: "all"` allows the **page's** Service Worker (the RP's SW) to intercept subresource fetches. However, FedCM requests are browser-initiated with `client: null` (no document context), so there is no "page SW" to intercept them. Instead, the browser matches against Service Worker registrations using the **request URL's origin** (the IDP). This means the **IDP's** — not the RP's — Service Worker intercepts requests to IDP endpoints.

## Problem Statement

Based on IDP feedback documented in [GitHub Issue #80](https://github.com/w3c-fedid/FedCM/issues/80), Identity Providers need programmable control over FedCM requests. Specific use cases raised by Microsoft's Identity team include:

- **Multi-domain failover**: Route requests to backup servers when primary IDP infrastructure fails
- **Token caching during outages**: Graceful degradation when IDP servers are temporarily unavailable
- **Geographic routing**: Direct requests to regional/sovereign identity services based on user location
- **Request signing (DPoP)**: Add proof-of-possession assertions to prevent token theft
- **Legacy system integration**: Wrap non-FedCM identity services with FedCM-compatible interfaces

The core motivation (from Issue #80): *"Bearer tokens have an inherent problem that they can be stolen - token theft being at the core of so many security incidents."* Service Worker interception enables IDPs to implement stronger security patterns beyond what passive HTTP caching provides.

**Key Question**: Can credentialed requests already be cached?

**Yes** - Standard HTTP caching works for credentialed FedCM requests (accounts, token endpoints) when `Cache-Control` headers allow. Browsers cache responses based on these directives.

**Why Service Workers?** Service Workers add **programmable control** beyond passive HTTP caching:

**Critical limitation of HTTP caching**: Standard browser HTTP cache handles fresh (non-expired) content correctly, but has a gap with stale content during network failures:

| Scenario | HTTP Cache Behavior | Service Worker Can Help? |
|----------|---------------------|--------------------------|
| Fresh cache (not expired) | ✅ Serves from cache | Not needed |
| Stale cache + network available | ✅ Revalidates with server | Not needed |
| Stale cache + network fails | ❌ Returns network error | ✅ Can serve stale content |
| No cache + network fails | ❌ Returns network error | ✅ Can return graceful error |

The key gap is the third scenario: when cached content has expired and the browser attempts revalidation, but the network is unavailable, the browser returns a network error rather than serving the stale content. Service Workers enable "stale-if-error" behavior that HTTP caching alone doesn't provide.

> **Caveat for FedCM**: The above applies to individual requests. In FedCM, `/.well-known` and `/config.json` are precursor requests that must succeed before `/accounts`, `/token`, or `/disconnect` can be made. Under the current proposal, these config endpoints bypass SW. This means SW only helps with **partial outages** (config servers reachable, auth servers down). To enable true network-failure resilience, SW interception would need to be allowed on `/.well-known` and `/config.json` as well—while keeping `/client_metadata` blocked to preserve privacy (since it contains RP identity).

**Service Worker capabilities**:
- **Request signing (DPoP)**: Add proof-of-possession assertions to prevent token theft
- **Active fallback logic**: Return cached responses when `fetch()` fails (HTTP cache can't do this)
- **Custom strategies**: Retry logic, try backup servers, conditional logic based on error type

Currently, FedCM requests bypass Service Workers entirely (`service-workers mode: "none"`), preventing IDPs from leveraging these programmable capabilities.

## Proposed Solution

Enable IDPs to register Service Workers that can intercept FedCM requests to authentication endpoints (`/accounts`, `/token`, `/disconnect`), while maintaining privacy by bypassing Service Workers for configuration and metadata endpoints.

### How It Works

#### 1. Service Worker Interception for FedCM Requests

The browser mediates all FedCM requests between the Relying Party (RP) and Identity Provider (IDP). During a FedCM flow initiated on `rp.com` using `idp.example` as the identity provider, the browser makes several requests to IDP endpoints. Below we examine the `/accounts` endpoint request as an example of Service Worker interception:

```
Example: /accounts endpoint request

Request Properties:
- URL: https://idp.example/accounts
- Method: GET
- Mode: no-cors
- Credentials: include
- Origin: opaque (privacy-preserving)
- Destination: webidentity
- Service-Workers Mode: "all" (proposed change)
- Client: null

Service Worker Matching:
- With service-workers mode: "all" and client: null, the browser
  matches against Service Worker registrations for the request URL's origin
  (per Handle Fetch [§ 9.5](https://w3c.github.io/ServiceWorker/#handle-fetch)
  and Match Service Worker Registration [§ 8.4](https://w3c.github.io/ServiceWorker/#scope-match-algorithm))
- Result: idp.example's Service Worker can intercept the request
```

**How this works**: When a FedCM request has `service-workers mode: "all"` and `client: null`, the browser matches against Service Worker registrations using the request URL's origin (`idp.example`). If a SW is registered for that origin, it receives a `FetchEvent`. (See [Spec coordination note](#spec-coordination-note) below regarding required changes to the Handle Fetch algorithm.)

The same mechanism applies to other SW-enabled endpoints (`/token`, `/disconnect`), each with their specific request properties as defined in the FedCM specification.

**Important**: FedCM requests are browser-initiated with `client: null`. This means:
- The request has no associated document/window client
- `FetchEvent.clientId` will be empty
- For `/token` and `/disconnect` (POST requests), the RP's identity comes from the POST body (`client_id` parameter), not from SW APIs
- For `/accounts` (GET request), the RP's identity is not available — the IDP intentionally doesn't know which RP is requesting until user consent

**Why does the IDP's SW intercept (not the RP's)?** In general, a Service Worker can intercept cross-origin requests made by pages it controls. However, FedCM requests have `client: null` — there's no associated page, so there's no "page's active SW" to intercept. This proposal specifies that the browser matches based on the request URL's origin, which is why `idp.example`'s SW intercepts requests to `idp.example`.

> <a id="spec-coordination-note"></a>**Spec coordination note**: The current SW spec's [Handle Fetch algorithm](https://w3c.github.io/ServiceWorker/#handle-fetch) defines SW matching for navigations (match by request URL's origin) and subresource requests (use client's active SW). FedCM requests are neither—they are browser-initiated with `client: null` but are not navigations. This proposal requires the Handle Fetch algorithm to be extended with a new category that matches non-navigation requests with `client: null` and `service-workers mode: "all"` based on the request URL's origin.

> **Note**: If the RP has its own Service Worker registered, it will **not** intercept FedCM requests. The RP's SW only intercepts requests made by pages it controls. Since FedCM requests are browser-initiated (`client: null`), they bypass the RP's SW entirely - there is no conflict between RP and IDP Service Workers.

#### 2. Selective Endpoint Policy

Not all endpoints allow Service Worker interception. This is enforced via `service-workers mode`:

| Endpoint | SW Interception | service-workers mode | Reason |
|----------|----------------|---------------------|--------|
| `/accounts` | Allowed | `"all"` | User account data - benefits from caching |
| `/token` | Allowed | `"all"` | Token generation - can use custom logic |
| `/disconnect` | Allowed | `"all"` | Account management - graceful error handling |
| `/.well-known/web-identity` | Blocked | `"none"` | IDP discovery - privacy protection |
| `/config.json` | Blocked | `"none"` | Configuration - privacy protection |
| `/client_metadata` | Blocked | `"none"` | RP metadata - privacy protection |
| `/picture` | Blocked | `"none"` | Profile images - not authentication-critical |

**Why are configuration endpoints protected?** See [Privacy Considerations](#privacy-considerations) below.

> **Developer Note**: FedCM requests are browser-initiated with `client: null`, so `FetchEvent.clientId` will be empty. To identify the RP in your Service Worker, read the `client_id` parameter from the POST body of `/token` or `/disconnect` requests — this is standard OAuth/OIDC behavior, unchanged by this proposal. Note that the `/accounts` endpoint (GET request) intentionally does not include RP identity — this is a privacy protection so the IDP cannot track which RPs a user visits before the user grants consent.

## Benefits

### Graceful Degradation During IDP Outages

**Scenario**: IDP experiences temporary server issues or undergoes maintenance.

**Without Service Worker**:
- Authentication requests fail if response is not cached or cache has expired
- Users see error messages
- RPs cannot function
- No fallback mechanism for expired cache

**With Service Worker**:
```javascript
// IDP's Service Worker provides network resilience for both endpoints
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle /accounts - cache for fallback
  if (url.pathname === '/accounts') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            caches.open('fedcm-accounts').then(cache => {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        })
        .catch(async () => {
          // Network failed, return cached accounts if available
          const cached = await caches.match(event.request);
          if (cached) return cached;
          throw new Error('No cached accounts available');
        })
    );
    return;
  }

  // Handle /token - retry logic and graceful error
  // (Cannot cache tokens due to nonce requirement)
  if (url.pathname === '/token') {
    event.respondWith(
      fetch(event.request)
        .catch(async () => {
          // Retry once after short delay
          await new Promise(r => setTimeout(r, 1000));
          return fetch(event.request);
        })
        .catch(() => {
          // Both attempts failed - return structured error
          return new Response(JSON.stringify({
            error: 'temporarily_unavailable',
            error_description: 'IDP temporarily unavailable. Please try again.'
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
});
```

**Result**: Complete resilience story - cached accounts for display, retry logic and graceful errors for token requests. This handles partial outages and transient failures across the full authentication flow.

## Limitations

### No True Offline Authentication

**Important**: This proposal does **not** enable complete offline authentication. Here's why:

1. Configuration endpoints (`/.well-known/web-identity`, `/config.json`) still bypass Service Workers
2. The FedCM flow requires successful config fetch **before** reaching `/accounts` or `/token`
3. If the network is offline during config fetch and the response is not cached or has expired, the entire flow fails

**What SW enables**:
- Fallback during **partial** outages (auth servers down, but network available)
- Caching for improved performance when online
- Graceful error handling

**What SW does NOT enable**:
- Complete offline authentication
- Bypassing the config/well-known fetch requirement

### Service Worker Must Be Pre-Registered

For the IDP's Service Worker to intercept FedCM requests:
1. User must have **previously** visited `https://idp.example`
2. The SW must be **installed and activated**
3. Only then can subsequent FedCM requests be intercepted

In practice, this is not a significant limitation because users must have already visited the IDP to create an account and log in initially. The SW gets registered during that first visit, enabling interception for all subsequent FedCM flows.

## Privacy Considerations

### Why Configuration Endpoints Are Protected

Configuration endpoints (`/.well-known`, `/config.json`, `/client_metadata`) bypass Service Workers for **privacy** reasons:

**The Privacy Concern**:

Configuration endpoints are fetched with privacy-preserving properties:
- `credentials mode: "omit"` - no cookies sent
- `origin: opaque` - RP origin not revealed
- `referrer policy: "no-referrer"` - no referrer sent

This prevents the IDP from learning which RP is requesting the configuration.

**Example attack** (if config interception were allowed):
```javascript
// Hypothetical malicious SW intercepting /client_metadata
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/client_metadata')) {
    // client_metadata URL contains RP identity in the client_id parameter
    const url = new URL(event.request.url);
    const rpOrigin = url.searchParams.get('client_id');

    // Make a NEW credentialed request to IDP's tracking endpoint
    // This links: user identity (via cookies) + RP they're visiting
    fetch('https://idp.example/track', {
      method: 'POST',
      credentials: 'include',  // Includes user's IDP session cookies
      body: JSON.stringify({ rp: rpOrigin })
    });

    // Forward original request normally
    return fetch(event.request);
  }
});
```

**Solution**: By keeping config endpoints with `service-workers mode: "none"`, the privacy guarantees are maintained.

### IDP Service Worker Sees All RP Requests

The IDP's Service Worker runs in a single instance and sees all interceptable FedCM requests from all RPs:

```javascript
// Single IDP Service Worker instance sees all SW-enabled endpoint requests:

// /accounts requests (GET, no RP identity visible - opaque origin):
// - GET /accounts (user browsing rp1.com - origin opaque)
// - GET /accounts (user browsing rp2.com - origin opaque)
// - GET /accounts (user browsing rp3.com - origin opaque)

// /token requests (POST, RP identity in body):
// - POST /token { client_id: "rp1.com", account_id: "user123" }
// - POST /token { client_id: "rp2.com", account_id: "user123" }
// - POST /token { client_id: "rp3.com", account_id: "user456" }

// /disconnect requests (POST, RP identity in body):
// - POST /disconnect { client_id: "rp1.com", account_id: "user123" }
// - POST /disconnect { client_id: "rp2.com", account_id: "user456" }
```

**Privacy analysis**:
- This matches the current FedCM model where IDP servers see all RP requests
- No worse than traditional OAuth where IDP servers log all authentication attempts
- Service Workers have the same visibility as IDP backend servers
- User consent is still required before any tokens are issued

## Security Considerations

### Origin Isolation

For FedCM requests (which have `client: null`), this proposal specifies that the browser matches against Service Worker registrations using the **request URL's origin**. Since FedCM requests to `idp.example` target that origin, only `idp.example`'s registered Service Worker can intercept them. (This requires extending the Handle Fetch algorithm—see [Spec coordination note](#spec-coordination-note) above.)

```
✅ idp.example's SW can intercept: Requests TO https://idp.example/token
❌ idp.example's SW cannot intercept: Requests TO https://other-idp.com/token
❌ rp.com's SW cannot intercept: Requests TO https://idp.example/token
```

Note: For normal page-initiated requests, a SW intercepts fetches made by browsing contexts it controls—and a SW only controls browsing contexts from [its own origin](https://w3c.github.io/ServiceWorker/#control-and-use-window-client) (the client's origin is the browsing context's origin, not the resource's origin). However, FedCM requests have no associated browsing context (`client: null`), so no SW has client control over them. This proposal specifies that for such requests, the browser matches based on the request URL's origin.

**Security guarantee**: Cross-origin Service Worker interception is architecturally impossible.

### Redirect Prevention

FedCM requests are created with `redirect mode: "error"`:

```
:  [=request/redirect mode=]
:: "error"
```

This means:
- If the server returns a redirect, the request fails
- Service Workers cannot redirect FedCM requests to different URLs
- Token theft via redirect attacks is prevented

### Request Origin Handling

FedCM requests use different `origin` values depending on the endpoint:

| Endpoint | Origin Value | Privacy Implication |
|----------|-------------|---------------------|
| `/.well-known` | Opaque origin | IDP cannot identify requesting RP |
| `/config.json` | Opaque origin | IDP cannot identify requesting RP |
| `/accounts` | Opaque origin | IDP cannot identify requesting RP |
| `/token` | RP's document origin | IDP must know RP to issue scoped token |
| `/disconnect` | RP's document origin | IDP must know RP to remove account link |
| `/client_metadata` | RP's document origin | IDP must know RP to fetch its metadata |

### Sec-Fetch-Dest Header

FedCM requests include `Sec-Fetch-Dest: webidentity`, a [forbidden request-header](https://fetch.spec.whatwg.org/#forbidden-header-name) that cannot be set by JavaScript, including in Service Workers:

> "The requests initiated by the FedCM API have a `webidentity` value for this header. The value cannot be set by random websites, so the [=IDP=] can be confident that the request was originated by the FedCM browser..."

IDPs can use this header to validate that requests genuinely come from the FedCM API.

> **Spec coordination note**: With this proposal, Service Workers can observe the `webidentity` destination via `event.request.destination`. The [Fetch spec note on destination types](https://fetch.spec.whatwg.org/#ref-for-destination-type) should be updated to reflect that `webidentity` is now exposed to JavaScript in Service Worker context. While SWs can **read** this value, they still cannot **set** it (it remains a forbidden header).

### SameSite Cookie Filtering

Cross-origin FedCM requests enforce SameSite cookie restrictions:

```
// FedCM request properties
credentials mode: "include"     // Permission to try sending cookies
site_for_cookies: (empty)       // Cross-site request

// Browser enforces SameSite filtering:
// - SameSite=Strict cookies -> Blocked
// - SameSite=Lax cookies    -> Blocked
// - SameSite=None; Secure   -> Allowed
```

**Note on SW behavior**: When a Service Worker **forwards** the original FedCM request via `fetch(event.request)`, the cross-site context is preserved and SameSite restrictions apply. However, if the SW creates a **new** request to its own origin (e.g., `fetch('https://idp.example/token')`), that request would be same-site and could include SameSite=Strict cookies. This is expected behavior—the SW is making a first-party request to its own origin, which is permitted.

## Examples

### IDP Service Worker Registration

```javascript
// On https://idp.example - register Service Worker
// Per https://w3c.github.io/ServiceWorker/#navigator-service-worker-register
//
// Note: This must happen when user visits IDP directly.
// The SW will then be available for subsequent FedCM requests.

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/fedcm-sw.js', {
    scope: '/'
  }).then(registration => {
    console.log('FedCM SW registered:', registration.scope);
  });
}
```

### IDP Service Worker Implementation

```javascript
// /fedcm-sw.js
// Implements fetch event handling per https://w3c.github.io/ServiceWorker/#fetchevent-interface

const CACHE_NAME = 'fedcm-cache-v1';
const ACCOUNTS_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('fedcm-cache-') && name !== CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests to FedCM endpoints
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle /accounts endpoint (GET)
  if (url.pathname === '/accounts' && event.request.method === 'GET') {
    event.respondWith(handleAccountsRequest(event.request));
    return;
  }

  // Handle /token endpoint (POST)
  if (url.pathname === '/token' && event.request.method === 'POST') {
    event.respondWith(handleTokenRequest(event.request));
    return;
  }

  // Handle /disconnect endpoint (POST)
  if (url.pathname === '/disconnect' && event.request.method === 'POST') {
    event.respondWith(handleDisconnectRequest(event.request));
    return;
  }
});

async function handleAccountsRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Check cache freshness
  if (cached) {
    const cachedTime = new Date(cached.headers.get('date')).getTime();
    const now = Date.now();

    if (now - cachedTime < ACCOUNTS_CACHE_TIME) {
      // Cache is fresh, return immediately
      console.log('FedCM: Returning cached accounts');
      return cached;
    }
  }

  // Cache miss or stale, fetch from network
  try {
    const response = await fetch(request);

    if (response.ok) {
      // Update cache
      cache.put(request, response.clone());
      console.log('FedCM: Fetched and cached accounts');
    }

    return response;
  } catch (error) {
    // Network failed, return stale cache if available
    if (cached) {
      console.log('FedCM: Network failed, returning stale cache');
      return cached;
    }
    throw error;
  }
}

async function handleTokenRequest(request) {
  try {
    // Always try network first for tokens
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Network failed - return error response
    console.error('FedCM: Token request failed', error);

    return new Response(JSON.stringify({
      error: 'temporarily_unavailable',
      error_description: 'IDP temporarily unavailable. Please try again.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDisconnectRequest(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      // Clear account cache on successful disconnect
      const cache = await caches.open(CACHE_NAME);
      await cache.delete('/accounts');
      console.log('FedCM: Cleared account cache after disconnect');
    }

    return response;
  } catch (error) {
    console.error('FedCM: Disconnect request failed', error);
    throw error;
  }
}
```

### RP Integration (No Changes Required)

```javascript
// On https://rp.com - standard FedCM API usage
const credential = await navigator.credentials.get({
  identity: {
    providers: [{
      configURL: "https://idp.example/config.json",
      clientId: "rp_client_123",
      nonce: "random_nonce_value"
    }]
  }
});

// Token is returned regardless of whether Service Worker was involved
console.log('Received token:', credential.token);
```

**Key point**: RPs don't need to know or care whether the IDP uses Service Workers. The FedCM API contract remains unchanged.

## Design Decisions

### Why This Approach to SW Matching?

FedCM requests use `client: null` and `service-workers mode: "all"`. This proposal specifies:
- The request has no associated page/document client
- SW matching uses the request URL's origin (requires Handle Fetch algorithm extension—see [Spec coordination note](#spec-coordination-note))
- Only the IDP's registered SW can intercept

This ensures the IDP controls interception of requests to its own endpoints, which is the appropriate trust model.

## Developer Experience

**IDP developers** can opt-in by:
1. Registering a Service Worker with appropriate scope on their origin
2. Implementing `fetch` event handlers for `/accounts`, `/token`, `/disconnect`
3. Using standard Service Worker APIs (Cache API, IndexedDB, Fetch API)

**RP developers**: No changes required. Transparent to RPs.

## References

- [FedCM Specification](https://fedidcg.github.io/FedCM/)
- [Service Worker Specification](https://w3c.github.io/ServiceWorker/)
- [Fetch Specification](https://fetch.spec.whatwg.org/)
- [GitHub Issue #80](https://github.com/w3c-fedid/FedCM/issues/80)
