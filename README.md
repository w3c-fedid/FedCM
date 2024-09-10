# FedID CG Federated Credentials Management

This is the repository for the W3C's FedID CG Federated Credentials Management API.

Explainer: [explainer.md](explainer.md)

Work-in-progress specification: <https://w3c-fedid.github.io/FedCM/>

## Introduction

As the web has evolved there have been ongoing privacy-oriented changes
([example](https://blog.chromium.org/2020/01/building-more-private-web-path-towards.html)) and underlying privacy
[principles](https://github.com/michaelkleber/privacy-model). With those
changes some underlying assumptions of the web are changing. One of those
changes is the deprecation of third-party cookies. While overall good for the
web, third-party cookie deprecation leaves holes in how some existing systems
on the web were designed and deployed.

Federated Credentials Management API aims to fill the specific hole left by
the removal of third-party cookies on federated login. Historically this has
relied on third-party cookies or navigational redirects in order to function
as they were the primitives provided by the web.

The [explainer](explainer.md) and [spec](https://w3c-fedid.github.io/FedCM)
provide a potential API and the rational behind how that API was designed.

## Contributing

Much of the FedCM specification has evolved due to the experimentation detailed
in the [explorations](explorations/README.md). The explorations documents give a good
overview of the _why_ of the FedCM API. Please read over the documents to
understand how the current API has evolved.

There are several ways to contribute to the Federated Credential Management API.

 * If you're an interested party and have potential requirements, they can be
   submitted to the [IDBrowserUseCases](https://github.com/IDBrowserUseCases/docs)
   repository. There are also discussions ongoing in the
   [Fed-ID CG](https://www.w3.org/community/fed-id/) about the various use cases.

 * If you'd like to try out the current demo of the FedCM API you can follow the
   [HOWTO](explorations/HOWTO-chrome.md) document.

 * If you're an Identity Provider, there are two sides of the implementation that
   will be needed and any feedback on either side is appreciated.

   1. The [Identity Provider API](https://w3c-fedid.github.io/FedCM/#idp-api) describes
      the manifest and API needed server side.
   2. The [Browser API](https://w3c-fedid.github.io/FedCM/#browser-api) describes the JavaScript
      interface to FedCM which will need to be utilized.

 * If you're a Relying Party (i.e. website) and would like to test the changes out
   we'd appreciate feedback, you'll need to do something similar to the
   [HOWTO.md](explorations/HOWTO-chrome.md) to setup a fake IDP which can serve the needed
   JavaScript. (Until an IDP provides first party JavaScript to work with FedCM
   this integration will be tricker). You can also review the demo provided by the
   HOWTO and take a look at the
   [Relying Party API](https://w3c-fedid.github.io/FedCM/#rp) to see what is needed
   on the RP side.

## Code of Conduct

This group operates under [W3C's Code of Conduct Policy](http://www.w3.org/Consortium/cepc/).
