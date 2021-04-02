## The HTML API

Relying Parties also typically embed iframes served by identity providers for personalization (e.g. showing the user's profile picture / name on buttons). Browsers do (or are intending to) block third party cookies in iframes, making them uncredentialed and hence unable to personalize.

This is still under active exploration, but our efforts are going into exploring ways in which we can leverage [fencedframes](https://github.com/shivanigithub/fenced-frame) and one of the response APIs above.

For example, we are looking into ways we could replace the `<iframe>` tag with the web-bundle version of `<fencedframe>`s:

```html
<fencedframe src="https://idp.example/personalized-frame.wbn" client_id="1234" scope="openid email">
</fencedframe>
```

In this formulation, the web bundle is a static (yet personalized) bundle that can be displayed on page load but can't have any uncontrolled communication outwards (e.g. over the network or over in-browser features, like postMessage).

Once the user interacts with the fencedframe, a user agent would know, based on identity-specific parameters in the fencedframe, when to release that information to the web bundle as well as use the APIs above (e.g. the HTTP API or the JS API) to return an idtoken back.

```javascript
window.addEventListener(`message`, (e) => {
  if (e.origin == "https://idp.example") {
    // ...
    e.source.postMessage("done, thanks");
  }
});
```
# Control

Now, clearly, addressing the classification problem is necessary but not sufficient. There are a couple of problems that needs to be solved too:

1. adversarial impersonation
1. the lack of privacy controls

The first thing to consider is that an adversarial tracker can and will use any of the affordances that will allow them to break out of the privacy sandbox. So, the high level APIs need to be implemented in such a way that prevents impersonation from happening.

In many ways, the first problem is related to the second one: if user agents expose clear privacy controls, then uncontrolled tracking cannot happen.

## The Permission-oriented Variation

There is a variety of privacy controls that we are exploring, but just as a baseline, take the permission-oriented variation:

In this variation, we offer the user the identity-specific controls whenever cross-site identity-specific communication is conducted (e.g. from the relying party to the IDP and vice versa), based on our ability to [classify](#classification) them.

Concretely, instead of a `window.location.href` top level redirect or a `window.open` popup, a relying party (most probably indirectly via JS SDK provided by the IDP) would call a high level API instead:

```javascript
// In replacement of window.location.href or window.open,
// we use a high-level API instead:
// NOTE: This is just a possible starting point, exact
// API largely TBD as we gather implementation experience.
let {idToken} = await navigator.credentials.get({
  provider: "https://accounts.example.com",
  ux_mode: "popup",
  // other OpenId connect parameters
});
```

Upon invocation, an IDP-controlled webpage is loaded:

![](static/mock19.svg)

The IDP-controlled website can communicates back with the RP with a high-level API (in replacemente of the low-level `postMessage`) too: 

```javascript
// This is just a possible starting point, largely TBD.
await navigator.credentials.store({
  idtoken: JWT,
});
```

This variation is a great **baseline** because it is highly backwards compatible (specially if it is done via the [HTTP API](#the-http-api)). Neither relying parties nor identity providers have to redeploy, nor users will have to change their mental models about federation.

But this variation isn't perfect: while it is backwards compatible with most of the deployment of federation, we believe it leaves something be desired on **user experience**.

For one, the user has to make **two** choices (on the consequences of tracking) that are unrelated to the job to be done (sign-in) which we don't expect to be the most effective way to affect change.

That leads us to the [mediation-oriented](#the-mediation-oriented-variation) variation which bundles these prompts into a browser mediated experience (which also comes with trade-offs).

## The Mediation-oriented Variation

In the **mediated** variation, the user agent takes more responsibility in owning that transaction, and talks to the IDP via an HTTP convention rather than allowing the IDP to control HTML/JS/CSS:

```javascript
let {idToken} = await navigator.credentials.get({
  provider: "https://accounts.example.com",
  ux_mode: "inline",
  // other OpenId connect parameters
});
```

The `ux_mode` parameter informs the user agent to use the mediation-oriented variation, which, as opposed to the permission-oriented variation, talks to the IDP via HTTP instead:

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
    "family_name": "Goto", 
    "email": "samuelgoto@gmail.com",
    "picture": "https://accounts.idp.com/profile/123",
  }]
}
```

With the data, the browser then controls the experience with the user to carry on:

![](static/mock15.svg)

Upon agreement, the browser uses the HTTP API convention to mint the idtoken. For example:

```http
POST /.well-known/webid/idtoken.php HTTP/1.1
Host: idp.example
Cookie: 123
Content-Type: application/x-www-form-urlencoded
account=1234,client_id=5678
```

And with the response, resolves the promise.

The benefits of the permission-oriented approach is that it is the most backwards compatible, at the cost of user friction in the form of permissions. The benefits of the mediated approach is that the user friction is inlined and contextual, at the cost of the ossification of the user experience.

Those two problems take us to a third approach we are exploring, which we are calling the delegation-oriented approach.

## The Delegation-oriented Variation

We believe that we are possibly making the user make a determination (to be tracked) that isn't necessary. The [delegation-oriented](consumers.md#the-delegation-oriented-variation) variation (which, again, comes with its set of trade-offs too) tries to solve the tracking risks by pulling more responsibilites to the user agent.

It is an active area of investigation to determine the **relationship** between these approaches. To the best of our knowledge so far, we expect these to be mutually complementary (rather than exclusive) and to co-exist long term. Each comes with trade-offs and it is too still early to know what market (if any) each fits. We expect that further implementation experimentation will guide us in better understanding the trade-offs and the relationship between these alternatives.
