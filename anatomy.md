# The Anatomy of Federation

Before we can answer "how to distinguish" federation from tracking, lets first try to understand what federation depends on. For our interest, we can identify two big passes:

1. There is a convention used by relying parties to request identification/authentication to identity providers
1. There is a convention used by identity providers to respond with identification/authentication to relying parties

These passes rely on the following low level primitives:

- **HTTP APIs** (i.e. redirects, top level navigations, `<a>` or `window.location.location`),
- **JS APIs** (i.e. popups with `window.open` and `postMessage`) or
- **HTML APIs** (i.e. personalized buttons using `<iframe>`)

For example, a relying party can use the OpenID convention to request to an IDP:

```html
<a href="https://idp.example/?client_id=1234&scope=openid&redirect_uri=https://rp.example/callback.php">Sign in with IDP</a>
```

Which it then expects the IDP to at some point use the second convention to return back a response to the `redirect_uri`:

```http
POST /callback.php HTTP/1.1
Host: rp.example.com
Content-Type: application/x-www-form-urlencoded
Content-Length: length
Accept-Language: en-us
Accept-Encoding: gzip, deflate
Connection: Keep-Alive

id_token={JWT}
```

Another common affordance that federation uses are popups:

```javascript
let popup = window.open(`https://idp.example/?client_id=1234&scope=openid&redirect_uri=rp.example`);
window.addEventListener(`message`, (e) => {
  if (e.origin == "https://idp.example") {
    // ...
    e.source.postMessage("done, thanks");
  }
});
```

Or iframes:

```html
<iframe src="https://idp.example/?client_id=1234&scope=openid&redirect_uri=rp.example"></iframe>
```

Which listen to postMessages:

```javascript
window.addEventListener(`message`, (e) => {
  if (e.origin == "https://idp.example") {
    // neat, thanks!
    let {idtoken} = e;
  }
});
```

All of these affordances depend on arbitrary credentialed cross-origin communication, so at some point we can expect them to be constrained (more details [here](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox)).
