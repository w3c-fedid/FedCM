
### 1. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

In the FedCM API, the user is visiting a relying party (RP) and is presented with a prompt to
perform federated sign-in by choosing one of their accounts from an identity provider (IDP). This
API exposes the following information to enable this federated sign-in flow: The user agent fetches
metadata about the RP from the IDP. This metadata includes a privacy policy URL and Terms of
Service. This exposes to the IDP that someone is visiting the RP, and is necessary to present these
links to the user on the FedCM UI. The user agent performs a separate credentialed fetch to get a
list of user’s accounts from the IDP. This exposes to the IDP that the given user is visiting some
unknown website which uses the FedCM API. Once the user chooses an account from the list of
accounts, the user agent gets a token from the IDP and provides this token to the RP. This exposes
information about the user’s selected account to the RP. It is necessary to complete the sign-in
process. Exposing this information serves user needs because it enables them to login to sites using
credentials from IDPs which they already have. This greatly reduces the user friction associated
with creating a username and password, thus making it a better user experience. We are actively
working on minimizing the information exposed before the user chooses an account. For instance, the
API could use directed identifiers instead of global ones which let the IDP track users that are
signed in. In addition, there are timing attacks that the RP and IDP can execute (by using the
information in 1) and 2) above) in order to gain knowledge about the user just based on the
credentialed request to the IDP to get the user accounts. This could be mitigated by using a push
model (instead of the current ‘pull’ model): the IDP will notify the browser about the user account
information when the user logs in, so no request is needed when the user visits the RP.

### 2. Do features in your specification expose the minimum amount of information necessary to enable their intended uses?

No (but it’s complicated). In order to enable logging in, the browser must request the user accounts
from the IDP, and it must provide the ID tokens to the RP once the user chooses an account. The
information exposed includes an account identifier, the user’s name, email, and profile picture (and
this may be expanded in the future as well). This is the minimum amount of information necessary, as
it is used by the RP as if the user had entered that information when creating an account. It is
possible to think of a future where the credentials are directed so that even after the user chooses
an account, the RP does not know more than they need about the user. This will be considered for
future iterations of the API.

### 3. How do the features in your specification deal with personal information, personally-identifiable information (PII), or information derived from them?

PII is only exposed with user consent to login. The personal information exposed by this API is: id,
name, email address, and profile picture.

### 4. How do the features in your specification deal with sensitive information?

The user agent facilitates communication, but it is the IDP who crafts the ID token exposed to the
RP for login. The purpose of this API is to allow federated login, and as such it is necessary to
expose the sensitive user information to JavaScript once the user has consented. It is worth noting
that this information does not include any passwords. This API protects the user’s privacy before
consent by not sharing any data with the RP before consent.

### 5. Do the features in your specification introduce new state for an origin that persists across browsing sessions?

Yes. There is intentionally a new state being introduced for an origin for which the user chooses to
login via the FedCM API. This allows the origin to identify the user across multiple page visits,
but only because the user has consented to login to this RP via the IDP credentials. The IDP would
not receive any information when repeat visits occur, unless the RP requests a new ID token for
whatever reason. The user should have the ability to logout of the RP as well and even clear the
credentials that are created from FedCM. Thus we believe that browsers consider how clearing Cookies
and site data should affect FedCM, when implementing the API. At a minimum, clearing site data
should clear FedCM tokens. In addition, the browser should consider adding FedCM-specific site
clearing settings.

### 6. Do the features in your specification expose information about the underlying platform to origins?

No

### 7. Does this specification allow an origin to send data to the underlying platform?

No

### 8. Do features in this specification enable access to device sensors?

No

### 9. Do features in this specification enable new script execution/loading mechanisms?

No

### 10. Do features in this specification allow an origin to access other devices?

No

### 11. Do features in this specification allow an origin some measure of control over a user agent’s native UI?

Yes. This feature allows introducing a sign-in sheet created by the user agent based on the
information provided by the IDP. The user’s choice on the sign in sheet may or may not block other
user agent UI: this choice is up to the user agent. And the user selections on the sheet (other than
clicking on the privacy policy or terms of service links) are not redirected to the website, but
rather handled directly by the user agent.

### 12. What temporary identifiers do the features in this specification create or expose to the web?

The tokens created and used by the FedCM API are managed by the IDP, and hence it is the IDP that
has to choose token expiry. The user agent does not store tokens, and the RP should coordinate with
the IDP to refresh tokens as needed.

### 13. How does this specification distinguish between behavior in first-party and third-party contexts?

The FedCM API can be called by a top-level frame without issue. Due to the risk of abuse from giving
cross-origin iframes access to the API, by default these cannot access the API. However, there are
use-cases for requesting users to sign in from an iframe. We propose using Permissions Policy to
allow top-level frames to grant iframes with permissions for calling the API.

### 14. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?

The FedCM API should work the same way in Incognito mode, thus not introducing a way for the RP to
tell that the user is currently browsing in that mode. In addition, as with cookies, any state
resulting from browsing in incognito mode should be cleared once the user ends the session.

### 15. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?

Security section is work in progress: https://w3c-fedid.github.io/FedCM/#security Privacy is discussed
more in depth: https://w3c-fedid.github.io/FedCM#privacy 

### 16. Do features in your specification enable origins to downgrade default security protections?

No. This API allows the RP and IDP to communicate with each other to enable federated login in the
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
