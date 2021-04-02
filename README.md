---
title: "WebID"
created: 01/01/2020
updated: 01/03/2021
redirect_from: "index.html"
---

> not to be confused with [this](https://www.w3.org/2005/Incubator/webid/spec/) WebID whose authors have [graciously](https://github.com/WICG/WebID/issues/54#issuecomment-783605484) allowed us to use this as a codename until we [find](https://github.com/WICG/WebID/issues/41#issuecomment-712304910) a better one

**TL;DR**; This is an **active** exploration to react to the **ongoing** privacy-oriented changes in browsers (e.g. [1](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), [2](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/) and [3](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/)) and **preserve** identity federation (e.g. OpenID, OAuth and SAML) on the web.

# The Problem

Over the last decade, identity federation has unquestionably played a central role in raising the bar for authentication on the web, in terms of ease-of-use (e.g. passwordless single sign-on), security (e.g. improved resistance to phishing and credential stuffing attacks) and trustworthiness compared to its preceding pattern: per-site usernames and passwords.

The standards that define how identity federation works today on the Web were built independently of the Web Platform (namely, [SAML](https://en.wikipedia.org/wiki/Security_Assertion_Markup_Language), [OpenID](https://en.wikipedia.org/wiki/OpenID) and [OAuth](https://en.wikipedia.org/wiki/OAuth)), and their designers had to (rightfully so) work **around** its limitations rather than extend them.

Because of that, existing user authentication flows were designed on top of general-purpose web platform capabilities such as top-level navigations/redirects with parameters, window popups, iframes and cookies.

However, because these general purpose primitives can be used for an open ended number of use cases (again, notably, by design), browsers have to apply policies that capture the **lowest common denominator** of abuse, at best applying cumbersome permissions (e.g. popup blockers) and at worst entirely blocking them (e.g. [blocking](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) third party cookies).

Over the years, as these low level primitives get abused, browsers intervene and federation adjusts itself. For example, popup blockers became common and federation had to adjust itself to work in a world where popups blockers were widely deployed.

The challenge, now more than ever, is that some of these low level primitives are getting increasingly abused to allow users on the web to be tracked. So, as a result, browsers are applying stricter and stricter policies around them.

> Publicly announced browser positions on third party cookies:
>
> 1. [Safari](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/): third party cookies are **already** blocked by **default**
> 1. [Firefox](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/): third party cookies are **already** blocked **by default**, and
> 1. [Chrome](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/): intends to offer **alternatives** to make them **obsolete** in the [near term](https://www.blog.google/products/chrome/building-a-more-private-web/).

Blocking third party cookies broke important parts of the protocols in those browsers (e.g. [logouts](https://www.identityserver.com/articles/the-challenge-of-building-saml-single-logout)) and made some user experiences inviable (e.g. social [button](https://developers.facebook.com/docs/facebook-login/userexperience/) and [widget](https://developers.google.com/identity/gsi/web) personalization). 

While it is clearer to see the **current** impact of third party cookies, it is equally important to understand the ways in which the low level primitives that identity federation depends on (e.g. redirects) are being abused and the [principles](https://github.com/michaelkleber/privacy-model) browsers are using to control them, so that we don't corner ourselves into another dead end.

If browsers are applying stricter policies around the low level primitives that federation depends on, and under the assumption that federation is significantly better than usernames/passwords, how do we keep identity federation around?

## Third Party Cookies

The problem starts with what we have been calling the classification problem.

When federation was first designed, it was rightfully designed **around** the existing capabilities of the web, rather than **changing** them. Specifically, federation worked with callbacks on top of **cookies**, **redirects**, **iframes** or **popup windows**, which didn't require any redesign, redeployment or negotiation with browser vendors.

One example of a low level primitive that federation depends on are **iframes** and **third party cookies**. For example, credentialed iframes are used while [logging out](https://openid.net/specs/openid-connect-rpinitiated-1_0.html) and social [button](https://developers.facebook.com/docs/facebook-login/userexperience/) and [widget](https://developers.google.com/identity/one-tap/web) personalization.

![](static/mock27.svg)

Unfortunately, that's virtually indistinguishable from trackers that can track your browsing history across relying parties, just by having users visit links (e.g. loading credentialed iframes on page load).

We call this **the classification problem** because it is hard for a browser to programatically distinguish between these two different cases: identity federation helping a user versus users being tracked without any control.

![](static/mock26.svg)

Third party cookies are **already** blocked in [Safari](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) and [Firefox](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/) **by default** (and [Chrome](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/) intends to block that soon too) which make these use cases inviable.

The problems then are:

1. **First** and foremost, what Web Platform features need to be exposed to (re) enable these features of federation to co-exist with the absence of third party cookies in browsers going forward?
2. **Secondarily**, in which direction browsers are going that could potentially impact federation?

## Bounce Tracking

Before we prematuraly jump into solutions for the first (and more **urgent**) problem, we think there is something more fundamental changing. Lets take a step back and a closer look at the **second** problem: in which direction browsers are going that could more fundamentally impact federation?

While third party cookies in iframes are used in federation, a more fundamental low level primitive that federation uses is the use of top level navigations (e.g. redirects or form POSTs) to navigate the user to identity providers (with callbacks, e.g. `redirect_uri`) and back to relying parties with a result (e.g. an `id_token`):

![](static/mock21.svg)

However, unfortunately, this **low level** primitive also enable cross-site communication, namely via [decorating links](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox), which can be abused to track users without their control in what's called **bounce tracking**:

![](static/mock22.svg)

In this formulation of **bounce tracking**, websites redirect the user to cross-origin websites that automatically and invisibly redirect the user back to the caller, but passing enough information in URL parameters that allows the tracker to join that visit (e.g. when you visit rings.com) with visits in other websites (e.g. when you visit shoes.com).

In federation, that's less invisible/automatic, but it is still there. Cross-site tracking is enabled via federation when relying parties that the user signs in to **collude** with each other (and other entities) to deterministically (or probabilistically) **link** their user's accounts to build and get access to a richer user profile (e.g. one site selling data on browsing history for ads targeting to another service). While this could be enabled without federation per se (user could manually provide a joinable email address or phone number), federated identity providers have an opportunity to address this problem at scale by providing their users with site-specific/directed identifiers. 

![](static/mock3.svg)

Because of these tracking risks, browsers are starting to disable third party cookies in iframes and more generally provide tighter control over cross-site communication (e.g. a [privacy model](https://github.com/michaelkleber/privacy-model) for the web).

Because these cross-site communication takes place in a general purpose medium, it is hard for browsers to distinguish between cross-site communication that is used for exchanging identity data deliberately (e.g. federation) or unintentionally (e.g. tracking).

Browsers can't **classify** federation, hence the name.

The classification problem is notably hard because it has to deal with **adversarial impersonation**: agents who have the interest in being classified as federation to get access to browser affordances.

While the timeline for link decoration is much farther in time, it much more fundamentally threatens federation.

> Publicly announced positions by browsers on bounce tracking:
>
> - Safari's existing deployed [strategies](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/) and [principles](https://github.com/privacycg/proposals/issues/6)
> - Firefox's protection against [redirect tracking](https://blog.mozilla.org/security/2020/08/04/firefox-79-includes-protections-against-redirect-tracking/)
> - Chrome's stated [Privacy Model](https://github.com/michaelkleber/privacy-model) for the Web

So, how do we **distinguish** federation from tracking and elevate the level of **control** while **assuming** adversarial impersonation?

# Proposal

Clearly, this is a massive, multi-agent, multi-year problem across the board.

There are billions of users that depend on federation on the web, millions/thousands of relying parties and thousands/hundreds of identity providers. There are also tens of browsers and operating systems, all moving independently. None of that changes overnight and we don't expect it to.

Having said that, failing to be proactive about affecting change and making federation forward compatible with a more private Web can steer users to less secure patterns, like usernames/passwords or native apps.

The approach we have taken so far has been a combination of two strategies:

- a **firm** and **principled** understanding of where we want to get
- a well **informed**, **deliberate** and **pragmatic** choice of what steps to take us there

We believe a convincing path needs to have a clearly defined end state but also a plausible sequencing strategy.

While much of the environment is changing and evolving as we speak, there are clear things that are broken right now and enough signals about the principles and challenges ahead of us. We are breaking this into three separate stages:

1. [Stage 1](#stage-1-third-party-cookies): preserve federation post third party cookies
1. [Stage 2](#stage-2-bounce-tracking): preserve federation post bounce tracking preventions
1. [Stage 3](#future-work): related problems and opportunities

## Stage 1: Third Party Cookies

The more urgent problem that clearly has already affected federation is the blocking of third party cookies. We plan to tackle this first.

- **Why**, **What** and **When**?
    **Today**, third party cookies are blocked on [Safari](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) and [Firefox](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/). They are in the process of becoming **obsolete** in [Chrome](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/) in the foreseeable future.
- So **What**? [logging out](https://openid.net/specs/openid-connect-rpinitiated-1_0.html), social [buttons](https://developers.facebook.com/docs/facebook-login/userexperience/) and [widgets](https://developers.google.com/identity/one-tap/web) personalization breaks. (anything else? add your use case [here](#how-can-i-help))
- **How**? [Here](cookies.md) are some early proposals on how to preserve these use cases.
- **Who** and **Where**?: Browser vendors, identity providers, relying parties and standard bodies are involved. The discussions so far have happened at the [WICG](https://github.com/WICG/WebID/issues) and at the [OpenID foundation](https://github.com/IDBrowserUseCases/docs).

## Stage 2: Bounce Tracking

Bounce tracking comes next. It is a more evolving situation, but has much more profound implications to federation:

- **Why**, **What** and **When**? Safari's [periodic storage purging](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/) and [SameSite=Strict jail](https://github.com/privacycg/proposals/issues/6), Firefox's [periodic storage purging](https://blog.mozilla.org/security/2020/08/04/firefox-79-includes-protections-against-redirect-tracking/) and Chrome's stated [privacy model](https://github.com/michaelkleber/privacy-model) for the Web.
- So **What**? Purging or partitionig storage across redirects / posts forces users to re-authenticate at each transition of federation flows, at best defeating the convenience that federation provides and at worst making it less secure (anything else? add your use case [here](#how-can-i-help).)
- **How**? [Here](redirects.md) are some early proposals on how to preserve these use cases.
- **Who** and **Where**?: Browser vendors, identity providers, relying parties and standard bodies are involved. The discussions so far have happened at the [WICG](https://github.com/WICG/WebID/issues) and at the [OpenID foundation](https://github.com/IDBrowserUseCases/docs).

## Stage 3: Future Work

There are a series of [related problems](problems.md) that affect federation that we believe we have a unique opportunity to tackle as a consequence of the choices that we make in stage 1 and 2.

These are key and important problems, but a lot less urgent, so we are being very deliberate about **when** and **how much** to focus on them.

# How can I help?

At the moment, we are actively working with the identity ecosystem to help us determine product requirements (contribute [here](https://github.com/IDBrowserUseCases/docs) with the list of use cases), ergonomics and deployment strategies that minimize change and maximize control, for example via testing our APIs ([instructions](HOWTO.md)) and giving us feedback.

Much of this explainer is evolving as a result of this field experimentation.
The most constructive/objective way you can help is to:

1. get a good understanding of the **why**: understand the ongoing privacy-oriented changes in browsers ([example](https://blog.chromium.org/2020/01/building-more-private-web-path-towards.html)) and their [principles](https://github.com/michaelkleber/privacy-model)
1. help us understand **what**: contribute [here](https://github.com/IDBrowserUseCases/docs) with a use case that you believe can be impacted
1. help us understand **how**: [try the APIs](https://github.com/WICG/WebID/blob/main/HOWTO.md) under development and help us understand what works / doesn't work

# Further Reading

The following should give you a deeper understanding of the problem, related problems and how they were tackled in the past:
  
- [Prior Art](prior.md)
- The [Anatomy](anatomy.md) of federation
- [Related Problems](problems.md) and desirable side effects
- The [deployment](activation.md) topology
- [Glossary](glossary.md)
- [The Threat Model](privacy_threat_model.md): a formalization of the problem
- Alternatives [considered](alternatives_considered.md)
- The WebID [devtrial](HOWTO.md)

With that in mind, lets take a closer look at what high-level APIs could look like for each of these two passes:

# Classification

Like we said above, the classification problem is the browser's inability to distinguish identity federation from tracking due to the fact that both use low level primitives (namely, redirects, popups, iframes and cookies) and its consequence is the application of lowest common denominator policies.

The first thought that occurred to us was to look into each of these low-level primitives and offer for each an indentity-specific high-level affordance, **trading generality for awareness**.

With that in mind, lets look into each specific low-level primitive and what a high-level identity-specific affordance would look like.

## The HTTP API

One of the most basic things that we could do to classify federation is to detect patterns in HTTP requests.

Because a significant part of federation is deployed over well-established protocols (e.g. OpenID, SAML), their HTTP profile is somewhat easy to spot. For example, for OpenID Connect requests/responses we could look at HTTP requests that have:

- a **client_id** parameter
- a **redirect_uri** parameter
- a **scope** parameter
- an accompanying **.well-known/openid-configuration** configuration

Responses can be matched when they match:

- a redirect to the previously used **redirect_uri**
- an **id_token** parameter

It is an active area of investigation to determine:

1. which and how many of these patterns we would want to use (too few and you over-classify, too many and you under-classify),
1. whether the same approach would work for other protocols (e.g. SAML).
1. whether we need an opt-in / explicit API and if so which (e.g. perhaps a special URL marker, like a reserved URL parameter or a scheme)

## The JS API

Popups are harder to classify because each IDP seems to use a custom protocol to open the popup as well as to communicate via postMessage.

It is hard to know what that will exactly look like right now, but as a starting point, here is what it could look like.

Instead of the low level `window.open` and listening to `window` events, one could write at a high-level:

```javascript
// This is just a possible starting point, largely TBD.
let {idToken} = await navigator.credentials.get({
  provider: "https://accounts.example.com",
  // other OpenId connect parameters
});
```

And instead of the low level `postMessage`, the IDP would write:

```javascript
// This is just a possible starting point, largely TBD.
await navigator.credentials.store({
  idtoken: JWT,
});
```

## The HTML API

Relying Parties also typically embed iframes served by identity providers for personalization (e.g. showing the user's profile picture / name on buttons). Browsers do (or are intending to) block third party cookies in iframes, making them uncredentialed and hence unable to personalize.

This is still under active exploration, but our efforts are going into exploring ways in which we can leverage [fencedframes](https://github.com/shivanigithub/fenced-frame) and one of the response APIs above.

For example, we are looking into ways we could replace the `<iframe>` tag with the web-bundle version of `<fencedframe>`s:

```html
<fencedframe src="https://idp.example/personalized-frame.wbn" client_id="1234" scope="openid email">
</fencedframe>
```

In this formulation, the web bundle is a static (yet personalized) bundle that can be displayed on page load but can't have any uncontrolled communication outwards (e.g. over the network or over in-browser features, like postMessage).

Once the user interacts with the fencedframe, a user agent would know, based on identity-specific parameters in the fencedframe, when to release that information to the web bundle as well as use the APIs above (e.g. the HTTP API or the JS API) to return an idtoken back.

```javascript
window.addEventListener(`message`, (e) => {
  if (e.origin == "https://idp.example") {
    // ...
    e.source.postMessage("done, thanks");
  }
});
```


