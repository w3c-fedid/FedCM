# FedCM Auto Re-authentication API Explainer

## Motivation

We have heard from both Relying Parties (RP) and Identity Providers (IDP) that they would like the authentication experience to be more streamlined for users who have already created a federated account with them. While this is achievable today by RPs setting long-lived session cookies, such a solution may be discouraged due to security reasons such as cookie theft. Managing long-lived cookies is challenging for many RPs and the cost gets proportionally increased with longer cookie lifetime.

We believe that the browser can help to reduce user friction at the re-authentication moment for RPs/IDPs without paying such security cost. In addition, since the new streamlined re-authn experience only applies to returning users who have granted permission for the RP-IDP communication in the past, we believe that this can be done without reducing privacy.

A quick overview of how the proposed  “auto re-authn” works:
1. Prerequisite: a user has already created an account on rp.example with idp.example in the browser, and has not cleared site data for either site
1. When the user returns to rp.example, they may no longer have an active session with the RP.  e.g. 1P session cookie expired
1. If “auto re-authn” is available (see details below), instead of showing the explicit sign-in UI with the “Continue as” call-to-action button, the browser can automatically fetch the token from idp.example and return it to rp.example
1. If successful, the user will be automatically re-authenticated into the RP. The browser can display some UI in the “auto re-authn” flow to give users some context of this feature.

## Proposals
Auto re-authn is for “returning users” only. In addition, it’s gated by several other conditions. We define **“Auto re-authn is available”** if all the following are true

1. An RP has opted in to auto re-authn AND
1. Only one account is eligible for auto re-authn AND
1. Auto re-authn is not in cooldown state

### Auto re-authn flow overview
<p align="center">
     <img width="467" src="/proposals/images/auto-re-authn-flow.png"/>
</p>

### API proposal
An RP can specify that they’d like to use auto re-authn by adding the autoReauthn field to the existing API:
```
const cred = await navigator.credentials.get({
    identity: {
        providers: [{
            configURL: "https://idp.example/fedcm.json",
            clientId: "1234",
        }],
        autoReauthn: true, // default to false
    },
});
```
When it’s true, and all other conditions are met, the browser can resolve the promise with the id token without explicit user action.

### UX proposal
As mentioned in the motivation section, auto re-authn provides streamlined user experience for users who have already created an account on the website without paying privacy or security cost. In the meantime we believe that providing some informative UI to users during the auto re-authn flow could give users more context.

When a user comes back to a website after some time, there are three possible scenarios:
1. the user is still signed in to the RP (e.g. the 1P RP cookie has not expired). RP/IDP should not call FedCM in this case so this is out of scope of FedCM
1. if auto re-authn is unavailable, the user will see the typical UI asking for their permission to proceed. e.g. the user will be presented with a UI with the “Continue as” button.
1. if auto re-authn is available, the browser will automatically send the token request to the IDP and show the UI with animation as if the user has clicked the “Continue as” button. e.g.
<p align="center">
     <img width="467" src="/proposals/images/auto-re-authn-ui.png"/>
</p>

#### Auto re-authn cooldown
When a user is automatically signed in, they may sign out if they want to switch an account or prefer to anonymously visit the site this time. To avoid the site from calling FedCM with auto re-authn immediately after the sign-out (which could lead to a dead loop), we disable auto re-authn within 10 mins from the last authentication.

#### Implicit user opt-out
When auto re-authn is triggered, there’s a UI with animation being displayed for 3 seconds. While the UI is not CTA, there’s currently a “X” button on it similar to the “Verifying…” UI in the non auto re-authn flow. If the “X” button is clicked, we may consider it as a signal of the user trying to end the flow and opt-out the user implicitly. However, according to the data we gathered so far, many users close the “Verifying…” UI today after they explicitly grant permission by clicking the “Continue as” button. i.e. user closing the UI doesn’t necessarily mean that they want to end the flow, it could also mean that they want to dismiss the UI sooner to continue browsing the website.

Therefore, we propose to monitor the “X” button close rate and only implicitly opt out users if auto re-authn has a statistically impact on the close rate. 

