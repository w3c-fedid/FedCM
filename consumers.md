> NOTE: this is an analysis only applicable to the very specific [deployment structure](#topology) of federation for **consumers**.
> If you are looking for an analysis to other use cases, go [here](design.md) or [here](enterprises.md).

This is an **early exploration** of the design alternatives to address [the problem](README.md) under [the thread model](privacy_thread_model.md).

This section is broken into:

- [Topology](#topology): the deployment structure
- [High Level Design](#high-level-design): the interfaces
- [The Consumer API](#the-consumer-api): the RP API
  - [Sign-in API](#the-sign-in-api)
  - [Authorization API](#the-authorization-api)
- [The Provider API](#the-provider-api): the IDP API
  - [Alternative Designs](#alternative-designs)
    - [The Status Quo API](#the-status-quo-api)
    - [The Permission-oriented APIs](#the-permission-oriented-apis)
    - [The Mediation-oriented API](#the-mediation-oriented-apis)
    - [The Delegation-oriented API](#the-delegation-oriented-api)
    
# Consumers

We'll start by going through an analysis of the [deployment structure](#topology) of federation for **consumers**.

We'll then go over how we think [The Consumer API](#the-consumer-api) (the interface between the RP and the Browser) could look like, and then we'll follow with a series of alternatives for [The Provider API](#the-provider-api) (the interaction between the Browser and the IDP) that are being taken under consideration.

## Topology

Currently, for **consumers**, sign-in flows on websites begin with a login screen that provides the user options to use federated identity, as illustrated in the mock below. Today, clicking the button for an IDP relies on general purpose primitives (typically [redirects or popups](#low-level)) to an IDP sign-in flow. 

![](static/mock1.svg)

There is a wide set of privacy and usability goals for identity sharing on the web, but early on we ran into better understanding the structural deployment of federation on the web, specifically the properties that make different activation/adoption strategies more or less plausible.

For example, it is clear that there are relatively few public [IDPs](#idp) in use (say, tens), particularly in comparison to the number of [RPs](#rp) (say, millions) and their users (say, billions). A structural change that only requires adoption by IDPs and no changes or engagement on the part of RPs and users is significantly easier compared to redeploying millions of RPs or retraining billions of users.

Fortunately, in more cases than not (by our estimates, about half of the deployment), RPs implement federated identity importing a script provided by - and under the control of - IDPs, giving us a major deployment vehicle: IDP SDKs loaded into RPs. 

![](static/mock7.svg)

Nonetheless, while much of the client side code is under the (few) IDPs to control (e.g. we can replace redirects by other means), all of the server side code is under the (many) RPs to control, meaning that that is significantly harder to change (say, years). The cases where RPs implement federated identity without a dynamically loaded SDK will have a longer deployment window and will be discussed separately. 

Likewise, changing user behavior and norms is hard because of the number of people involved (say, billions). Unfamiliar login flows could result in users declining to use federated options, and instead opting for username/password credentials during RP account creation. To address that, this proposal aims to provide an experience that minimizes the divergence from existing federated identity user experience as much it possibly can (e.g. introducing new user decisions to be made).

So, with this deployment constraint in mind, let's look at some alternatives under exploration.

## High Level Design

From a high level perspective, the browser acts as an mediator between two parties: the relying party and the identity provider.

> TODO(goto): fix this diagram to be more high level.
> ![](static/mock14.svg)

The browser exposes two distinct interfaces for the intermediation:

- [The Consumer API](#the-consumer-api) to allow a relying party to request and receive an identity token and
- [The Provider API](#the-provider-api) to allow an identity provider to provide an identity token

We'll go over each of these separately next.

## The Consumer API

The consumer API is the Web Platform privacy-oriented API that relying parties call to request information from a specific identity provider, to be used in replacement of the current redirect/popup affordances that are currently used.

From the perspective of [The Privacy Threat Model](privacy_threat_model.md), there are two notably distinct uses of federation:

* signing-in and
* authorization

While both are implemented on top of OAuth as different scopes, the former (typically deployed with the `openid` oauth scope) captures a meaningful volume of usage (we estimate it be around 80% of the use) at a much more controlled surface area (including transactions done at the front channel with idtokens as opposed to access tokens), whereas the latter is much more powerful and used less frequently (as well as done primarily on the back channel).

Lets first turn to the former use, and then go over authorization following that.
  
### The Sign-In API

Simply put, the Sign-In API takes an identity provider as input and returns an idtoken as output.

The current redirect/popup flow gets replaced by the invocation of a newly introduced identity-specific API that enables RPs to request IdTokens.

We don't know exactly what it should look like, but here is an example that can serve as a starting point:

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

Upon success, the consumer API results into an idtoken. For example:

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

The IdToken is signed into a JWT and then returned back to the relying party which can effectively get the user logged in. Here is [an example](https://jwt.io/#debugger-io?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmlkcC5jb20iLCJzdWIiOiIxMTAxNjk0ODQ0NzQzODYyNzYzMzQiLCJhdWQiOiJodHRwczovL2V4YW1wbGUuY29tIiwiaWF0IjoiMjM0MjM0MiIsIm5hbWUiOiJTYW0gRyIsImVtYWlsIjoic2prbGQyMDkzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjoidHJ1ZSIsInByb2ZpbGUiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vZGVmYXVsdC1hdmF0YXIucG5nIn0.3fGpHH5IeL2fDxbToBLE2DWDf6hfHU5YfiSdfqRGlIA) of what a signed JWT looks like for the payload above.

### Directed Basic Profile

The data that is exchanged is designed to be consequence-free: minimize as much as possible the disclosure of information between IDPs and RPs while keeping it (a) viable for signing-in/signing-up and (b) backwards compatible.

For backwards compatibility, we use a restrictive subset of OpenId's [standard claims](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims), namely:

| field          | description                                                                   |
|----------------|-------------------------------------------------------------------------------|
| iss            | The issuer, per the OpenID specification                                      |
| aud            | The intended audience, per the OpenId specification                           |
| iat            | The creation time, per the OpenId specification                               |
| exp            | The expiration time, per the OpenId specification                             |
| sub            | The user's directed user ids (rather than global user ids)                    |
| email          | The user's email directed addresses (rather than global)                      |
| email_verified | Whether the email is verified or not                                          |
| profile        | static/guest/global/default profile pictures / avatars                        |
| name           | directed names (e.g. initials, just first names, etc)                         |

By consequence-free, we mean that the data that is exchanged at this stage isn't able to be joined across RPs. By minimally viable and backwards-compatible we mean that it is sufficient for authentication and could be used without RPs changing their servers.

### The Authorization API

Relying Parties often rely on more services from IDPs which are gathered via subsequent flows to get the user's authorization to release access to broader scopes. Notably, there is a long tail of these scopes, with little to no commonalities between them (say, access to calendar, photos, social graphs, etc).

To allow users to continue accessing broader scopes, we expose a new API to mediate that flow. For example:

```javascript
navigator.credentials.requestAuthorization({
  scope: "https://idp.com/auth/calendar.readonly",
  provider: "https://idp.com",
});
```

Now that we looked at the surface area introduced for relying parties, lets turn into [The Provider API](#the-provider-api) and see what are the options under consideration for the intermediation between the user agent and the identity provider.

## The Provider API

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

### Alternative Designs

We'll try to go over the thought process and the biggest considerations to be made starting from the most basic thing that we could do to some of the most involved.

In each step, we'll try to go over some of the pros and cons. They can be introduced in the following order:

1. The [Status Quo](#the-status-quo-api) API
1. The [Permission-oriented](#the-permission-oriented-apis) APIs
1. The [Mediation-oriented](#the-mediation-oriented-apis) APIs
1. The [Delegation-oriented](#the-delegation-oriented-api) API 

Lets go over each of these in that order.
  
#### The Status Quo API

A trivial alternative that is worth noting as a baseline is to "do nothing" and keep federation using low level primitives like redirects and popups.

That seems clear to reject based on:

- the increasing constraints that are being put in place for cross-site communication through third party cookies, postMessage and URL parameters as link decorations as a result of the [IDP tracking problem](#the-idp-tracking-problem)
- the inability to prevent the [RP tracking problem](#the-rp-tracking-problem)

From here, the next incremental step we could look at are permission-oriented APIs.

#### The Permission-oriented APIs

The Permission-oriented APIs are a series of formulations where the browser tries to "get out of the way" as much as possible, letting IDPs drive as much as possible of the user experience.

In this formulation, the browser gathers the user's permission and builds comprehension, but otherwise "gets out of the way" of IDPs.

![](static/mock2.svg)

The two most meaningful permission moments a user would go through are:
  
- Acknowledgement that the IDP will [be made aware](README.md#the-idp-tracking-problem) as you sign-up and sign-into the relying parties.
- Acknowledgement that the RP will [be made able to join](README.md#the-rp-tracking-problem) the user's identities with other relying parties.

These prompts would be inserted by the browser before or after the IDP pass.
  
The benefits of this approach are fairly clear: it gives IDPs the autonomy to cover their various use cases, differentiate between each other, innovate and compete, without the browser pulling them back.

The drawbacks of this approach is that:

- There would be three independent blocking permission moments: (a) one by the browser to capture the permission to allow the RP and the IDP to communicate, (b) one by the IDP to capture permission to sign-in with the RP and (c) one by the browser to capture the acknowledgement that RPs can track you when undirected identifiers are used.
- The [The IDP Tracking Problem](README.md#the-idp-tracking-problem) and the [The RP Tracking Problem](README.md#the-rp-tracking-problem) are addressed via consent rather than mechanically. Because of the difficulty users have in comprehending the risks involved, there is a chance the permission moments will be as effective as "speed bumps" that users dismiss just to get them out of the way.
- Because the IDP is controlling the user journey, the browser doesn't have the ability to promote directed identifiers as defaults (outside of policy).
  
Naturally, the next set of formulations try to address these two shortcomings at the cost of the autonomy of the IDP and the ossification of parts of the flow.

#### The Mediation-oriented APIs

In this formulation, the browser pulls the responsibility for itself to drive the data exchange, enabling it to (a) bundle the consent moments described in the formulation above and (b) steers users to safer defaults.
  
![](static/mock15.svg)

After the user acknowledgement, the browser can be confident about the user's intention and finally unveils to the IDP the RP, which the IDP can then use to mint a new token addressed/directed to the specific RP.

The benefits of this variation is that it (a) bundles the consent moments into a single prompt and (b) enables the browser to address [The RP Tracking Problem](README.md#the-rp-tracking-problem) by picking defaults that promote [directed basic profiles](#directed-basic-profile).

The drawbacks of this variation is that it:

- Ossifies the Sign-In flow and
- [The IDP Tracking Problem](README.md#the-idp-tracking-problem) is still only addressed via consent rather than mechanically.
  
#### The Delegation-oriented API

The last alternative under consideration continues to pull responsibility for the browser, enabling it to finally address the [The IDP Tracking Problem](README.md#the-idp-tracking-problem) mechanically.

In this formulation, the IDP delegates the presentation of identity assertions to the Browser. It accomplishes that by making the browser generate a public/private key pair and have the IDP sign a certificate attesting that the browser's private key can issue certificates for a certain JWT.

The biggest benefits of this variation are:

- The delegation mechanically solves the [The IDP Tracking Problem](README.md#the-idp-tracking-problem): it keeps the IDP unaware of where the user is signing-into while still enabling the user to recover its account while moving around.
- Because there aren't any [IDP Tracking Problem](README.md#the-idp-tracking-problem) nor any [RP Tracking Problem](README.md#the-rp-tracking-problem), this can possibly be a zero-prompt, consequence-free UX.  
  
The biggest drawback of this variation is that it leads to a JWT that is not backwards compatible with the existing server-side deployment of relying parties (which are expecting the IDP to sign JTWs, not the Browser), which is O(K) hard to change.

