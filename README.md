---
title: "WebID"
created: 01/01/2020
updated: 03/02/2021
redirect_from: "index.html"
layout: "default"
---

> not to be confused with [this](https://www.w3.org/2005/Incubator/webid/spec/) WebID whose authors have [graciously](https://github.com/WICG/WebID/issues/54#issuecomment-783605484) allowed us to use this as a codename until we [find](https://github.com/WICG/WebID/issues/41#issuecomment-712304910) a better one

**TL;DR**; This is an **active** exploration to react to the **ongoing** privacy-oriented changes in browsers (e.g. [1](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), [2](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/) and [3](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/)) and **preserve** and **elevate** identity federation (e.g. OpenID, OAuth and SAML) for a more private Web.

This explainer is divided in three sections:

1. [Where we are](#the-problem)
1. [Where we ought to be](#the-end-state)
1. [How do we get there](#sequencing)


# Deep Dives

The following should give you a deeper understanding of the problem, related problems and how they were tackled in the past:
  
- [Prior Art](prior.md)
- [Related Problems](problems.md) and desirable side effects
- The [deployment](activation.md) topology
- [Glossary](glossary.md)
- [The Threat Model](https://wicg.github.io/WebID/#privacy-threat-model): a formalization of the problem
- Alternatives [considered](alternatives_considered.md)
- The WebID [devtrial](HOWTO.md)

With that in mind, lets take a closer look at what high-level APIs could look like for each of these two passes:


