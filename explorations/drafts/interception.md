# Navigation Interception API

## Problem Statement

So far, we've managed to deploy FedCM on a series of deployment setups (IdPs that deploy with JS SDKs, small federations and cases where RPs can be deployed at scale), and in doing so, developed a lot of the infrastructure to meet those requirements.

However, one deployment pattern (which also happens to be the most widely used) remained out of reach to deploy at scale: federation implemented with top level redirects.

For example, take [chatgpt.com](http://chatgpt.com/): a user clicks on `Continue with Google`, which redirects the user to [google.com](http://accounts.google.com/) (with a well-defined set of URL parameters, including, notably, a `redirect_uri` that tells where to redirect the user at the end of the flow) which asks for the user’s permission to share their identity to [chatgpt.com](http://chatgpt.com/) and then redirects (using the `redirect_uri` specified before) the user back to [chatgpt.com](http://chatgpt.com/) with the user’s identity in it (e.g. with a well-defined URL parameter called `code`).

We could go RP by RP and ask them to reploy and use FedCM instead (for IdPs that support it), but that would be an overwhelming task considering how many Relying Parties exist to any single IdP.

![Image](https://github.com/user-attachments/assets/815503d7-5c21-4a69-b61f-7802be90428c)

As a basis for comparison, consider the case when RPs embed JS SDKs that IdPs can re-deploy: migrating the traffic becomes much easier, because just changing the JS SDK that the IdP controls, the IdP can deploy FedCM to many RPs. 

For example, here is part of the federation traffic migrated to FedCM which isn’t using redirect flows, but rather rely on updating JS SDKs that an Identity Provider controls live on a Relying Party, in this case https://pinterest.com.

![Image](https://github.com/user-attachments/assets/244ab21a-7064-48f7-9e1b-aa58a36c6279)

In redirect flows, however, RPs directly navigate the user to the Identity Provider’s OAuth authorization endpoint without any opportunity for the IdP to tell the browser that this is a FedCM flow through JS calls.

Redirect flows account for the vast majority of the deployment of federation at large, so really important to be able to be migrated at scale.

One trivial answer to this problem is to ask every website in the world to change and call FedCM instead (when the corresponding IdP supports it), but that’s intractable based on the scale of the number of Relying Parties.

So, the problem is: how might an IdP migrate redirect flows without requiring changes to its Relying Parties?

## The Proposal

The proposal under exploration in this doc here is to find ways to initiate FedCM without requiring changing Relying Parties (or relying on JS SDKs running on the RP’s page).

The key insight in this proposal is to try to find a way to allow the IdP to communicate to the browser that this is a FedCM flow before the user navigates away from the Relying Party.

While looking at many different mechanisms (e.g. OPTIONS requests, CSP policies, DNS entries, etc), we ran into a common pattern in browsers: before the browser navigates the user away from the current page, the browser fetches the headers of the next page, and is allowed to cancel the current navigation based on that information.

This pattern is currently used for a variety of things, but perhaps most notably to handle downloads: if a user clicks on a binary file (say, a .zip file), the browser doesn’t navigate away from the page, and instead it downloads the file without leaving the page. The browser makes that distinction by looking at the returning HTTP headers to figure out that the next page isn’t an actual page, but rather a binary blob that needs to be downloaded instead. This works on a variety of navigational events, whether they are `<a>` tags, `window.location.href` scripts, `<form method=”POST”>` submissions, etc.

So, the idea is to use that mechanism (in conjunction with participating Identity Providers) to intercept navigations when users click on the “Continue with IdP” buttons.

There are multiple stages of the navigation that the throttle can interact with (e.g. before making HTTP requests, while redirects are being done, etc), but the most meaningful one to this design here is that there is a stage where (a) the navigation can still be cancelled and (b) the HTTP headers of the website that the user is going to navigate to has already been fetched and parsed.

That is, after the user clicks on “Continue with IdP”, the HTTP headers of the next URL (e.g. The IdP’s OAuth authorization endpoint) is fetched and made available for a navigation throttler to make a determination to cancel the navigation or not.

The proposal is to ask the HTTP endpoint to output a special HTTP header that tells the browser “this flow is equivalent to this FedCM request in XYZ ways”.

For example:

```http
HTTP/1.1 200 OK
Date: Thu, 16 Oct 2025 20:28:00 GMT
Content-Type: text/html; charset=UTF-8
Content-Length: 123
Connection: Keep-Alive
FedCM-Intercept-Navigation: client_id="1234", config_url="https://idp.example/fedcm.json", context="continue", domain_hint="domain.com", fields=("name" "email"), login_hint="user@email.com", nonce="5678", params="{\"custom_key\":\"custom_value\"}"
```

The proposed `FedCM-Intercept-Navigation` header is an [RFC 9651](https://datatracker.ietf.org/doc/html/rfc9651#name-dictionaries)  encoding of a subset (e.g. IdPs don’t get to specify “mode” or a list of “providers” – but can specify “context” and a single entry of an IdentityProviderRequestOptions) of a FedCM request in query parameters.

The supported parameters are:

| Parameter | Type |
| :------- | :------ |
| configURL | String |
| clientId | String |
| nonce | String |
| params | String-encoded JSON |
| context | String of one of the pre-defined contexts |
| login_hint | String |
| domain_hint | String |
| fields | List of Strings of supported fields |

Notably, the IdP is **NOT** allowed to set the following parameters of the FedCM API: `mode` (assumed to always be active) and use multiple `providers`.

When it does that, the navigation throttler is able to get that response BEFORE the user navigates away, and is then able to cancel (or defer) the navigation and open a browser-mediated FedCM prompt instead:

<img width="1280" height="960" alt="FedCM Navigation Interception API" src="https://github.com/user-attachments/assets/47692368-3809-4fd1-a6e1-9dbb46d0920f" />

Because the browser has gotten really good at mediating federation (e.g. we know how to handle logged out users, adding new accounts, asking for permissions, etc), the entire flow that would have been a navigation can be captured by the browser.

Because the header is new, the IdP would operate without any change in browsers that don’t intercept it.

At the end of the flow, as per the FedCM protocol, the `id_assertion_endpoint` is called, and we introduce a new result type, say, `redirect_to`, to go along with `token` (which resolves a JS promise) and `continue_on` (which opens a pop-up window).

The id assertion response now gets augmented with an extra response type:

```javascript
// https://w3c-fedid.github.io/FedCM/#dictdef-identityassertionresponse
dictionary IdentityAssertionResponse {
  // ...
  (USVString or IdentityAssertionResponseFormSubmission) redirect_to;
  // ...
};

enum Method {"GET", "POST"};

dictionary IdentityAssertionResponseFormSubmission {
  USVString url;
  Method method;
  USVString? body;
};
```

For example:

```javascript
{
  'redirect_to': 'https://chatgpt.com/oauth/redirect_uri?code=...',
}
```

When the `redirect_to` response is a string, it is assumed that this is a GET navigation.

For POST form submissions, the “redirect_to” can be expanded into an object of its own, so that the other parameters can be specified as a form submission. For example:

```javascript
{
  'redirect_to': {
    'url': 'https://chatgpt.com/oauth/redirect_uri',
    'method': 'POST',
    'body': 'code=hello'
  }
}
```

What `redirect_to` instructs the browser to do is to continue the navigation to a new URL that the IdP specified, concluding the OAuth/OIDC flow and logging the user to the RP.

## User ergonomics

A big part of the reason this is a compelling construction is because there are intrinsic benefits of having the user agent access high level concepts (e.g. a sign-in flow) rather than low level concepts (e.g. a top level navigation).

For example, UX-wise, the browser native UIs perform much better than top-level redirects and pop-up windows, especially on mobile devices with constrained memory and network resources.

Additionally, when the user agent has access to the high level concept of federated accounts, it can reconcile and unify with other authentication mechanisms (e.g. passwords and passkeys) for returning users.


## Developer ergonomics

One nice property of this feature is that it allows redirect flows to have an “inline experience” without requiring the Relying Parties to use Javascript and pop-up windows to do so. Because it only requires Identity Providers to change, most Relying Parties can get this improved user experience without redeploying at all.

## Security Considerations

- What kinds of security considerations do we need to put into the “redirect_to” URL?
- We shouldn’t allow redirecting to things like reserved urls, like chrome://settings, but what else?
- Any CSP considerations? What else?
- A1 > IdP > A2
- A2 should be navigated with the initiator being IdP
- E.g. CSP policies, redirect chains, SameSite cookies policies (e.g. not pass SameSite=None), etc
- Initiator in this case doesn’t have a frame

## Privacy Considerations

### Link Decoration

One nice side effect of this proposal is that it turns the OAuth servers future-proof to link decoration mitigations.

So far, one of the mitigations to link decoration was to block first party cookies when links are decorated. 

This construction would allow OAuth servers to operate in that environment, because they could return the header without first party cookies, and the browser can still construct the account choosing UI because we already figured out how to do so without third party cookies (i.e. via the accounts endpoint construction).

