---
title: "Delegation-oriented API"
maintainer: "majido"
created: 08/10/2020
updated: 08/10/2020

---


# Delegation-oriented API

This approach attempts to provide technical enforcements of [Identity Provider
blindness](glossary.md#identity-provider-blindness) by having the IDP delegate
the generation of identity assertion to the browser.

Below is one variation that combines the IDP blindness mechanisms designed in
[Mozilla’s Personas proposal](https://en.wikipedia.org/wiki/Mozilla_Persona)
with the [RP blindness](glossary.md#relying-party-blindness), recovery processes
and the user-behavior backwards compatibility. This approach maximizes the
technical enforcement of both RP and IDP tracking, at the cost of IDP and RP
server-side backwards compatibility.

## Basic Flow

<figure>
  <img src="./static/delegation-api-flow.svg" alt="High-level flow diagram for delegation-oriented approach" />
  <figcaption>High-level flow diagram for delegation-oriented approach</figcaption>
</figure>


Notice that in this approach we are assuming that an email proxy and email
provider exist independent from the IDP. This is necessary to maintain IDP
blindness even after RP uses the directed email address to email the user.

Below is the sign up flow in this proposal where a user signs up to an RP and
share their [directed basic profile](glossary.md#directed-basic-profile). The
importance of recovery code and salt are discussed in the next section.


<figure>
  <img src="./static/delegation-api-signup-flow.svg" alt="Sign-Up Flow for a WebID enabled browser" />
  <figcaption>Sign-Up Flow for a WebID enabled browser</figcaption>
</figure>

Description of the steps involved in this flow:

1. RP initiates the sign-up through
   [the consumer API](consumers.md#the-consumer-api)
1. Browser obtains the designated IDP endpoint as declared in a `.well-known`
   configuration.
1. Browser sends the user to the designated IDP end point to obtain the global
   account and a list of directed accounts for the current user.
    - Note that the RP is not exposed to the IDP.
    - As part of this step IDP may show UI and authenticate the user.
    - In this example the list of directed accounts is empty given that this is
      a first sign-up moment.
1. Browser sees no directed account in the IDP response and initiates its
   account creation process.
    - It is possible that the directed accounts list is not empty and has a
      matching entry for the current RP. This occurs for a retuning user sign-in
      and means that the browser already has account details including a private
      key for the user and can skip most of the following steps.
1. Browser coordinates with Email Proxy service to obtain a directed email for
   the user.
    - This step only assumes that an Email Proxy separate from the IDP exists.
      This process may involves additional steps which are not relevant at this
      stage. See [#decoupling-idp-from-email-services] for more details.
1. Browser generates a new key pair and a random salt value.
1. Browser sends the public key, salt, and directed email address to the IDP.
1. IDP return a certificate signed with its own private key. The certificate
     includes browser generated public key, and directed email.
    - IDP remembers [browser public key, directed email, and salt] as a new
      directed account for the user. This is used for future sign-ins.
1. Browser receives the certification and adds the new directed account to its
   database.
1. Browser creates a recovery code for the new account in its database.
    - Recover code is `SHA512(alice, salt, RP)`
1. Browser generates an [Certified JWT](#certified-jwt) as `id_token` and signs
   it with its own privte key.
   - The token includes [directed identifier, directed email, and the recovery
     code].
1. Browser returns the certified `id_token` to RP.
1. RP verifies the certified `id_token` and signs up the user.
    - The verification process involves both the browser public key and the IDP
      public key. Additional details are available in the
      [RP backend verification section](#rp-backend-verification).
    - RP stores the recovery code in addition to the user directed identifier.
      The recovery code allows RP to sign in the user even in absence of WebID.
      See [recovery flow](#recovery-flow) for more details.

## Benefits

Maximum IDP and RP tracking preventions using technical enforcement.

From a UX perspective, we expect this to have the lowest privacy-introduced
friction/consent, since both RP and IDP tracking problems are addressed
mechanically.


## Challenges

### Server-side Backward compatibility

This approach requires changes in the RP backends:

- This approach requires a new token format which is no longer backward
  compatible with the OpenID JWT. This means that the token verification
  libraries on the RP backends need to be updated. While we can do our best to
  make the change small, all RPs are  still required to redeploy. In contrast,
  earlier explored flows only require IDP sdk and backend updates.
- The RP needs to maintain a recovery token for each account. This is necessary
  to enable the ability for users to sign-in to their account on platforms that
  don't have WebID or after they switch browsers.

### UX Complication

With this proposal the sign-in user experience on RP would remain the same in
particular a) users can sign in to RP by selecting an IDP and b) users can sign
in to their existing account with RP even on platforms that do not support WebID
by falling back to OpenID and removing IDP blindness restriction.

However the user experience on IDP side changes. In particular users are no
longer able to see and manage all the RPs they have signed up with through their
IDP control panel. Browsers may be able to provide a similar UX. Most likely
scenario is that both browser and IDP would end up managing some account which
can be a source of confusion.

### Decoupling IDP from Email Services

A [directed email address](glossary.html#directed-basic-profile) requires an
email proxy service in addition to the email provider.

One option is for the email provider to be the email proxy as well. This seems
like a reasonable option.

Another seemingly natural option would be to have the IDP provide the email
proxy service. However this can weaken the IDP blindness if IDP is also either
the email proxy or email provider. This is beucase most RPs send a welcome email
to their users on account creation.

So to mitigate this risk, we envision an entity (or entities) different from the
IDP is responsible for proxying email and keeping the user inbox. At this stage
and for the purpose of the flows discussed here, we simply assume the key
property that separate IDP and Email Proxy/Provider exists and paper over the
details of how a directed email address is created and verified across email
proxy, email provider and IDP.

### RP account management complexity

Directed emails notably increase account management complexity for RPs since
many users are not be able to readily recall their directed email address. This
proposal adds even more complexity to this by introducing email proxy to the
mix.

## Technical Details


### IDP/RP Blindness Enforcement

- the IDP is not aware of the RP that the user is signing in. This is achieved
  by having the IDP certify a browser controlled public key whose private key
  can be used to mint new tokens on IDP's behalf.
- This enforced IDP blindness may be reverted when it becomes necessary. We
  belive one such necessary use case is to allow a user to sign in to their
  account on platforms that do not support WebID.
- the RP is always blind as it receives directed id and directed email.

### Databases

Here is the database for each of the participating entities.

* **Browser**: RP, IDP, global user id, private/public key pair, global email, directed email, salt, IDP certificate
* **Email Proxy**: directed email, global email
* **IDP**: user id, directed id, directed email, public key, salt
* **RP**: directed email, directed id, recovery code


### RP Backend Verification

Normally the RP verifies the [JWT] (JSON Web Token) on its backend by checking
its signature against the IDP public key. However the new proposed Certified JWT
contains, in its header, a browser generated public key which is certified by
the IDP. So the verification process first verifies the included public key with
the IDP public key and then verifies the token using this public key.

#### Certified JWT
Here is a strawman proposal for a Certified JWT:

```js

{
  header: {
    "alg": "ES512",
    "typ": "JWT",
    /* new entry in header */
    "certified-public-key": {
      "value": "MIIBIjANBgkqhkiG",
      "signature":  ECDSASHA512(
          "<value>",
          "<idp-private-key>"
      ),
    }
  },
  payload: {
    "sub": "1234567890",
    "name": "John Doe",
    "admin": true,
    "iat": 1516239022,
    /* new entry in payload */
    "recovery": ECDSASHA512("<user_id>", RP, "<salt>")
  },

  signature: ECDSASHA512(
    base64(header) + "." + base64(payload),
    "<browser-private-key>")
  }
}
```

### Recovery Flow

Recovery code is an opaque value that can be computed given user id, RP site,
and a salt value e.g., `recovery code = SHA512(user_id, RP, salt)`.

The recovery code is kept at the RP. But it may be passed to the IDP to uniquely
identify the user. This means that an RP and IDP may be able to identify the
user if they directly or indirectly (e.g., browser mediation) collaborate. This
enables the recovery mechanism for a user to sign in to their existing account
on RP in a few important situations:

 1. A browser that implements WebID but does not have access to the original
    certificate database (e.g., a fresh install). This mediated recovery
    maintains IDP blindness.
 2. A browser or agent (e.g., a mobile app) that does not implement WebID
    protocol and OAuth flows are needed. Here the recovery code may be passed by
    the RP to the IDP which can authenticate the user and generate a regular JWT
    token. Notice that here **IDP gets unblinded** as it learns about the user
    sign-in to the RP.

A random salt ensures that neither RP nor IDP is able to unblind themselves
simply by enumerating all possible values.


<figure>
  <img src="./static/delegation-api-recovery-signin-flow.svg" alt="Sign-In (Recovery) Flow for a fresh WebID enabled browser" />
  <figcaption>Sign-In (Recovery) Flow for a fresh WebID enabled browser</figcaption>
</figure>



<figure>
  <img src="./static/delegation-api-recovery-legacy-flow.svg" alt="Sign-In (Recovery) Flow for legacy non-WebID enabled browser/apps" />
  <figcaption>Sign-In (Recovery) Flow for legacy non-WebID enabled browser/apps</figcaption>
</figure>

[JWT]: https://tools.ietf.org/html/rfc7519