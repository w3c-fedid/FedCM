---
title: "Mediation-oriented API"
created: 08/10/2020
updated: 08/10/2020
---

In this variation of the [Provider API](consumers.md#the-provider-api), we modify the [Permission-oriented](consumers.md#the-permission-oriented-variation) variation to:

- Bundle the prompts to unify the case where the users opt-into using an undirected profile.
- Allow the user agent to pick defaults (e.g opt-out vs opt-in) and control the use of [directed profiles](directed_basic_profile.md).

The fundamental modification to achieve these goals is allow the browser to mediate the sign-in flow:  

![](static/mock15.svg)

In this formulation, we solve the cross-browser consistency by leveraging the IDP: specifically, the IDP tells the browser whether a given flow is a sign-up or sign-in. A consequence of this is that the IDP must learn at least the RP’s origin before the browser UI is painted. This flow is similar to [Permission-oriented API](permission_oriented_api.md) in that it makes the assumption that IDPs can learn the RP's origin after a user gesture on the RP page.

![](static/mock18.svg)

# Benefits

- Fewer prompts compared to the [Permission-oriented](consumers.md#the-permission-oriented-variation) variation
- Prompts are "functional" (part of a decision the user has to make) rather than "informational" (speed bumps)
- The browser has the ability to control the defaults

# Challenges

- Ossification: Browsers need to become opinionated about sign-in and the subset of flows that enables it.
- User comprehension: the browser UI is displaying data (including T&Cs) provided by the IDP. Will users get confused and take it as browser provided data or that the browser has fully vetted the IDP?
