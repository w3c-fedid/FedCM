---
title: "WebID"
created: 01/01/2020
updated: 01/03/2021
redirect_from: "index.html"
---

**TL;DR**; This is an exploration to proactively **preserve** and **extend** identity federation on the Web (e.g. Sign-in with X/Y/Z), as a reaction to incoming **privacy-preserving** changes to low level primitives that it depends on ([example](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox)).

This explainer is broken down into:

- [The Problem Space](#the-problem)
- [The Prior Art](prior.md)
- [The Threat Model](privacy_threat_model.md)
- [The Solution Space](design.md)

# The Problem

Over the last decade, identity federation has unquestionably played a central role in raising the bar for authentication on the web, in terms of ease-of-use (e.g. passwordless single sign-on), security (e.g. improved resistance to phishing and credential stuffing attacks) and trustworthiness compared to its preceding pattern: per-site usernames and passwords.

The standards that define how identity federation works today were built independently of the web platform (namely, [SAML](https://en.wikipedia.org/wiki/Security_Assertion_Markup_Language), [OpenID](https://en.wikipedia.org/wiki/OpenID) and [OAuth](https://en.wikipedia.org/wiki/OAuth)), and their designers had to work **around** its limitations rather than extending them (rightfully so at the time). Because of that, existing user authentication flows rely on general web capabilities such as top-level navigations/redirects with parameters, window popups and cookies.

Because these general purpose primitives can be used for an open ended number of use cases (by design), browsers have to apply policies that capture the **lowest common denominator**, at best applying cumbersome permissions (e.g. popup blockers) and at worst entirely blocking them.

Over the years, some of these low level primitives get abused, browsers intervene and federation has to adjust itself. For example, popup blocks became common and federation had to adjust itself to work in a world where popups blockers were given:

![](static/mock11.svg)

The challenge, now more than ever, is that some of these low level primitives are getting increasingly abused to allow users on the web to be tracked. So, as a result, browsers are applying strictier and stricter policies around them.

If browsers are applying stricter policies around them, how do we keep identity federation around?

Before we dig into the solution space, lets take a deeper dive into the problem, specifically looking at:

- How federation works and what it depends on,
- How tracking works and
- [The classification problem](#the-classification-problem)

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

The classification problem is the problem of taking the existing federation mechanisms built on top of general purpose primitives and classify them such that they can be told apart.

The classification problem is hard because it has to deal with **adversarial impersonation**: agents who have the interest in being classified as federation to get access to browser affordances.

So, in order to solve the classification problem, one has to come up with the criteria for classification but also build the game theoretic devices that make the interventions less gameable (e.g. assume that there will be **adversarial impersonation**).

# Next Steps

The following should give you a deeper understanding of the problem, related problems and how they were tackled in the past:
  
- [Prior Art](prior.md)
- [The Threat Model](privacy_threat_model.md): a formalization of the problem
- [Related Problems](problems.md)

With a solid understanding of the problem space, you can read below some of the thoughts on how to address them:

- An early exploration of [The Solution Space](design.md)

