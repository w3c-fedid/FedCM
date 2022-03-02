# Federated Credential Management (FedCM)
**Last Update:** Mar 08, 2022

## Introduction

Over the last decade, identity federation has played a central role in raising
the bar for authentication on the web, in terms of ease-of-use (e.g.
password-less single sign-on), security (e.g. improved resistance to phishing
and credential stuffing attacks) and trustworthiness compared to per-site
usernames and passwords. In identity federation, a **RP (relying party)** relies
on an **IDP (identity provider)** to provide the user an account without
requiring a new username and password.

Unfortunately, the mechanisms that identity federation was designed on (iframes,
redirects and cookies) are being abused to track users across the web. A user
agent isn’t able to differentiate between identity federation and tracking, the
mitigations for the various types of abuse make identity federation more
difficult.

The Federated Credential Management API provides a use case specific abstraction
for federated identity flows on the web. The identity specific APIs allow the
browser to understand the context in which the RP and IDP exchange information,
inform the user as to the information and privilege levels being shared and
prevent unintended abuse.

Specifically, the user agent:

* gathers user consent to use an IDP to login to an RP
* keeps state if a relationship between the RP/IDP has been established
* provides APIs and capabilities to the RP/IDP based on the consent provided

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
| ┌─────────────────────────────┐ |       | ┌─────────────────────────────┐ |
| | https://rp.example          | |       | | https://rp.example          | |
| └─────────────────────────────┘ |       | └─────────────────────────────┘ |
| ┌─────────────────────────────┐ |       | ┌─────────────────────────────┐ |
| |                             | |       | |                             | |
| |  Welcome to my website!     | |       | |  Welcome to my website!     | |
| |                             | |       | |                             | |
| |                             | |       | |                             | |
| ┌─────────────────────────────┐ |       | ┌─────────────────────────────┐ |
| |      Choose an account      | |       | |    Sign-in to rp.example    | |
| |   to sign-in to rp.example  | |       | |      with idp.example?      | |
| |                             | |       | |                             | |
| | ┌────┐                      | |       | | ┌────┐                      | |
| | | :) |  John Doe            | |  ──►  | | | :) |  John Doe            | |
| | └────┘  john@email.com      | |       | | └────┘  john@email.com      | |
| | ┌────┐                      | |       | |                             | |
| | | :] |  John Doe            | |       | | ┌─────────────────────────┐ | |
| | └────┘  john.doe@work.com   | |       | | |    Continue as John     | | |
| |                             | |       | | └─────────────────────────┘ | |
| └─────────────────────────────┘ |       | └─────────────────────────────┘ |
└─────────────────────────────────┘       └─────────────────────────────────┘
```

### What Will Break

With third party cookies blocked, here are the list of things known to degrade:

* OIDC’s
  [Front-channel logout](https://openid.net/specs/openid-connect-frontchannel-1_0.html). Front-channel logout requires the IDP to embed several RP iframes which rely
  on the  RPs cookies.
* Social Widgets. In order to provide social widgets the IDPs third-party cookie
  must be provided from the RPs top level origin.
* Personalized buttons. The display of personalized login information on a button
  in the RP origin is implemented as an IDP iframe that requires third party
  cookies
* Session Refresh without top-level navigation or popups


### Goals

* Enable all federated identity flows (including
  [what will break](#what-will-break)) without the use of third-party cookies in
  a way that makes the web meaningfully more private and usable compared to
  the [next best alternative](#related-work)
* Maximize backwards compatibility, specially for RPs
* Allow identity protocols to be extended independent of browser changes
* Reuse as much from OIDC / SAML / OAuth as possible

### Out-of-Scope

Features which are out-of-scope for the **current** version of FedCM, but are
**not** conflicting with our goals:

* Sign into the IDP
* Support future interventions/mitigations beyond third-party cookie
   deprecation: FedCM is not a stop-gap solution built entirely for third-party
   cookie deprecation, and is likely to be a stepping stone towards a future
   that includes continued privacy-preserving efforts (e.g. against navigational
   tracking). Knowing that that is on the horizon, FedCM addresses a smaller
   problem now, and builds a small piece of the foundation (i.e. a browser
   mediated federated account chooser), rather than dealing with all problems
   all at once.

### Non-goals

* Address problems that are better addressed by [related](#related-work)
   technologies (e.g. [first party sets](#first-party-sets)) or controls (e.g.
   [user settings](#settings), [admin policies](#enterprise-policies))
* Zero RP/IDP change deployment: redeployments should be minimized but a
   non-zero number of IDP/RP changes maybe required
* Replace OIDC / SAML / OAuth: these efforts should continue to thrive by
   offering a better identity-specific foundation

## Example

The following is an example of a website allowing a user to login with
`idp.example`. The user is able to revoke tokens and logout of the site.

```js
async function login() {
  const credential = getFederatedCredential();

  // This will prompt when credential["approved"] is false , but
  // it won’t when credential["approved"] is true.
  //
  // If credential["approved"] is false and mediation is silent will `reject`.
  //
  // If the user selects an account updates the credential["approved"]
  // state and store any needed account information.
  return await credential.login({ nonce: "456" });
}

