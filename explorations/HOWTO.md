# HOWTO

This article explains how to try out FedCM in Google Chrome.

We will do our best to keep these instructions up to date as protocol and API
changes occur. It will subsequently roll into downstream channels, but with lag
in functionality and bug fixes since this is under development.

## Available functionality

As of July 2022, Chrome supports the mediation-oriented flow on Android.

From the Relying Party (RP):

* `navigator.credentials.get()`: Sign-up and sign-in. Prompts the user to pick an account.

From the Identity Provider (IdP):

* `FederatedCredential.logoutRPs()`: Sends a signal to specified RPs to logout the user.
* A request for the `/fedcm.json` configuration.
* A request for a list of accounts that the user can use for federated sign-in.
* A request for a metadata about clients (RPs).
* A request for an ID token associated with a specified account.
* A request to revoke an ID token associated with an account.

These are described in more detail in the sections below.

**Note**: Though we do have a prototyping implementation of the
permission-oriented flow on desktop, it's not currently actively maintained and
we do not guarantee that it will continue to work the way it is in the future.

## Enabling FedCM in Chrome

1. Download Chrome Canary. Since this is a prototype with ongoing development,
   the implementation in other channels will be out of date with respect to
   functionality and bug fixes.
2. Enable FedCM. This can be done directly from `chrome://flags#fedcm` from
   Chrome 98 or later. Change the setting from "Default" to "Enabled".

At the moment the only way to reset the sign-up status is to clear browsing data
on the Chrome profile. This can be done from the **[ClearBrowsing Data
(`chrome://settings/clearBrowserData`)]** **[Settings]** dialog. Under
**[Advanced]** select the **[Site Settings]** checkbox. Also be sure the time
range of data being cleared includes the time when the sign-up status was set.

Testing can be easier in Incognito mode, Guest mode or with single-use profiles
if sign-up status persistence is not desired.

## Testing the API

### Feature detection

In order to determine whether the FedCM API is available, we have two feature
detection scripts. To feature-detect on Chrome versions before 105.0.5170.0, run
the following JS snippet:

```js
// Feature detection: Since `FederatedCredential` is already available in Chrome
// for the old Credential Management API, additional
// `FederatedCredential.prototype.login` check is required.
function isOldFedCMEnabled() {
  return !(!window.FederatedCredential || !FederatedCredential.prototype.login);
}
console.log(isOldFedCMEnabled() ? "FedCM is available" : "FedCM is not available");
```

As of Chrome 105.0.5170.0 or later, we use IdentityCredential, which is not an
interface previously used so feature detection becomes:

```js
function isFedCMEnabled() {
  return !!window.IdentityCredential;
}
console.log(isFedCMEnabled() ? "FedCM is available" : "FedCM is not available");
```

### Relying Party implementation

The RP interacts with the FedCM API to obtain an ID token for a user. The API
method returns a promise that either resolves successfully and provides the
token, or else is rejected with an error.

**Note**: The page must be served over HTTPS. `navigator.credentials` is not
defined on other types of pages.

```js
async function login() {
  try {
    if (!isOldFedCMEnabled() && !isFedCMEnabled()) {
      return;
    }

    // In this example, https://idp.example is the IdP's URL.
    var idToken = await navigator.credentials.get({
      federated: {
        providers: [{
          url: "https://idp.example", // IdP domain
          clientId: "1234", // Client ID of the RP
          nonce: "5678", // Nonce (random value)
        }]
      }
    });

    console.log(`received token: ${idToken}`);
  } catch (e) {
    console.log(`rejected with ${e}`);
  }
};
```

The JS API allows the RP to obtain the `idToken`, a proof of IDP authentication.

### Identity Provider implementation

The Chrome prototype supports multiple endpoints between the browser and the
IdP. On the mediation-oriented flow, there are five different HTTP requests:

1. A request for the `/fedcm.json` configuration.
2. A request for a list of accounts that the user can use for federated sign-in.
3. A request for a metadata about clients (RPs).
4. A request for an ID token associated with a specified account.
5. A request to revoke an ID token associated with an account.

