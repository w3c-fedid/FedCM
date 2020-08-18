**TL;DR**; This is an **early exploration** of a set of [Browser APIs](#browser-api) and an [ecosystem activation strategy](#deployment-structure).

# Early Exploration

This is an early exploration of the solution space for the problem space described [here](README.md).

This section is broken into:

- [Deployment Structure](#deployment-structure)
- [Threat Model](#threat-model)
- [High Level Design](#high-level-design)
- [Browser API](#browser-api)
- [Alternatives Considered](#alternatives-considered)
  - [Keeping The Status Quo](#keeping-the-status-quo)
  - [Mixed Browser UI](#mixed-browser-ui)
  - [Inline Affordance](#inline-affordance)
  - [Browser Issued JWT](#browser-issued-jwt)

# Deployment Structure

Currently, sign-in flows on websites begin with a login screen that provides the user options to use federated identity, as illustrated in the mock below. Today, clicking the button for an IDP relies on general purpose primitives (typically [redirects or popups](#low-level)) to an IDP sign-in flow. 

![](static/mock1.svg)

There is a wide set of privacy and usability goals for identity sharing on the web, but early on we ran into better understanding the structural deployment of federation on the web, specifically the properties that make different activation/adoption strategies more or less plausible.

For example, it is clear that there are relatively few public [IDPs](#idp) in use (say, tens), particularly in comparison to the number of [RPs](#rp) (say, millions) and their users (say, billions). A structural change that only requires adoption by IDPs and no changes or engagement on the part of RPs and users is significantly easier compared to redeploying millions of RPs or retraining billions of users.

Fortunately, in more cases than not (by our estimates, about half of the deployment), RPs implement federated identity importing a script provided by - and under the control of - IDPs, giving us a major deployment vehicle: IDP SDKs loaded into RPs. 

![](static/mock7.svg)

Nonetheless, while much of the client side code is under the (few) IDPs to control (e.g. we can replace redirects by other means), all of the server side code is under the (many) RPs to control, meaning that that is significantly harder to change (say, years). The cases where RPs implement federated identity without a dynamically loaded SDK will have a longer deployment window and will be discussed separately. 

Likewise, changing user behavior and norms is hard because of the number of people involved (say, billions). Unfamiliar login flows could result in users declining to use federated options, and instead opting for username/password credentials during RP account creation. To address that, this proposal aims to provide an experience that minimizes the divergence from existing federated identity user experience as much it possibly can (e.g. introducing new user decisions to be made).

So, with this deployment constraint in mind, let's look at what could be done.

## Threat Model

We formalized the threat model [here](privacy_threat_model.md).

## High Level Design

In this proposal, we provide a [high-level](#high-level), identity-specific API that allows browsers to [classify](#the-classification-problem) the otherwise **opaque** transactions that are enabled by [low-level](#low-level) APIs.

By classifying as an identity data exchange, browsers are now in a position to provide domain specific guidance to users regarding the consequences of the specific identity transaction.

Some of the guiding principles we identified early on intermediating the data exchange are:

* **Principle of Least Disclosure**: The data exchange should disclose as little as possible for a use that is as constrained as possible, incrementally increasing the scope of disclosure with additional explicit consent when that's relevant contextually. For example, unbundling overly broad scopes (e.g. unbundling authentication from authorization) into multiple granular steps that are asked independently and incrementally. 
* **Principle of Least Surprise**: the data exchange should never have consequences that exceeds the level of consent and user understanding (including second-order consequences). For example, enforcing the use of [directed profiles](#directed-basic-profile) for the majority of the cases prevents unnecessary release of correlation handles.
* **Path Dependence Principle**: the set of design options we have is limited by the decisions that have been made in up to this point, regardless of whether they are relevant or not. For example, it seems clear that breaking **Server-Side Backwards Compatibility** increases the deployment window exponentially and proportionally to the number of relying parties.

## Browser API

To accomplish these goals, we break the data exchange down in four stages:

- The [invocation](#the-invocation-stage) stage: the user makes a user gesture and the RP calls a newly introduced API
- The [provisioning](#the-provisioning-stage) stage: the browser makes an assessment over the risks involved in exchanging the data (e.g. does it contain a global identifier?),
- The [mediation](#the-mediation-stage) stage: makes sure the user consents and understands the risks involved (e.g. scarier prompts when a global identifier is found) and
- The [creation](#the-creationg-stage) stage: with the user's consent established, an IdToken is then created.

In this formulation, here is how the data flows:

![](static/mock14.svg)

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

The IdToken is signed into a JWT and then returned back to the RP which can effectively get the user logged in. Here is [an example](https://jwt.io/#debugger-io?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmlkcC5jb20iLCJzdWIiOiIxMTAxNjk0ODQ0NzQzODYyNzYzMzQiLCJhdWQiOiJodHRwczovL2V4YW1wbGUuY29tIiwiaWF0IjoiMjM0MjM0MiIsIm5hbWUiOiJTYW0gRyIsImVtYWlsIjoic2prbGQyMDkzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjoidHJ1ZSIsInByb2ZpbGUiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vZGVmYXVsdC1hdmF0YXIucG5nIn0.3fGpHH5IeL2fDxbToBLE2DWDf6hfHU5YfiSdfqRGlIA) of what a signed JWT looks like for the payload above.

### Authorization

Once the [directed basic profile](#directed-basic-profile) has been handed back to the RP, the browser has established that there is a level of trust between the user and the IDP.

RPs often rely on more services from IDPs which are gathered via subsequent flows to get the user's authorization to release access to broader scopes. Notably, there is a long tail of these scopes, with little to no commonalities between them (say, access to calendar, photos, social graphs, etc).

To allow users to continue accessing broader scopes, we propose exposing a new API to mediate that flow. For example:

```javascript
navigator.credentials.requestPermission({
  scope: "https://idp.com/auth/calendar.readonly",
  provider: "https://idp.com",
});
```

Because of the long tail nature of the scopes and the user's prior consent for the [directed basic profile](#directed-basic-profile), the mediation happens primarily under the control of the IDP:

![](static/mock17.svg)

# Alternatives Considered

As we go along, a lot of variations have been and will be analysed. We'll collect them here and revisit them as we gather more evidence.

## Keeping The Status Quo

A trivial alternative that is worth noting is to "do nothing". That seemed clear to reject based on:

- the growing sentiment that the [RP tracking problem](https://github.com/WICG/WebID/blob/master/README.md#the-rp-tracking-problem) had to be addressed broadly
- the growing sentiment that the [classification problem](https://github.com/WICG/WebID/blob/master/README.md#the-classification-problem) would lead to general purpose policies which increase the friction to existing flows
- the second order consequences of relying parties moving to less safe options (compared to federation) like usernames/passwords or out of the web

## Mixed Browser UI

The most notable alternative considered is one that gives a greater amount of autonomy and extensibility browsers give to identity providers. In this alternative, at the [mediation stage](#the-mediation-stage), the browser would load content that is controlled by the IDP giving it the flexibility to own the user journey, while still making sure there is clear attribution (e.g. having the IDP origin clearly stated).

![](static/mock2.svg)

The benefits of this approach are fairly clear: it gives IDPs the autonomy to cover their various use cases, differentiate between each other, innovate and compete, without the browser pulling them back.

The drawbacks are clear too:

1. it constitutes cross-site communication that can be used/abused outside of authentication, putting us back at the [classification problem](#the-classification-problem).
1. the browser can't be confident about the user's consent, so it is forced to apply general purpose policies.

For those reasons, we think that the browser mediated formulation best fit our goals.

## Inline Affordance

One notable alternative considered is a declarative formulation that would allow embedding the user experience inline in the content area while still keeping the cross-origin separation before user consent. For example:

```html
<input type=”idtoken” provider=”https://accounts.example.com”>
```

From a friction perspective, it seems that users benefit from seeing their names/avatar in the sign-in buttons.

It also seemed to make things more complicated in terms of user comprehension (do users understand the cross-origin separation if that is inline?) and incentives (e.g. is clickjacking now a problem?).

So, seemed like a plausible formulation worth noting, but one that didn't seem right to start from.

## Browser Issued JWT

A really interesting property of the [Personas protocol](https://github.com/mozilla/id-specs/blob/prod/browserid/index.md#issuing-assertions) is that it made IDPs sign a certificate delegating the issuing/minting of JWTs to the Browser. It accomplished that by making the browser generate a public/private key pair () and have the IDP sign a certificate attesting that the browser's private key could issue certificates for a certain JWT.

```javascript
navigator.id.beginProvisioning(function(email, cert_duration) {
  // request a keypair be generated by browserid and get the public key
  navigator.id.genKeyPair(function(pubkey) {

    // ... interact with the server to sign the public key and get
    // a certificate ...
    someServerInteraction(function(cert){
      // pass the certificate back to BrowserID and complete the
      // provisioining process
      navigator.id.registerCertificate(cert);
    });
  });
});
```

The neat property that this protocol has is that it keeps the IDP blind to most of the interaction with the RP which seems desirable.

The drawback of this part of the protocol is that it leads to a JWT that is not backwards compatible with the existing server-side deployment of relying parties (which are expecting the IDP to sign JTWs, not the Browser), which is O(K) hard to change.

So, seemed like a plausible formulation that is worth noting, but one that didn't seem right to start from.


