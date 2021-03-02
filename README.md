---
title: "WebID"
created: 01/01/2020
updated: 01/03/2021
redirect_from: "index.html"
---

**TL;DR**; This is an **active** exploration to proactively **preserve** and **extend** identity federation on the Web (e.g. Sign-in with X) beyond the incoming **privacy-preserving** changes ([example](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox)) to low level primitives that it depends on.

This explainer is broken down into:

- [Why](#the-problem) is federation under threat?
- [How](design.md) do we keep it around and/or extend it?

# The Problem

Over the last decade, identity federation has unquestionably played a central role in raising the bar for authentication on the web, in terms of ease-of-use (e.g. passwordless single sign-on), security (e.g. improved resistance to phishing and credential stuffing attacks) and trustworthiness compared to its preceding pattern: per-site usernames and passwords.

The standards that define how identity federation works today were built independently of the web platform (namely, [SAML](https://en.wikipedia.org/wiki/Security_Assertion_Markup_Language), [OpenID](https://en.wikipedia.org/wiki/OpenID) and [OAuth](https://en.wikipedia.org/wiki/OAuth)), and their designers had to work **around** its limitations rather than extending them (notably, rightfully so at the time).

Because of that, existing user authentication flows rely on general web capabilities such as top-level navigations/redirects with parameters, window popups and cookies.

Because these general purpose primitives can be used for an open ended number of use cases (again, notably, by design), browsers have to apply policies that capture the **lowest common denominator** of abuse, at best applying cumbersome permissions (e.g. popup blockers) and at worst entirely blocking them (for example, [here](https://github.com/michaelkleber/privacy-model)).

Over the years, as these low level primitives get abused, browsers intervene and federation adjusts itself. For example, popup blocks became common and federation had to adjust itself to work in a world where popups blockers were widely deployed:

![](static/mock11.svg)

The challenge, now more than ever, is that some of these low level primitives are getting increasingly abused to allow users on the web to be tracked. So, as a result, browsers are applying strictier and stricter policies around them.

If browsers are applying stricter policies around them, and assuming that federation is safer than usernames/passwords, how do we keep identity federation around?

# The classification problem

The problem starts with what we have been calling the classification problem.

When federation was first designed, it was rightfully designed **around** the existing capabilities of the web, rather than **changing** them. Specifically, federation worked with callbacks on top of **cookies**, **redirects** or **popup windows**, which didn't require any redesign, redeployment or negotiation with browser vendors.

Federation makes use of redirects to navigate the user to identity providers (with callbacks, e.g. `redirect_uri`), which upon permission redirects users again to the relying parties with a result (e.g. an `id_token`):

![](static/mock21.svg)

These **general purpose** primitives enabled a variety of use cases, which include, among other things, federation. However, unfortunately, they also enable cross-site communication, namely via [decorating links](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox), which can be used to track users without their awareness in what's called **bounce tracking**:

![](static/mock22.svg)

In this formulation of **bounce tracking**, websites redirect the user to cross-origin websites that automatically and invisibly redirect the user back to the caller, but passing enough information in URL parameters that allows the tracker to join that visit (e.g. when you visit rings.com) with visits in other websites (e.g. when you visit shoes.com).

In federation, that's less invisible/automatic, but it is still there. Cross-site tracking is enabled via federation when relying parties that the user signs in to **collude** with each other (and other entities) to deterministically (or probabilistically) **link** their user's accounts to build and get access to a richer user profile (e.g. one site selling data on browsing history for ads targeting to another service). While this could be enabled without federation per se (user could manually provide a joinable email address or phone number), federated identity providers have an opportunity to address this problem at scale by providing their users with site-specific/directed identifiers. 

![](static/mock3.svg)

Another example of a low level primitive that federation depends on are **iframes** and **third party cookies**. Iframes are often embedded into relying parties assuming they'll have access to third party cookies which are then used for personalization (e.g. showing names in login buttons). Unfortunately, that's virtually indistinguishable from trackers that can track your browsing history across relying parties, just by having users visit links (e.g. loading credentialed iframes on page load):

![](static/mock23.svg)

Because of the tracking risk, browsers are starting to disable third party cookies in iframes.

Because these cross-site communication takes place in a general purpose medium, it is hard for browsers to distinguish between cross-site communication that is used for exchanging identity data or other cases where intervention is needed.

Browsers can't **classify** federation, hence the name.

The classification problem is notably hard because it has to deal with **adversarial impersonation**: agents who have the interest in being classified as federation to get access to browser affordances.

So, how do we **distinguish** federation from tracking and **elevate** the level of awareness/privacy while **assuming** adversarial impersonation?

# The Anatomy of Federation

Before we can answer "how to distinguish" federation from tracking, lets first try to undrestand how federation works. For our interest, we can identify three big passes:

1. There is a convention used by relying parties to request identification/authentication to identity providers
1. There is a convention used by identity providers to respond with identification/authentication to relying parties
1. It uses browser affordances for personalization

These passes rely on the following low level primitives:

- **redirects** (i.e. `<a>` or `window.location.location`),
- **popups** (i.e. `window.open` and `postMessage`) or
- **widgets** (i.e. `<iframe>`)

For example, a relying party can use the OpenID convention to request to an IDP:

```html
<a href="https://idp.example/?client_id=1234&scope=openid&nonce=456&redirect_uri=https://rp.example/cgi-bin/callback.php">Sign in with IDP</a>
```

Which it then expects the IDP to at some point use the second convention to return back a response to the `redirect_uri`:

```http
POST /cgi-bin/callback.php HTTP/1.1
Host: www.rp.example.com
Content-Type: application/x-www-form-urlencoded
Content-Length: length
Accept-Language: en-us
Accept-Encoding: gzip, deflate
Connection: Keep-Alive

id_token={JWT}
```

The same can be accomplished with top level navigations:

```javascript
navigation.location.href = `https://idp.example/?client_id=1234&scope=openid&nonce=456&redirect_uri=rp.example`;
```

Popups:

```javascript
let popup = window.open(`https://idp.example/?client_id=1234&scope=openid&nonce=456&redirect_uri=rp.example`);
window.addEventListener(`message`, (e) => {
  if (e.origin == "https://idp.example") {
    // ...
    e.source.postMessage("done, thanks");
  }
});
```

Or iframes:

```html
<iframe src="https://idp.example/?client_id=1234&scope=openid&nonce=456&redirect_uri=rp.example"></iframe>
```

Which listen to postMessages:

```javascript
window.addEventListener(`message`, (e) => {
  if (e.origin == "https://idp.example") {
    // ...
    e.source.postMessage("done, thanks");
  }
});
```

All of these affordances allow for arbitrary cross-origin communication, so at some point we can expect them to be constrained (more details [here](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox)).

So, from a scoping perspective, we need to find alternatives for all of these low level alternatives that would be future-proof:

- **redirects** (i.e. `<a>` or `window.location.location`),
- **popups** (i.e. `window.open` and `postMessage`) or
- **widgets** (i.e. `<iframe>`)

# Next Steps

The following should give you a deeper understanding of the problem, related problems and how they were tackled in the past:
  
- [Prior Art](prior.md)
- [The Threat Model](privacy_threat_model.md): a formalization of the problem
- [Related Problems](problems.md)

With a solid understanding of the problem space, you can read below some of the thoughts on how to address them:

- [The Solution Space](design.md)

