# FedCM Well-Known Subdomain Discovery — Explainer

**Authors:**
Suresh Potti (sureshpotti@microsoft.com)

## Participate

- https://github.com/w3c-fedid/FedCM/issues/809
- https://github.com/w3c-fedid/FedCM/pull/823

## Summary

This document describes a proposed addition to FedCM's [=well-known file=] discovery
algorithm: allow an Identity Provider (IDP) to host the well-known file at a fixed
`web-identity.<registrable domain>` subdomain in addition to the existing apex
(`<registrable domain>`) location. The user agent attempts the subdomain first and
falls back to the apex if the subdomain fetch fails. This preserves all of FedCM's
existing anti-fingerprinting privacy properties while removing operational obstacles
that today prevent some organizations from deploying FedCM.

## Status

Proposed addition to the FedCM specification, captured in
[PR #823](https://github.com/w3c-fedid/FedCM/pull/823) and motivated by
[Issue #809](https://github.com/w3c-fedid/FedCM/issues/809).

## Problem Statement

FedCM's current spec requires the well-known file to be served from the IDP's
[registrable domain](https://url.spec.whatwg.org/#host-registrable-domain) — for
`login.contoso.com` that means `https://contoso.com/.well-known/web-identity`. This
two-tier design exists for a critical privacy reason: it prevents the IDP from
fingerprinting the Relying Party (RP) by encoding RP information in the config file
path (see [`#manifest-fingerprinting`](https://fedidcg.github.io/FedCM/#manifest-fingerprinting)).

The privacy goal is sound, but pinning the file to the apex (registrable) domain
creates real-world deployment friction for many organizations:

### 1. Apex domains are operationally awkward

Apex domains (e.g., `contoso.com`) cannot use DNS `CNAME` records because they must
hold `NS` and `SOA` records at the zone root. Modern cloud and CDN providers expect
`CNAME`-based onboarding for load balancing, geographic affinity, and failover.
Workarounds (`ALIAS` / `ANAME` records, or pinned `A`/`AAAA` records) exist but are
not universally supported and frequently degrade DNS-driven traffic management.

### 2. Split ownership of subdomains

Within a single registrable domain, different subdomains often belong to different
teams or vendors:

| Subdomain                | Operated by                                |
| ------------------------ | ------------------------------------------ |
| `contoso.com` (apex)     | Marketing CMS / brand site                 |
| `login.contoso.com`      | Authentication service (e.g., Entra B2C)   |
| `support.contoso.com`    | Ticketing SaaS                             |
| `blog.contoso.com`       | Substack / external blog                   |

Requiring the well-known file at the apex couples the authentication service's
release process to whichever team owns the apex web property. Both teams must
coordinate to ship FedCM, and any change at the apex risks breaking sign-in.

### 3. White-label IDPs cannot host on the customer apex

When an organization delegates authentication to a white-label IDP (Okta, Microsoft
Entra External ID/B2C, Auth0, etc.), the customer typically `CNAME`s a subdomain
such as `login.contoso.com` to the IDP. The IDP has no control over `contoso.com`
itself and therefore cannot host the well-known file on its customer's behalf,
making FedCM onboarding a per-customer manual task at the apex.

## Proposed Solution

### How it works

PR #823 adds a fixed subdomain — `web-identity.<registrable domain>` — as an
alternative location for the well-known file. The IDP only needs to point that
subdomain at its existing authentication infrastructure using a standard DNS record:

```
web-identity.contoso.com.   CNAME   login.contoso.com.
```

The user agent's updated `fetch the config file` algorithm runs as follows:

1. Compute `registrableDomain` from the configUrl host.
2. Build two URLs:
   - `subdomainUrl` = `https://web-identity.<registrableDomain>/.well-known/web-identity`
   - `rootUrl` (apex fallback) = `https://<registrableDomain>/.well-known/web-identity`
3. Fetch `subdomainUrl` first (in parallel with the config fetch, as today).
4. If the subdomain fetch fails (DNS, TLS, HTTP error, malformed JSON, or
   `provider_urls` length > 1), immediately fall back to fetching `rootUrl`.
5. Validate the resulting well-known file against the config URL exactly as before.

The same-site shortcut (`skipWellKnown` when RP and IDP share a registrable domain)
is preserved.

### Why this preserves privacy

The anti-fingerprinting guarantee of the well-known file rests on two properties:

1. The file lives at a **fixed path** the IDP cannot vary per RP.
2. The file lives within a **location the IDP cannot use to encode RP identity**.

Both still hold. `web-identity.<registrable domain>` is a fixed name within the
same registrable domain the IDP already controls. There is no per-RP variation,
no new origin to enumerate, and the request continues to be sent without
credentials, without a `Referer`, and from an opaque origin — identical to the
existing apex fetch.

### Why a fixed subdomain (not a configurable one)

A configurable subdomain would reintroduce exactly the fingerprinting surface the
well-known file was designed to eliminate: the IDP could vary the location based on
the RP. A single, hard-coded label (`web-identity.`) keeps the location
deterministic and inspectable.

### Why subdomain-first with apex fallback (not the other way around)

Subdomain-first benefits new and white-label deployments without breaking any IDP
that has already shipped against the apex location. Apex-first would force every
new deployment to wait one fetch round-trip before reaching the working subdomain.
The fallback is triggered only on actual failure, so steady-state cost for
already-deployed apex IDPs is one extra failed request per discovery — and the
spec allows the fallback to begin immediately on subdomain failure rather than
waiting for the config fetch.

## Example deployment

A white-label IDP, `idp.example`, hosts authentication for `contoso.com`:

1. Customer (`contoso.com`) creates a single DNS record:
   ```
   web-identity.contoso.com.   CNAME   tenants.idp.example.
   ```
2. The white-label IDP serves `/.well-known/web-identity` from
   `tenants.idp.example` with the customer's `provider_urls` entry.
3. No change is required at `contoso.com` (the apex). The marketing site, CDN,
   and any other apex tenants are untouched.
4. User agents fetching `https://login.contoso.com/fedcm/config.json` discover
   the well-known file at `https://web-identity.contoso.com/.well-known/web-identity`
   on the first try.

## Alternatives considered

### Keep apex-only (status quo)

Rejected. Documented operational pain (apex DNS limitations, split ownership,
white-label delegation) is real and is blocking adoption today. See discussion
on Issue #809.

### Allow the IDP to declare an arbitrary well-known location

Rejected. Any IDP-controlled location reintroduces RP fingerprinting via the
discovery URL, which is the exact threat the well-known file mitigates.

### Use a different fixed label (e.g., `fedcm.`, `.well-known.`)

`fedcm.` was the label proposed in Issue #809. PR #823 settled on `web-identity.`
to match the existing well-known path segment (`/.well-known/web-identity`) and
to leave room for non-FedCM Web Identity specifications to share the same
discovery point. The label choice is a bikeshed but `web-identity.` is consistent
with the existing naming.

### Require IDPs to migrate to the subdomain

Rejected as a breaking change. Apex fallback keeps already-deployed IDPs working
unchanged; the subdomain is purely additive.

## Privacy and Security Considerations

- **No new fingerprinting surface.** The discovery URL is a deterministic function
  of the registrable domain. The IDP cannot encode RP identity in it.
- **Same request shape as today.** Subdomain and apex fetches both use
  `credentials: "omit"`, `referrer-policy: "no-referrer"`, an opaque origin, and
  `Sec-Fetch-Dest: webidentity`.
- **TLS still required.** The subdomain must serve a valid certificate covering
  `web-identity.<registrable domain>`. IDPs that cannot or will not provision such
  a certificate simply continue to use the apex location.
- **Cookie scope unchanged.** No cookies are sent on either fetch; the subdomain
  introduces no new cookie-sharing surface beyond what `*.contoso.com` already
  implies.
- **Content authority unchanged.** The IDP still proves authority over the
  registrable domain by being able to serve content under it; whether that proof
  comes from the apex or the `web-identity.` subdomain is equivalent for FedCM's
  trust model, since both are within the same site.

## Open Questions

- **Should the apex fallback eventually be deprecated?** Not in this proposal.
  PR #823 keeps it indefinitely for backward compatibility.
- **Caching.** Should a successful subdomain discovery be cached so that the apex
  fallback is not retried on every navigation? The existing well-known caching
  behavior applies; no new cache key is introduced.
- **Interaction with `provider_urls` size relaxation
  ([Issue #333](https://github.com/fedidcg/FedCM/issues/333))** — orthogonal; the
  fallback rules treat `> 1` entries as failure today and that behavior is
  preserved on both subdomain and apex fetches.

## References

- Issue: [w3c-fedid/FedCM#809](https://github.com/w3c-fedid/FedCM/issues/809)
- PR: [w3c-fedid/FedCM#823](https://github.com/w3c-fedid/FedCM/pull/823)
- Spec sections touched: `#well-known-discovery`, `#fetch-config-file`,
  `#manifest-fingerprinting`, `#deployment-well-known`
