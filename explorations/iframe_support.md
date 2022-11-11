# Iframe Support

The FedCM API allows relying parties (RPs) to present federated login prompts where the user can login to the RP via some identity provider (IDP).
And it allows this without requiring usage of third-party cookies, i.e. via some browser mediation between the user, RP, and IDP.

By default, the FedCM API can only be invoked from the top-level frame. Given that this is a very powerful API, an iframe should not have the
capability to invoke the API without consent from the top-level frame. However, there are actually cases where invoking the API from the iframe is
desirable: iframe-embedded scripts and identification within iframes.

## Embedded Scripts

Smome IDPs engage with the RP via an embedded script. This script is the one which would invoke the FedCM API. There are large RPs like
eBay which currently use the Google One-Tap product, but they do so from an iframe to protect the top-level frame from IDP script tampering. In other
words, ebay.com may contain an iframe ebaystatic.com which is the one which embeds the script from Google. When using FedCM, this would not work at
the moment because FedCM is currently limited to being invoked from a top-level frame.

The ‘identity-credentials-get’ permissions policy can thus be used to allow ebaystatic.com to invoke the FedCM API even though it is an iframe. Once
it receives explicit permission from the top-level frame ebay.com, it works just as if it had been invoked from the top-level frame. Thus, enabling
FedCM on iframes allows RPs to keep using IDP scripts within iframes.

## Iframes Requiring FedCM (Authenticated Embeds)

Another use-case of enabling FedCM on iframes is when the iframe itself is the one that needs to know the identity of the user. One example of this
is AMP, where the page contents are within the AMP iframe. But there are also other examples: chat widgets, calendars, etc. where the main page does
not really need to receive the identity of the user but the iframe does in order for the site to work properly.

Without iframe support, identification within iframes suffers from two problems. First, it would be hard to pull it off: it requires collaboration
between the top-level frame and the iframe so that the top-level requests the FedCM API, and once it receives an ID token then it can message it to
the iframe. Second, it exposes information more than needed: the top-level does not need to know the identity of the user which is identifying itself
to the iframe, but because it acts as intermediary then it gets to know this information.
