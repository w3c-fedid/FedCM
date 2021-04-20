---
title: "Cookies"
maintainer: "samuelgoto"
created: 03/02/2021
updated: 03/02/2021
---

This is an **early exploration** of the design alternatives to address [this](README.md#stage-1-third-party-cookies) under [this threat model](privacy_threat_model.md).

This section goes over the **what** and the **how**. It presuposes that you have read and started from:

- The **why**: the [problem](README.md) statement and the [motivations](privacy_threat_model.md) and the [topology](activation.md) of the parties involved.
- The **why not**: the [alternatives](alternatives_considered.md) considered (e.g. the [prior art](prior.md), the [status quo](alternatives_considered.md#the-status-quo) and the [requestStorageAccess API](alternatives_considered.md#the-request-storage-access-api)).

It is widely known that browsers are either **already** blocking third party cookies or are planning to.

> Publicly announced browser positions on third party cookies:
>
> 1. [Safari](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/): third party cookies are **already** blocked by **default**
> 1. [Firefox](https://blog.mozilla.org/blog/2019/09/03/todays-firefox-blocks-third-party-tracking-cookies-and-cryptomining-by-default/): third party cookies are **already** blocked **by a blocklist**, and
> 1. [Chrome](https://blog.google/products/chrome/privacy-sustainability-and-the-importance-of-and/): on iOS **already** blocked **by default** and intends to offer **alternatives** to make them **obsolete** in the [near term](https://www.blog.google/products/chrome/building-a-more-private-web/) in other platforms.

Unfortunately, that has either broken or are about to break a few use cases in federation, namely [logging out](https://openid.net/specs/openid-connect-rpinitiated-1_0.html), social [buttons](https://developers.facebook.com/docs/facebook-login/userexperience/) and [widget](https://developers.google.com/identity/one-tap/web) personalization (anything else? add your use case [here](#how-can-i-help))).

![](static/mock27.svg)

# Session Management

OpenID has a series of specifications that cover the lifecycle of sessions. 

* [Session Management](https://openid.net/specs/openid-connect-session-1_0.html)
* [RP initiated logout](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)
* [Front Channel Logout](https://openid.net/specs/openid-connect-frontchannel-1_0.html)

Most of these specs relies on cross-site communication between OPs and RPs, but some are more imminently going to be blocked with the deprecation of third party cookies.

For each of these we need to find alternatives:

* [login](#login)
* [logout](#logout)
* [status change notification](https://openid.net/specs/openid-connect-session-1_0.html#ChangeNotification)
* invisible refresh tokens

We'll go over each of these in the sections below:

## Login

Relying Parties typically embed credentialed iframes served by identity providers for personalization (e.g. showing the user's profile picture / name on buttons). Browsers do (or are intending to) block third party cookies in iframes, making them uncredentialed and hence unable to personalize.

There are two variations that we are evaluating to preserve this use case:

- [fencedframes](#fencedframes) and permissions and
- [mediation](#mediation)

### fenced frames

There is a variety of privacy controls that we are exploring, but the fenced frame variation is a good baseline.

In this variation, we offer the user the identity-specific controls whenever cross-site identity-specific communication is conducted (e.g. from the relying party to the IDP and vice versa), based on exposing new high level identity-specific APIs.

This is still under active exploration, but our efforts are going into exploring ways in which we can leverage [fencedframes](https://github.com/shivanigithub/fenced-frame) and introduce new high-level javascript APIs.

For example, we are looking into ways we could replace the `<iframe>` tag with the web-bundle version of `<fencedframe>`s:

```html
<fencedframe src="https://idp.example/personalized-frame.wbn" client_id="1234" scope="openid email">
</fencedframe>
```

In this formulation, the web bundle is a static (yet personalized) bundle that can be displayed on page load but can't have any uncontrolled communication outwards (e.g. over the network or over in-browser features, like postMessage).

The IDP-controlled fenced frame can communicates back with the RP with a high-level API (in replacement of the low-level `postMessage`) too (which isn't allowed in a fenced frame): 

```javascript
// This is just a possible starting point, largely TBD.
await navigator.credentials.store({
  idtoken: JWT,
});
```

![](static/mock28.svg)

Upon approval, the user agent would hand it back the result to the relying party using the existing mechanisms:

```javascript
window.addEventListener(`message`, (e) => {
  if (e.origin == "https://idp.example") {
    // ...
    e.source.postMessage("done, thanks");
  }
});
```

This variation is a great **baseline** because it is highly backwards compatible from a user experience perspective and from a deployment perspective. Relying parties don't have to redeploy, nor users will have to change their mental models about the widgets.

But this variation isn't perfect: while it is backwards compatible, we believe it leaves something be desired on **user experience**.

For one, the user has to make **two** choices (on the consequences of tracking) that are unrelated to the job to be done (sign-in) which we don't expect to be the most effective way to affect change.

That leads us to the [mediation-oriented](#the-mediation-oriented-variation) variation which bundles these prompts into a browser mediated experience (which also comes with trade-offs).

### mediation

In the **mediated** variation, the user agent takes more responsibility in owning that transaction, and talks to the IDP directly (e.g. via an HTTP convention or JS APIs) rather than allowing the IDP to control HTML/JS/CSS.

As opposed to a fenced frame, relying parties call a javascript API:

```javascript
let {idToken} = await navigator.credentials.get({
  provider: "https://accounts.example.com",
  mode: "mediated",
  request: {
    client_id: 'my_client_id',
    scope: 'openid email',
    nonce: 'abcxyz'
    // other OpenId connect parameters
  }
});
```

The `mode` parameter informs the user agent to use the mediation-oriented variation, which, as opposed to the permission-oriented variation, talks to the IDP via HTTP instead:

```http
GET /.well-known/webid/accounts.php HTTP/1.1
Host: idp.example
Cookie: 123
```

The IDP responds with a list of accounts that the user has:

```http
HTTP/2.0 200 OK
Content-Type: text/json
{
  "accounts": [{
    "sub": 1234, 
    "name": "Sam Goto",
    "given_name": "Sam",
    "email": "samuelgoto@gmail.com",
    "picture": "https://accounts.idp.com/profile/123",
  }]
}
```

With the data, the browser then controls the experience with the user to carry on:

![](static/mock29.svg)

Upon agreement, the browser uses the HTTP API convention to mint the idtoken. For example:

```http
POST /.well-known/webid/idtoken.php HTTP/1.1
Host: idp.example
Cookie: 123
Content-Type: application/json

{
  'sub': '1234',
  'request': {
    'client_id' : 'my_cliend_id',
    'scope': 'openid email',
    'nonce': 'abcxyz'
  }
}
```

Which may respond with the following JWT:
```json
{
  "id_token" : "asdlkjop2awlasd"
}
```

And with the response, resolves the promise.

The benefits of the permission-oriented approach is that it is the most backwards compatible, at the cost of user friction in the form of permissions. The benefits of the mediated approach is that the user friction is inlined and contextual, at the cost of the ossification of the user experience.

## Logout

When users log out of IDPs, there is typically a desire for users to also be logged out of the RPs they signed into. This is typically accomplished with the IDPs loading iframes pointing to a pre-acquired endpoint for each of the relying parties ([details](https://www.identityserver.com/articles/the-challenge-of-building-saml-single-logout)).

This is still an active area of investigation, but one first approximation is that, without cookies, these iframes are going to be uncredentialed. That leads to a few options to be explored:

- use the back channel and session ids (which comes with its own set of challenges) or
- expose web platform APIs to preserve this use case

We are still actively investigating the use case and understanding the deployment structure here, but just as a starting point, consider the introduction of an identity-specific browser API that would allow the browser to gather the user permission and release the credentials to the iframes:

```javascript
await navigator.credentials.logout({
  relying_parties: [
    "https://rp1.com",
    "https://rp2.com",
    "https://rp3.com",
    // ...
    "https://rp8.com",
    "https://rp9.com",
  ]
});
```

The form of the API as well as whether/which permissions that would be involved as still largely being explored. Our current best approximation is to use the [login](#login) API to observe which relying parties the user has signed-in to and has already established an IDP/RP relationship. For those RPs, the browser can probably safely load these iframes in a credentialed form.

It is unclear to us if the browser can observe all of the sign-ins (e.g. multi-browser cases as well as how WebID may roll out), so an array of relying party logout endpoints can also be passed and a permission can be used for those cases:

![](static/mock30.svg)





