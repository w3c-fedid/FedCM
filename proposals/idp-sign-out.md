
# IDP Sign-out

Note: The API specified in this section is not launched in any user agent,
and as such should be considered very experimental and subject to change.

In enterprise scenarios, it is common for the user to want to clear all of
their existing sessions in all of the RPs they are logged into.

It does so by being navigated to their IDP who initiates
what's called a Front-Channel-Logout.

The browser exposes an API that takes the list of [=RP=]s that the
IDP wants to initiate the logout which are loaded in parallel
with cookies.

Each RP endpoint is responsible for clearing its local state
(e.g. clearing cookies).

```
.---------------------------------.       .---------------------------------.
| .-----------------------------. |       | .-----------------------------. |
| | "https://rp.example"        | |       | | "https://idp.example"       | |
| '-----------------------------' |       | '-----------------------------' |
| .-----------------------------. |       | .-----------------------------. |
| |                             | |       | |                             | |
| |   Welcome to my website!    | |       | |  John, we are logging out   | |
| |                             | |       | |  of the relying parties.    | |
| |                             | |       | |                             | |
| +-----------------------------+ |       | |  +~~~~~~~~~~~~~~~~~~~~~~~+  | |
| |   Sign-in to rp.example     | |       | |  :"<script>"             :  | |
| |     with idp.example?       | |       | |  :" IdentityCredential. ":  | |
| |                             | |       | |  :"    logoutRPs([{     ":  | |
| | .----.                      | |       | |  :"       url: ...      ":  | |
| | | :) | "John Doe"           | |  -->  | |  :"       accountId: ...":  | |
| | '----' "john@email.com"     | |       | |  :"    }, {             ":  | |
| |                             | |       | |  :"       ...           ":  | |
| | +-------------------------+ | |       | |  :"    }]);             ":  | |
| | |     Continue as John    | | |       | |  :"<\/script>"           :  | |
| | +------------+------------+ | |       | |  +~~~~~~~~~~~+~~~~~~~~~~~+  | |
| '--------------|--------------' |       | '--------------|--------------' |
'----------------|----------------'       '----------------|----------------'
                 |                                         |
                 |                                         |
                 |        +------------------------+       |        +-------+
                 |        |                        |       |        |       |
                 +------->|     Registered RPs     |-------+------->| Queue |
                          |                        |                |       |
                          +------------------------+                +-------+
```

```js
await IdentityCredential.logoutRPs([{
    url: "https://rp1.example",
    accountId: "123"
  }, {
    url: "https://rpN.example",
    accountId: "456"
  }]);
```

IDPs can call `IdentityCredential.logoutRPs()` to log the user out of the RPs they are
signed into.


```idl
dictionary IdentityCredentialLogoutRPsRequest {
  required USVString url;
  required USVString accountId;
};

[Exposed=Window, SecureContext]
partial interface IdentityCredential {
  static Promise<undefined> logoutRPs(sequence<IdentityCredentialLogoutRPsRequest> logoutRequests);
};```


Proposed algorithm:

```bikeshed
When the {{IdentityCredential/logoutRPs()}} method is invoked given a [=list=] of
{{IdentityCredentialLogoutRPsRequest}}s |logoutRequests|, the user agent MUST execute the following
steps. This returns a {{Promise}}.
    1. Let |promise| be a new {{Promise}}.
    1. Let |globalObject| be <a>this</a>'s <a>relevant global object</a>.
    1. [=In parallel=], perform the following steps:
        1. For each |request| in |logoutRequests|:
            1. Let |rpOrigin| be [=this=]'s [=Document/origin=].
            1. Let |idpOrigin| be |request|'s {{IdentityCredentialLogoutRPsRequest/url}}'s [=/origin=].
            1. Let |account| be |request|'s {{IdentityCredentialLogoutRPsRequest/accountId}}.
            1. Let |triple| be (|rpOrigin|, |idpOrigin|, |account|).
            1. If [=state machine map=][|triple|] does not exist, continue.
            1. Let |accountState| be [=state machine map=][|triple|].
            1. If the |accountState|'s {{AccountState/registration state}} is {{unregistered}} or
                |accountState|'s {{AccountState/allows logout}} is false, continue.
            1. Let |fetchRequest| be a new <a spec=fetch for=/>request</a> as follows:

                :  [=request/url=]
                :: |request|'s {{IdentityCredentialLogoutRPsRequest/url}}
                :  [=request/mode=]
                :: "GET"
                :  [=request/redirect mode=]
                :: "error"
                :  [=request/client=]
                :: null
                :  [=request/window=]
                :: "no-window"
                :  [=request/service-workers mode=]
                :: "none"
                :  [=request/destination=]
                :: "webidentity"
                :  [=request/origin=]
                :: a unique [=opaque origin=]
                :  [=request/credentials mode=]
                :: "include"

            1. [=Queue a global task=] on the [=network task source=]  given |globalObject|
                to [=fetch=] |fetchRequest|.
            1. Set the |accountState| {{AccountState/allows logout}} to false.
        1. [=Resolve=] |promise| with [undefined].
    1. Return |promise|.
```
