# FedCM Service Worker Interception - Explainer

**Authors:**
Suresh Potti (sureshpotti@microsoft.com)

## Participate

https://github.com/w3c-fedid/FedCM/issues/80

## Summary

This document describes how Service Workers can intercept and handle Federated Credential Management (FedCM) network requests, enabling Identity Providers (IDPs) to provide offline support, caching, and custom authentication logic while maintaining security and privacy guarantees.

## Problem Statement

Identity Providers need to:
- Provide authentication services even when the user is offline or has poor connectivity
- Cache user account information to improve performance and reduce latency
- Implement custom logic for token generation, account selection, and error handling
- Pre-fetch and cache authentication resources for better user experience
- Handle temporary IDP server outages gracefully

Currently, FedCM requests bypass Service Workers entirely, preventing IDPs from leveraging modern web capabilities for enhanced authentication flows.

## Proposed Solution

Enable IDPs to register Service Workers that can intercept FedCM requests to specific endpoints, while maintaining security by bypassing Service Workers for configuration and metadata endpoints.

### How It Works

#### 1. Destination-Based Interception (Standard SW Behavior)

When the browser makes a FedCM request from `rp.com` to `idp.example`:

```
Request Properties:
- URL: https://idp.example/token
- Initiator: https://rp.com
- Mode: cors
- Credentials: include

Service Worker Routing:
- Storage Key: StorageKey(idp.example, idp.example)  ← Based on destination
- Result: idp.example's Service Worker intercepts the request
```

**This is standard Service Worker behavior**: Just like `<img src="https://cdn.example/logo.png">` is intercepted by `cdn.example`'s Service Worker (not the page's SW), FedCM requests to `idp.example` are intercepted by `idp.example`'s Service Worker.

#### 2. Selective Endpoint Policy

Not all endpoints can be intercepted. Only authentication-specific endpoints are eligible:

| Endpoint | Interceptable? | Reason |
|----------|---------------|---------|
| `/accounts` | ✅ Yes | User account data - benefits from caching |
| `/token` | ✅ Yes | Token generation - can use custom logic |
| `/disconnect` | ✅ Yes | Account management - can be handled offline |
| `/.well-known/web-identity` | ❌ No | IDP discovery - must be fresh and authentic |
| `/config.json` | ❌ No | Configuration - critical security policy |
| `/client_metadata` | ❌ No | RP metadata - trust requirement |
| `/metrics` | ❌ No | Analytics - should reflect actual usage |

#### 3. RP Identity Flow

**Important**: The RP's identity is **not** communicated through Service Worker client APIs. Instead, it flows through the FedCM protocol itself:

```javascript
// IDP's Service Worker receives:
self.addEventListener('fetch', async (event) => {
  if (event.request.url.includes('/token')) {
    // RP identity is in the POST body, not event.clientId
    const requestData = await event.request.json();
    console.log(requestData.client_id);  // "rp_client_123"
    
    // Service Worker can:
    // - Validate the RP
    // - Return cached tokens
    // - Generate tokens with custom logic
    // - Handle errors gracefully
    
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
});
```

**Note**: `event.clientId` would reference the RP's browser client (cross-origin context), but FedCM doesn't use this. The RP identifier comes from the `client_id` parameter in the POST body, which the Service Worker can access via `request.json()` or `request.formData()`.

## Benefits

### Offline Authentication Support

**Scenario**: User has previously signed in to multiple websites using their IDP account. Later, they lose internet connectivity but need to access a website.

**Without Service Worker**:
- Browser cannot reach IDP servers
- Authentication fails
- User is blocked from accessing the website

**With Service Worker**:
```javascript
// IDP's Service Worker
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/accounts')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Network failed, return cached accounts
          return caches.match(event.request);
        })
    );
  }
  
  if (event.request.url.includes('/token')) {
    event.respondWith(
      fetch(event.request)
        .catch(async () => {
          // Generate offline token with limited validity
          const requestData = await event.request.formData();
          return new Response(JSON.stringify({
            token: await generateOfflineToken(requestData),
            offline: true,
            expires_in: 3600
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
  }
});
```

