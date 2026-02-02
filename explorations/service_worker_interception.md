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

## Problem Statement

Identity Providers need to:
- Provide programmable fallback logic during server outages
- Implement custom cache strategies for account data
- Apply client-side rate limiting and fraud detection
- Pre-fetch and actively manage authentication resources

**Key Question**: Can credentialed requests already be cached?

**Yes** - Standard HTTP caching works for credentialed FedCM requests (accounts, token endpoints) when `Cache-Control` headers allow. Browsers cache responses based on these directives.

**Why Service Workers?** Service Workers add **programmable control** beyond passive HTTP caching:

**Critical limitation of HTTP caching**: Standard browser HTTP cache is **passive** - it won't serve cached responses when the network fails. The cache only works when network succeeds and `Cache-Control` headers allow reuse.

**Service Worker capabilities**:
- **Active fallback logic**: Return cached responses when `fetch()` fails (HTTP cache can't do this)
- **Custom strategies**: Stale-while-revalidate, try backup servers, conditional logic based on error type
- **Response modification**: Add metadata like `{offline: true, limited_scope: true}` to responses
- **Active management**: Background sync, pre-fetching, intelligent cache invalidation
- **Custom logic**: Rate limiting, fraud detection, conditional responses based on network state

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
- Result: idp.example's Service Worker can intercept the request
```

**How this works**: When a FedCM request has `service-workers mode: "all"`, the browser checks if a Service Worker is registered for the request URL's origin (`idp.example`). If found, the SW receives a `FetchEvent`. This is similar to how the browser would handle any fetch to that origin when a SW is registered.

The same mechanism applies to other SW-enabled endpoints (`/token`, `/disconnect`), each with their specific request properties as defined in the FedCM specification.

**Important**: FedCM requests are browser-initiated with `client: null`. This means:
- The request has no associated document/window client
- `FetchEvent.clientId` will be empty
- The RP's identity comes from the POST body (`client_id` parameter), not from SW APIs

Per the [W3C Service Worker specification § 2.1](https://w3c.github.io/ServiceWorker/#service-worker-concept), Service Workers execute within a specific origin. Only `idp.example`'s Service Worker can intercept requests to `idp.example`.

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

> **Developer Note**: FedCM requests are browser-initiated with `client: null`, so `FetchEvent.clientId` will be empty. To identify the RP in your Service Worker, read the `client_id` parameter from the POST body of `/token` or `/disconnect` requests—this is standard OAuth/OIDC behavior, unchanged by this proposal.

## Benefits

### Graceful Degradation During IDP Outages

**Scenario**: IDP experiences temporary server issues or undergoes maintenance.

**Without Service Worker**:
- All authentication requests fail immediately
- Users see error messages
- RPs cannot function
- No fallback mechanism

**With Service Worker**:
```javascript
// IDP's Service Worker provides network resilience
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/accounts')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            // Cache successful response for fallback
            caches.open('fedcm-accounts').then(cache => {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        })
        .catch(async () => {
          // Network failed, return cached data with warning header
          const cached = await caches.match(event.request);
          if (cached) {
            // Clone and add warning header
            const headers = new Headers(cached.headers);
            headers.set('X-FedCM-Cached-Fallback', 'true');
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers: headers
            });
          }
          throw new Error('No cached data available');
        })
    );
  }
});
```

**Result**: Improved authentication availability during partial outages.

### Performance Optimization via Caching

**Scenario**: Popular IDP serves millions of authentication requests daily. Account information rarely changes but is fetched on every sign-in.

**With Service Worker**:
```javascript
// IDP's Service Worker uses Cache API
// Per https://w3c.github.io/ServiceWorker/#cache-interface
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/accounts')) {
    event.respondWith(
      caches.open('fedcm-accounts').then(async (cache) => {
        const cached = await cache.match(event.request);

        // Stale-while-revalidate pattern
        if (cached) {
          // Return cached immediately, update in background
          fetch(event.request)
            .then(response => {
              if (response.ok) {
                cache.put(event.request, response.clone());
              }
            })
            .catch(() => { /* Ignore background fetch failures */ });

          return cached;
        }

        // No cache, fetch and cache
        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
  }
});
```

**Benefits**:
- Instant account display for returning users
- Reduced IDP server load
- Better user experience with faster UI

### Custom Token Handling Logic

**Scenario**: Enterprise IDP needs to apply rate limiting or implement fraud detection.

**With Service Worker**:
```javascript
// IDP's Service Worker implements custom logic
self.addEventListener('fetch', async (event) => {
  if (event.request.url.includes('/token')) {
    event.respondWith(
      (async () => {
        const formData = await event.request.clone().formData();
        const clientId = formData.get('client_id');
        const accountId = formData.get('account_id');

        // Client-side rate limiting using IndexedDB
        const rateLimitKey = `ratelimit:${clientId}:${accountId}`;
        const attempts = await getRateLimitCount(rateLimitKey);

        if (attempts > 10) {
          return new Response(JSON.stringify({
            error: 'temporarily_unavailable',
            error_description: 'Too many requests. Please try again later.'
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        await incrementRateLimitCount(rateLimitKey);

        // Forward to server
        return fetch(event.request);
      })()
    );
  }
});
```

**Result**: Reduced server load, faster fraud detection, improved security through client-side checks.

### Pre-fetching and Background Sync

**Scenario**: IDP wants to pre-fetch account information before user initiates sign-in.

**With Service Worker**:
```javascript
// Background sync for account updates
// Per https://w3c.github.io/ServiceWorker/#sync-event
self.addEventListener('sync', (event) => {
  if (event.tag === 'update-accounts') {
    event.waitUntil(
      fetch('/accounts', { credentials: 'include' })
        .then(response => {
          if (response.ok) {
            return caches.open('fedcm-accounts')
              .then(cache => cache.put('/accounts', response));
          }
        })
    );
  }
});
```

**Result**: Faster account selection when user initiates FedCM flow.

## Limitations

### No True Offline Authentication

**Important**: This proposal does **not** enable complete offline authentication. Here's why:

1. Configuration endpoints (`/.well-known/web-identity`, `/config.json`) still bypass Service Workers
2. The FedCM flow requires successful config fetch **before** reaching `/accounts` or `/token`
3. If the network is offline during config fetch, the entire flow fails

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

This means:
- First-time FedCM flows (user never visited IDP) will not benefit from SW caching
- Works best for IDPs with direct user relationships (Google, Microsoft, enterprise IDPs)

## Privacy Considerations

### Why Configuration Endpoints Are Protected

Configuration endpoints (`/.well-known`, `/config.json`, `/client_metadata`) bypass Service Workers for **privacy** reasons, not just security:

**The Privacy Concern**:

Configuration endpoints are fetched with privacy-preserving properties:
- `credentials mode: "omit"` - no cookies sent
- `origin: opaque` - RP origin not revealed
- `referrer policy: "no-referrer"` - no referrer sent

This prevents the IDP from learning which RP is requesting the configuration.

**Example attack**:
```javascript
// Hypothetical malicious SW (if config interception were allowed)
let configRequestTime = null;

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/config.json')) {
    configRequestTime = Date.now();  // Track "anonymous" request
  }

  if (event.request.url.includes('/token')) {
    // Token request reveals user identity
    // Can correlate with earlier config request timing
    // to track which RPs user visits
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

For FedCM requests (which have `client: null`), the browser matches against Service Worker registrations using the **request URL's origin**. Since FedCM requests to `idp.example` target that origin, only `idp.example`'s registered Service Worker can intercept them.

```
✅ idp.example's SW can intercept: Requests TO https://idp.example/token
❌ idp.example's SW cannot intercept: Requests TO https://other-idp.com/token
❌ rp.com's SW cannot intercept: Requests TO https://idp.example/token
```

Note: This is distinct from Service Worker [client control](https://w3c.github.io/ServiceWorker/#control-and-use-window-client), where a SW can only control browsing contexts from its own origin. FedCM requests have no associated browsing context (`client: null`), so client control rules do not apply—only fetch interception based on the request URL's origin.

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
| `/token` | RP's document origin | IDP knows which RP is requesting (required for protocol) |
| `/disconnect` | RP's document origin | IDP knows which RP is requesting |
| `/client_metadata` | RP's document origin | IDP knows which RP is requesting |

### Sec-Fetch-Dest Header

FedCM requests include `Sec-Fetch-Dest: webidentity`, a [forbidden request-header](https://fetch.spec.whatwg.org/#forbidden-header-name) that cannot be set by JavaScript:

> "The requests initiated by the FedCM API have a `webidentity` value for this header. The value cannot be set by random websites, so the [=IDP=] can be confident that the request was originated by the FedCM browser..."

IDPs can use this header to validate that requests genuinely come from the FedCM API.

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

**Security guarantee**: Service Workers cannot bypass SameSite cookie protections.

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

FedCM requests use `client: null` and `service-workers mode: "all"`. This means:
- The request has no associated page/document client
- SW matching uses the request URL's origin
- Only the IDP's registered SW can intercept

This ensures the IDP controls interception of requests to its own endpoints, which is the appropriate trust model.

## Implementation Considerations

### Browser Implementation

1. **Endpoint Classification**: Browser classifies each FedCM request by endpoint type
2. **Service-Workers Mode Setting**:
   - Config endpoints: `service-workers mode: "none"` (bypass SW)
   - Auth endpoints: `service-workers mode: "all"` (allow SW interception)
3. **Fallback**: If no SW is registered or SW doesn't call `respondWith()`, request proceeds normally
4. **Async Operations**: All Service Worker lookups and dispatches are asynchronous

### Developer Experience

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
