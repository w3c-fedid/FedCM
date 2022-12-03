# FedCM’s Context API

- champion: goto@google.com
- status: draft

This is an early exploration of a mechanism that would allow websites to identify the context (e.g. logging specific flows like signing-in, signing-up, or more generically using your federated identity to continue on the website) in which the FedCM API prompt is shown, so that the appropriate language can be used. It extends the FedCM API by introducing a “context” attribute to its call.
Problem

Currently, the FedCM prompt assumes that the user is inside a sign-in flow, so uses language to match that:

```
| |                             | |
| |                             | |
| ┌─────────────────────────────┐ |
| |    Sign-in to rp.example    | |
| |      with idp.example?      | |
| |                             | |
| | ┌────┐                      | |
| | | :) |  John Doe            | |
| | └────┘  john@email.com      | |
| |                             | |
| | ┌─────────────────────────┐ | |
| | |    Continue as John     | | |
| | └─────────────────────────┘ | |
| └─────────────────────────────┘ |
└─────────────────────────────────┘
```

The prompt is awkward when used inside of other flows, such as signing-up or unlocking content (e.g. a scholarly article) based on federated identity (e.g. a university student).

# Non goals

It is a non goal to come up with something that is infinitely extensible / expressive. It is ok if we end up with a limited enumeration of contexts in which we expect the prompt to be used.

# Use Cases

There are some known use cases that we heard in the past from developers:

- Signing-in with your federated identity
- Signing-up with your federated identity
- Unlocking content (e.g. a scholarly article) based on your federated identity (e.g. your student id)

Here are a few examples [[1](https://developers.facebook.com/docs/facebook-login/web/login-button/), [2](https://developers.google.com/identity/gsi/web/guides/change-sign-in-context)] used by Facebook Login (“login with” or ”continue with”) and Google Sign-in (“sign-in with”, “sign-up with”, “continue with” and “use with”).

# Mocks

The API doesn’t make any visual UI structural changes other than the strings that we use. Currently, we have:

+--------------+---------------------------------------+
| Use Case     | String                                |
+--------------+---------------------------------------+
| Status Quo   | “Sign in to ${rp} with ${idp}”        |
+--------------+---------------------------------------+

And the proposal is to introduce 3 context modes:

+--------------+---------------------------------------+
| Use Case     | String                                |
+--------------+---------------------------------------+
| Sign-up      | “Sign up to ${rp} with ${idp}”        |
+--------------+---------------------------------------+
| Continue     | “Continue to ${rp} with ${idp}”       |
+--------------+---------------------------------------+
| Use          | “Use ${rp} with ${idp}”               |
+--------------+---------------------------------------+

# Examples

```js
const {token} = await navigator.credentials.get({
  identity: {
    // “signin” is the default, “use” and “continue” can also be used
    context: "signup", 
    providers: [{
          configURL: "https://idp.example/fedcm.json",
          clientId: "1234",
    }],
  }
});
```

# IDL

The specific way in which we propose to extend the FedCM API is the following:

```
Extensions to FederatedCredential
partial dictionary IdentityCredentialRequestOptions {
  // ...

  // A querying language that allows an RP to ask what it wants from the issuers.
  IdentityCredentialRequestOptionsContext context;
};

enum IdentityCredentialRequestOptionsContext {
  “signin”, “signup”, “use”, “continue”
};
```

# Algorithms

# Open Questions

1. I wonder if this is something we should propose on a higher level, for the credential management API in general?
1. How does this integrate with the Multi-IdP API? How do we decide which context to use if they conflict with each other?

