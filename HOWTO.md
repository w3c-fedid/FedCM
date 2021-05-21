---
title: "How to experiment with WebID in Chrome"
maintainer: "kenrb"
created: 10/12/2020
updated: 10/12/2020
---


# How to experiment with WebID in Chrome

A prototype of the API approaches described in the [solutions page](navigations.md) is present in Chrome 89 and later. **This is intended for experimentation purposes and is subject to change as a specification takes shape and develops.**

We will do our best to keep these instructions up to date as protocol and API changes occur.

It will subsequently roll into downstream channels, but with lag in functionality and bug fixes since this is under development.

## Enabling WebID in Chrome
1. Download [Chrome Canary](https://www.google.com/chrome/). Since this is a prototype with ongoing development, the implementation in other channels will be out of date with respect to functionality and bug fixes.
2. Enable WebID. As of Chrome 91 this can be done directly from chrome://flags.

## Available functionality
* Automatic permission prompts on [top-level Open ID Connect protocol navigations](navigations.md#the-sign-in-api)
* `navigator.id.get()` API call under [the permission-oriented flow](navigations.md#the-permission-oriented-variation)
https://github.com/WICG/WebID/blob/main/cookies.md#logout
* `navigator.id.get()` API call under [the mediation-oriented flow](navigations.md#the-mediation-oriented-variation)
* A potential [Logout API](cookies.md#logout)

These are described in more detail in the sections below.

### Permission persistence
In the flows where permission prompts are shown and the user accepts them, their acceptance is stored in the Chrome user profile as a website setting. The permission prompt will **not** subsequently be shown for the same RP and IDP pair. There are two distinct permissions, corresponding to the two prompts shown during the above flows.

At the moment the only way to reset these permissions is to clear browsing data on the profile. Testing can be done in Guest mode or with single-use profiles if permission persistence is not desired.

## Automatic permission prompts
When WebID is enabled and a user attempts a federated sign-in using the OpenID Connect protocol over a top-level cross-origin navigation, the navigation request can be blocked by WebID and a permission prompt shown to the user. The same happens with a different prompt when an OIDC response is returned to the relying party. There is [a rough heuristic](README.md#the-permission-oriented-api) to identify these navigations, so it is possible some requests might be missed.

This is intended to illustrate a simple backward-compatible relaxation of web privacy restrictions for identity flows. It has some known limitations, such as behaving poorly in the presence of redirects on the request to the IDP.

## Testing the API

### Relying Party implementation

The RP interacts with the WebID API to obtain an ID token for a user. The API method returns a promise that either resolves successfully and provides the token, or else is rejected with an error. The page must be served over HTTPS.

The `mode` parameter to the API specifies whether the permission or mediation-oriented flow is beings tested. Omitting the argument defaults to permission-oriented flow. Using `mode: "mediation"` triggers the mediation-oriented flow. 

```javascript
async function login() {
  // Feature detection.
  if (!navigator.id) {
    console.log("WebID is not available.");
    return;
  }
  
  try {
    // In this example, https://idp.example is the IdP's URL.
    // |request| could include any OAuth request fields.
    const token = await navigator.id.get({
        provider: "https://idp.example",
        request: "client_id=1234&nonce=Ct60bD&response_type=code&scope=email openid profile",
        mode: "permission",
    });

    log(`received token: ${token}`);
  } catch (e) {
    log(`rejected with ${e}`);
  }
};
```

### Identity Provider implementation
The Chrome prototype implements two protocols between the browser and the IDP, one for each supported variation of the API.

In the permission-oriented variation, the IdP must respond to three different HTTP requests:
1. A request for the WebID Well-Known configuration.
2. A request to fetch an ID token.
3. A request for a sign-in web page if the IdP requires user interaction before providing the token.

The mediation-oriented variation also has three different HTTP requests:
1. A request for the WebID Well-Known configuration.
2. A request for a list of accounts that the user can use for federated sign-in.
3. A request for an ID token associated with a specified the accounts.

All of these must be served over HTTPS. These requests are tagged with a forbidden header `Sec-WebID-CSRF` to identify them as browser-generated WebID requests. The `Sec-` prefix prevents web content being able to set this header on other kinds of traffic such as via `XMLHttpRequest`, which makes it useful to prevent CSRF attacks. The header currently has an empty value.

_Note that the UI for the mediation-oriented variation is still in development, but the protocol can be tested on Canary. This note is current as of 2021-05-20._

### Permission-oriented variation protocol details

#### Well-Known configuration request
After the RP initiates a sign-in flow by calling the API, the browser learns about the IdP's WebID support with a fetch to `https://idp.example/.well-known/webid`, where `https://idp.example` was specified as the provider by the RP.

The browser expects a response with MIME type `application/json`, currently containing only one field:<br>
```json
{
  "idp_endpoint": "https://idp.example/webid/idp_endpoint"
}
```

The `idp_endpoint` value provides the URL that the browser should use for the next step.

#### ID token fetch
The browser will then issue a credentialed `GET` request to `https://idp.example/webid/signin?{OAuth request string}`.

The browser expects one of two responses (both with MIME type `application/json`):
1. If the IdP can reply immediately with a token to fulfill the sign-in token request:<br>

```json
{
  "id_token": "ID_token_here"
}
````

2. If the IdP requires user interaction such as sign-in or choosing an account, before issuing a token:<br>

```json
{ 
  "signin_url": "https://idp.example/webid/user_login"
}
```

#### IdP sign-in page
If the IdP responded to the token fetch in the previous step with a `signin_url`, the browser will then load and render a page from that URL. The page will contain HTML for the user to provide whatever action is needed, then the IdP will invoke the `navigator.id.provide()` API to give a token back to the RP (or provide an empty string if it chooses not to give a token).<br>

```javascript
navigator.id.provide('YOUR_JWT_HERE');
```

The string should contain a [JWT](https://jwt.io/).

### Mediation-oriented variation protocol details

#### Well-Known configuration request
After the RP initiates a sign-in flow by calling the API, the browser learns about the IdP's WebID support with a fetch to `https://idp.example/.well-known/webid`, where `https://idp.example` was specified as the provider by the RP.

The browser expects a response with MIME type `application/json`, currently containing two fields:<br>
```json
{
  "token_endpoint": "https://idp.example/webid/webid_token_endpoint",
  "accounts_endpoint": "https://idp.example/webid/webid_accounts_endpoint",
}
```

The `accounts_endpoint` value provides the URL for the next step, fetching a list of user accounts. The `token_endpoint` value provides the URL that the browser should use for the third step, requesting an ID token.

#### Account list fetch
The browser sends a credentialed request to the specified `accounts_endpoint`. The cookie on the request can be used to identify valid signed-in accounts the user might have on the IDP which are then returned in the response. A valid response body would look like:<br>
```json
{
 "accounts": [
  { "sub": 1234, 
   "name": "John Doe", "given_name": "John", "family_name": "Doe", 
   "email": "john_doe@idp", "picture": "https://idp.example/profile/123",
   "enrolled_relying_parties": ["bakery.example", "login.shop.example"] 
  },
  {"sub": 5678, 
   "name": "Johnny", "given_name": "Johnny", "family_name": "",
   "email": "johnny@idp", "picture": "https://idp.example/profile/456"
  }
 ],
 "request_id": "xyz123123zyx",
 "tos": "https://idp.example/tos.html",
 "privacy_policy": "https://idp.example/privacy.html"
}
```

Several of the fields have obvious function.

`enrolled_relying_parties` provides a list of RPs that this account has been used to sign in to before. The browser can determine whether the current RP is on the list and adapt the user experience accordingly.

`request_id` allows the IDP to correlate this response with the subsequent ID token request.

#### ID token fetch
If the user selects an account from one that is offered, the browser sends a `POST` request to the `token_endpoint` with a body such as:<br>
```json
{
  "account": 1234,
  "request_id": "xyz123123zyx",    
  "request": {
    "client_id": "myclientid",
    "nonce": "abc987987cba"
  }
}
```

`account` and `request_id` are taken from the response of the previous request, and the `request` field contains information from the RP's original identity request.

## Session Management

We have also been experimenting with methods for helping session management features continue to work that currently rely on third-party cookies. So far the only implemented proposal is an API for Logout.

### Logout API
The Logout API, `navigator.id.logout()` which is being explored as a way to preserve OIDC front-channel logout and SAML Single Signout with loss of access to third-party cookies in embedded contexts. It is intended to replace situations where an IDP logging out a user also must log out the user in RP contexts and would normally do it using iframes with each RP's known logout URL.

The API takes an array of URLs as an argument. For each URL, the browser determines if the user is known to have previously logged in to the RP using that IDP, and if it has, it sends a credentialed GET request to that URL. The determination is currently based on the permission set during an identity request from the RP to the IDP, either via `navigator.id.get()` or from an intercepted OIDC navigation with an automatic permission prompt. That logic should be considered very tentative.

```javascript
navigator.id.logout(['https://rp1.example/logout', 'https://rp2.example/logout']);
```

For security reasons, the IDP does not learn whether any of the network requests succeeded or failed.

The shape of this API, its behavior, its effectiveness for addressing current problems, and its privacy properties are topics of discussion.
