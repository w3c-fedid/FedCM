### 1. What information does this feature expose, and for what purposes?
In the FedCM API, the user is visiting a relying party (RP) and is presented with a prompt to perform federated sign-in by choosing one of their accounts from an identity provider (IDP).
This API exposes the following information to enable this federated sign-in flow:
the user agent fetches metadata about the RP from the IDP.
The user agent queries this from the IDP for a few reasons:

* The goal of FedCM is to work without requiring any RP interventions, assuming that the RP has embedded an IDP SDK in its site. Therefore, in these cases, all of the information would come from the IDP.
* The IDP may have legal requirements that it needs to verify the links presented to the user. That said, we have a feature request to allow the RP to provide their own links, at least in certain cases. See w3c-fedid/idp-registration#8 for more details.

This metadata includes a privacy policy URL and Terms of Service.
This exposes to the IDP that someone is visiting the RP, and is necessary to present these links to the user on the FedCM UI.
However, assuming that the RP has embedded an IDP SDK, this does not let the IDP learn anything new, as the IDP can send itself an uncredentialed fetch.

The user agent performs a separate credentialed fetch to get a list of user’s accounts from the IDP.
This exposes to the IDP that the given user is visiting some unknown website which uses the FedCM API.
Once the user chooses an account from the list of accounts, the user agent gets a token from the IDP and provides this token to the RP.
This exposes information about the user’s selected IdP and account to the RP.
It is necessary to complete the sign-in process.
Exposing this information serves user needs because it enables them to login to sites using credentials from IDPs which they already have.
This removes the need to create a username and password in the RP, thus making it an easier and more secure user experience.

We are actively working on alternatives to reduce the information exposed before the user chooses an account.
For instance, we could use a delegation model to prevent the IdP from knowing every time the user uses FedCM with them: see https://github.com/w3c-fedid/FedCM/issues/677 for more details.
In addition, there are timing attacks that the RP and IDP can execute (by using the information in the uncredentialed fetch revealing the RP and the credentialed fetch revealing the user’s IdP accounts above) in order to gain knowledge about the user just based on the credentialed request to the IDP to get the user accounts.
We have mitigated this in a couple of ways:

* We use the login status API to keep track of when users are logged in to the IdP, avoid fetching accounts if they are not, and always show UI if the IdP claims the user is logged in but they are not. This was solved in w3c-fedid/FedCM#447.
* We are actively working on an alternative model where the API does not need to fetch accounts before the user agrees to linking information between the RP and the IDP. The repository for this is https://github.com/fedidcg/LightweightFedCM.

### 2. Do features in your specification expose the minimum amount of information necessary to implement the intended functionality?
In order to enable logging in, the browser must request the user accounts from the IDP, and it must provide the ID tokens to the RP once the user chooses an account.
The information exposed includes an account ID, the user’s name, email, and profile picture (and this may be expanded in the future as well).
This information is requested by the browser to create a user-comprehensible dialog.
The information sent to the RP to create the user account is controlled by the IdP, and it is only sent once the user agrees to use the IdP account.
The ID of the account is sent to the IdP to know which account the user has selected.
It is possible to think of a future where the IdP is blind so that either (a) it does not know anything until the user agrees to use the API or (b) it does not know who the RP is even after the exchange of information occurs.
As mentioned above, these are future iterations of the API that we are working on.

### 3. Do the features in your specification expose personal information, personally-identifiable information (PII), or information derived from either?
PII is only exposed to the RP once the user consents to login.
The actual information exposed once user consents to login is up to the IdP, and it is not something that this API can control.

### 4. How do the features in your specification deal with sensitive information?
The user agent facilitates communication, but it is the IDP who crafts the ID token exposed to the RP for login.
The purpose of this API is to allow federated login, and as such it is necessary to expose the sensitive user information to JavaScript once the user has consented.
It is worth noting that this information does not include any passwords.
This API protects the user’s privacy before consent by not sharing any data with the RP before consent.

### 5. Does data exposed by your specification carry related but distinct information that may not be obvious to users?
No

