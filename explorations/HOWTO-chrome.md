# HOWTO

This article explains how to try out FedCM in Google Chrome.

We will do our best to keep these instructions up to date as protocol and API
changes occur. It will subsequently roll into downstream channels, but with lag
in functionality and bug fixes since this is under development.

## Available functionality

As of December 2022, FedCM API is available by default on Chrome (versions 108+).
See [here](https://developer.chrome.com/docs/privacy-sandbox/fedcm/#use-api) for
a detailed guide on how to use the parts of the API that have been shipped!

## Testing the API

Testing can be easier in Incognito mode, Guest mode or with single-use profiles
if sign-up status persistence is not desired.

At the moment the only way to reset the sign-up status is to clear browsing data on the Chrome profile.
This can be done from the [ClearBrowsing Data (chrome://settings/clearBrowserData)] [Settings] dialog.
Under [Advanced] select the [Site Settings] checkbox. Also be sure the time range of data being cleared
includes the time when the sign-up status was set.

## Experimental functionality

To test experimental functionality:

1. Download Google Chrome Canary. It is best to experiment with the latest
   build possible to get the most up-to-date implementation.
2. FedCM is blocked if third party cookies are blocked. Ensure the Chrome
   version you're using is not blocking third party cookies by navigating to
   `chrome://settings/cookies`.
3. Enable your experimental FedCM feature. This can be done directly from
   `chrome://flags` and searching 'fedcm' to see all available features.

The list of experimental features can be found [here](/proposals/README.md).

### Logout

We have been experimenting with methods for helping session management
features continue to work that currently rely on third-party cookies. So far the
only implemented proposal is an API for Logout.

The Logout API, `IdentityCredential.logoutRPs()` which is being explored as a way
to preserve OIDC front-channel logout and SAML Single Signout with loss of
access to third-party cookies in embedded contexts. It is intended to replace
situations where an IDP logging out a user also must log out the user in RP
contexts and would normally do it using iframes with each RP's known logout URL.

The API takes an array of URLs as an argument. For each URL, the browser
determines if the user is known to have previously logged in to the RP using
that IDP, and if it has, it sends a credentialed GET request to that URL.

```js
IdentityCredential.logoutRPs([{
  url: "https://rp1.example/logout",
  accountId: "123",
}, {
  url: "https://rp2.example/logout",
  accountId: "456",
}]);
```

For security reasons, the IDP does not learn whether any of the network requests
succeeded or failed.

### LoginHint

To use the LoginHint API:

* Add an array of `hints` to the accounts described in the accounts endpoint:

```
{
  accounts: [{
    id: "accountId",
    email: "account@email.com",
    hints: ["hint", "otherHint"],
    ...
  }, ...]
}
```

* Invoke the API with the `loginHint` parameter like so:

```js
  return await navigator.credentials.get({
      identity: {
        providers: [{
          configURL: "https://idp.example/config.json",
          clientId: "123",
          nonce: nonce,
          loginHint : "hint"
        }]
      }
  });
```

Now, only accounts with the "hint" provided will show in the chooser.

### UserInfo

To use the UserInfo API:

* The RP must embed an IDP iframe, which will perform the query.
* The embedded iframe must receive permissions to invoke FedCM (via Permissions Policy).
* The user first needs to go through the FedCM flow once before invoking UserInfo.
* In a subsequent site visit, the IDP iframe may invoke UserInfo:

```js
const user_info = await IdentityProvider.getUserInfo({
    configUrl: "https://idp.example/config.json",
    clientId: "client1234"
});

user_info.forEach( info => {
  // It's up to the IDP regarding how to display the returned accounts.
  // Accounts are sorted based on RP registration status.
  const name = info.name;
  const given_name = info.given_name;
  const picture = info.picture;
  const email = info.email;
}
```

### RP Context

To use the RP Context API:

* Provide the `context` value in JS, like so:

```js
const {token} = await navigator.credentials.get({
  identity: {
    context: "signup", 
    providers: [{
          configURL: "https://idp.example/fedcm.json",
          clientId: "1234",
    }],
  }
});
```

Now, the browser UI will be different based on the value provided.

### IdP Sign-in Status API

To use the IdP Sign-in Status API:

1. Enable the experimental feature `FedCM with FedCM IDP sign-in status` in `chrome://flags`.
2. When the user logs-in to the IdP, use the following HTTP header `IdP-SignIn-Status: action=signin`.
3. When the user logs-out of all of their accounts in the IdP, use the following HTTP header `IdP-SignIn-Status: action=signed-out`.
4. Add a `signin_url": "/idp_login.html` property to the `configURL` configuration. 
5. The browser is going load the `signin_url` when the user is signed-out of the IdP.
6. Call `IdentityProvider.close()` when the user is done logging-in to the IdP.

### Error API

To use the Error API:

* Enable the experimental feature `FedCmError` in `chrome://flags`.
* Provide an `error` in the ID assertion endpoint instead of a `token`:
```
{
  "error" : {
     "code" : "access_denied",
     "url" : "https://idp.example/error?type=foo"
  }
}
```
Note that the `error` field in the response including both `code` and `url` is
optional. As long as the flag is enabled, Chrome will render an error UI when
the token request fails. The `error` field is used to customize the flow when an
error happens. Chrome will show a customized UI with proper error message if the
code is "invalid_request", "unauthorized_client", "access_denied", "server_error",
or "temporarily_unavailable". If a `url` field is provided and same-site with
the IdP's `configURL`, Chrome will add an affordance for users to open a new
page (e.g., via pop-up window) with that URL to learn more about the error on
that page.

### Auto-selected Flag API

To use the Auto-selected Flag API:
* Enable the experimental feature `FedCmAutoSelectedFlag` in `chrome://flags`.

The browser will send a new boolean to represent whether auto re-authentication
was triggered such that the account was auto selected by the browser in the flow
to both the IdP and the API caller.

For IdP, the browser will include `is_auto_selected` in the request sent to the
ID assersion endpoint:
```
POST /fedcm_assertion_endpoint HTTP/1.1
Host: idp.example
Origin: https://rp.example/
Content-Type: application/x-www-form-urlencoded
Cookie: 0x23223
Sec-Fetch-Dest: webidentity

account_id=123&client_id=client1234&nonce=Ct60bD&disclosure_text_shown=true&is_auto_selected=true
```

For the API caller, the browser will include a boolean when resolving the
promise:
```
const cred = await navigator.credentials.get({
  identity: {
    providers: [{
      configURL: "https://idp.example/manifest.json",
      clientId: "1234"
    }]
  }
});

const token = cred.token;
if (cred.isAutoSelected !== undefined) {
  const isAutoSelected = cred.isAutoSelected;
}
```