**Result**: User can authenticate even offline, enabling access to cached content and limited functionality.

### Performance Optimization via Caching

**Scenario**: Popular IDP serves millions of authentication requests daily. Account information rarely changes but is fetched on every sign-in.

**Without Service Worker**:
- Every authentication requires a network round-trip to fetch accounts
- Average latency: 200-500ms
- Poor user experience on slow connections

**With Service Worker**:
```javascript
// IDP's Service Worker
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/accounts')) {
    event.respondWith(
      caches.open('fedcm-accounts').then(async (cache) => {
        const cached = await cache.match(event.request);
        
        // Stale-while-revalidate pattern
        if (cached) {
          // Return cached immediately
          const freshResponse = fetch(event.request)
            .then(response => {
              cache.put(event.request, response.clone());
              return response;
            });
          
          return cached;
        }
        
        // No cache, fetch and cache
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      })
    );
  }
});
```

**Result**: 
- First request: 200-500ms (network)
- Subsequent requests: <50ms (cache)
- Background refresh keeps data fresh

### Graceful Degradation During IDP Outages

**Scenario**: IDP experiences temporary server issues or undergoes maintenance.

**Without Service Worker**:
- All authentication requests fail
- Users see error messages
- RPs cannot function
- Customer support overwhelmed

**With Service Worker**:
```javascript
// IDP's Service Worker
const BACKUP_ACCOUNTS_ENDPOINT = 'https://backup.idp.example/accounts';

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/accounts')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response.ok) {
            // Primary server error, try backup
            return fetch(BACKUP_ACCOUNTS_ENDPOINT);
          }
          return response;
        })
        .catch(() => {
          // Both servers failed, return cached data with warning
          return caches.match(event.request)
            .then(cached => {
              if (cached) {
                return new Response(cached.body, {
                  ...cached,
                  headers: {
                    ...cached.headers,
                    'X-Cached-Fallback': 'true',
                    'X-Warning': 'IDP temporarily unavailable'
                  }
                });
              }
              throw new Error('No cached data available');
            });
        })
    );
  }
});
```

**Result**: 99.9% authentication availability even during partial outages.

### Progressive Web App (PWA) Integration

**Scenario**: IDP provides a PWA that users install. The PWA should work offline and provide seamless authentication.

**Without Service Worker**:
- PWA cannot authenticate users offline
- Limited offline functionality
- Poor user experience

**With Service Worker**:
```javascript
// IDP's Service Worker (shared between PWA and FedCM)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle both PWA navigation and FedCM requests
  if (url.pathname === '/accounts') {
    event.respondWith(
      // Use IndexedDB for more sophisticated caching
      getAccountsFromIndexedDB()
        .then(accounts => {
          if (accounts && accounts.length > 0) {
            return new Response(JSON.stringify({ accounts }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return fetch(event.request)
            .then(response => {
              // Update IndexedDB in background
              response.clone().json().then(saveAccountsToIndexedDB);
              return response;
            });
        })
    );
  }
});
```

**Result**: Consistent authentication experience between PWA usage and third-party RP authentication.

### Custom Token Generation Logic

**Scenario**: Enterprise IDP needs to generate different token types based on RP requirements, apply rate limiting, or implement fraud detection.

**Without Service Worker**:
- All logic must be server-side
- Difficult to implement client-side rate limiting
- Cannot leverage client-side cryptography

**With Service Worker**:
```javascript
// IDP's Service Worker
self.addEventListener('fetch', async (event) => {
  if (event.request.url.includes('/token')) {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const clientId = formData.get('client_id');
        const accountId = formData.get('account_id');
        
        // Client-side rate limiting
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
        
        // Increment rate limit counter
        await incrementRateLimitCount(rateLimitKey);
        
        // Check if RP requires special token format
        const rpConfig = await getRPConfiguration(clientId);
        
        if (rpConfig.tokenFormat === 'jwt') {
          // Generate JWT client-side using Web Crypto API
          const token = await generateJWTToken(accountId, clientId, rpConfig);
          return new Response(JSON.stringify({ token }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Default: forward to server
        return fetch(event.request);
      })()
    );
  }
});
```

