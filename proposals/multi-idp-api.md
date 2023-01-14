# FedCM Multiple IDP Support Explainer

## Participate
[https://github.com/fedidcg/FedCM/issues/319](https://github.com/fedidcg/FedCM/issues/319)

## What is this?

The [Federated Credential Management (FedCM) API](https://fedidcg.github.io/FedCM/) is a Web Platform API which allows users to login to websites with their federated accounts in a privacy preserving manner. Currently, it only supports a single identity provider (IDP) at a time.

This is an example of what we have now. Users can only login with their federated accounts from a single IDP at a time, in this example, Google.

<p align="center">
     <img width="467" src="/proposals/images/multi-idp-explainer-1.png"/>
</p>
     
With multi IDP support, we want to allow users to login with their federated accounts from a set of IDPs at a time, in this example, Facebook, Google or Apple.

<p align="center">
     <img align="center" width="450" src="/proposals/images/multi-idp-explainer-2.png"/>
</p>

## Why do we care?

### Consumers

Many consumers tend to have accounts with more than one identity provider. For instance, users tend to have a work account for work and a separate personal account for everything else.

### Identity providers

Relying parties (RPs) shouldn't have to choose one IDP to prefer over others. We want to maximize user agency in their choice of IDP and decrease the barrier for new IDPs.

### Browser vendors

Browser vendors such as Mozilla have expressed interest in having multi IDP support.

### Other use cases

Providing multi IDP support can be an essential requirement for other use cases. For example, in education scenarios, each institution is an IDP and many RPs tend to support login with a lot of institutions.

<p align="center">
     <img align="center" width="745" src="/proposals/images/multi-idp-explainer-3.png"/>
</p>

## Key considerations

Here are key scenarios that we plan on covering in our implementation.

### Page load

The FedCM dialog appears without user interaction, usually the instant a website has finished loading.

<p align="center">
     <img align="center" width="700" src="/proposals/images/multi-idp-explainer-4.gif"/>
</p>

### User interaction

The FedCM dialog appears only when user interaction occurs such as clicking on a button.

<p align="center">
     <img align="center" width="700" src="/proposals/images/multi-idp-explainer-5.gif"/>
</p>

### HTML API

We want to limit RP changes and go with IDP SDK changes if possible to make our activation strategy more feasible. Currently, Google Identity Services offers a HTML API to support federated login with the following script.

RP's script
```
<div data-client_id="123" 
     data-callback="handleToken"
     id="idp_on_load">
</div>
<script src="idp.js" type="module"></script>
```

### JavaScript API

Similar to the HTML API, we want to limit RP changes and go with IDP SDK changes if possible to make our activation strategy more feasible. Currently, Facebook offers a JavaScript API to support federated login with the following script. Importantly, we want to be able to support the case where some IDPs use a HTML API and some use an JavaScript API and show both in the same dialog.

RP's script
```
<script>
idp.getLoginStatus = (token) => {
  // log the user in
}
</script>
```

### IDP ordering

Whenever it is possible, IDPs are ordered in a way that benefits the user such as by showing IDPs in which the user has returning accounts first. However, if the user is not signed in to any IDP, or signed into multiple IDPs, we need to make the decision on how to order the IDPs.

### IDP independence
IDPs should remain independent from one another. In other words, IDPs should not need to collaborate with other IDPs in order to share the same FedCM dialog. On the other hand, an IDP should also not be able to intentionally or unintentionally prevent another IDP from appearing within the same FedCM dialog.

### RP changes
FedCM’s operating assumption is that the difficulty in propagating changes is (from easiest to most difficult): browsers, IDPs, RPs, users. The reason being that the number of browsers is orders of magnitude lower than the number of IDPs, the number of IDPs is orders of magnitude lower than the number of RPs and so on and so forth. Ideally for the best activation strategy, we do not want any RP changes.

### Slow or unresponsive IDPs

IDPs that take a while to respond should be handled in a way that doesn't affect other IDPs.

### Easy to understand

Solution should be intuitive to web developers.

## Prototyped implementations

### 1.  Array-based implementation
Prototype is available in M107 gated behind the FedCmMultipleIdentityProviders flag. Multiple identity providers are specified as an array in the providers field of a single navigator.credentials.get call.

RP's script
```
<script>
const cred = await navigator.credentials.get({
  identity: {
    providers: [ // all IDPs are specified in this array
      {
        configUrl: "https://idp1.com/foo.json", // first IDP
        clientId: "123",
      },
      {
        configUrl: "https://idp2.com/bar.json", // second IDP
        clientId: "456",
      }
    ]
  }
});
</script>
```

| Key considerations | Covered by implementation? How so? |
| --- | --- |
| Page load | Yes, RP is in control of when the navigator.credentials.get is called so they can make the call upon page load. |
| User interaction | Yes, RP is in control of when the navigator.credentials.get is called so they can make the call upon user interaction. |
| HTML API | No, RP is in control of the navigator.credentials.get call not the IDP who implements the HTML API. |
| JavaScript API | No, RP is in control of the navigator.credentials.get call not the IDP who implements the JavaScript API. |
| IDP ordering | Yes, the order of the IDPs in the array specified by the RP can be the order of IDPs when the user is not signed in with any of them. |
| IDP independence | Yes, RP is in control of the get call so IDPs do not have to collaborate and cannot interfere with one another. |
| RP changes | No, there are a lot of non-trivial RP changes required. In particular, RP has to call navigator.credentials.get. |
| Slow or unresponsive IDPs | Yes, the user agent can set a default timeout at the cutoff for IDP registration. If needed, a new method to override the default timeout could be surfaced for the RP to call. We could also explore other ways to add IDPs to the dialog dynamically. |
| Easy to understand | Yes, the developer can specify all the IDPs they want to support in a single navigator.credentials.get call. |

The main issue with this implementation is its activation strategy which requires a lot of RP changes. Another issue is that the ID token that is returned by FedCM goes directly to the RP and completely bypasses the associated IDP's JS SDK library. If the IDP library needs to remember, post-process, or handle the returned ID token, then using this method could result in discrepancies between the RP's identity state and the IDP's identity state, which could result in subsequent issues.

### 2. Batched get implementation

A preliminary prototype is available in M110 gated behind the FedCmMultipleIdentityProviders flag. Multiple identity providers are specified through multiple separate navigator.credentials.get calls.

As hinted in the name, the get calls are processed in batches. This implementation depends on heuristics such as but not limited to the window onload event to set a cutoff for the batches. It is up to the user agent when they would like to show the FedCM dialog but it is required that the dialog is shown after the window onload event. This ensures that IDPs are given a fair chance to be included in the initial FedCM dialog by registering themselves prior to the window onload event. Here are some common scenarios of our implementation built around the window onload event.

**a. Before or during window onload**

First IDP's script
```
idp1.js

<script>
const cred = await navigator.credentials.get({
  identity: {
    providers: [
      {
        configUrl: "https://idp1.com/foo.json",
        clientId: "123",
      }
    ]
  }
});
</script>
```

Second IDP's script
```
idp2.js

<script>
const cred = await navigator.credentials.get({
  identity: {
    providers: [
      {
        configUrl: "https://idp2.com/bar.json",
        clientId: "456",
      }
    ]
  }
});
</script>
```

RP's script
```
<script src="idp1.js"></script>
<script src="idp2.js"></script>
```

The window onload event is fired when the whole page is loaded, including all dependent resources such as the scripts idp1.js and idp2.js. Thus, in this scenario, both IDP scripts are loaded before the window onload event. We would collect the get call parameters for both IDPs and combine them to produce a single dialog which is shown at the user agent's discretion.

<p align="center">
     <img align="center" width="700" src="/proposals/images/multi-idp-explainer-6.png"/>
</p>

**b. After window onload**

First IDP's script
```
idp1.js

<script>
function prompt() {
  const cred = await navigator.credentials.get({
    identity: {
      providers: [
        {
          configUrl: "https://idp1.com/foo.json",
          clientId: "123",
        }
      ]
    }
  });
}
</script>
```

Second IDP's script
```
idp2.js

<script>
function prompt() {
  const cred = await navigator.credentials.get({
    identity: {
      providers: [
        {
          configUrl: "https://idp2.com/bar.json",
          clientId: "456",
        }
      ]
    }
  });
}
</script>
```

RP's script
```
<script src="idp1.js"></script>
<script src="idp2.js"></script>

<script>
function onButtonClick() {
  const idp1 = idp1.init(...);
  const idp2 = idp2.init(...);
  Promise.all([idp1, idp2]).then(() => {
     idp1.prompt();
     idp2.prompt();
  });
}
</script>
```

In this scenario, navigator.credentials.get is not called when IDP scripts are loaded but instead in methods that are called when a button is clicked. This means the navigator.credentials.get calls occur in the same task. Upon the first invocation of FedCM, we would post a task to fetch from endpoints of all registered IDPs. When a task is posted, it is not executed immediately but it is queued. Once it is the task's turn to be executed, the process of fetching from the endpoints of all registered IDPs begins. Finally, the get call parameters for both IDPs are combined to produce a single dialog which is shown at the user agent's discretion.

<p align="center">
     <img align="center" width="700" src="/proposals/images/multi-idp-explainer-7.png"/>
</p>

| Key considerations | Covered by implementation? How so? |
| --- | --- |
| Page load | Yes, the user agent can choose to show the dialog immediately after the window onload event is fired. |
| User interaction | Yes, but only if all navigator.credentials.get calls occur when a gesture occurs. The user agent can choose to show the dialog as soon as the task to request a token is successfully completed. |
| HTML API | Yes, the IDP can call navigator.credentials.get in their script for their HTML API. |
| JavaScript API | Yes, the IDP can call navigator.credentials.get in their script for their JavaScript API. |
| IDP ordering | Maybe, the order of navigator.credentials.get calls would be the order of IDPs. It is also possible to add a new method which allows the RP to explicitly specify the order. If we go with a dynamically updated dialog where IDPs are added into the dialog as we receive responses, we could also order IDPs in order of response times. |
| IDP independence | Yes, IDP calls get independently from one another and cannot interfere with other IDPs’ get calls. |
| RP changes | Yes, there are no RP changes required. |
| Slow or unresponsive IDPs | Yes, the user agent can set a default timeout parameter at the cutoff for IDP registration. If needed, a new method to override the default timeout parameter could be surfaced for the RP to call. We could also explore other ways to add IDPs to the dialog dynamically. |
| Easy to understand | No, the implementation depends on the onload heuristic and the collation of get calls that don't seem related to one another. |

The main issue with this implementation is that it can be confusing for web developers because it behaves differently depending on whether the API is called before, during or after onload.

## Alternatives considered
### 1. Register and prompt implementation
Instead of using a single navigator.credentials.get call, we want to decouple the registration of an IDP and the display of the FedCM dialog by introducing two new methods. Namely,
1. `navigator.credentials.register` method to be called by IDPs
2. `navigator.credentials.prompt` method to be called by RPs

First IDP’s script
```
idp1.js

<script>
const cred = await navigator.credentials.register({
  identity: {
    providers: [
      {
        configUrl: "https://idp1.com/foo.json", // first IDP
        clientId: "123",
      }
    ]
  }
});
</script>
```

Second IDP’s script
```
idp2.js

<script>
const cred = await navigator.credentials.register({
  identity: {
    providers: [
      {
        configUrl: "https://idp2.com/bar.json", // second IDP
        clientId: "456",
      }
    ]
  }
});
</script>
```

RP’s script
```
<script src="idp1.js"></script>
<script src="idp2.js"></script>

<script>
navigator.credentials.prompt();
</script>
```

| Key considerations | Covered by implementation? How so? |
| --- | --- |
| Page load | Yes, RP is in control of when navigator.credentials.prompt is called so they can make the call upon page load. |
| User interaction | Yes, RP is in control of when navigator.credentials.prompt is called so they can make the call upon user interaction. |
| HTML SDK | Yes, the IDP can call navigator.credentials.register in their script for their HTML SDK. |
| JavaScript SDK | Yes, the IDP can call navigator.credentials.register in their script for their JavaScript SDK. |
| IDP ordering | Yes, we can add a field to navigator.credentials.prompt for the RP to specify IDP order. |
| IDP independence | No, an IDP could call navigator.credentials.prompt immediately after their navigator.credentials.register call. Consequently, IDPs registered after the prompt would not show up in the dialog. |
| RP changes | No, there are some RP changes required. In particular, RP has to call navigator.credentials.prompt. |
| Slow or unresponsive IDPs | Yes, the user agent can set a default timeout parameter at the cutoff for IDP registration. If needed, a new method to override the default timeout parameter could be surfaced for the RP to call. We could also explore other ways to add IDPs to the dialog dynamically. |
| Easy to understand | Yes, the methods do exactly as their names describe. i.e. register and prompt. |

The biggest flaw with this implementation is that IDPs are able to prevent other IDPs from showing up in the dialog. Even in the case of a non-malicious IDP, they may want to call prompt immediately to ensure that their IDP will show up in the dialog in the event RP forgets to call prompt.
Batched get implementation with mediation parameter
This implementation is an extension of the second prototyped implementation i.e. “Batched get implementation”. The only difference is an extra mediation parameter to handle page load and user interaction more explicitly. This is to make it simpler for web developers to use as they wouldn’t need to worry about onload heuristics.

### 2. Batched get implementation with mediation parameter

This implementation is an extension of the second prototyped implementation i.e. "Batched get implementation". The only difference is an extra mediation parameter to handle page load and user interaction more explicitly. This is to make it simpler for web developers to use as they wouldn't need to worry about onload heuristics.

The proposed mediation parameters are similar to those used in WebAuthn’s conditional UI for autocomplete. In particular, WebAuthn uses `get({mediation: “conditional”})` to register their get call but the prompt doesn’t occur until the user interacts with the autocomplete UI. For our implementation, we propose
1. `mediation: “now”` which leads to dialog being shown immediately upon page load
2. `mediation: “delayed”` which leads to registration of IDP but dialog is shown later and upon user interaction

First IDP’s script
```
idp1.js

<script>
const cred = await navigator.credentials.get({
  mediation: "now", // or “delayed”
  identity: {
    providers: [
      {
        configUrl: "https://idp1.com/foo.json", // first IDP
        clientId: "123",
      }
    ]
  }
});
</script>
```

Second IDP’s script
```
idp2.js

<script>
const cred = await navigator.credentials.get({
  mediation: "now", // or “delayed”
  identity: {
    providers: [
      {
        configUrl: "https://idp2.com/bar.json", // second IDP
        clientId: "456",
      }
    ]
  }
});
</script>
```

RP’s script
```
<script src="idp1.js"></script>
<script src="idp2.js"></script>
```

| Key considerations | Covered by implementation? How so? |
| --- | --- |
| Page load | Yes, IDP can set the mediation parameter to "now" to show the dialog upon page load. |
| User interaction | Yes, IDP can set the mediation parameter to "delayed" to show the dialog upon user interaction. |
| HTML SDK | Yes, the IDP can call navigator.credentials.get in their script for their HTML SDK. |
| JavaScript SDK | Yes, the IDP can call navigator.credentials.get in their script for their JavaScript SDK. |
| IDP ordering | Maybe, the order of navigator.credentials.get calls would be the order of IDPs. It is also possible to add a new method which allows the RP to explicitly specify the order. If we go with a dynamically updated dialog where IDPs are added into the dialog as we receive responses, we could also order IDPs in order of response times. |
| IDP independence | No, an IDP could set the mediation parameter to "now" and that would cancel the requests of IDPs which set the mediation parameter to "delayed". |
| RP changes | Yes, there are no RP changes required. |
| Slow or unresponsive IDPs | Yes, the user agent can set a default timeout parameter at the cutoff for IDP registration. If needed, a new method to override the default timeout parameter could be surfaced for the RP to call. We could also explore other ways to add IDPs to the dialog dynamically. |
| Easy to understand | Maybe, it is arguably easier to understand relative to "Batched get implementation" but unintuitive in other ways. For instance, mediation delayed calls rely on the user agent to determine when the dialog is shown. |

The biggest flaw in this solution is that the IDP does not know whether to set the mediation parameter to “now” or “delayed” without communicating with the RP. Hence, IDPs are more inclined to default to “now” as a way to ensure that their IDP will be displayed in the dialog. This defeats the purpose of having the mediation parameter.

On the other hand, RPs give up the control of when exactly the dialog will be shown in exchange for the RP not having to know onload heuristics from “Batched get implementation”. The minor simplification in terms of understanding is not worth the major uncertainty from not knowing when the FedCM dialog would be shown.

Lastly, it shares the same major flaw as the first alternative consideration. That is, IDPs are able to prevent other IDPs from showing up in the dialog. Even in the case of a non-malicious IDP, they may want to set their mediation parameter to “now” indefinitely. This is to ensure that their IDP will show up in the dialog regardless of other IDPs’ mediation parameters.
