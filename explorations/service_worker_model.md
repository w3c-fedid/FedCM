# FedCM Service Worker Registration and Lifecycle Model
The FedCM Identity Handler proposal is still evolving. This document proposes a service worker registration and lifecycle model designed for production-scale deployment and resilience.

## Scenarios Considered
This proposal considers the following scenarios.

#### Long-Lived User Sessions
After a user interactively signs in, the IdP session may remain valid for an extended period. For example, Microsoft Entra may allow a user session to remain valid for up to 90 days, depending on tenant policy. During this period, FedCM may continue making credentialed accounts and identity assertion/token requests without requiring the user to interact with an IdP-hosted sign-in page.

#### Bad Rollout
A high-severity defect in the service worker could affect credentialed FedCM requests for a large number of users. FedCM should support bypassing or disabling the service worker, or fetching an updated service worker script, without relying on the user revisiting an IdP page.

#### Staged Rollout
IdPs generally follow safe deployment mechanisms where changes are rolled out gradually, for example, to 1%, 5%, 20%, and eventually 100% of clients. The design must allow the IdP to continue using its existing deployment and rollback strategy for the service worker script.

#### Eviction
The user may remove the service worker registration, for example through storage eviction or site-data clearing. FedCM should support re-registering the declared service worker when it is needed again, and should support unregistering the service worker when the IdP removes the declaration from the well-known file.


## Registration
The IdP declares a FedCM-specific service worker in `/.well-known/web-identity`.

```json
{
  "provider_urls": [
    "https://idp.example/fedcm/config.json"
  ],
  "identity_handler": {
    "service_worker": "/fedcm/sw.js",
    "scope": "/fedcm/",
    "enabled": true
  }
}
```

The presence of `identity_handler` indicates that the IdP has a service worker that should be registered and used for credentialed FedCM requests.

When FedCM is invoked, the user agent checks the `identity_handler` declaration in the well-known file to determine which service worker registration should be used. If a matching service worker is already registered for the IdP origin, declared scope, and declared script URL, FedCM does not register it again, but still runs the Soft Update behavior described below. If no matching registration exists, FedCM registers the declared service worker in the IdP's origin and declared scope.

FedCM managed registration fits the use case because FedCM is the component making credentialed requests to the IdP. It can ensure that the required service worker is registered immediately before it is needed, without depending on JavaScript running on an IdP page that may not be visited for several weeks or months.

## Service Worker Update Model
This approach supports bad-rollout recovery and aspects of staged rollout by separating registration from freshness checks. FedCM should not re-register the service worker every time the FedCM API is invoked. Instead, when a matching registration already exists, FedCM should initiate a Service Worker Soft Update in parallel during every FedCM API invocation.

The high-level update flow is:

```text
On each FedCM API invocation:
  If no matching service worker registration exists:
    Register the service worker declared in identity_handler and wait for registration to complete.
  Otherwise:
    Use the currently active service worker for the FedCM request that caused this invocation.
    Initiate a Soft Update for the registered service worker in parallel.
```

The service worker should be registered with cache behavior equivalent to:

```json
{
  "updateViaCache": "all"
}
```

This allows the HTTP cache to be used when checking both the top-level service worker script and imported script resources, such as scripts loaded by `importScripts()` in a service worker.
The IdP can serve `/fedcm/sw.js` with a cache lifetime and an HTTP validator:

```http
Cache-Control: max-age=1800
ETag: "sw-build-42"
Content-Type: text/javascript
```

In this example, the cached service worker response remains fresh for 30 minutes. FedCM requests a Soft Update whenever the FedCM API is invoked, but update checks within the 30-minute window can be satisfied from the user agent's local HTTP cache without making a network request to the IdP.

On the first FedCM invocation after the cached response becomes stale, the user agent revalidates the service worker script using the ETag.

```http
GET /fedcm/sw.js
If-None-Match: "sw-build-42"
```

If the script has not changed, the IdP returns `304 Not Modified`, and the user agent continues using the installed service worker. If the script has changed, the IdP returns the new script with a new ETag, and the user agent updates the service worker registration through the normal service worker lifecycle.

The Soft Update should run in parallel with the FedCM request that caused the API invocation. The currently active service worker may handle that request while the user agent checks for an updated version. A newly discovered service worker becomes available after the normal installation and activation process completes, and may handle a later FedCM request.

This model allows the IdP to control how quickly fixes are discovered by choosing an appropriate cache lifetime. A shorter cache lifetime allows faster discovery of updates, while a longer lifetime reduces network revalidation traffic.

## Failure Handling and Emergency Disablement
If the `identity_handler` declaration is absent, or if it is present with `enabled: false`, FedCM should use the normal direct-network path.
If the `identity_handler` declaration is present and enabled, the IdP has opted in to service worker handling for credentialed FedCM requests. In that case, first registration is required before the identity event can be dispatched. If the declared service worker cannot be registered or started, FedCM should fail the request rather than silently bypassing the service worker.

If the IdP needs to disable the identity handler completely, it can set `enabled` to `false` in the well-known file.


```json
{
  "provider_urls": [
    "https://idp.example/fedcm/config.json"
  ],
  "identity_handler": {
    "service_worker": "/fedcm/sw.js",
    "scope": "/fedcm/",
    "enabled": false
  }
}
```


After the user agent observes `enabled: false`, FedCM should stop dispatching identity events to the service worker and use the direct-network path. Any existing registration may be ignored or removed asynchronously. If the `identity_handler` declaration is absent, FedCM should also treat that as no service worker opt-in.

## Recommended IdP Service Worker Structure
The registered `/fedcm/sw.js` file should be a small and stable bootstrap script. It should primarily load the implementation script and perform only minimal lifecycle work.

```javascript
// /fedcm/sw.js
importScripts("/fedcm/identity-handler.a13f92.js");
```

The imported content-hashed script contains the actual identity-handler implementation.
For staged rollout, the IdP should preserve cell affinity when selecting the imported script. A new script version should be selected using a stable customer, tenant, or deployment-cell cohort rather than random per-request traffic selection. If 5% of requests randomly receive a new implementation, repeated requests can install that implementation for more than 5% of customers.
