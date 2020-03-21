---
permalink: index.html
layout: post
title: WebID
---

**TL;DR**: This is a proposal for a new API that will allow websites ([relying parties](https://en.wikipedia.org/wiki/Relying_party), or RPs) to access verified identity information about a user in a consensual and privacy-preserving manner.

Initially this API will serve to permit browser intermediation of existing federated sign-in flows on the web, over [OpenID Connect](https://openid.net/connect/) or [SAML](http://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0.html), between RPs and federated [identity providers](https://en.wikipedia.org/wiki/Identity_provider) (IDPs for short). It will also add flexibility in the future for user agents to support identity protocols with better privacy properties.

# Why is this important?

Over the last decade, identity federation has played a central role in raising the bar for authentication on the web, in terms of ease-of-use (e.g. passwordless single sign on), security (e.g. improved resistance to phishing and credential stuffing attacks) and trustworthiness compared to its preceding common pattern: per-site usernames and passwords.

The standards that define how identity federation works today were built independent of the web platform, and their designers had to work around its limitations. Accordingly, existing user authentication flows rely on simple web capabilities such as top-level navigation, link decoration, window popups and cookies.

Unfortunately, these same low-level capabilities that facilitate cross-origin data transmission are increasingly being abused to pass identifying information about users without their knowledge or consent.

This proposal provides a way forward for browsers to support federated identity over an explicit channel that will eliminate RP and IDP reliance on those lower level capabilities. Accordingly the user agent will be better able to protect user privacy during authentication flows, and also the web platform can make privacy-enhancing changes without concern for breaking federated identity flows.

Goals: 

- Allow the user to share identity information between an IDP and an RP over a browser-controlled channel.
- Allow the user agent to ensure that the user is aware and has expressed intent to share personal information between sites before the data is shared.
- Make the exchange of information as easy for the user as possible, where privacy constraints are satisfied.
- Lessen disruption to the web ecosystem from future privacy enhancements.
- Support extensibility such that more private authentication protocols and/or usability improvements can be added to this API in future without breaking existing usage.

Non-goals:

- To prescribe the specific manner in which user agents provide information to or gain consent from users regarding information being shared during account creation or authentication.

# Considerations

We would like to address a wide set of privacy and usability goals for identity sharing on the web, but this proposal is specifically narrowed in order to minimize barriers to activation on the web. In particular we must give consideration to **user acceptance** and **ease of adoption**.

A notable property of identity federation on the web today is that there are relatively few public IDPs in use (say, tens), particularly in comparison to the number of RPs (say, millions) that use them. From that observation, activation will be much easier if it only requires adoption by IDPs and no changes or engagement on the part of RPs. Since the canonical way for RPs to implement federated identity today involves them dynamically importing a script from supported IDPs, this is a feasible goal. However, it means that this proposal must exclude any approaches or features that are non-backwards compatible (e.g. backend storage changes) and would require active participation by (the millions of) RPs.

User acceptance is important because unfamiliar or uncertain login flows could result in users declining to use federated options, and instead opting for username/password credentials during RP account creation. To address that, this proposal aims to provide an experience that minimizes the divergence from existing federated identity user experience as much as possible.

# Prior Art

## BrowserID

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

The postmortem analysis is very insightful in understanding what were the challenges faced and gives this proposal a solid place to work from. Some of the noteworthy points there that we empathise with are:

- "We were in a three-way cold-start between users, providers, and websites. More info on Hacker News."
- "We made Persona a user-visible brand but that competed with a site's own brand."
- "We looked at Facebook Connect as our main competitor, but we can't offer the same incentives (access to user data)."
- "Persona should be built natively into Firefox, Fennec and Firefox OS to make the JavaScript shim unnecessary on these platforms. The base functionality should be cross-browser, but the experience should be optimized for the native platforms."
- "Sites should control most of the user flow and Persona should be almost invisible to users."

In some ways, we think some of these insights are rooted in the observation we made earlier about backwards compatibility with RPs and user’s current behavior. 

# Proposal

In this proposal, the browser-mediated federated identity can be broken down into four distinct stages, each with its own set of design considerations:

1. Initiation: The user interacts with the RP page, triggering the RP to initiate a request for identity in an imperative or declarative fashion. The RP specifies which IDP to use.
1. Account Selection and Authentication: The browser assists the user in selecting which identity to use with the selected IDP, and authenticating to the IDP for that identity.
1. Consent: The browser displays to the user relevant information about the data sharing that is about to take place, and ensures the user consents to that sharing.
1. Data Exchange: The identity request from the RP is passed to the IDP and the IDP responds with a token that is sufficient to identify the user. The RP receives the token.

## Initiation

RP sign-in flows usually begin with a login screen that provides the user options to use federated identity, as illustrated in the mock below. Today, clicking the button for an IDP usually initiates a navigation to a designated IDP sign-in page. We propose that it be replaced by invocation of a new API, described in [a later section](#Request).

## Account Selection and Authentication

Next the user must select an account with the given IDP that they want to use for federated sign-in, and authenticate to that account if they do not already have a valid session. In current flows this is done on the IDP’s page following a top-level navigation, but we suggest that it would be better placed in a popup window or a tab-modal dialog resembling what is used for [PaymentHandler windows](https://www.w3.org/TR/payment-handler/#windows) or the proposed [modal-window](https://github.com/adrianhopebailie/modal-window/blob/master/explainer.md).

Importantly, at this stage the user has not provided explicit consent for data sharing, and therefore the IDP should not be provided with any details of the RP’s identity request. The IDP will call a browser API to signal that this step has been completed.

## Consent

At this point the user agent must make an attempt to gain assurance that the user is informed that information is about to be shared between the RP and IDP, and that they consent to its sharing. The details of this step are left to the discretion of the user agent, which must decide the amount of information to provide that would sufficiently make them aware of the exchange, and also may take into account available contextual information. For example, if the user has previously signed in to the current RP with the same account, then it might be reasonable to streamline this step and presume that consent previously given still applies.

In the below mock we suggest what it might look like to combine the account selection/authentication step with the consent step, with a bottom sheet that combines IDP-supplied and browser-supplied UI to accomplish both tasks.

## Data Exchange

Finally, with the user having selected an account to use for federated sign-in, and consent having been obtained to the user agent’s satisfaction, a data exchange can occur in accordance with OpenID Connect or SAML standards. The user agent conveys the RP’s identity request to the IDP, and an ID token is returned that is provided to the RP in order to fulfill the Promise initiated at the beginning.

# Proposed Usage

## Request

The data exchange flow starts with RPs requesting an IdToken given a specific IDP. While largely to be determined, a good source of inspiration and analogy can be drawn from the PaymentsRequest API: it has similar UX flows, number of players and privacy requirements. As a starting point, in this proposal, the RP can invoke the IdentityRequest process through an asynchronous imperative API, or a declarative API, roughly illustrated below, but we expect the exact shape of this API to evolve a lot over time.

```javascript
async function signup() {
  // a possible starting point
  let request = new IdentityRequest({
    federated: {
      provider: "https://accounts.idp.example"
    }
  });
  let {idtoken} = await request.show();
  return idtoken;
}
```

The exact shape of the API is still largely to be determined. Here is a declarative formulation that could work too:

```html
<input type="idtoken" provider="https://accounts.idp.example">
```

## Response

Once the request is made, the user agent intermediates the request in coordination with the IDP. Since the IDP controls the user’s account selection and authentication process, an IDP page must be loaded in some type of browser window. When the user has completed necessary actions (described in the Account Selection section) the IDP must signal the user agent so that subsequent steps can proceed. The IDP should provide two values: a method path that the user agent can use to fetch an IDToken once user consent has been granted, and a random nonce that will correlate that fetch with the authenticated user. A nonce could be unnecessary if the IDP could set a cookie at this point and the subsequent fetch is credentialed, but we think the nonce provides more flexibility by removing assumptions about cookie availability.

```javascript
// The first argument represents the method URL:
//     https://accounts.idp.example/oidc
// The second argument is a nonce to correlate the account selection
// that just happened with the ID request that will come next.
new IdentityResponse()
  .respond("/oidc", {"requestContext": "419A9DAAC6F28301"});
```

## Obtaining an IDToken

Once user consent is obtained, the user agent can send a POST request to the target indicated in the last step (in the above example, it would be sent to `https://accounts.idp.example/oidc`), containing the specified nonce as well as the details of the identity request from the RP. The response to the request would contain a special token, the IDToken, which can be supplied to the RP that initiated the IdentityRequest, completing the process.

```
POST /oidc HTTP/1.1
Host: accounts.idp.example
Content-Type: application/x-www-form-urlencoded
Content-Length: 120

state=419A9DAAC6F28301
scope=openid
client_id=s8ty349a
response_type=code
destination=https://login.rp.example

```

The user agent then expects an IdToken to be generated, which contains a header:

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

A payload:

```json
{
 "iss": "https://accounts.idp.example",
 "sub": "110169484474386276334",
 "aud": "https://rp.example",

 "name": "Jane Doe",
 "given_name": "Jane",
 "family_name": "Doe",
 "email": "jane.doe@idp.example",
 "email_verified": "true",
}
```

And a signature:

```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),  
  SECRET
)
```

# Future Direction

A number of privacy and usability proposals around identity management are under consideration but are not within the current scope of this proposal. The following is a non-exhaustive list:

- Blinded federated identity (i.e. hiding the RP’s identity from the IDP, and/or vice versa)
- Logged-in session management (i.e. the problem being addressed by [isLoggedIn](https://github.com/WebKit/explainers/tree/master/IsLoggedIn))
- User agent mediation of IDP selection
- User agent tracking of user’s federated accounts
- Obfuscation of user data during federated sign-in to mitigate tracking via back-end joins
- Alternative or ephemeral email addresses for federated sign-in (e.g. Apple’s [Hide my Email](https://support.apple.com/en-us/HT210425))

# Related Work

- [Building a More Private Web](https://blog.chromium.org/2020/01/building-more-private-web-path-towards.html)
- [Personas](https://wiki.mozilla.org/Identity/Persona_AAR) and [navigator.id](https://developer.mozilla.org/en-US/docs/Archive/Mozilla/Persona/The_navigator.id_API)
- [Credential Manager](https://w3c.github.io/webappsec-credential-management/#federated)
- Add your work [here](https://github.com/samuelgoto/WebID/issues/new)
