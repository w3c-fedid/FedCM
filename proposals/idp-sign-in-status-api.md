# Explainer for IDP sign-in status API

## Background

The FedCM API lets a website make cross-origin credentialed requests. FedCM is
designed to enable the browser to get user consent before sending any
information to IDPs or RPs which could enable cross-site tracking of the user.
Because similar consent dialogs can lead to permission blindness and user
frustration, browsers rely on various implementation-defined heuristics to
balance user consent fatigue with privacy risk (eg. in the implementation of
requestStorageAccess). We expect these heuristics to evolve over time with each
browser's privacy threat model and the changing privacy landscape.

One common class of such heuristics is to replace explicit user confirmation
with passive user notification in some contexts. For example, when navigating to
a cross-origin URL that passes some information in a query parameter, browsers
generally rely on the fact that the navigation is visible to the user, rather
than requesting consent to share information with the target origin. FedCM aims
to enable such optimizations without specifying the precise behavior which
browsers are likely to evolve independently over time. Such notification in
FedCM contexts presents a problem when the user is currently not signed into a
given IDP as resulting UI is likely to be of low value to the user, eg. "You are
not signed into IDP X and so no sign-in UI can be shown".

To solve this problem (and to slightly optimize network traffic), we propose
this API to let identity providers (IDPs) tell the browser when the user signs
in to and out of the IDP. The IDP Sign-in Status API does not grant the identity
provider any permissions. Using the IDP sign-in status API is not a way for a
site to prove that it is an identity provider. The purpose of the
Idp-Signin-Status API is to enable identity providers to disable the FedCM API
for their IDP in order to suppress the need to show UI to the user which is of
low value to them.

In addition, with the browser gaining knowledge about IDPs, this may allow
finer-grained user control over which IDPs are available to websites, e.g. a
settings page allowing the user to disable certain IDPs for use with FedCM.


## Proposed API


### Headers

```
IdP-SignIn-Status: action=signin
IdP-SignIn-Status: action=signout-all
```

These headers can be sent on the toplevel load as well as subresources such as
XMLHttpRequest (this is necessary for at least one IDP).

The signout-all header should only be sent when no accounts remain signed in
to the IDP, i.e. when this action has signed out all accounts or if this
was the last/only account getting signed out.

### JS API (future)

Tentatively:

```
[Exposed=Window]
interface IdentityProvider {
  static void login();
  static void logout();
}
```

To be called from the IDP's origin, and marks the current origin as signed in or signed out.

### Config file addition

This proposal adds a new `signin_url` field to [the config file](https://fedidcg.github.io/FedCM/#dictdef-identityproviderapiconfig):


```
partial dictionary IdentityProviderAPIConfig {
	USVString signin_url;
}
```

See further below for a description of the semantics.


### Semantics

For each IDP (identified by its config URL) the browser keeps a tri-state
variable representing the sign-in state with possible values “signed-in”,
“signed-out”, and “unknown”, defaulting to “unknown”.

When receiving the sign-in header, the state will be set to “signed in”. In
case of subresources, to limit abuse, the header is only processed if the
resource is same-origin with the document.

Similar for the sign-out header.

In some cases, a user can get signed out server-side while the user is not on
the IDP website. For example, the IDP may require re-authentication every N
days, or the user may have changed their password (or deleted their account) on
a different browser, forcing re-login. This proposal does not have special
handling in this situation; we would show the error dialog mentioned below.

There is [some discussion](https://crbug.com/1381505) on whether the sign-in header should require user activation; however, right now in Chrome it does not.


### Effect on FedCM requests

When an RP calls navigator.credentials.get():

* If the sign-in state on the provided config URL is “signed out”, no
network requests will be made and the promise is rejected (with a delay
as usual (step 3 of
[the algorithm](https://fedidcg.github.io/FedCM/#dom-identitycredential-discoverfromexternalsource-slot)))
* Otherwise, network requests are made as usual

When the accounts endpoint response is successful and has at least one account:

* The sign-in state is set to “signed-in” if it was previously “unknown”


When an error is received from the accounts endpoint or no accounts are returned:

* If the sign-in state was unknown, the sign-in state is set to “signed out”. No UI is displayed and the promise is rejected as usual
    * This is used when launching this API, when the browser has no stored IDP sign-in data, and also when an IDP starts supporting FedCM, where the user can also be signed in without the sign-in status being set. This allows us to handle these cases without being required to show UI when the user is not signed in
    * This does incur a one-time timing attack per IDP. Since this can only happen once per IDP/browser profile, it seems impractical for an attacker to rely on.
        * An alternative solution is to show the sign-in UI even in this case
* If the sign-in state was “signed in”, the sign-in state is set to “signed out”. An error dialog is displayed that also allows the user to sign in to the IDP. The exact UI is TBD; the dialog may not explicitly say something like “we thought you were logged in to the IDP”.
    * The primary case where this will happen is if the session is invalidated server-side, either because of session-length settings, because the user forced logout on other devices, or other reasons.
    * We show a dialog in this situation to discourage trackers using this
    * This dialog is why there is a sign-in URL being added in this proposal, so that the user has a way to recover instead of being presented with a useless dialog. However, having this URL is also useful for other UI enhancements.


## Alternatives considered

### Big picture

See [https://github.com/fedidcg/FedCM/blob/main/meetings/2022/FedCM_%20Options%20for%20the%20Timing%20Attack%20Problem%202022-08-31.pdf](https://github.com/fedidcg/FedCM/blob/main/meetings/2022/FedCM_%20Options%20for%20the%20Timing%20Attack%20Problem%202022-08-31.pdf) 

### Header syntax

We chose action=signout-all to make it clear that this header should only be
sent when all accounts from this IDP are signed out.

We could instead or in addition have allowed notifying the user agent of
individual accounts being signed in/out, such as:

```
IdP-SignIn-Status: action=signin; count=2
IdP-SignIn-Status: action=signout; new-count=1
```

Or

```
IdP-SignIn-Status: action=signin; accountid=foo@bar.com
IdP-SignIn-Status: action=signout; accountid=foo@bar.com
```

However, we decided to go with the simpler syntax because we do not currently
have a use case that requires the extra information.

Additionally, the second option would require the browser to track which
specific account IDs are signed in, so that it can tell when there no
more signed in accounts for this IDP. This introduces extra complexity,
whereas the IDP already knows how many accounts are signed in and thus
whether no accounts remain after this signout action.