## Privacy Consideration
The major difference between the existing authentication flow and the auto re-authn flow is that the latter does not require explicit user permission for authentication. However, an explicit user permission to allow the RP-IDP communication MUST have been granted in the browser in the past (e.g. the browser stores such permission locally after a previous FedCM grant). i.e. the new feature only works “post permission”. 

From privacy’s perspective, this “post permission” feature does not introduce new privacy risks because an explicit user permission to allow RP-IDP communication has been granted in the browser in the past. Thus, bad actors can track user visits on an RP already. e.g. during the last time the user logged in with FedCM, RP and IDP could have already exchanged an identifier such that the RP could just make a fetch to the IDP and reveal relevant information to IDP anyway.

## Security Consideration
Technically speaking, the concept “auto re-authn” is achievable on the RP land. e.g. when a user is signing in to an RP with an IDP, the RP can set a long-lived cookie (e.g. 400 days) such that the user is always signed in to the RP as long as they revisit the RP within 400 days. However, while being able to automatically sign returning users back in is a promising feature for RPs, having to extend 1P cookies may be suboptimal or even impractical for some RPs. The proposed API on the other hand:
1. provides all RPs the opportunity of “auto re-authn” without jeopardizing their cookie policy
- Having long-lived session cookies are hard because an RP has to deal with cookie theft etc. which gets proportionally harder the longer it lives
- It’s cheaper to operate by delegating it to the IDP (auto re–authn works when the user is signed in to the IDP, i.e. IDP needs to manage long-lived session cookies but RPs don’t)
1. does not introduce any security risk similar to privacy since it’s “post permission”

## UX Consideration
While “auto re-authn” does not introduce any security and privacy risks, there are a handful of UX challenges. In addition to “Auto re-authn cooldown” and “Implicit user opt-out” mentioned above, there are several more considerations.

### Explicit user sign-out
We propose not to tie auto re-authn with explicit user sign-out. e.g. after a user signs out, we don’t disable auto re-authn for that RP. 

A user may sign out from an RP due to several reasons:
1. they have finished their business on the RP
1. they are using a shared/public computer
1. they want to browse the RP anonymously
1. they were signed in with a wrong account

For case #1, there’s no obvious signal that the user doesn’t want to sign in to the RP next time
For case #2, if the user either has cleared the cookies/browsing history, or signed out from the IDP to switch accounts, auto re-authn won’t be triggered next time.
For cases #3 and #4, the “auto re-authn cooldown” feature is able to honor their sign-out intention and won’t cause a dead loop.

From security ux’s perspective, since this feature is “post permission”, even though there’s a chance that a user may be automatically signed in unintentionally, there’s no privacy/security leak. In addition, the user is able to update their auto re-authn preferences from settings.
#### Considered alternative
While disabling auto re-authn after explicit user sign-out of the RP is also an acceptable UX, there’s no reliable way for the browser to detect such user action. Technically speaking the browser can expose a sign-out API such that the RP can “notify” the browser that the user has signed out and the browser can disable auto re-authn accordingly. That being said, this sign-out API is not a reliable way either since RPs are less incentivized to use it. Such inconsistency among RPs could lead to bad UX as well.
### Cancellable auto re-authn
When auto re-authn flow is triggered, it’s possible that a user wants to cancel it. One possible solution is that before the browser fetches the token automatically, it shows a UI for users to cancel the auto re-authn flow. If users don’t take any action in 5s, the browser proceeds with the token fetch. While this solution provides more controls to some users, it does raise accessibility concerns due to the call-to-action UI being timed out. We could use a longer timeout value but that would negate the benefits of auto re-authn.

## FedCM extensions consideration
### Multiple IDP support
FedCM is adding multiple IDP support (explainer) which may have an intersection with auto re-authn. e.g. if both IDP1 and IDP2 are eligible for FedCM, how does FedCM handle auto re-authn?

Similar to the “single IDP with multiple accounts” use case, we can choose to trigger auto re-authn only if the user has one returning account across the IDPs. e.g.

|                              | Account with IDP 1 is new | Account with IDP 1 is returning |
| ------------- |-------------| -----|
| **Account with IDP 2 is new**       | No auto re-authn          | Auto re-authn with IDP 1        |
| **Account with IDP 2 is returning** | Auto re-authn with IDP 2  | No auto re-authn                |