All of these must be served over HTTPS. These requests are tagged with a
browser-controlled header `Sec-FedCM-CSRF` to identify them as browser-generated
FedCM requests. The `Sec-` prefix prevents web content being able to set this
header on other kinds of traffic such as via `XMLHttpRequest`, which makes it
useful to prevent CSRF attacks. The header value is undefined.

### Protocol details

#### `/fedcm.json` configuration request

After the RP initiates a sign-in flow by calling the
`navigator.credentials.get()`, the browser learns about the IdP's FedCM support
with a fetch to `https://idp.example/fedcm.json`, where
`https://idp.example` was specified as the provider URL by the RP.

The browser expects a response with MIME type `application/json`, currently
containing four fields:

```json
{
  "accounts_endpoint": "https://idp.example/fedcm/accounts_endpoint",
  "client_metadata_endpoint": "https://idp.example/fedcm/client_metadata_endpoint",
  "id_token_endpoint": "https://idp.example/fedcm/token_endpoint",
  "revocation_endpoint": "https://idp.example/fedcm/revocation_endpoint",
  "branding": {
    "background_color": "green",
    "color": "#FFEEAA",
    "icons": [{
      "url": "https://idp.example/icon.ico",
      "size": 10
    }]
  }
}
```

* The `accounts_endpoint` value provides the URL to fetch a list of user
  accounts.
* The `client_metadata_endpoint` value provides the URL to fetch the client
  metadata including terms of services and privacy policy.
* The `id_token_endpoint` value provides the URL to request an ID token.
* The `revocation_endpoint` value provides the endpoint URL to revoke all id
  tokens of the user.

#### Account list fetch

After fetching the configuration, the browser sends a credentialed
request to the specified `accounts_endpoint`. The cookie on the request can be
used to identify valid signed-in accounts the user might have on the IdP which
are then returned in the response. A valid response body would look like:

```json
{
  "accounts": [
    {
      "id": "1234",
      "name": "John Doe",
      "given_name": "John",
      "email": "john_doe@idp",
      "picture": "https://idp.example/profile/123"
    },
    {
      "id": "5678",
      "name": "Johnny",
      "given_name": "Johnny",
      "email": "johnny@idp",
      "picture": "https://idp.example/profile/456"
    }
  ]
}
```

The browser will render an account picker UI based on this information.

#### metadata endpoint

The client metadata endpoint provides metadata about the RP. The browser sends a
un-credentialed request to the `client_metadata_endpoint`.

```json
{
  "privacy_policy_url": "https://idp.example/privacy.html",
  "terms_of_service_url": "https://idp.example/tos.html",
}
```

Currently terms of service and privacy policy are defined as returned
properties. They are rendered in the account picker UI.

#### ID token fetch

If the user selects an account from one that is offered, the browser sends a
credentialed `application/x-www-form-urlencoded` POST request to the
`id_token_endpoint` with a body such as:

```http
account_id=1234&client_id=myclientid&nonce=abc987987cba
```

`account_id` is taken from the response of the previous request.

The HTTP response will be parsed as a JSON file including `id_token`.

```json
{
  "id_token": "eyJC...J9.eyJzdWTE2...MjM5MDIyfQ.SflV_adQssw....5c",
}
```

## Session Management

We have also been experimenting with methods for helping session management
features continue to work that currently rely on third-party cookies. So far the
only implemented proposal is an API for Logout.

### Logout API

The Logout API, `FederatedCredential.logoutRPs()` which is being explored as a way
to preserve OIDC front-channel logout and SAML Single Signout with loss of
access to third-party cookies in embedded contexts. It is intended to replace
situations where an IDP logging out a user also must log out the user in RP
contexts and would normally do it using iframes with each RP's known logout URL.

The API takes an array of URLs as an argument. For each URL, the browser
determines if the user is known to have previously logged in to the RP using
that IDP, and if it has, it sends a credentialed GET request to that URL.

```js
FederatedCredential.logoutRPs([{
  url: "https://rp1.example/logout",
  accountId: "123",
}, {
  url: "https://rp2.example/logout",
  accountId: "456",
]);
```

For security reasons, the IDP does not learn whether any of the network requests
succeeded or failed.

The shape of this API, its behavior, its effectiveness for addressing current
problems, and its privacy properties are topics of discussion.
