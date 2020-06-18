---
permalink: index.html
layout: post
title: WebID
---

**TL;DR**; This is an **early exploration** of ways that Browsers can help users of the Web make [safer](#the-rp-tracking-problem) decisions while logging in on [websites](#rp) with [identity providers](#idp).

This explainer is broken down into:

- [The Problem](#the-problem)
- [Prior Art](#prior-art)
- [An early exploration](#early-exploration)
- [Related Problems](#related-problems)

# The Problem

Over the last decade, identity federation has unquestionably played a central role in raising the bar for authentication on the web, in terms of ease-of-use (e.g. passwordless single sign-on), security (e.g. improved resistance to phishing and credential stuffing attacks) and trustworthiness compared to its preceding pattern: per-site usernames and passwords.

The standards that define how identity federation works today were built independently of the web platform, and their designers had to work **around** its limitations rather than extending them. Because of that, existing user authentication flows rely on general web capabilities such as top-level navigation, link decoration, window popups and cookies.

Because these general purpose primitives can be used for an open ended number of use cases (some of them increasingly allowing users to be tracked), browsers have to apply policies that capture the **lowest common denominator**, at best applying cumbersome permissions (e.g. popup blockers) but at worst entirely [blocking](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox) them.

If the low level primitives are being abused for tracking purposes and browsers are applying stricter policies around them, how do we keep identity federation around?

## The classification problem

Some of the problem starts with what we have been calling the classification problem.

When federation was first designed, it was rightfully designed **around** the existing capabilities of the web, rather than **changing** them. Specifically, federation worked with callbacks on top of **redirects** or **popup windows**, which didn't require any redesign, redeployment or negotiation with browser vendors.

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

In order to prevent tracking in federation, one has to solve what we've been calling the [RP tracking problem](#the-rp-tracking-problem) in federation and the [IDP tracking problem](#the-idp-tracking-problem).

## The RP Tracking problem

Relying party tracking is enabled through federation when services that the user signs in to **collude** with each other and other entities to deterministically or probabilistically **link** their user's accounts to build and get access to a richer user profile (e.g. one site selling data on browsing history for ads targeting to another service). While this could be enabled without federation per se (user could manually provide a joinable email address or phone number), federated identity providers have an opportunity to address this problem by providing the user with service-specific data and directed identifiers. 

![](static/mock3.svg)

## The IDP Tracking problem

Even if identity providers were to provide site-specific data and directed identifiers, IDPs and RPs can exchange data without the user explicitly being aware of what information is flowing between the parties, and that the IDP may have insight into the user’s activity across sites. Federation is implemented via parameters on redirects / top level navigation, which allow for arbitrary data exchange, without insight or controls by the user’s browser.

![](static/mock10.svg)

# Prior Art

By far, the closest analogy to this work is the great work of [BrowserID](https://github.com/mozilla/id-specs/blob/prod/browserid/index.md#web-site-signin-flow) during the [Mozilla Personas](https://developer.mozilla.org/en-US/docs/Archive/Mozilla/Persona/The_navigator.id_API) effort (postmortem [here](https://wiki.mozilla.org/Identity/Persona_AAR)). In many ways, the goals that BrowserID was trying to achieve as well as the mechanisms that were created are a lot alike what’s being proposed here. There are significant differences in strategy and design, but let’s start with the similarities first because there are many.

First, BrowserID was clearly trying to solve similar problems, namely IDP Tracking and friction. The mechanisms that were created clearly had [strong builtin privacy components](https://www.youtube.com/watch?v=qHpFwdQw2wQ) to prevent IDPs from knowing about RPs and vice versa, via the chain of signatures gathered from IDPs (mainly email providers) and certificates generated by the browser.

Second, from a mechanism perspective, there was clearly a separation between an RP to Browser API as well as a Browser to IDP API. 

```javascript
navigator.id.get((assertion) => {}, {
  backgroundColor: "#606B72",
  siteName: "My Example Site"
});
```

The [RP calls a browser native API](https://github.com/mozilla/id-specs/blob/prod/browserid/index.md#web-site-signin-flow) to fetch an assertion which gets mediated by the [browser in coordination with the IDP](https://github.com/mozilla/id-specs/blob/prod/browserid/index.md#identity-provisioning-flow).

```javascript
// set up UI
navigator.id.beginAuthentication(function(email) {
  // update UI to display the email address
});
```

The postmortem analysis [here](https://wiki.mozilla.org/Identity/Persona_AAR) is very insightful in understanding what were the challenges faced and gives this proposal a solid place to work from. In many ways, we think some of these insights are rooted in the observation we made earlier about backwards compatibility with RPs and user’s current behavior, which we are deliberately trying to avoid. 

# Early Exploration

There is a wide set of privacy and usability goals for identity sharing on the web, but early on we ran into better understanding the structural deployment of federation on the web, specifically the properties that make different strategies more or less plausible.

For example, it is clear that there are relatively few public [IDPs](#idp) in use (say, tens), particularly in comparison to the number of [RPs](#rp) (say, millions) and their users (say, billions). A structural change that only requires adoption by IDPs and no changes or engagement on the part of RPs and users is significantly easier compared to redeploying millions of RPs or retraining billions of users.

Fortunately, in more cases than not, RPs implement federated identity importing a script provided by - and under the control of - IDPs, giving us a major deployment vehicle: IDP SDKs loaded into RPs. 

![](static/mock7.svg)

Nonetheless, while much of the client side code is under the (few) IDPs to control (e.g. we can replace redirects by other means), all of the server side code is under the (many) RPs to control, meaning that that is significantly harder to change (say, years). The cases where RPs implement federated identity without a dynamically loaded SDK will have a longer deployment window and will be discussed separately. 

Likewise, changing user behavior and norms is hard because of the number of people involved (say, billions). Unfamiliar login flows could result in users declining to use federated options, and instead opting for username/password credentials during RP account creation. To address that, this proposal aims to provide an experience that minimizes the divergence from existing federated identity user experience as much it possibly can (e.g. introducing new user decisions to be made).

So, with this deployment constraint in mind, let's look at what could be done.

## Status Quo

Currently, sign-in flows on websites begin with a login screen that provides the user options to use federated identity, as illustrated in the mock below. Today, clicking the button for an IDP relies on general purpose primitives (typically [redirects or popups](#low-level)) to an IDP sign-in flow. 

![](static/mock1.svg)

## Design Principles

- Minimal Disclosure
- Directed Identifiers
- Server-Side Backwards compatibility

## Browser API

In this formulation, we provide a [high-level](#high-level), identity-specific API that allows browsers to [classify](#the-classification-problem) the otherwise **opaque** transactions that are enabled by [low-level](#low-level) APIs.

By classifying as an identity data exchange, browsers are now in a position to provide domain specific guidance to users regarding the consequences of the specific identity transaction.

The browser intermediates the exchange of the identity token between the RP and the IDP:

![](static/mock14.svg)
We can break these down in four stages:

- The [invocation](#the-invocation-stage) stage: the user makes a user gesture and the RP calls a newly introduced API
- The [provisioning](#the-provisioning-stage) stage: the browser makes an assessment over the risks involved in exchanging the data (e.g. does it contain a global identifier?),
- The [mediation](#the-mediation-stage) stage: makes sure the user consents and understands the risks involved (e.g. scarier prompts when a global identifier is found) and
- The [creation](#the-creationg-stage) stage: with the user's consent established, an IdToken is then created.

Lets go over each of these stages in more detail.

### The Invocation Stage

In the invocation stage, the [low-level](#low-level) redirect/popup flow gets replaced by the invocation of a new **high-level** identity-specific API (see [alternatives considered](#alternatives-considered)) that enables RPs to request IdTokens, for example:

```javascript
// This is just a possible starting point, largely TBD.
let {idToken} = await navigator.credentials.get({
  provider: "https://accounts.example.com",
  // other OpenId connect parameters
});
```

At this stage, the browser makes an assessment of the user's intention, for example making sure that the API was used as a result of a user gesture.

### The Provisioning Stage

Upon invocation of the API, the browser proceeds to talk to the IDP (e.g. via a **.well-known** convention) and gathers the user's basic profile to build the consent UI per the OpenId's [Standard Claims](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims):

| field          | description                                                                   |
|----------------|-------------------------------------------------------------------------------|
| name           | the user's fulll name                                                         |
| email          | the user's email addresses                                                    |
| email_verified | whether the email is verified or not                                          |

For example:

```json
{
 "name": "Sam Goto",
 "email": "samuelgoto@gmail.com",
 "email_verified": "true",
}
```

The IDP also gets the opportunity to inform the browser if it needs to walk the user through a custom IDP-specific flow to pick accounts, create accounts and / or reauthenticate.

![](static/mock16.svg)

The browser also makes an assessment of the privacy policies the IDP follows.

We believe a combination of strategies are going to be involved, but it seems hard to escape some form of agreement on policy, specifically because of server-side / out-of-band collusion where browsers aren't involved. So, as a starting point, this strawman proposal starts with a mechanism and convention that allows IDPs to explicitly acknowledge certain service agreements.

```js
// Available on a .well-known/webid file:
{
  "@context": "https://www.w3.org/ns/webid",
  "@type": "IdentityProvider",
  "policies": [
    "https://tbd.org/policies/privacy/1.0"
  ]
  ... TBD ...
  // possibly signed by a neutral authority that verifies the claims?
}
```

At this point, the browser hasn't yet revealed  who the RP is quite yet, without the user's permission. So, a idtoken with well established field is created but not quite yet signed by the IDP:

### The Mediation Stage

With the user's identity information at hand, the browser then proceeds to gathering consent from the user and raising awareness of any peril that may be involved according to the assessment it made in the last stage.

![](static/mock15.svg)

### The Creation Stage

After the user consents, the browser can now be confident about the user's intention and finally unveils to the IDP the RP, which the IDP can then use to mint a new token addressed/directed to the specific RP.

The browser makes a `POST` request to an agreed-upon endpoint to generated a [directed basic profile](#directed-basic-profile).

```
POST /.well-known/webid/create HTTP/1.1
Host: accounts.idp.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 27

client_id=1234
```

#### Directed Basic Profile

The data that is exchanged is designed to be consequence-free: minimize as much as possible the disclosure of information between IDPs and RPs while keeping it (a) viable for signing-in/signing-up and (b) backwards compatible.

By consequence-free, we mean that the data that is exchanged at this stage isn't able to be joined across RPs. By minimally viable and backwards-compatible we mean that it is sufficient for authentication and could be used without RPs changing their servers.

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

For example:

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

The IdToken is signed into a JWT and then returned back to the RP which can effectively get the user logged in. Here is an example ([decoded](https://jwt.io/#debugger-io?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmlkcC5jb20iLCJzdWIiOiIxMTAxNjk0ODQ0NzQzODYyNzYzMzQiLCJhdWQiOiJodHRwczovL2V4YW1wbGUuY29tIiwiaWF0IjoiMjM0MjM0MiIsIm5hbWUiOiJTYW0gRyIsImVtYWlsIjoic2prbGQyMDkzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjoidHJ1ZSIsInByb2ZpbGUiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vZGVmYXVsdC1hdmF0YXIucG5nIn0.3fGpHH5IeL2fDxbToBLE2DWDf6hfHU5YfiSdfqRGlIA)) of what a signed JWT looks like for the payload above:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmlkcC5jb20iLCJzdWIiOiIxMTAxNjk0ODQ0NzQzODYyNzYzMzQiLCJhdWQiOiJodHRwczovL2V4YW1wbGUuY29tIiwiaWF0IjoiMjM0MjM0MiIsIm5hbWUiOiJTYW0gRyIsImVtYWlsIjoic2prbGQyMDkzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjoidHJ1ZSIsInByb2ZpbGUiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vZGVmYXVsdC1hdmF0YXIucG5nIn0.3fGpHH5IeL2fDxbToBLE2DWDf6hfHU5YfiSdfqRGlIA
```


# Alternatives Considered

## Mixed Browser UI

The most notable alternative considered is one that gives a greater amount of autonomy and extensibility browsers give to identity providers. In this alternative, at the [mediation stage](#the-mediation-stage), the browser would load content that is controlled by the IDP giving it the flexibility to own the user journey, while still making sure there is clear attribution (e.g. having the IDP origin clearly stated).

![](static/mock2.svg)

The benefits of this approach are fairly clear: it gives IDPs the autonomy to cover their various use cases, differentiate between each other, innovate and compete, without the browser pulling them back.

The drawbacks are clear too:

1. it constitutes cross-site communication that can be used/abused outside of authentication, putting us back at the [classification problem](#the-classification-problem).
1. the browser can't be confident about the user's consent, so it is forced to apply general purpose policies.

For those reasons, we think that the browser mediated formulation best fit our goals.

## Inline affordance

One notable alternative considered is a declarative formulation that would allow embedding the user experience inline in the content area while still keeping the cross-origin separation before user consent. For example:

```html
<input type=”idtoken” provider=”https://accounts.example.com”>
```

From a friction perspective, it seems that users benefit from seeing their names/avatar in the sign-in buttons.

It also seemed to make things more complicated in terms of user comprehension (do users understand the cross-origin separation if that is inline?) and incentives (e.g. is clickjacking now a problem?).

So, seemed like a plausible formulation worth noting, but one that didn't seem right to start from.

# Related Work

- [Building a More Private Web](https://blog.chromium.org/2020/01/building-more-private-web-path-towards.html)
- [Personas](https://wiki.mozilla.org/Identity/Persona_AAR) and [navigator.id](https://developer.mozilla.org/en-US/docs/Archive/Mozilla/Persona/The_navigator.id_API)
- [WebOTP](https://github.com/WICG/WebOTP)
- [Credential Manager](https://w3c.github.io/webappsec-credential-management/#federated)
- Add your work [here](https://github.com/samuelgoto/WebID/issues/new)

# Terminology

## RP

Relying Parties.

## IDP

Identity Providers.

## low level

General Purpose APIs, namely redicts and iframes.

## high level

Domains Specific APIs.
