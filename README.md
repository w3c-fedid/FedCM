---
permalink: index.html
layout: post
title: WebID
---

**TL;DR**; This is an **exploration** of a new Web API to allow websites to keep using identity federation in the [privacy sandbox](https://web.dev/digging-into-the-privacy-sandbox/), helping users make safe decisions about what data they share with websites (most notably, [global identifiers](problem.md#rp-tracking-and-joinability)). 

This proposal has two parts:

1. An API that websites ([RPs](#rp)) can use to [request](#relying-party-api) the user's identity and
1. An API that identity providers ([IDPs](#idp)) can use to [provide](#identity-provider-api) the user's identity and a mechanism to declare their privacy [agreements](#well-knownwebid)

# Why?

([longer version](problem.md))

Over the last decade, identity federation has unquestionably played a central role in raising the bar for authentication on the web, in terms of ease-of-use (e.g. passwordless single sign-on), security (e.g. improved resistance to phishing and credential stuffing attacks) and trustworthiness compared to its preceding common pattern: per-site usernames and passwords.

The standards that define how identity federation works today were built independently of the web platform, and their designers had to work **around** its limitations rather than extending them. Because of that, existing user authentication flows rely on general web capabilities such as top-level navigation, link decoration, window popups and cookies.

Unfortunately, these same [low-level](#low-level) capabilities that facilitate cross-origin data transmission are increasingly being used to pass identifying information about users without their knowledge or consent. Most notably, global identifiers (e.g. email addresses, usernames) can be used to [link accounts](problem.md#rp-tracking-and-joinability) when two or more relying parties collude.

![](static/mock3.svg)

This proposal provides a way forward for browsers to support federated identity over an [identity specific](#high-level) channel that will eliminate RP and IDP reliance on those lower level capabilities. From that stepping stone, the user agent will be better able to protect the user's privacy during authentication flows, and also the web platform can make privacy-enhancing changes without concern for breaking federated identity flows.

# Considerations

There is a wide set of privacy and usability goals for identity sharing on the web, but this proposal is largely optimized for a plausible deployment on the web, specifically maintaining **user behavior** and **website infrastructure** backwards compatible.

A noteworthy observation of identity federation on the web today is that there are relatively few public [IDPs](#idp) in use (say, tens), particularly in comparison to the number of [RPs](#rp) (say, millions) and their users (say, billions). Any deployment will be much easier if it only requires adoption by IDPs and no changes or engagement on the part of RPs and users. Fortunately, in more cases than not, RPs implement federated identity importing a script provided by - and under the control of - IDPs, giving us a major deployment vehicle: IDP SDKs loaded into RPs. 

![](static/mock7.svg)

Nonetheless, while much of the client side code is under the (few) IDPs to control (e.g. we can replace redirects by other means), all of the server side code is under the (many) RPs to control, meaning that that is significantly harder to change (say, years). The cases where RPs implement federated identity without a dynamically loaded SDK will have a longer deployment window and will be discussed separately. 

Likewise, changing user behavior and norms is hard because of the number of people involved (say, billions). Unfamiliar login flows could result in users declining to use federated options, and instead opting for username/password credentials during RP account creation. To address that, this proposal aims to provide an experience that minimizes the divergence from existing federated identity user experience as much it possibly can (e.g. introducing new user decisions to be made).

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

# Proposal

Currently, sign-in flows on websites usually begin with a login screen that provides the user options to use federated identity, as illustrated in the mock below. Today, clicking the button for an IDP relies on general purpose primitives (typically [redirects or popups](#low-level)) to an IDP sign-in flow. 

![](static/mock1.svg)

This proposal provides a [high-level](#high-level), identity-specific API that allows browsers to **classify** the otherwise **opaque** transactions that are enabled by [low-level](#low-level) APIs.

By classifying as an identity data exchange, browsers can provide domain specific guidance to users regarding the consequences of the specific identity transaction.

The high level API is broken down into two parts:

- A [Relying Party API](#relying-party-api)
- An [Identity Provider API](#identity-provider-api)

### Relying Party API

In this formulation, the current redirect/popup flow gets replaced by the invocation of a new **high-level** identity-specific API that enables RPs to request IdTokens. While largely to be determined, a good starting point and source of inspiration can be drawn from the [PaymentsRequest API](https://developers.google.com/web/fundamentals/payments/merchant-guide/deep-dive-into-payment-request) because it has similar UX flows, number of players and privacy requirements:

```javascript
// This is just a possible starting point, largely TBD.
let {idToken} = await new IdentityRequest({
  provider: "https://accounts.example.com",
  // other OpenId connect parameters
}).show();
```

Here is a declarative formulation that could potentially work too:

```html
<input type=”idtoken” provider=”https://accounts.example.com”>
```

In current flows this is done on the IDP’s page following a top-level navigation, but we suggest that it could be better placed in a popup window or a tab-modal dialog resembling what is used for PaymentHandler [windows](https://www.w3.org/TR/payment-handler/#windows) or the proposed [modal-window](https://github.com/adrianhopebailie/modal-window/blob/master/explainer.md), for performing the Identity Provisioning Flow step that follows. The mock below shows an example of a bottom sheet that combines IDP-supplied and browser-supplied UI.

![](static/mock2.svg)

### Identity Provider API

With the IDP's endpoint loaded in a content area of their own control, it is the IDPs responsibility to navigate the user through their own consent flow. 

Once the IDP has gathered enough consent from the user, it uses a newly exposed JS API to inform the browser that an idtoken has been generated:

```javascript
// This API is still largely to be determined. But here is an idea
// to get the ball rolling:
new IdentityResponse().resolve(idToken};
```

The `IdentityResponse` would be created and `resolved` upon the user consent in the IDP UI. Here is an example of what that could look like on desktop:

![](static/mock8.png)

#### `.well-known/webid`

Browsers intermediate the data exchange according to their assessment of the privacy properties involved: the more it believes that the exchange is respecting the user's privacy the less it has to raise the user's awareness of the perils involved (e.g. scary permission prompts). 
 
We believe a combination of strategies are going to be involved, but it seems hard to escape some form of agreement on policy, specifically because of server-side / out-of-band collusion where browsers aren't involved. So, as a starting point, this strawman proposal starts with a mechanism and convention that allows IDPs to explicit acknowledge certain service agreements.


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

The IDPs host the `.well-known/webid` file to acknowledge and express agreement on privacy policies. Browsers load the file and inform the user accordingly.

In addition to that, browsers could choose to use a variety of other mechanisms to help them further assess, for example:

- **IdToken introspection**: browsers could observe when global identifiers (e.g. email addresses) are being passed to different origins and warn users.
- **Crypto**: browsers and IDPs could agree upon a one-way hash function to build verifiably directed identifiers (e.g. `HASH(GLOBAL_ID+ origin) == LOCAL_ID`).

Aside from the mechanisms, from a deployment perspective, our intuition is that supporting directed identifiers by IDPs is:

1. **directionally** correct but
2. a large architectural change

Because of that, we imagine that the enforcement of these policies are going to be deployed in multiple phases in coordination with IDPs.

# Future Work

## Friction

The proposal hopefully has a comparable or better completion rates compared to the status quo, or else IDPs will just move to other mechanisms. Nonetheless, from this viewpoint, there are a series of friction enhancements that browsers could provide, specifically around its unique ability to aggregate data across origin boundaries, for example mediating across IDPs and addressing the **NASCAR flag** problem.

## IDP Tracking

The proposal isn’t changing the amount of information (nor its timing) exchanged between RPs and IDPs. A few possible ways [IDP tracking](problem.md#idp-tracking-and-opaque-data-exchange) can be improved:

- the user agent could choose to prompt the user for permission before the RP is revealed
- the user agent could choose to delay revealing the origin of the RP to the IDP upon user consent. In this formulation, the user agent could load the IDP without telling it which RP is requesting it and only let that information be passed upon further stages of the transaction when the user understands better what’s involved.
- the user agent could step up and mint IdTokens itself on behalf of the user, using the (cryptographically signed) identity from the IDP. In this formulation, the RP could still use information from the IDP, but without the IDP ever knowing who the RP is, along the lines of the infrastructure built by BrowserID.


# Related Work

- [Building a More Private Web](https://blog.chromium.org/2020/01/building-more-private-web-path-towards.html)
- [Personas](https://wiki.mozilla.org/Identity/Persona_AAR) and [navigator.id](https://developer.mozilla.org/en-US/docs/Archive/Mozilla/Persona/The_navigator.id_API)
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
