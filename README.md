# FedID CG Federated Credentials Management

This is the repository for the W3C's FedID CG Federated Credentials Management API.

Developer documentation: [Federated Credential Management (FedCM) API](https://developer.mozilla.org/en-US/docs/Web/API/FedCM_API)

Editor's draft of the spec [here](https://w3c-fedid.github.io/FedCM/)

## Introduction

The Federated Credential Management (FedCM) API provides a modern, privacy-preserving
standard for federated identity on the web. It enables a more secure and intuitive
user experience for signing in to websites (Relying Parties) with accounts from a
trusted Identity Provider, all through a browser-mediated and standardized flow.

In an era of increasing focus on user privacy and data control, the FedCM API offers
a forward-looking solution to the known privacy and usability challenges of
traditional federated login systems. By introducing the browser as an active
participant, it creates a more interoperable and consistent authentication process.
This ensures that users have a clearer understanding and more explicit control over
what information is being shared and with whom.

For websites, FedCM offers a durable and efficient API for implementing
federated sign-in that is not dependent on the shifting landscape of browser
tracking technologies. It represents a proactive step towards building a more
trustworthy and user-centric web by improving the fundamental mechanics of how
we manage identity online.

Identity providers gain increased visibility with FedCM. The API allows the
browser to display a single account chooser that can include multiple providers,
letting users easily select their favorite. This unified login experience, managed
directly by the browser, opens up new access points for providers.

The [documentation](https://developer.mozilla.org/en-US/docs/Web/API/FedCM_API)
and [spec](https://w3c-fedid.github.io/FedCM) provide a potential API and the
rationale behind that API's design.

## Contributing

Much of the FedCM specification has evolved due to the experimentation detailed
in the [explorations](explorations/README.md). The explorations documents give a good
overview of the _why_ of the FedCM API. Please read over the documents to
understand how the current API has evolved.

There are several ways to contribute to the Federated Credential Management API.

 * If you'd like to try out the current demo of the FedCM API you can follow the
   [HOWTO](explorations/HOWTO-chrome.md) document. A Firefox implementation is on
   the works so stay tuned!

 * If you're an Identity Provider, there are two sides of the implementation that
   will be needed and any feedback on either side is appreciated.

   1. The [Identity Provider API](https://w3c-fedid.github.io/FedCM/#idp-api) describes
      the manifest and API needed server side.
   2. The [Browser API](https://w3c-fedid.github.io/FedCM/#browser-api) describes the JavaScript
      interface to FedCM which will need to be utilized.

 * If you're a Relying Party (i.e. website) and would like to test the changes out
   we'd appreciate feedback, you have a couple of options:

   1. Use [HOWTO.md](explorations/HOWTO-chrome.md) to setup a fake IDP which can serve
      the needed JavaScript. You can also review the demo provided by the HOWTO and take a
      look at the [Relying Party API](https://w3c-fedid.github.io/FedCM/#rp) to see what is
      needed on the RP side.
   2. Try using an existing IDP which deploys FedCM.

## Code of Conduct

This group operates under [W3C's Code of Conduct Policy](http://www.w3.org/Consortium/cepc/).
