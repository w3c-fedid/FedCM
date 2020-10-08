# Delegation Oriented API

This approach attempts to provide technical enforcements of [Identity Provider
blindness](glossary.md#identity-provider-blindness) by having the IDP delegate
the generation of identity assertion to the browser.

Below is one variation the combines the IDP blindness mechanisms designed in
[Mozilla’s Personas proposal][https://en.wikipedia.org/wiki/Mozilla_Persona]
with the [RP blindness](glossary.md#relying-party-blindness), recovery processes
and the user-behavior backwards compatibility. This approach maximizes the
technical enforcement of both RP and IDP tracking, at the cost of IDP and RP
server-side backwards compatibility.

## Sign Up Flow


Here is a sign up flow in this proposal where a user can sign up to RP and share
a directed basic profile. The importance of recovery code and salt are discussed
in the next section.

TODO: Explain in more details.


## Benefits

Maximum IDP and RP tracking preventions using technical enforcement.

From a UX perspective, we expect this to have the lowest privacy-introduced
friction/consent, since both RP and IDP tracking problems are addressed
mechanically.


## Challenges

### Server-side Backward compatibility

This proposal requires changes in the RP backends:

- This approach requires a new token format which is no longer backward
  compatible with the OpenID JWT. This means that the token verification
  libraries on RP backends need to be updated. While we can do our best to make
  the change small, all RPs are  still required to redeploy. In contrast,
  earlier explored flows only require IDP sdk and backend updates.
- RP needs to maintain a recovery token for each account. This is necessary to
  enable the ability for user’s to sign-in to their account on platforms that
  don’t have WebID or after they switch browsers.

### UX Complication
This approach changes user experience in some respect:

- RP sign in experience would remain the same in particular a) users can sign in
  to RP by selecting an IDP and b) users can sign in to their existing account
  with RP even on platforms that do not support WebID by falling back to OpenID
  and removing IDP blindness restriction.
- Users are no longer able to see and manage all the RPs they have signed up
  with through their IDP control panel. Browsers may be able to provide a
  similar UX. Most likely scenario is that both browser and IDP would end up
  managing some account which can be a source of confusion.

### Decoupling the Email Proxy and the Email Provider

Most RPs send welcome email to their users on account creation. This can defeat
the IDP blindness if IDP is also the email proxy and provider. To mitigate this
we envision other parties to be responsible for proxying email (e.g., the
browser) and keeping the user inbox (email provider). 

### RP account management complexity

Directed emails notably increase account management complexity for RPs since
most users will not be able to remember their email address. This proposal adds
even more complexity to this by introducing email proxy to the mix.

## Technical Details


### IDP/RP Blindness Enforcement

- IDP is not aware of the RP that the user is signing in. This is achieved by
  having IDP certify a browser controller public key whose private key can be
  used to mint new tokens on IDP’s behalf.
- This enforced IDP blindness may be reverted when it becomes necessary (e.g.,
  to allow users to sign in to their account on platforms that do not support
  WebID).
- RP is always blind as it receives directed id and directed email.

### Databases

Here is the database for each of the participating entities.

* **Browser**: RP, IDP, global user id, private/public key pair, global email, directed email, salt, IDP certificate
* **Email Proxy**: directed email, global email
* **IDP**: user id, directed id, directed email, public key, salt
* **RP**: directed email, directed id, recovery code


### RP Backend Verification

Normally RP verifies the JWT on its backed by checking its signature against IDP
public key. However the new proposed Certified JWT contains in its header a
bowser generated public key which is certified by IDP. So the verification
process first validates the included public key with the IDP public key and then
verifies the token using this public key.


Strawman proposal for Certified JWT token:

``` json
{header: {
  "alg": "ES512",
  "typ": "JWT",
  /* new entry in header */
  "certified-public-key": {
    "value": "MIIBIjANBgkqhkiG",
    "signature":  ECDSASHA512(
         <value>,
         <idp-private-key>
     ),
  }
},
payload: {
  "sub": "1234567890",
  "name": "John Doe",
  "admin": true,
  "iat": 1516239022,
  /* new entry in payload */
  "recovery": ECDSASHA512(<user_id>, RP,<salt>)
},

signature: ECDSASHA512(
  base64(header) + "." + base64(payload),
  <browser-private-key>)
}
```

Recovery Flow

Recovery code is an opaque value that can be computed given user id, directed
email, and salt e.g., `recovery code = SHA512(user_id, RP, salt)`.

This allows RP to IDP to be able to uniquely identify the user if they
collaborate. This enables the recovery mechanism for a user to sign in to their
account in a new browser or platform that does not support WebID.  A random salt
ensures that neither RP nor IDP is able to unblind themselves simply by
enumerating all possible values.

Here we articulate the flow where a user is trying to sign in to their existing
account on RP using a new browser or platform that either: 

 1. Implement WebID does not have access to the database. This maintains IDP blindness. 
 2. Does not implement WebID protocol (e.g., A mobile app) and needs to use
    OAuth flows. Here the recovery code may be passed to IDP which can
    authenticate the user and generate a regular JWT token. Notice that here IDP
    gets unblinded as it learns about user sign-in to the RP.  




