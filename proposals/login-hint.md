# LoginHint Explainer

## The Problem

The FedCM API allows the user to choose an account to login to an RP via some IDP.
In some cases though, the user has previously used the FedCM API to login to the RP via a specific IDP account.
The RP knows some information about the user already, and they just want the user to refresh their credentials via the IDP.
The current way to achieve this would be to invoke FedCM again, but this would show all of the IDP accounts from the user.
The user could then inadvertently choose an alternate account, which is not ideal from the RP’s perspective.
In [other](https://youtu.be/uGKFVrWOZ38?t=150) cases, the RP may ask the user for some information about their account and then show them
the FedCM prompt.

## The Proposal

We’d like to add a new optional parameter to the [IdentityProviderConfig](https://fedidcg.github.io/FedCM/#dictdef-identityproviderconfig)
to allow the RP to specify a login hint, which will in turn enable the user agent to show a FedCM dialog with only some specific user account.
The parameter would be `loginHint` and initially the allowed values would be either the account ID or the email address from the user.
The naming is based on OpenID’s [login_hint parameter](https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest), which also has an
[equivalent](https://developers.google.com/identity/openid-connect/openid-connect#authenticationuriparameters) in Google Identity Services.
When the RP includes this parameter, the user agent would only show accounts whose ID or email match the given `loginHint` value.
This enables the RP to provide a better user experience for users when some part of their identity is known a priori.
Note that returning users are the most common use case but not the only one,
as the RP first asking for an identifier and then showing FedCM would not require the user to be a returning user.
Therefore, the `loginHint` would not interact with approved_clients:
the user agent would not verify that the given user is deemed a returning user.

## Extensibility

In order to prevent hard-coding the fact that the `loginHint` matches to either ID or email, we’d like to instead have a mechanism to surface
the attribute (subset of [IdentityProviderAccount](https://fedidcg.github.io/FedCM/#dictdef-identityprovideraccount)) that the `loginHint` is
being matched to. There are a few options here:

* IDP provides the login hint types, either in the accounts list response or the config response.
  This means that the IDP is the one who picks what are the allowable filters,
  and the `loginHint` provided by the RP call tries to match against those.
* RP provides the login hint types it wants to match against, perhaps as a new parameter in the `get()` call
  (which would also be optional, but perhaps required when `loginHint` is provided).
  In this case, the IDP does not have control over the allowable filters,
  and it is instead the RP call which decides what it is trying to match against.

The latter option seems more intuitive.
The simplest way to achieve it would be to add a `loginHintTypes` which receives an array of strings.
However, that solution would not allow the RP to filter based on multiple filters at once.
For example, this could be something desired when the RP knows the email of the user but also wants to ensure that the
[hostedDomain](https://developers.google.com/identity/openid-connect/openid-connect#hd-param) matches the requirements of the site.

Sample code snippet which uses the `loginHint` parameter:

```js
   return await navigator.credentials.get({
      identity: {
        providers: [{
          configURL: "https://idp.example/manifest.json",
          clientId: "123",
          nonce: nonce,
	    loginHint: {email: "user@email.com"}
        }]
      }
    });
```

## Security and privacy considerations

The `loginHint` parameter is provided by the RP in the initial get() call, as the RP would need to know beforehand some information about
who the user is. The login hint is not sent in any of the fetch requests initiated by the user agent.
The only usage of the login hint is by the user agent, to filter out accounts that do not match when displaying the sign-in UI.
As such, this does not provide additional information to the IDP about the RP.
Note that the FedCM API is designed so that the RP should not be able to differentiate between no user accounts shown in the dialog vs other
errors like the user declines to login via the FedCM dialog.
In addition, there is some delay between when a get() call is made and when the rejection arrives and multiple simultaneous get() calls with
the same IDP are not allowed, so it would be completely impossible to try to spam FedCM to find out some ID or email corresponding the the
user that is visiting a website.
Based on this, there are no additional security or privacy concerns of this addition given the existing API
(see below for concerns when in the context of the IDP Sign In Status API).

## Interaction with other FedCM extensions

### Multi IDP and Auto Sign In

There is in theory no constraint to use `loginHint` when invoking FedCM with more than one IDP, although we’d expect that to be a rare
occurrence since the use-case is to simplify the flow for users whose identity is somewhat known.
If multiple IDPs are indeed used, `loginHint` in one IDP would not modify the behavior for other IDPs.
That is, other IDP accounts would all show up in the dialog.
If for example there is one get() call using IDP1 with a `loginHint` for account1 and another get() call using IDP2 with a `loginHint` for
account2, then the user agent would show an account picker including both account1 and account2: the `loginHint` specified by IDP1 does not
affect the accounts shown by IDP2, and vice-versa.

The auto sign in feature only works if there are no returning accounts from other IDPs. In this scenario, the `loginHint` feature could be
used even if there are multiple returning accounts for a single IDP.
For example, if the user agent deems account1 and account2 from IDP1 as returning accounts, but the get() call notes it wants to use
account1 via `loginHint`, then auto sign in is allowed (and uses account1).
Note that the `loginHint` feature does not remove the requirement for the account to be a returning account, from the user agent’s
perspective (i.e. approved_clients or the user agent knowledge of the account must be such that it is considered a returning user).

### IDP Sign In Status API

The `loginHint` feature breaks an assumption about the IDP Sign In Status API: UI is always shown when the user is logged in to the IDP.
This could happen if the `loginHint` provided is incorrect, i.e. does not correspond to any of the user IDs or emails returned by the IDP.
In this case, we must show the UI in order to avoid re-introducing an invisible timing attack, which would be bad for privacy.
There are a couple of options we could go with:

* Disregard the `loginHint` and instead show all returned accounts. In case there are no accounts returned at all, follow the IDP Sign In
  Status flow for that case, i.e. show the UI to sign in to the IDP.
* Show an error dialog which tells the user that the RP attempted to show them a sign in prompt.

The first option seems more compelling in terms of usefulness to the user, although it seems to not match the existing behavior of some of
our users like the Google Identity Services library, so we’d want to ensure that this is acceptable behavior, otherwise go with an error
dialog. It is also possible to have a parameter so that the RP can choose from the above two options.

### Selective disclosure

The `loginHint` usage implies that the RP already knows some property about the user’s account. Therefore, when used alongside the selective
disclosure API, which allows the user to share only some data from their IDP account with the RP, it is probably best to consider the
`loginHint` types as shared. This is because any successful FedCM call using `loginHint` leaks to the RP that the account used matches the
`loginHint`.
