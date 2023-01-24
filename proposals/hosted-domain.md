# Hosted Domain

### The Problem

FedCM can be used to make it easier for a user to login to a relying party (RP: a website) via an identity provider (IDP). However, there are
cases where the RP already knows beforehand that only accounts associated with a certain origin are allowed to login to the site. This is
particularly common in enterprise scenarios where the site being accessed is restricted to a corporate domain. In order to provide a better
user experience, it is better for the FedCM API to allow the RP to only show the accounts which may be used to login to the RP. This prevents
the case where a user tries to login to the RP using an account outside of the corporate domain, only to be served with an error message later
(or cryptic silence where the login did not work) since the right type of account was not used.

### The Proposal

In order to solve this problem, we propose extending the FedCM API by allowing accounts to have a `hostedDomain` and allowing the API call to 
mention what is the valid `hostedDomain` for accounts.

One open question is whether a single account could belong to more than one `hostedDomain`. There does not currently seem to be a use-case that
requires this, so for now we assume that an account can have just one `hostedDomain`. Thus, the account info parsed from the JSON response is
extended as follows:

```
dictionary IdentityProviderAccount {
	DOMString hosted_domain;
}
```

This would be an optional string that can come with each account. Additionally, we’d extend the `get()` call to allow providing a requested
`hostedDomain` as follows:

```
dictionary IdentityProviderConfig {
	DOMString hostedDomain;
}
```

The value would not be sent as part of the accounts request, since that would provide a fingerprinting vector to the IDP. Instead, the user
agent would perform a FedCM request as usual, and manually filter out the accounts that do not match the `hostedDomain` value specified by the
`get()` call. Then, the user agent would show the FedCM dialog to the user with the new accounts list.


### Example

Suppose a user is visiting corp-partner.com and this website uses FedCM to enable the user to access its corporate resources. Of course, only
accounts managed by the corporation are allowed to access them. The site would invoke `get()` as follows:

```js
   return await navigator.credentials.get({
      identity: {
        providers: [{
          configURL: "https://idp.example/manifest.json",
          clientId: "123",
          nonce: nonce,
    hostedDomain : "corp.com"
        }]
      }
    });
```

The accounts list response could include `hostedDomain` as follows:

```
{
 "accounts": [{
   "id": "1234",
   "given_name": "John",
   "name": "John Doe",
   "email": "john_doe@idp.example",
   "picture": "https://idp.example/profile/123",
   "approved_clients": ["123", "456", "789"],
  }, {
   "id": "5678",
   "given_name": "Johnny",
   "name": "Johnny",
   "email": "johnny@corp.com",
   "picture": "https://idp.example/profile/456"
   "approved_clients": ["abc", "def", "ghi"],
   "hosted_domain": "corp.com",
  }]
}
```

The user agent would then only show the second account (the one with email “[johnny@corp.com](mailto:johnny@corp.com)”, since the first one
does not match the `hostedDomain` requested by the `get()` call (if no `hostedDomain` is provided, it is considered to not match any
`hostedDomain` requested).


### Alternatives considered


#### Show an error message

It is also possible to not filter out accounts based on `hostedDomain`, but allow the IDP to say that the chosen account does not actually match the requirements of the site. However, this does not improve the user experience by a lot because the user would still have to go through the FedCM flow only to be denied access at the end, and thus was not the chosen solution.


#### Filter based on email

In some cases, it could be possible to infer the `hostedDomain` based on the email address of the account, which is already being returned by the IDP. However, as we spoke to IDPs, we realized that this is not always the case. It can be hard to produce some query that provides the correct filter based on emails, and it would likely require regEx if at all possible. Due to the complexity of computing these from the IDP side and of applying these on the user agent side, plus the uncertainty about whether these could work for all cases, this was not the chosen solution.


### Security and privacy considerations

The `hostedDomain` parameter is provided by the `get()` call, but not sent with any of the fetches initiated by the user agent. Therefore, the IDP does not learn anything about the RP because it does not receive this parameter, and the FedCM API is designed in such a way to not let the IDP learn when accounts were shown vs when no accounts matched. It is also impossible to spam the API, as there is a delay between the API being invoked and the API resolving (either due to user input or intentional delay in rejecting the call from the user agent).

The addition of new data to the accounts response is something that needs to be considered. The `hostedDomain` is probably the least privacy-sensitive data of all of the fields being sent. So it is still important for the IDP to perform the appropriate checks so that only requests performed by the user agent are responded to with the relevant data, especially in user agents that still use third party cookies. The one thing that is a bit more sensitive about `hostedDomain` is that it is usually invisible to users. With a compromised user agent, an attacker can easily learn the names and emails of the user accounts, but perhaps not the `hostedDomain`. This addition would now allow the attacker to also learn hosted domains. But this threat model requires the highest level of access (compromised user agent), and the new information leaked is not very sensitive (having the emails already gives an idea of what the hostedDomains could be).


### Interaction with other FedCM extensions


#### Multi IDP

We are setting the `hostedDomain` on the IDP info, so in the multi IDP scenario a corporation could in theory provide different values for different IDPs. This makes the most sense as `hostedDomain` would be an IDP-specific value. However, using `hostedDomain` will generally mean that the RP is not going to use more than one IDP.


#### IDP Sign In Status


Similar to [https://github.com/fedidcg/FedCM/blob/main/proposals/login-hint.md#idp-sign-in-status-api](https://github.com/fedidcg/FedCM/blob/main/proposals/login-hint.md#idp-sign-in-status-api)


#### LoginHint

The `hostedDomain` feature can be used in conjunction with `loginHint`, i.e. both filters would be applied to the list of accounts received.
