---
title: "How to experiment with WebID in Chrome"
maintainer: "kenrb"
created: 10/12/2020
updated: 10/12/2020
---


# How to experiment with WebID in Chrome

A prototype of the API approaches described in the [solutions page](consumers.md) is present in Chrome 89. **This is intended for experimentation purposes and is subject to change as a specification takes shape and develops.**

We will do our best to keep these instructions up to date as protocol and API changes occur.

As of approximately December 11, 2020, it is available on Chrome Canary channel. It will subsequently roll into downstream channels.

## Enabling WebID in Chrome
1. Download a version of Chrome with WebID implemented. ([Link for Canary channel](https://www.google.com/chrome/))
2. Launch Chrome with the command line flag --enable-features=WebID. ([Instructions for different platforms.](https://www.chromium.org/developers/how-tos/run-chromium-with-flags))
3. Navigate to a Relying Party page that will exercise the API.

## Relying Party implementation

The RP interacts with the WebID API to obtain an ID token for a user. The API method returns a promise that either resolves successfully and provides the token, or else is rejected with an error. The page must be served over HTTPS.

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
    });

    log(`received token: ${token}`);
  } catch (e) {
    log(`rejected with ${e}`);
  }
};
```

## Identity Provider implementation

The Chrome prototype currently implements the [permission-oriented variation](permission_oriented_api.md) of the API.

In this variation, the IdP must respond to three different HTTP requests:
1. A request for the WebID Well-Known configuration.
2. A request to fetch an ID token.
3. A request for a sign-in web page if the IdP requires user interaction before providing the token.

All of these must be served over HTTPS.

### Well-Known configuration request

After the RP initiates a sign-in flow by calling the API, the browser learns about the IdP's WebID support with a fetch to `https://idp.example/.well-known/webid`, where `https://idp.example` was specified as the provider by the RP.

The browser expects a response with MIME type `application/json`, currently containing only one field:<br>
`{ 'idp_endpoint': 'https://idp.example/webid/signin' }`

The `idp_endpoint` value represents the address that the browser should use for the next step.

### ID token fetch

The browser will then issue a credentialed `GET` request to `https://idp.example/webid/signin?{OAuth request string}`.

The browser expects one of two responses (both with MIME type `application/json`):
1. If the IdP can reply immediately with a token to fulfill the sign-in token request:<br>
`{ 'id_token' : '{JWT ID token here}' }`
2. If the IdP requires user interaction such as sign-in or choosing an account, before issuing a token:<br>
`{ 'signin_url' : 'https://idp.example/webid/user_login' }`

### IdP sign-in page

If the IdP responded to the token fetch in the previous step with a `signin_url`, the browser will then load and render a page from that URL. The page will contain HTML for the user to provide whatever action is needed, then the IdP will invoke the `navigator.id.provide()` API to give a token back to the RP (or provide an empty string if it chooses not to give a token).<br>

```javascript
await navigator.id.provide("YOUR_ID_TOKEN_HERE_SERIALIZED_AS_A_STRING");
```

The string should be a [JWT](https://jwt.io/), for example:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```
