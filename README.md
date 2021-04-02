---
title: "WebID"
created: 01/01/2020
updated: 01/03/2021
redirect_from: "index.html"
---

> not to be confused with [this](https://www.w3.org/2005/Incubator/webid/spec/) WebID whose authors have [graciously](https://github.com/WICG/WebID/issues/54#issuecomment-783605484) allowed us to use this as a codename until we [find](https://github.com/WICG/WebID/issues/41#issuecomment-712304910) a better one

**TL;DR**; This is an **active** exploration to proactively **preserve** and **elevate** identity federation (e.g. OpenID, OAuth and SAML), **forward-compatible** with a more **private** web.

# The Problem

Over the last decade, identity federation has unquestionably played a central role in raising the bar for authentication on the web, in terms of ease-of-use (e.g. passwordless single sign-on), security (e.g. improved resistance to phishing and credential stuffing attacks) and trustworthiness compared to its preceding pattern: per-site usernames and passwords.

The standards that define how identity federation works today on the Web were built independently of the Web Platform (namely, [SAML](https://en.wikipedia.org/wiki/Security_Assertion_Markup_Language), [OpenID](https://en.wikipedia.org/wiki/OpenID) and [OAuth](https://en.wikipedia.org/wiki/OAuth)), and their designers had to (rightfully so) work **around** its limitations rather than extending them.

Because of that, existing user authentication flows were built on top of general-purpose web platform capabilities such as top-level navigations/redirects with parameters, window popups, iframes and cookies.

However, because these general purpose primitives can be used for an open ended number of use cases (again, notably, by design), browsers have to apply policies that capture the **lowest common denominator** of abuse, at best applying cumbersome permissions (e.g. popup blockers) and at worst entirely blocking them.

Over the years, as these low level primitives get abused, browsers intervene and federation adjusts itself. For example, popup blockers became common and federation had to adjust itself to work in a world where popups blockers were widely deployed.

More recently, the challenge is that some of these low level primitives are getting increasingly abused to allow users on the web to be tracked. So, as a result, browsers are applying stricter and stricter policies around them.

> Publicly announced browser positions on third party cookies:
>
> 1. Third party cookies are **already** blocked in [Safari](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) and [Firefox](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/) **by default**, and
> 1. [Chrome](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/)'s intent to offer alternatives to make them obsolete in the [near term](https://www.blog.google/products/chrome/building-a-more-private-web/).

Blocking third party cookies broke important parts of the protocols in those browsers (e.g. [logouts](https://www.identityserver.com/articles/the-challenge-of-building-saml-single-logout)) and made some user experiences inviable (e.g. social [button](https://developers.facebook.com/docs/facebook-login/userexperience/) and [widget](https://developers.google.com/identity/gsi/web) personalization). 

While it is clearer to see the **current** impact of third party cookies, it is equally important to understand the ways in which the low level primitives that identity federation depends on (e.g. redirects) are being abused and the [principles](https://github.com/michaelkleber/privacy-model) browsers are using to control them, so that we don't corner ourselves into another dead end.

If browsers are applying stricter policies around the low level primitives that federation depends on, and under the assumption that federation is significantly better than usernames/passwords, how do we keep identity federation around?

## Third Party Cookies

The problem starts with what we have been calling the classification problem.

When federation was first designed, it was rightfully designed **around** the existing capabilities of the web, rather than **changing** them. Specifically, federation worked with callbacks on top of **cookies**, **redirects**, **iframes** or **popup windows**, which didn't require any redesign, redeployment or negotiation with browser vendors.

One example of a low level primitive that federation depends on are **iframes** and **third party cookies**. For example, credentialed iframes are used while [logging out](https://openid.net/specs/openid-connect-rpinitiated-1_0.html) and social [button](https://developers.facebook.com/docs/facebook-login/userexperience/) and [widget](https://developers.google.com/identity/one-tap/web) personalization.

![](static/mock27.svg)

Unfortunately, that's virtually indistinguishable from trackers that can track your browsing history across relying parties, just by having users visit links (e.g. loading credentialed iframes on page load):

We call this **the classification problem** because it is hard for a browser to programatically distinguish between these two different cases: identity federation helping a user versus users being tracked.

![](static/mock26.svg)

Third party cookies are **already** blocked in [Safari](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) and [Firefox](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/) **by default** (and [Chrome](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/) intends to block that soon too) which make these use cases inviable.

The problems then are:

1. **First** and foremost, what Web Platform features need to be exposed to (re) enable these features of federation to co-exist with the absence of third party cookies in browsers going forward?
2. **Secondarily**, in which direction browsers are going that could potentially impact federation?

## Link Decoration

Before we prematuraly jump into solutions for the first (and more **urgent** problem), lets take a step back and a closer look at the **second** problem: in which direction browsers are going that could more fundamentally impact federation?

While third party cookies in iframes are used in federation, a more fundamental low level primitive that federation uses is the use of redirects to navigate the user to identity providers (with callbacks, e.g. `redirect_uri`) and back to relying parties with a result (e.g. an `id_token`):

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

While the timeline for link decoration is much farther in time, it much more fundamentally threatens federation:

> Publicly announced positions by browsers on bounce tracking:
>
> - Safari's existing deployed [strategies](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/) and [principles](https://github.com/privacycg/proposals/issues/6)
> - Firefox's protection against [redirect tracking](https://blog.mozilla.org/security/2020/08/04/firefox-79-includes-protections-against-redirect-tracking/)
> - Chrome's stated [Privacy Model](https://github.com/michaelkleber/privacy-model) for the Web

So, how do we **distinguish** federation from tracking and elevate the level of **control** while **assuming** adversarial impersonation?

# The Anatomy of Federation

Before we can answer "how to distinguish" federation from tracking, lets first try to understand what federation depends on. For our interest, we can identify two big passes:

1. There is a convention used by relying parties to request identification/authentication to identity providers
1. There is a convention used by identity providers to respond with identification/authentication to relying parties

These passes rely on the following low level primitives:

- **HTTP APIs** (i.e. redirects, top level navigations, `<a>` or `window.location.location`),
- **JS APIs** (i.e. popups with `window.open` and `postMessage`) or
- **HTML APIs** (i.e. personalized buttons using `<iframe>`)

For example, a relying party can use the OpenID convention to request to an IDP:

```html
<a href="https://idp.example/?client_id=1234&scope=openid&redirect_uri=https://rp.example/callback.php">Sign in with IDP</a>
```

Which it then expects the IDP to at some point use the second convention to return back a response to the `redirect_uri`:

```http
POST /callback.php HTTP/1.1
Host: rp.example.com
Content-Type: application/x-www-form-urlencoded
Content-Length: length
Accept-Language: en-us
Accept-Encoding: gzip, deflate
Connection: Keep-Alive

id_token={JWT}
```

Another common affordance that federation uses are popups:

```javascript
let popup = window.open(`https://idp.example/?client_id=1234&scope=openid&redirect_uri=rp.example`);
window.addEventListener(`message`, (e) => {
  if (e.origin == "https://idp.example") {
    // ...
    e.source.postMessage("done, thanks");
  }
});
```

Or iframes:

```html
<iframe src="https://idp.example/?client_id=1234&scope=openid&redirect_uri=rp.example"></iframe>
```

Which listen to postMessages:

```javascript
window.addEventListener(`message`, (e) => {
  if (e.origin == "https://idp.example") {
    // neat, thanks!
    let {idtoken} = e;
  }
});
```

All of these affordances depend on arbitrary credentialed cross-origin communication, so at some point we can expect them to be constrained (more details [here](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox)).

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

# Control

Now, clearly, addressing the classification problem is necessary but not sufficient. There are a couple of problems that needs to be solved too:

1. adversarial impersonation
1. the lack of privacy controls

The first thing to consider is that an adversarial tracker can and will use any of the affordances that will allow them to break out of the privacy sandbox. So, the high level APIs need to be implemented in such a way that prevents impersonation from happening.

In many ways, the first problem is related to the second one: if user agents expose clear privacy controls, then uncontrolled tracking cannot happen.

## The Permission-oriented Variation

There is a variety of privacy controls that we are exploring, but just as a baseline, take the permission-oriented variation:

In this variation, we offer the user the identity-specific controls whenever cross-site identity-specific communication is conducted (e.g. from the relying party to the IDP and vice versa), based on our ability to [classify](#classification) them.

Concretely, instead of a `window.location.href` top level redirect or a `window.open` popup, a relying party (most probably indirectly via JS SDK provided by the IDP) would call a high level API instead:

```javascript
// In replacement of window.location.href or window.open,
// we use a high-level API instead:
// NOTE: This is just a possible starting point, exact
// API largely TBD as we gather implementation experience.
let {idToken} = await navigator.credentials.get({
  provider: "https://accounts.example.com",
  ux_mode: "popup",
  // other OpenId connect parameters
});
```

Upon invocation, an IDP-controlled webpage is loaded:

![](static/mock19.svg)

The IDP-controlled website can communicates back with the RP with a high-level API (in replacemente of the low-level `postMessage`) too: 

```javascript
// This is just a possible starting point, largely TBD.
await navigator.credentials.store({
  idtoken: JWT,
});
```

This variation is a great **baseline** because it is highly backwards compatible (specially if it is done via the [HTTP API](#the-http-api)). Neither relying parties nor identity providers have to redeploy, nor users will have to change their mental models about federation.

But this variation isn't perfect: while it is backwards compatible with most of the deployment of federation, we believe it leaves something be desired on **user experience**.

For one, the user has to make **two** choices (on the consequences of tracking) that are unrelated to the job to be done (sign-in) which we don't expect to be the most effective way to affect change.

That leads us to the [mediation-oriented](#the-mediation-oriented-variation) variation which bundles these prompts into a browser mediated experience (which also comes with trade-offs).

## The Mediation-oriented Variation

In the **mediated** variation, the user agent takes more responsibility in owning that transaction, and talks to the IDP via an HTTP convention rather than allowing the IDP to control HTML/JS/CSS:

```javascript
let {idToken} = await navigator.credentials.get({
  provider: "https://accounts.example.com",
  ux_mode: "inline",
  // other OpenId connect parameters
});
```

The `ux_mode` parameter informs the user agent to use the mediation-oriented variation, which, as opposed to the permission-oriented variation, talks to the IDP via HTTP instead:

```http
GET /.well-known/webid/accounts.php HTTP/1.1
Host: idp.example
Cookie: 123
```

The IDP responds with a list of accounts that the user has:

```http
HTTP/2.0 200 OK
Content-Type: text/json
{
  "accounts": [{
    "sub": 1234, 
    "name": "Sam Goto",
    "given_name": "Sam",
    "family_name": "Goto", 
    "email": "samuelgoto@gmail.com",
    "picture": "https://accounts.idp.com/profile/123",
  }]
}
```

With the data, the browser then controls the experience with the user to carry on:

![](static/mock15.svg)

Upon agreement, the browser uses the HTTP API convention to mint the idtoken. For example:

```http
POST /.well-known/webid/idtoken.php HTTP/1.1
Host: idp.example
Cookie: 123
Content-Type: application/x-www-form-urlencoded
account=1234,client_id=5678
```

And with the response, resolves the promise.

The benefits of the permission-oriented approach is that it is the most backwards compatible, at the cost of user friction in the form of permissions. The benefits of the mediated approach is that the user friction is inlined and contextual, at the cost of the ossification of the user experience.

Those two problems take us to a third approach we are exploring, which we are calling the delegation-oriented approach.

## The Delegation-oriented Variation

We believe that we are possibly making the user make a determination (to be tracked) that isn't necessary. The [delegation-oriented](consumers.md#the-delegation-oriented-variation) variation (which, again, comes with its set of trade-offs too) tries to solve the tracking risks by pulling more responsibilites to the user agent.

It is an active area of investigation to determine the **relationship** between these approaches. To the best of our knowledge so far, we expect these to be mutually complementary (rather than exclusive) and to co-exist long term. Each comes with trade-offs and it is too still early to know what market (if any) each fits. We expect that further implementation experimentation will guide us in better understanding the trade-offs and the relationship between these alternatives.

## The Enterprise-oriented Variation

To the best of our knowledge, we believe that business users (employees of a corporation) have a different set of privacy expectations compared to consumers, in that the accounts issued to employees are owned by the businesses (as opposed to the relationship a consumer has with social login providers). It is also clear to us too that the current deployment of businesses makes a non-trivial use of personal machines owned by employees, rather than machines that are issued by the business (which have a much easier ability to control enterprise policies).

We believe that the controls should take that distinction into consideration, and that the biggest challenge is adversarial impersonation.

![](static/mock24.svg)

This is still an active area of exploration, but to give a sense of direction, we are actively exploring making an abrupt separation between personal profiles and work profiles. The intuition here is that browser profiles are the closest delineation that can make a separation between personal use of your browser versus work use of your browser, along with the privacy expectations in each mode.

![](static/mock25.svg)

In addition to the separation, and with the user's permission/control/understanding, it seems like it would be beneficial for business admins to have the ability to set work policies on a per-profile basis.

# Roadmap

We expect this to be a multi-years project, rather than something that will happen overnight. There are billions of users that depend on federation on the web, millions/thousands of relying parties and thousands/hundreds of identity providers. There are also tens of browsers and operating systems, all moving independently. None of that changes overnight and we don't expect it to.

Having said that, we believe that we have to be proactive about affecting change and making federation forward compatible with a more private Web.

The approach we have taken so far has been a combination of two strategies:

- a firm and principled understanding of where we want to get
- a pragmatic and flexible understanding of what steps to take us there

We believe a convincing path needs to have a clearly defined end state but also a plausible sequencing strategy.

At the moment, we are actively working with the identity providers ecosystem to help us determine product requirements (contribute [here](https://github.com/IDBrowserUseCases/docs) with the list of use cases), ergonomics and deployment strategies that minimize change and maximize control, for example via testing our APIs ([instructions](HOWTO.md)) and giving us feedback.

Much of this explainer is evolving as a result of this field experimentation.

It is an active area of investigation the order in which these APIs and controls rollout and the precise time. 

# How can I help?

The most constructive/objective way you can help is to:

1. get a good understanding of the **why**: understand the ongoing privacy-oriented changes in browsers ([example](https://blog.chromium.org/2020/01/building-more-private-web-path-towards.html)) and their [principles](https://github.com/michaelkleber/privacy-model)
1. help us understand **what**: contribute [here](https://github.com/IDBrowserUseCases/docs) with a use case that you believe can be impacted
1. help us understand **how**: [try the APIs](https://github.com/WICG/WebID/blob/main/HOWTO.md) under development and help us understand what works / doesn't work

# Further Reading

The following should give you a deeper understanding of the problem, related problems and how they were tackled in the past:
  
- [Prior Art](prior.md)
- Alternatives [considered](alternatives_considered.md)
- [Related Problems](problems.md) and desirable side effects
- The WebID [devtrial](HOWTO.md)
- The [deployment](activation.md) topology
- [Glossary](glossary.md)
- [The Threat Model](privacy_threat_model.md): a formalization of the problem
