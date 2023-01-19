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

In order to test experimental functionality:

1. Download Google Chrome Canary. It is best to experiment with the latest
   build possible to get the most up-to-date implementation.
2. FedCM is blocked if third party cookies are blocked. Ensure the Chrome
   version you're using is not blocking third party cookies by navigating to
   `chrome://settings/cookies`.
3. Enable your experimental FedCM feature. This can be done directly from
   `chrome://flags` and searching 'fedcm' to see all available features.

The list of experimental features can be found [here](/proposals/README.md).

### Logout API

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