async function logout() {
  const credential = getFederatedCredential();
  // This never prompts, rejects the promise in case credential["approved"]
  // is false
  return credential.logout();
}

async function revoke() {
  const credential = getFederatedCredential();
  // This never prompts, rejects the promise in case credential["approved"]
  // is false
  return credential.revoke();
}

async function getFederatedCredential() {
  // This never prompts. A FederatedCredential object will always be returned.
  //
  // The object will be either approved or unapproved and store information
  // on if the user should be prompted based on the mediation flag.
  return await navigator.credentials.get({
    mediated: "optional",  // "optional" is the default
    federated: {
      providers: [{
        url: "https://idp.example",
        clientId: "123"
      }]
    }
  });
}
```

## Key scenarios

  * [RP initiated login](#rp-initiated-login)
  * [RP initiated logout](#rp-initiated-logout)
  * [Revocation](#revocation)
  * [Personalized login buttons](#personalized-login-buttons)
  * [IDP initiated RP login](#idp-initiated-rp-login)
  * [Token creation](#token-creation)
  * [Token refresh](#token-refresh)
  * [Iframe support](#iframe-support)
  * [IDP initiated front-channel logout](#idp-initiated-front-channel-logout)


## Detailed Design

There are two sides to the FedCM API. Changes for the RP and changes for the
IDP.

```
┌───────────┐                  ┌───────────┐                      ┌───────────┐
│           │           Login  │           │           fedcm.json │           │
│           │   ┌─────────────►x           │     ┌───────────────►x           │
│           │   │              │           │     │                │           │
│           │   │       Logout │           │     │   Accounts API │           │
│           │   ├─────────────►x           │     ├───────────────►x           │
│           │   │              │           │     │                │           │
│           │   │       Revoke │           │     │   Metadata API │           │
│           │   ├─────────────►x           │     ├───────────────►x           │
│  Relying  │   │              │   User    │     │                │ Identity  │
│   Party   │   │              │   Agent   │     │     Revoke API │ Provider  │
│           │   │              │           │     ├───────────────►x           │
│           │   │              │           │     │                │           │
│           │   │              │           │     │      Token API │           │
│           │   │              │           │     ├───────────────►x           │
│           │   │              │           │     │                │           │
│ ┌───────┐ │   │              │ ┌───────┐ │     │                │ ┌───────┐ │
│ │ FedCM ├─┼───┘     ┌────────┼─┤ FedCM ├─┼─────┘       ┌────────┼─┤ FedCM │ │
│ └───────┘ │         │        │ └───────┘ │             │        │ └───────┘ │
│           │         │        │           │             │        │           │
│           │         │        │           x◄────────────┤        │           │
│           │         │        │           │ Authorize   │        │           │
│           x◄────────┘        │           │             │        │           │
│           │ Logout API       │           x◄────────────┘        │           │
│           │                  │           │ Logout               │           │
└───────────┘                  └───────────┘                      └───────────┘
```

The RP is mostly done in JavaScript except if they desire front-channel logout
capabilities which requires an HTTP endpoint to be implemented.


### JS API

#### RP Initiated Login

The RP initiated `login` API allows an RP to log the user into using their
federated credentials. The result of the `login` call allows the RP to know if
the user has consented to the authentication. The returned tokens can then be
used as needed.

```js
const cred = await navigator.credentials.get({
  mediated: "optional", // "optional" is the default
  federated: {
    providers: [{
      url: "https://idp.example",
      clientId: "123"
    }]
  }
});
const tokens = await cred.login({nonce: "1234"});
```

The `login` method will call into the IDP
[Manifest Endpoint](#fedcm.json),
[Accounts Endpoint](#accounts_endpoint),
[Client Metadata Endpoint](#client_metadata_endpoint) and the
[Token Endpoint](#token_endpoint).


##### Mediation Values

The `get` request for the `FederatedCredential` uses the `mediation` parameter
to determine if and when to prompt the user.

* `silent`: will attempt to return an existing credential, will never prompt
   the user
* `required`: will always prompt the user even if an existing credential could
   be returned
* `optional`: will attempt to return an existing credential, will prompt the
   user if unable

#### RP Initiated Logout

Used for when the RP wishes to log the user out of their system. Used to clean
up internal browser state.

```js
const cred = await navigator.credentials.get({
  mediated: “silent”,
  federated: {
    providers: [{
      url: "https://idp.example",
      clientId: "123"
    }]
  }
});