**Result**: Reduced server load, faster token generation, improved security through client-side checks.

### Pre-fetching and Background Sync

**Scenario**: IDP wants to pre-fetch account information and credentials before user initiates sign-in.

**With Service Worker**:
```javascript
// IDP's Service Worker
self.addEventListener('message', (event) => {
  if (event.data.type === 'PREFETCH_ACCOUNTS') {
    // Pre-fetch and cache account data
    const accountsUrl = new URL('/accounts', self.location.origin);
    fetch(accountsUrl, { credentials: 'include' })
      .then(response => caches.open('fedcm-accounts'))
      .then(cache => cache.put(accountsUrl, response));
  }
});

// Background sync for account updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'update-accounts') {
    event.waitUntil(
      fetch('/accounts', { credentials: 'include' })
        .then(response => {
          return caches.open('fedcm-accounts')
            .then(cache => cache.put('/accounts', response));
        })
    );
  }
});
```

**Result**: Instant account selection when user initiates FedCM flow.

## Privacy and Security Considerations

### Privacy Impact

**IDP Sees All RP Requests (Acceptable)**

The IDP's Service Worker runs in a single instance and sees requests from all RPs:

```javascript
// Single IDP Service Worker instance sees:
// - POST /token (from rp1.com)
// - POST /token (from rp2.com)
// - POST /token (from rp3.com)
```

**Privacy analysis**: 
- This matches the current FedCM model where IDP servers see all RP requests
- No worse than traditional OAuth where IDP servers log all authentication attempts
- Service Workers have same privacy characteristics as IDP backend servers
- User consent is still required before any tokens are issued

### Security Impact

**Origin Isolation (Maintained)**

Service Workers can **only** intercept requests to their own origin. This is enforced by the browser's Service Worker infrastructure:

```
✅ idp.example's SW can intercept: https://idp.example/token
❌ idp.example's SW cannot intercept: https://other-idp.com/token
❌ rp.com's SW cannot intercept: https://idp.example/token
```

**Security guarantee**: No cross-origin interception is possible.

**Configuration Endpoint Protection**

Critical configuration endpoints (`/.well-known`, `/config.json`, `/client_metadata`) **bypass Service Workers entirely**:

```javascript
// Browser-side routing logic
if (endpointType === 'well-known' || 
    endpointType === 'config' || 
    endpointType === 'client_metadata') {
  // Use SimpleURLLoader - direct to network, no SW
  useNetworkDirectly();
} else {
  // Check for Service Worker
  checkServiceWorkerAndIntercept();
}
```

**Security guarantee**: Trust relationships and security policies cannot be manipulated by Service Workers.

**Redirect Prevention**

Service Worker responses that attempt to redirect are rejected:

```cpp
// In FedCmServiceWorkerURLLoader
if (response.url_list.size() > 1) {
  // Response included redirects
  client->OnComplete(net::ERR_UNSAFE_REDIRECT);
  return;
}
```

**Security guarantee**: Token theft via redirect attacks is prevented.

**URL Validation**

Response URL must exactly match request URL:

```cpp
if (response_url != request_url) {
  client->OnComplete(net::ERR_INVALID_RESPONSE);
  return;
}
```

**Security guarantee**: Service Workers cannot serve responses for different origins or paths.

**SameSite Cookie Filtering (Maintained)**

Cross-origin requests still enforce SameSite cookie restrictions:

```cpp
// Cross-origin FedCM request
resource_request->credentials_mode = CredentialsMode::kInclude;  // Permission to try
resource_request->site_for_cookies = net::SiteForCookies();      // Empty = cross-origin

// Browser enforces SameSite filtering:
// - SameSite=Strict cookies → Blocked
// - SameSite=Lax cookies   → Blocked  
// - SameSite=None; Secure  → Allowed
```

