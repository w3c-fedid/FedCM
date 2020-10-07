**TL;DR**; This is an **early exploration** of ways that Browsers can help users of the Web make safer decisions [[1](#the-rp-tracking-problem), [2](#the-idp-tracking-problem)] while logging-in on websites with identity providers with identity-specific APIs.

# WebID

This explainer is broken down into:

- [The Problem Space](#the-problem)
- [The Prior Art](prior.md)
- An early exploration of [The Solution Space](design.md)

# The Problem

Over the last decade, identity federation has unquestionably played a central role in raising the bar for authentication on the web, in terms of ease-of-use (e.g. passwordless single sign-on), security (e.g. improved resistance to phishing and credential stuffing attacks) and trustworthiness compared to its preceding pattern: per-site usernames and passwords.

The standards that define how identity federation works today were built independently of the web platform, and their designers had to work **around** its limitations rather than extending them. Because of that, existing user authentication flows rely on general web capabilities such as top-level navigation, link decoration, window popups and cookies.

Because these general purpose primitives can (by design) be used for an open ended number of use cases (some of them increasingly allowing users to be tracked), browsers have to apply policies that capture the **lowest common denominator**, at best applying cumbersome permissions (e.g. popup blockers) and at worst entirely blocking them.

If browsers are applying stricter policies around them, how do we keep identity federation around?

Before we dig into the solution space, lets take a deeper dive into the problem:

- [The classification problem](#the-classification-problem)
- [The RP tracking problem](#the-rp-tracking-problem)
- [The IDP tracking problem](#the-idp-tracking-problem)

## The classification problem

Some of the problem starts with what we have been calling the classification problem.

When federation was first designed, it was rightfully designed **around** the existing capabilities of the web, rather than **changing** them. Specifically, federation worked with callbacks on top of **cookies**, **redirects** or **popup windows**, which didn't require any redesign, redeployment or negotiation with browser vendors.

These **general purpose** primitives enabled a variety of use cases, which include, among other things, federation. However, they also enable cross-site communication, which isn't always consented or acknowledged by users, namely via [decorating links](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox).

Because the cross-site communication takes place in a general purpose medium, it is hard for browsers to tell the difference between cross-site communication that is used for exchanging identity data or other cases where intervention is needed.

The classification problem is the problem of taking the existing federation mechanisms built on top of general purpose primitives and classify them such that they can be told apart.

![](static/mock9.svg)

For example, IDPs use full page redirects which take the user out of context of the site they were trying to use. IDPs also try to use the general purpose pop-up window, but often because browsers are unaware of the use federation makes of popups, it has to apply a general rule across all usages, often blocking an IDP popup that would be otherwise helpful.

![](static/mock11.svg)

To solve the classification problem, the following needs to hold:

- The user agent should be able to distinguish between authentication and tracking
- The affordance should be applicable/meaningful if and only if it is used for authentication (i.e. cannot be abused outside of its scope)

If the classification problem was solved alone it would delineate the boundaries and applications of the affordances, but it wouldn't necessarily move the needle in making sure that the users are making safer choices.

In order to prevent cross-site tracking in federation, one has to solve what we've been calling the [RP tracking problem](#the-rp-tracking-problem) in federation and the [IDP tracking problem](#the-idp-tracking-problem).

## The RP Tracking problem

Cross-site joins are enabled through federation when the relying parties that the user signs in to **collude** with each other (and other entities) to deterministically (or probabilistically) **link** their user's accounts to build and get access to a richer user profile (e.g. one site selling data on browsing history for ads targeting to another service). While this could be enabled without federation per se (user could manually provide a joinable email address or phone number), federated identity providers have an opportunity to address this problem at scale by providing their users with site-specific/directed identifiers. 

![](static/mock3.svg)

## The IDP Tracking problem

Even if identity providers were to provide site-specific/directed identifiers, IDPs and RPs can exchange data without the user explicitly being aware of what information is flowing between the parties, and that the IDP may have insight into the user’s activity across sites. Federation is implemented via parameters on redirects / top level navigation, which allow for arbitrary data exchange, without insight or controls by the user’s browser.

![](static/mock10.svg)

# Next Steps

The [Classification Problem](#the-classification-problem), the [RP Tracking Problem](#the-rp-tracking-problem) and the [IDP Tracking Problem](#the-idp-tracking-problem) are the problems that we are set to solve.

The following should give you a deeper understanding of the problems, related problems and how they were tackled in the past:
  
- [Prior Art](prior.md)
- [The Threat Model](privacy_threat_model.md): a formalization of the problem
- [Related Problems](problems.md)

With a solid understanding of the problem space, you can read below some of the thoughts on how to address them:

- An early exploration of [The Solution Space](design.md)

