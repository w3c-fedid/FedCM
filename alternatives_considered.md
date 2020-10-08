# Alternatives Considered

Now that we have a deep understanding of (a) the [problem](README.md) and (b) the [motivations](privacy_threat_model.md) and [topology](activation.md) of the parties involved, lets look at some **why not**s.

## The Status Quo

A trivial alternative that is worth noting as a baseline is to "do nothing" and keep federation using low-level primitives like redirects and popups.

That seemed clear to reject based on:

- the inability to prevent the [RP tracking problem](#the-rp-tracking-problem)
- the increasing constraints that are being put in place for cross-site communication through third-party cookies, postMessage and URL parameters as link decorations as a result of the [IDP tracking problem](#the-idp-tracking-problem)

From here, the next incremental step we could look at is the [requestStorageAccess](https://developer.mozilla.org/en-US/docs/Web/API/Document/requestStorageAccess) API.

## The RequestStorageAccess API

The [Document.requestStorageAccess()](https://developer.mozilla.org/en-US/docs/Web/API/Document/requestStorageAccess) API grants first-party storage to cross-origin subframes. In conjunction with iframes, an IDP could expose its service via cross-site postMessage communication once first-party storage has been granted.

That seemed clear to reject based on:

- the inability to prevent the [RP tracking problem](#the-rp-tracking-problem)
- the general-purpose nature of the API leading to the lowest common denominator policy

From here, let's try to break down the problem into smaller parts.
