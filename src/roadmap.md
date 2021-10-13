---
layout: "default"
---

## Sequencing

While [The End State](#the-end-state) gives us guidance of where to aim at, we consider an equally hard problem to find a plausible path that leads us there.

While much of the environment is changing and evolving as we speak, there are concrete flows that are inviable right **now** and enough signals about the principles and challenges **ahead** of us.

Much of this is evolving quickly and we are adapting as we learn, but here is our best representation of how we expect features to be developed:

| Stage                                   | Timeline  | Description                                 |
|-----------------------------------------|-----------|----------------------------------------------|
| [Stage 0](problem.md)                    |   2020    | Understanding of the [problem](problem.md) and [properties](https://github.com/michaelkleber/privacy-model) of the end state |
| [Stage 1](#stage-1-third-party-cookies) |   2021    | [dev trials](https://docs.google.com/document/d/1_FDhuZA_C6iY5bop-bjlPl3pFiqu8oFvuK1jzAcyWKU/edit#heading=h.t4ac0nsw5yo) in Q1/Q2 ([instructions](HOWTO.md)) and [origin trials](https://sites.google.com/a/chromium.org/dev/blink/origin-trials) in Q3/Q4 of alternatives to [third-party cookies](#stage-1-third-party-cookies)   |
| [Stage 2](#stage-2-bounce-tracking)     |   2021+   | [origin trials](https://sites.google.com/a/chromium.org/dev/blink/origin-trials) of alternatives to [top level navigation](#stage-2-bounce-tracking)  |
| [Stage 3](#stage-3-future-work)         |   2021++  |  other [related problems](problems.md) and opportunities    |


### Stage 1: Third-Party Cookies

The more urgent problem that clearly has **already** affected federation (or is about to) is the blocking of third-party cookies. We plan to tackle this first:

- **Why**, **What** and **When**? Today, third-party cookies are blocked on [Safari](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) and [Firefox](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/). They are in the process of becoming **obsolete** in [Chrome](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/) in the foreseeable future.
- So **What**? [Logging out](https://openid.net/specs/openid-connect-rpinitiated-1_0.html), [social buttons](https://developers.facebook.com/docs/facebook-login/userexperience/) and [widget personalization](https://developers.google.com/identity/one-tap/web) breaks. (Anything else? Add your use-case [here](#how-can-i-help).)
- Ok ... Now **What**? [Here](cookies.md) are some early proposals on how to preserve these use cases.
- **Who** and **Where**?: Browser vendors, identity providers, relying parties and standard bodies are involved. The discussions so far have happened at the [WICG](https://github.com/WICG/FedCM/issues) and at the [OpenID foundation](https://github.com/IDBrowserUseCases/docs).

### Stage 2: Bounce Tracking

Bounce tracking comes next. It is a more evolving situation, but has much more profound implications to federation:

- **Why**, **What** and **When**? Safari's [periodic storage purging](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/) and [SameSite=Strict jail](https://github.com/privacycg/proposals/issues/6), Firefox's [periodic storage purging](https://blog.mozilla.org/security/2020/08/04/firefox-79-includes-protections-against-redirect-tracking/) and Chrome's stated [privacy model](https://github.com/michaelkleber/privacy-model) for the Web.
- So **What**? Purging or partitioning storage across redirects/posts forces users to re-authenticate at each transition of federation flows, at best defeating the convenience that federation provides and at worst making it less secure (Anything else? Add your use-case [here](#how-can-i-help).)
- OK ... Now **What**? [Here](navigations.md) are some early proposals on how to preserve these use cases.
- **Who** and **Where**?: Browser vendors, identity providers, relying parties and standards bodies are involved. The discussions so far have happened at the [WICG](https://github.com/WICG/FedCM/issues) and at the [OpenID Foundation](https://github.com/IDBrowserUseCases/docs).

### Stage 3: Future Work

There is a series of [related problems](problems.md) that affect federation. We believe we have a unique opportunity to tackle these as a consequence of the choices that we make in stages 1 and 2.

These are key and important problems, but a lot less urgent, so we are being very deliberate about **when** and **how much** to focus on them.
