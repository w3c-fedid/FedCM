---
title: "Consumers"
maintainer: "samuelgoto"
created: 01/01/2020
updated: 07/10/2020
---

This is an **early exploration** of the design alternatives to address [this problem](README.md) under [this threat model](privacy_threat_model.md) for **consumers**.

> NOTE: this is an analysis only applicable to the very specific deployment [structure](activation.md) of federation for **consumers**.
> If you are looking for an analysis to other use cases, go [here](design.md) or [here](enterprises.md).

This section goes over the **what** and the **how**. It presuposes that you have read and started from:

- The **why**: the [problem](README.md) statement and the [motivations](privacy_threat_model.md) and the [topology](activation.md) of the parties involved.
- The **why not**: the [alternatives](alternatives_considered.md) considered (e.g. the [prior art](prior.md), the [status quo](alternatives_considered.md#the-status-quo) and the [requestStorageAccess API](alternatives_considered.md#the-request-storage-access-api)).

We'll then go over the [high-level overview](#high-level-design) and a breakdown into two smaller problems:

- [The Consumer API](#the-consumer-api) (i.e. the interface between the RP and the Browser) and
- [The Producer API](#the-producer-api) (i.e. the interaction between the Browser and the IDP).

In the first part of the last section will go over the (slightly less controversial) [Consumer API](#the-consumer-api) and the useful separation between:

- The [Sign-in API](#the-sign-in-api) and
- The [Authorization API](#the-authorization-api).

Finally, we'll then enumerate a series of alternatives for the (much more contentious) [Provider API](#the-provider-api):

- The [Permission-oriented](#the-permission-oriented-variation) Variation
- The [Mediation-oriented](#the-mediation-oriented-variation) Variation
- The [Delegation-oriented](#the-delegation-oriented-variation) Variation

# High Level Design

From a high level perspective, the browser acts as an mediator between two parties: the relying party and the identity provider.

![](static/mock14.svg)
The browser exposes two distinct interfaces for the intermediation:

- [The Consumer API](#the-consumer-api) to allow a relying party to request and receive an identity token and
- [The Provider API](#the-provider-api) to allow an identity provider to provide an identity token

We'll go over each of these separately next.

# The Consumer API

The consumer API is the Web Platform privacy-oriented API that relying parties call to request information from a specific identity provider, to be used in replacement of the current redirect/popup affordances that are currently used.

From the perspective of [The Privacy Threat Model](privacy_threat_model.md), there are two notably distinct uses of federation:

* [signing-in](glossary.md#federated-sign-in) and
* [authorization](glossary.md#authorization)

While both are implemented on top of OAuth as different scopes, the former (typically deployed with the `openid` oauth scope) captures a meaningful volume of usage (we estimate it be around 80% of the use) at a much more controlled surface area (including transactions done at the front channel with idtokens as opposed to access tokens), whereas the latter is much more powerful and used less frequently (as well as done primarily on the back channel).

Lets first turn to the former use, and then go over authorization following that.
  
## The Sign-In API

Simply put, the Sign-In API is a Web Platform affordance that takes an identity provider as input and returns a [directed basic profile](directed_basic_profile.md) as output. It substitutes the navigational/popup affordances currently used.

We don't know yet exactly what it should look like, but here is an example that can serve as a starting point:

```javascript
// This is just a possible starting point, largely TBD.
let {idToken} = await navigator.credentials.get({
  provider: "https://accounts.example.com",
  // other OpenId connect parameters
});
```

Another notable alternative worth considering is a declarative API that would allow embedding the user experience inline in the content area while still keeping the cross-origin separation before user consent. For example:

```html
<input type=”idtoken” provider=”https://accounts.example.com”>
```

Upon invocation, the browser makes an assessment of the user's intention, for example making sure that the API was used as a result of a user gesture.

From there, the browser proceeds to mediate the data exchange with the chose identity provider via [The Provider API](#the-provider-api).

Upon success, the consumer API results into a [directed basic profile](directed_basic_profile.md). For example:

```json
{
 "iss": "https://accounts.idp.com",
 "sub": "110169484474386276334",
 "aud": "https://example.com",
 "iat": "2342342",
 "name": "Sam G",
 "email": "sjkld2093@gmail.com",
 "email_verified": "true",
 "profile": "https://accounts.google.com/default-avatar.png",
}
```

The [directed basic profile](directed_basic_profile.md) is signed into a JWT and then returned back to the relying party which can effectively get the user logged in. Here is [an example](https://jwt.io/#debugger-io?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmlkcC5jb20iLCJzdWIiOiIxMTAxNjk0ODQ0NzQzODYyNzYzMzQiLCJhdWQiOiJodHRwczovL2V4YW1wbGUuY29tIiwiaWF0IjoiMjM0MjM0MiIsIm5hbWUiOiJTYW0gRyIsImVtYWlsIjoic2prbGQyMDkzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjoidHJ1ZSIsInByb2ZpbGUiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vZGVmYXVsdC1hdmF0YXIucG5nIn0.3fGpHH5IeL2fDxbToBLE2DWDf6hfHU5YfiSdfqRGlIA) of what a signed JWT looks like for the payload above.

## The Authorization API

Relying Parties often rely on more services from IDPs which are gathered via subsequent flows to get the user's authorization to release access to broader scopes. Notably, there is a long tail of these scopes, with little to no commonalities between them (say, access to calendar, photos, social graphs, etc).

To allow users to continue accessing broader scopes, we expose a new API to mediate that flow. For example:

```javascript
navigator.credentials.requestAuthorization({
  scope: "https://idp.com/auth/calendar.readonly",
  provider: "https://idp.com",
});
```

Now that we looked at the surface area introduced for relying parties, lets turn into [The Provider API](#the-provider-api) and see what are the options under consideration for the intermediation between the user agent and the identity provider.

# The Provider API

The purpose of the Provider API is to fulfill the invocation of [The Consumer API](#the-Consumer-api) by coordinating with the identity provider.

From the perspective of [The Privacy Threat Model](privacy_threat_model.md), the Provider API has a much wider set of choices and trade-offs:

1. Because of the [classification problem](README.md#the-classification-problem), we want to prevent a tracker from abusing this API by impersonating an IDP to track users.
1. Because of the [RP tracking problem](README.md#the-rp-tracking-problem), we want to promote directed identifiers as much as we can.
1. Because of the [IDP tracking problem](README.md#the-idp-tracking-problem), we want to keep IDPs involved only to the extent that they justifiably need to.

We also want to make sure that:

- There is a credible path towards eventual browser interoperability (e.g. firefox, safari, edge)
- The scheme reaches an economically viable equilibrium for all parties involved, from a design of incentives perspective
- The scheme handles gracefully federation on non-web platforms (e.g. Android, iOS, PlayStation, etc)
- We minimize the deployment and activation windows (e.g. server-side / client-side and user-behavior backwards compatibility) for relying parties and identity providers
- The scheme has a deliberate and well informed extensibility and ossification model, i.e. make extensible where innovation is constructive and ossify where there is less rapid iteration going on and there a direct value in terms of privacy/security. 
  
We believe we all still have a lot to learn from each other (browser vendors, identity providers, relying parties, etc) in choosing the mean between the extremes of excess and deficiency with regards to the trade-offs of privacy, usability and economic viability.

Having said that, in the following section we'll enumerate some of the most prominent variations under consideration and their trade-offs.

We'll try to go over the thought process and the biggest considerations to be made starting from the most basic thing that we could do to some of the most involved.

The approaches are categorized into three general approaches:

1. The [Permission-oriented](#the-permission-oriented-variation) Variation
1. The [Mediation-oriented](#the-mediation-oriented-variation) Variation
1. The [Delegation-oriented](#the-delegation-oriented-variation) Variation
  
## The Permission-oriented Variation

The simplest approach is to have WebID offer APIs that allow cross-origin data sharing for sign-in and authorization use cases that works much as they do today, but with the user agents providing warnings and consent moments to the user when new tracking risks appear.

![](static/mock19.svg)

An expanded exploration of this approach with its benefits and drawbacks can be seen [here](permission_oriented_api.md).

Naturally, the next set of formulations try to address these two shortcomings at the cost of the autonomy of the IDP and the ossification of parts of the flow.

## The Mediation-oriented Variation

In this formulation, the browser pulls the responsibility for itself to drive the profile exchange, enabling it to (a) bundle the consent moments described in the formulation above and (b) steer users to safer defaults.
  
![](static/mock15.svg)

An expanded exploration of this approach with its benefits and drawbacks can be seen [here](mediation_oriented_api.md).
  
## The Delegation-oriented Variation

The last alternative under consideration continues to pull responsibility for the browser, enabling it to finally address the [The IDP Tracking Problem](README.md#the-idp-tracking-problem) mechanically.

In this formulation, the IDP delegates the presentation of identity assertions to the Browser. It accomplishes that by making the browser generate a public/private key pair and have the IDP sign a certificate attesting that the browser's private key can issue certificates for a certain JWT.

The biggest benefits of this variation are:

- The delegation mechanically solves the [The IDP Tracking Problem](README.md#the-idp-tracking-problem): it keeps the IDP unaware of where the user is signing-into while still enabling the user to recover its account while moving around.
- Because there aren't any [IDP Tracking Problem](README.md#the-idp-tracking-problem) nor any [RP Tracking Problem](README.md#the-rp-tracking-problem), this can possibly be a zero-prompt, consequence-free UX.  
  
The biggest drawback of this variation is that it leads to a JWT that is not backwards compatible with the existing server-side deployment of relying parties (which are expecting the IDP to sign JTWs, not the Browser), which is O(K) hard to change.