**Security guarantee**: Service Workers cannot bypass SameSite cookie protections.

## Examples

### IDP Service Worker Registration

```javascript
// On https://idp.example - register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/fedcm-sw.js', {
    scope: '/'
  });
}
```

### IDP Service Worker Implementation

```javascript
// /fedcm-sw.js
const CACHE_NAME = 'fedcm-cache-v1';
const ACCOUNTS_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache critical resources
      return cache.addAll([
        '/accounts',
        '/static/avatar-default.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle /accounts endpoint
  if (url.pathname === '/accounts' && event.request.method === 'GET') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        
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
          const response = await fetch(event.request);
          
          if (response.ok) {
            // Update cache
            cache.put(event.request, response.clone());
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
      })()
    );
    return;
  }
  
  // Handle /token endpoint
  if (url.pathname === '/token' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          // Always try network first for tokens
          const response = await fetch(event.request);
          return response;
        } catch (error) {
          // Network failed - could implement offline token generation
          console.error('FedCM: Token request failed', error);
          
          return new Response(JSON.stringify({
            error: 'temporarily_unavailable',
            error_description: 'IDP temporarily unavailable. Please try again.'
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
    return;
  }
  
  // Handle /disconnect endpoint
  if (url.pathname === '/disconnect' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request);
          
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
      })()
    );
    return;
  }
  
  // All other requests: pass through to network
  event.respondWith(fetch(event.request));
});

self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('fedcm-cache-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});
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

## Design Decisions and Alternatives Considered

### Why Selective Endpoint Interception?

**Rejected Alternative**: Allow Service Workers for all endpoints.

**Decision Rationale**: Configuration endpoints must remain trustworthy and unmodified to maintain security guarantees. Only authentication-specific endpoints benefit from Service Worker capabilities without compromising trust relationships.

### Why Destination-Based Interception?

**Decision Rationale**: This follows standard Service Worker behavior. Just like `<img src="https://cdn.example/logo.png">` is intercepted by `cdn.example`'s Service Worker, FedCM requests to `idp.example` are intercepted by `idp.example`'s Service Worker. No new concepts are introduced to the platform.

### Why Not Communicate RP Identity via Service Worker APIs?

**Decision Rationale**: The RP's identity flows through the FedCM protocol itself (via `client_id` in request bodies), not through Service Worker client APIs. This maintains consistency with existing OAuth/OIDC patterns and avoids introducing new cross-origin communication channels.

### Rejected Alternatives Summary

1. **Allow Service Workers for All Endpoints**: Rejected - Configuration endpoints must remain trustworthy and unmodified
2. **Use WebTransport or WebSockets**: Rejected - Doesn't provide offline support or caching capabilities
3. **Browser-Managed Cache**: Rejected - Less flexible than Service Worker, harder to customize, no offline logic support
4. **Require Service Worker to Signal Intent**: Rejected - Adds complexity. Standard Service Worker registration is sufficient

## Implementation Considerations

### Browser Implementation

1. **Endpoint Classification**: Browser classifies each FedCM request by endpoint type
2. **Conditional Routing**: 
   - Config endpoints → Direct to network (SimpleURLLoader)
   - Auth endpoints → Check for Service Worker → SW or fallback to network
3. **Fallback**: If Service Worker lookup fails or SW doesn't handle the request, automatically fall back to network
4. **Async Operations**: All Service Worker lookups and dispatches are asynchronous to avoid blocking

### Developer Experience

**IDP developers** can opt-in by:
1. Registering a Service Worker with appropriate scope
2. Implementing `fetch` event handlers for `/accounts`, `/token`, `/disconnect`
3. Using standard Service Worker APIs (Cache API, IndexedDB, Fetch API)

**RP developers**: No changes required. Transparent to RPs.