cred.logout();
```

Does not call into the IDP API.

#### Revocation

Provides the capabilities for the RP to tell the IDP to destroy any token
created for the RP.

```js
const cred = await navigator.credentials.get({
  mediated: "silent",
  federated: {
    providers: [{
      url: "https://idp.example",
      clientId: "123"
    }]
  }
});
cred.revoke();
```

The `revoke` method will call into the IDP
[Revocation Endpoint](#revocation_endpoint).

#### Personalized Login Buttons

Personalized login buttons allow an RP and IDP (for which the user has an
active consented credential), to display user information in the login button
itself. Displaying the user's name, email or profile photo in the login button
makes it clearer to the user which federated identity provider they used in the
past and simplifies the decision of which provider to select on subsequent
logins.

> The implementation of this has not been worked out at this point, it could
either be done by calling the `login` API to create a new ID token which would
then need to be revoked, or a separate API which could be called on the IDP to
return the personalization information.

#### IDP Initiated RP Login

Provides the IDP the ability to create the credential objects for an RP. In the
case where a top-level redirect to the IDP sign in pages has occurred this
allows the IDP to control the timing of the prompt for user consent and to
provide context for the prompt.

> The implementation of this has not been worked out at this point, and we are
still investigating the shape of the API, below is a sketch.


```js
const cred = await navigator.credentials.get({
  federated: {
    providers: [{
      relyingPartyOrigin: "https://rp.example"
    }]
  }
});
await cred.authorize({
  name: "dan",
  email "dan@example"
  account_id: 123,
  tokens: "access",
  scopes: "calendar.read profile"
});
```

#### Token Creation

There are multiple types of token which can be requested from the IDP.

* ID token: Provides information on the users identity
* Access token: Provides access to some resources
* Refresh token: Provides ability to retrieve a new access token

```js
const cred = await navigator.credentials.get({
  mediated: "optional", // "optional" is the default
  federated: {
    providers: [{
      url: "https://idp.example",
      clientId: "123"
    }]
  }
});
const tokens = await cred.login({
  nonce: "1234",
  tokens: ["access", "refresh", "id"],
  scopes: ["calendar.read", "profile"]
});
```

The `login` method will call into the IDP
[Manifest Endpoint](#fedcm.json),
[Accounts Endpoint](#accounts_endpoint),
[Client Metadata Endpoint](#client_metadata_endpoint) and the
[Token Endpoint](#token_endpoint).

#### Token Refresh

Access tokens can be short lived. The `refresh` call provides the ability for
the RP to request new tokens, optionally providing the `refresh_token` in the
request.

```js
tokens = await cred.refresh({
  tokens: ["access", "refresh"],
  scopes: ["calendar.read", "profile"],
  refresh_token: tokens.refreshToken
});
```

The IDP calls for `refresh` have not been flushed out yet.

#### iframe Support

In the Credential Management Level 1 specification FedCM by default restricts
iframe access to iframes which satisfy
[`sameOriginAsAncestor`](https://www.w3.org/TR/credential-management-1/#same-origin-with-its-ancestors).

There are cases, such as learning management systems where third-party content
is embedded inside the LMS. That third-party content may embed other content as
well, the embedded iframes need to be able to retrieve access tokens for the
user in order to request resources. In this case, the `sameOriginAsAncestor`
setting would not help as the embeddings are specifically cross site. See
[fedidcg/use-case-library issue #13](https://github.com/fedidcg/use-case-library/issues/13)
for more context.

FedCM adds an `allow=fedcm` attribute to the `iframe` tag. This allows the RP to
specify that FedCM may be called inside the iframe. This allows IDP embedded
iframe content to continue to function when updated to use FedCM calls. Without
the `allow=fedcm` attribute then the
[`sameOriginAsAncestor`](https://www.w3.org/TR/credential-management-1/#same-origin-with-its-ancestors)
setting would apply.

This could also fall under
[Permissions Policy](https://github.com/w3c/webappsec-permissions-policy/blob/main/integration.md)
but that seems to be on a per-page basis where FedCM seems more applicable on a
per-iframe basis.

#### IDP Initiated Front-Channel logout

Some IDPs provide the ability to log the user out of supporting RPs when the
user logs out of the IDP. The FedCM API provides this capability through the
`logoutRPs` call. This will allow the IDP to logout any RP for which the user
has previously approved the RP, IDP communication.

The front-channel logout URL is exchanged with the IDP through a back-channel
and is outside the scope of the FedCM API.

```js
FederatedCredential.logoutRPs([{
  url: "https://rp1.example/logout",
  accountId: "123",
}, {
  url: "https://rp2.example/logout",
  accountId: "456",
}]);
```

The `logoutRPs` method will call into the RP `logout` endpoints.

### HTTP API

The IDP is required to expose a number of endpoints which are used to gather
the required information needed for authentication along with token generation
and revocation.

The URLs are provided through a `fedcm.json` file which is located at the path
provided by the RP JS call to `navigator.credentials.get` provided in the `url`
for the `federated` `provider`.

#### Endpoint Properties

| Endpoint                 | Cookies      | Client Id | Referrer |
|:-------------------------|:------------:|:---------:|:--------:|
| fedcm.json               | no           | no        | no       |
| accounts_endpoint        | yes          | no        | no       |
| token_endpoint           | yes          | yes       | yes      |
| client_metadata_endpoint | no           | yes       | yes      |
| revocation_endpoint      | yes          | yes       | yes      |

* Client Id is an identifier provided to the RP by the IDP during signup
* All requests sent from the browser include a `Sec-FedCM-CSRF` header to
   prevent CSRF attacks

#### `fedcm.json`

The `fedcm.json` request is used to provide the UA with information needed to
interact with the IDP during federation.

For example:

```http
GET /fedcm.json HTTP/1.1
Host: idp.example
Accept: application/json
Sec-FedCM-CSRF: ?1
```

```json
{
  "accounts_endpoint": "/accounts",
  "client_metadata_endpoint": "/metadata",
  "token_endpoint": "/tokens",
  "revocation_endpoint": "/revocation",
  "branding": {
    "background_color": "green",
    "color": "0xFFEEAA",
    "icons": [{
      "url": "https://idp.example/icon.ico",
      "size": 10
    }]
  }
}
```

#### `accounts_endpoint`

The `accounts_endpoint` request is used to provide account information to be
shown in the browser mediation dialogs.

For example:

```http
GET /accounts HTTP/1.1
Host: idp.example
Accept: application/json
Cookie: 0x23223
Sec-FedCM-CSRF: ?1
```

```json
{
 "accounts": [{
   "id": "1234",
   "given_name": "John",
   "name": "John Doe",
   "email": "john_doe@idp.example",
   "picture": "https://idp.example/profile/123",
   "approved_clients": ["123", "456", "789"]
  }, {
   "id": "5678",
   "given_name": "Johnny",
   "name": "Johnny",
   "email": "johnny@idp.example",
   "picture": "https://idp.example/profile/456",
   "approved_clients": ["abc", "def", "ghi"]
  }]
}
```

The information returned from the `accounts_endpoint` is not exposed to the RP,
but instead used by the browser to render the mediated account chooser dialog.

#### `client_metadata_endpoint`

The `client_metadata_endpoint` request allows the IDP to return RP specific
information needed in the mediated dialogs.

For example:

```http
GET /metadata?client_id=1234 HTTP/1.1
Host: idp.example
Referer: https://rp.example/
Accept: application/json
Sec-FedCM-CSRF: ?1
```

```json
{
  "privacy_policy_url": "https://rp.example/clientmetadata/privacy_policy.html",
  "terms_of_service_url": "https://rp.example/clientmetadata/terms_of_service.html"
}
```

#### `token_endpoint`

The `token_endpoint` returns tokens for the user from the IDP.

For example:

```http
POST /tokens HTTP/1.1
Host: idp.example
Referer: https://rp.example/
Content-Type: application/x-www-form-urlencoded
Cookie: 0x23223
Sec-FedCM-CSRF: ?1