### 6. Do the features in your specification introduce state that persists across browsing sessions?
Yes. There is intentionally a new state: the connected accounts set, which stores information about which RP, IDP, accountIDs have been used via FedCM.
This allows the origin to identify the user across multiple page visits, but only because the user has consented to login to this RP via the IDP credentials.
The RP can achieve the same result by just storing a cookie with this information.
The IDP would not receive any information when repeat visits occur, unless the RP requests a new ID assertion (via a navigator.credentials.get request) for whatever reason.
The user should have the ability to logout of the RP as well and even clear the credentials that are created from FedCM.
Thus we believe that browsers consider how clearing Cookies and site data should affect FedCM, when implementing the API.
At a minimum, clearing site data should clear FedCM’s connected accounts set.
In addition, the browser should consider adding FedCM-specific site clearing settings.
Another state introduced with this API is the IDP login status.
This state is used to ensure that fetching accounts always results in some visible UI being shown to the user.
The state is not something that neither the RP nor the IDP can query.

### 7. Do the features in your specification expose information about the underlying platform to origins?
No

### 8. Does this specification allow an origin to send data to the underlying platform?
No

### 9. Do features in this specification enable access to device sensors?
No

### 10. Do features in this specification enable new script execution/loading mechanisms?
No

### 11. Do features in this specification allow an origin to access other devices?
No

### 12. Do features in this specification allow an origin some measure of control over a user agent’s native UI?
Yes. This feature allows the introduction of a sign-in sheet created by the user agent based on the information provided by the IDP.
The user’s choice on the sign in sheet may or may not block other user agent UI: this choice is up to the user agent.
And the user selections on the sheet (other than clicking on the privacy policy or terms of service links) are not redirected to the website, but rather handled directly by the user agent.

### 13. What temporary identifiers do the features in this specification create or expose to the web?
The tokens created and used by the FedCM API are managed by the IDP, and hence it is the IDP that has to choose token expiry.
The user agent does not store tokens, and the RP should coordinate with the IDP to refresh tokens as needed.

### 14. How does this specification distinguish between behavior in first-party and third-party contexts?
The FedCM API can be called by a top-level frame without issue.
Due to the risk of abuse from giving cross-origin iframes access to the API, by default these cannot access the API.
However, there are use-cases for requesting users to sign in from an iframe.
We use Permissions Policy to allow top-level frames to grant iframes with permissions for calling the API.

### 15. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?
The FedCM API should work the same way in Incognito mode, thus not introducing a way for the RP to tell that the user is currently browsing in that mode.
In addition, as with cookies, any state resulting from browsing in incognito mode should be cleared once the user ends the session.

### 16. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?
Security section: https://w3c-fedid.github.io/FedCM/#security

Privacy section: https://w3c-fedid.github.io/FedCM#privacy

### 17. Do features in your specification enable origins to downgrade default security protections?
No. This API allows the RP and IDP to communicate with each other to enable federated login in the absence of third-party cookies.
The specification will allow the usage of Permissions Policy to enable the API on iframes, so in particular this API is disabled by default on iframes.

### 18. What happens when a document that uses your feature is kept alive in BFCache (instead of getting destroyed) after navigation, and potentially gets reused on future navigations back to the document?
The dialog to choose an IDP and a user account within the IDP should not be shown when the document is not visible, which in particular means that it should not be shown for non-fully active documents.
So in particular a FedCM request should be dismissed once the document enters the BFCache, and the document may resurface a request after

### 19. What happens when a document that uses your feature gets disconnected?
The FedCM request associated with a disconnected document should be rejected and any UI being shown dismissed.

### 20. Does your spec define when and how new kinds of errors should be raised?
Our spec does not use new kinds of errors, but rather existing ones

### 21. Does your feature allow sites to learn about the user’s use of assistive technology?
No

### 22. What should this questionnaire have asked?
Timing attacks were discussed briefly in 2.1.
It could be useful to ask whether there are multiple bits of information that are disclosed separately but when correlated help break privacy or security assumptions.
