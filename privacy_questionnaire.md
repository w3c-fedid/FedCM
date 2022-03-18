### 1. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

With the deprecation of third-party cookies, identity providers (IDPs) can no longer know the
accounts of a user that is trying to sign into a relying party (RP). This API will expose
information about the user’s IDP account to the RP once the user chooses to use a specific account
from the IDP to login to the RP. This exposure is necessary in order to preserve federated sign-in
in websites. Note that this API does not yet cover signing in via full-page redirects, and in fact
this API does not allow the user to login to the IDP if they are not already. The redirect flow is
being thought about as well since link decoration is also in the process of being phased out due to
its misuse as tracking vectors. This API also makes a credentialed request to the IDP in order to
obtain the user’s IDP accounts, so that they can be shown to the user. This request does not include
information about the RP where the request is coming from. It also exposes the fact that the user
chose to login into the RP with certain IDP credentials, once that happens. This is necessary in
order for the IDP to facilitate the login and to enable them to perform actions such as
front-channel logout (logging out of all relying parties using certain IDP credentials). Exposing
this information serves user needs because it enables them to login to sites using credentials from
IDPs which they already have. This greatly reduces the user friction associated with creating a
username and password, thus making it a better user experience. There are risks involved: RPs or
IDPs can collude to attempt to track users by using the API. The best defense here consists of
ensuring that the identity of the user is hidden at least until the user chooses an account to sign
in. We are actively working on reducing the information exposed before the user chooses an account.
For instance, there are timing attacks that the RP and IDP can execute in order to gain knowledge
about the user just based on the credentialed request to the IDP to get the user accounts. This
could be mitigated by user a push model (instead of the current ‘pull’ model): the IDP will notify
the browser about the user account information when the user logs in, so no request is needed when
the user visits the RP.

### 2. Do features in your specification expose the minimum amount of information necessary to enable their intended uses?

In order to enable logging in, the browser must request the user accounts from the IDP, and it must
provide the user credentials to the RP once the user chooses an account. The information exposed
includes the user’s name, email, and profile picture. This is the minimum amount of information
necessary, as it is used by the RP as if the user had entered that information when creating an
account. It is possible to think of a future where the credentials are anonymized so that even after
the user chooses an account, the RP does not know the exact details about the user. This will be
considered for future iterations of the API.

### 3. How do the features in your specification deal with personal information, personally-identifiable information (PII), or information derived from them?

The personal information exposed by this API is: name, email address, and profile picture. This
information is only exposed once the user selects an IDP account to login to the RP, and this
represents consent from the user for the RP to learn their information from the IDP.

### 4. How do the features in your specification deal with sensitive information?

The purpose of this API is to allow federated login, and as such it is necessary to expose the
sensitive user information to JavaScript. It is worth noting that this information does not include
any passwords.

### 5. Do the features in your specification introduce new state for an origin that persists across browsing sessions?

There is intentionally a new state being introduced for an origin for which the user chooses to
login via the FedCM API. So this does allow the origin to identify the user across multiple page
visits, but only because the user has consented to login to this RP via the IDP credentials. The IDP
would not receive any information when repeat visits occur. The user should have the ability to
logout of the RP as well and even clear the credentials that are created from FedCM. Thus we believe
that browsers consider how clearing Cookies and site data should affect FedCM, when implementing the
API. At a minimum, clearing site data should clear FedCM tokens. In addition, the browser should
consider adding FedCM-specific site clearing settings.

### 6. Do the features in your specification expose information about the underlying platform to origins?

No

### 7. Does this specification allow an origin to send data to the underlying platform?

The information exchanged via the FedCM API is meant to be structured in order to reduce risks and
prevent adding fingerprinting tracking strings. In particular:

* The accounts list passed from the IDP to the browser has fields such as ‘given name’, ‘name’, and
  ‘email’.
* The metadata passed from the IDP to the browser contains a ‘privacy policy url’ and a ‘terms of
  service url’.
* The IDP token is structured as well, allowing fields like ‘name’, ‘email’, and ‘profile picture’.

### 8. Do features in this specification enable access to device sensors?

No

### 9. Do features in this specification enable new script execution/loading mechanisms?

No

### 10. Do features in this specification allow an origin to access other devices?

No

### 11. Do features in this specification allow an origin some measure of control over a user agent’s native UI?

This feature does not modify the native UI per se but it does allow introducing a sign in sheet. The
user’s choice on the sign in sheet should not block user agent UI but rather be rendered on top of
the website, occluding part of it. And the user selections on the sheet are not redirected to the
website, but rather handled directly by the browser.

### 12. What temporary identifiers do the features in this specification create or expose to the web?

The tokens created and used by the FedCM API are managed by the IDP, and hence it is the IDP that
has to choose token expiry. The user agent does not store tokens, and the RP should coordinate with
the IDP to refresh tokens as needed. As tokens could be encrypted, it seems unfeasible for the user
agent to enforce expiries on them.

### 13. How does this specification distinguish between behavior in first-party and third-party contexts?

The FedCM API can be called by a top-level frame without issue. However, there are use-cases for
requesting users to sign in from an iframe. Due to the risk of abuse from giving cross-origin
iframes access to the API, by default these cannot access the API. However, we propose using
Permissions Policy to allow top-level frames to grant iframes with permissions for calling the API.

### 14. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?

The FedCM API should work the same way in Incognito mode, thus not introducing a way for the RP to
tell that the user is currently browsing in that mode. In addition, as with cookies, any state
resulting from browsing in incognito mode should be cleared once the user ends the session.

### 15. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?

* [Security section](https://fedidcg.github.io/FedCM/#security) is work in progress
* [Privacy](https://fedidcg.github.io/FedCM/#privacy) is discussed more in depth

### 16. Do features in your specification enable origins to downgrade default security protections?

This API allows the RP and IDP to communicate with each other to enable federated login in the
absence of third-party cookies. The specification will allow the usage of Permissions Policy to
enable the API on iframes, so in particular this API is disabled by default on iframes.

### 17. How does your feature handle non-"fully active" documents?

The dialog to choose an IDP and a user account within the IDP should not be shown when the document
is not visible, which in particular means that it should not be shown for non-fully active
documents.

### 18. What should this questionnaire have asked?

Timing attacks were discussed briefly in 2.1. It could be useful to ask whether there are multiple
bits of information that are disclosed separately but when correlated help break privacy or security
assumptions.