account_id=123&client_id=client1234&nonce=Ct60bD&consent_acquired=true
```

```json
{
  "id_token": "eyJhbGciOiJIUzI.eyJzdWIiOiIx.SflKxwRJSMeKKF2Q"
}
```

#### `revocation_endpoint`

The `revocation_endpoint` is used to inform the IDP to destroy all tokens
provided to the user.

For example:

```http
POST /revocation HTTP/1.1
Host: idp.example
Referer: https://rp.example/
Content-Type: application/x-www-form-urlencoded
Cookie: 0x23223
Sec-FedCM-CSRF: ?1

account_id=123&client_id=client1234
```


## Related Work

This is a set of related work that we expect to be used in conjunction with this
proposal.

### First Party Sets

[First Party Sets](https://github.com/privacycg/first-party-sets) will play a
big role in preserving the deployment of federation on the Web. There are a lot
of cases (largely in enterprises), where:

* the IDP and the RP are within the same first party set or
* the IDP goes through redirects within the origin of its first party set

It is a [non goal](#non-goals) to address the use cases that are better served by
first party sets.

### Enterprise Policies

Enterprise Policies are policies that administrators set for devices managed and
supplied by their enterprise. While expected to cover a large set of devices,
the community has stated there is a substantial number of employees that bring
their own devices that need federation to work (namely, front channel logout) in
the absence of third party cookies.

### Settings

Browser Settings are controls that users have to change how their browser works.
While constructive and useful, they are hard to discover proactively (compared
to Web Platform APIs that can be invoked by websites).

## Alternatives considered

### Status Quo

A trivial alternative that is worth noting as a baseline is to "do nothing" and
keep federation using low-level primitives like iframes and third party cookies.

That seemed clear to reject based on the already deployed, planned and
increasing constraints that are being put in place for cross-site communication
through third-party cookies.

> Publicly announced browser positions on third-party cookies:
>
> 1. [Safari](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/):
     third-party cookies are **already** blocked by **default**
> 1. [Firefox](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/):
     third-party cookies are **already** blocked **by a blocklist**
> 1. [Chrome](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/):
   on iOS **already** blocked **by default** and intends to offer **alternatives**
   to make them **obsolete** in the
   [near term](https://www.blog.google/products/chrome/building-a-more-private-web/)
   on other platforms.

The only alternative to federation is the proliferation of usernames/passwords
(or native applications), which we believe isn't healthy for the web.

### Heuristics

Browser vendors have applied a series of
[temporary heuristics](https://developer.mozilla.org/en-US/docs/Web/Privacy/Storage_Access_Policy#automatic_storage_access_upon_interaction)
to mitigate tracking while maintaining backwards compatibility. As we learn from
their experience, there are a few challenges:

* they are easy to circumvent and abuse
* they are hard to cover all cases and maintain
* the use of allowlists and denylists is hard to scale

### The Storage Access API

The
[Document.requestStorageAccess()](https://developer.mozilla.org/en-US/docs/Web/API/Document/requestStorageAccess)
API grants first-party storage to cross-origin subframes. In conjunction with
iframes, an IDP could expose its service via cross-site postMessage
communication once first-party storage has been granted.

The general-purpose nature of the API leads to a couple of downsides:

* A lowest-common-denominator policy (e.g. a permission prompt that warns users
   of the worst case scenario) which we expect to lead to permission blindness
   to users short and long term.
* Its inability to solve identity-specific problems, like front-channel logout
* General / non-specific consent text for the end-user that is difficult to
   understand / difficult to give consent to

### The  [Login Status API](https://github.com/privacycg/is-logged-in)

The Login Status API allows a website to inform the browser of the users login
status:

```js
await navigator.recordFederatedLogin("https://idp.example", "username");
```

As it suggests, its weakest point is
[defending against abuse](https://github.com/privacycg/is-logged-in#defending-against-abuse)
, and a lot of the most promising mitigations is to show browser mediated UX.

It explicitly notes an
[integration with FedCM](https://github.com/privacycg/is-logged-in#federated-logins)
but it is unclear at the moment why the "logged in" bit could not be
inferred from invoking `credential.login()` and requiring the website to
call `navigator.recordFederatedLogin()`.

Further investigation on the relationship of FedCM and that proposal is taking
place in
[privacycg/is-logged-in issue#44](https://github.com/privacycg/is-logged-in/issues/44).


## Prior Art

By descending order of proximity:

* [Mozilla Personas](https://github.com/mozilla/persona)
* [Web Login](https://github.com/junosuarez/web-login)
* [OpenYOLO](https://github.com/openid/OpenYOLO-Web)
* [Basic Auth](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication)
* Web Login
* [Web Sign-in](https://microformats.org/wiki/web-sign-in)
* [WebID](https://dvcs.w3.org/hg/WebID/raw-file/tip/spec/identity-respec.html)

## References & Acknowledgements

The FedID CG and the Privacy CG have provided invaluable feedback on the design
of the API.
