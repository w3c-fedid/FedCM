---
title: WebID Privacy Threat Model
description: A privacy threat model intended to frame privacy risks associated with federated identity on the web.
---
Author: @kenrb

# Overview
## WebID proposal
WebID is a proposal to provide a new API that will allow browser intermediation of federated sign-in on the web in a manner that has stronger privacy protections than the flows that exist today.
The [WebID explainer draft](https://code.sgo.to/WebID/) contains a full description of the problem statement and a strawman solution.
## Document purpose
This document is intended to provide a comprehensive overview of the privacy risks associated with federated identity on the web for the purpose of measuring the privacy risks and benefits of proposed browser intermediation designs.
# Relevant principals
This section describes the three principals that would participate in an invocation of the API and expectations around their behavior.
## User Agent
The user agent implements the API and controls the execution contexts for the RP and IDP content. The user agent is assumed to be trusted by the user, and transitively trusted by the RP and IDP.
## Relying Party (RP)
Relying Parties are first party websites that invoke the WebID API for the purpose of authenticating a user to their account or for requesting information about that user. A well-behaving RP would only invoke the API following a clear user signal -- typically, clicking a sign-in button. Since any site can invoke the API, RPs cannot necessarily be trusted to limit the user information it collects or use that information in an acceptable way.
## Identity Provider (IDP)
Identity Providers are third party websites that are the target of a WebID call to attempt to fetch an ID token. Usually the IDP has a higher level of trust than the RP since it already has the user’s personal information, but it is possible that the IDP might use the user’s information in non-approved ways. It is possible that the IDP specified in the API call may not be an IDP the user knows about, or may not be a bona fide IDP at all, in which case it likely does not have personal user information in advance, but also might be less accountable for its behavior.
# High-level threats
Below is an enumeration of the privacy risks to users associated with identity federation and the mechanisms that enable it.
## User tracking
Many existing web features create the opportunity for surveillance and correlation of user activity across the web by cooperating websites. While there is active work on making that impractical by means such as restricting third-party 
, identity federation specifically requires exchanges of information between websites and an API for this purpose risks increasing tracking risks.
## Non-consensual sharing of personal information
Identity federation as it currently exists on the web allows an IDP to pass a token to an RP containing personal information such as the user’s name, email address, and other data depending on the situation. IDPs are responsible for providing adequate contextual information to the user and ensuring they consent to the sharing of information (e.g. See the sections entitled "Authorization Server obtains End-User Consent/Authorization" in the [OIDC spec](https://openid.net/specs/openid-connect-core-1_0.html)). Browser-mediated flows must provide the same guarantees.
# Attack scenarios
This section describes the scenarios in which various agents might attempt to gain user information. It considers the possibilities when the RP is collecting information, the IDP is collecting information, or both the RP and the IDP are colluding. For the purposes of this section, a principal is considered to be participating in the collection of information if it directly or indirectly performs actions with the aim of realizing one of the above threats. An example of indirect collusion would be an RP importing a script supplied by an IDP where the IDP intends to track users.
For the purpose of discussion this document assumes that [third-party cookies are disabled by default](https://www.chromium.org/Home/chromium-privacy/privacy-sandbox) and are no longer effective for use in tracking mechanisms, and also some form of mitigations are implemented against ‘bounce tracking’ using link decoration or postMessage. Most of these scenarios consider how user tracking might happen without them.
## Relying Party collecting information
### (RP1.) Multiple Relying Parties correlate user information for tracking purposes
When a user willingly provides their full name, email address, phone number, etc, to multiple relying parties, those relying parties can collaborate to build a profile of that user and their activity across collaborating sites. This correlation and profile-building is outside the user’s control and entirely out of the browser’s or IDP’s view.
### (RP2.) Relying Party obtains personal user information from IDP without user consent
A relying party might attempt to obtain user information from an identity provider without the user having consenting to the information being released, or being aware of it being released. This can happen if consent mechanisms are missing, inadequate, or susceptible to bypass.
### (RP3.) Relying Party uses user information for purposes to which the user did not consent
When the user agrees to allow the IDP to provide information to the RP, the consent is specific to specific purposes, such as sign-in and personalization. The RP might use that data for other purposes, such as selling email addresses to a spam list. Spamming risk can exist even when using [directed identifiers](#directed-identifiers).
### (RP4.) Relying Party employs client state-based tracking to identify user
Any API that exposes any kind of client state to the web risk becoming a vector for fingerprinting or ‘supercookies’. Neither the status quo of federated identity nor current proposals for browser mediation add detectable client state that would increase fingerprinting risk, but any changes or additional features need to be analyzed as to whether they increase the feasibility of sites tracking users without cookies.
## Identity Provider collecting information
### (IDP1.) Identity Provider tracking user sign-ins to Relying Party sites
Existing federation protocols require that the Identity Provider know the CLIENT_ID of the Relying Party in order to allow identity federation. Identity providers can use this fact to build profiles of users across sites where the user has decided to use federation with the same account. This profile could be used, for example, to serve targeted advertisements to those users browsing on sites that the IDP controls.
### (IDP2.) Identity Provider misusing federated sign-in capabilities
Since Identity Providers have unconstrained ability to issue ID tokens, they are capable of logging in to users’ federated accounts without user knowledge or action.
## Relying Party and Identity Provider colluding to collect information
### (COL1.) IDP exceeding user’s information sharing permission
Existing federated identity protocols are clear on what information an RP is requesting, which the IDP can provide. While the browser can inspect the request and response and consider whether user permission has been granted for that transfer, it is difficult to know that there is no additional information embedded in the response. An example could be if the IDP encodes an identifier that could be used to load user-targeted advertisements on RP pages, which could be of value where the IDP has much more profiling information about the user. Another example is if the ID token is shared out-of-band, invisible to the browser, in which case it could contain anything.
### (COL2.) RP sharing user-identifying information with the IDP
Since it is likely a requirement that browser requests to the IDP are credentialed, there is a tracking risk in the requests that the RPs are generating. The RP could provide identifying data in the request which the IDP (possibly not a bona fide IDP, but just a tracking site) could correlate to other requests from other RPs.
Even where the RP does not convey user-identifying information in its request, it is possible that the request sent to a colluding IDP can be correlated after the fact based on timing, and this could be used for tracking purposes. For example, if the RP logs the time at which it invoked the API, and the IDP logs the time at which it received a credentialed WebID request from that RP, this might have a high probability of allowing the user’s separate account with the RP and IDP to be associated together. This is possible without WebID using simple cross-origin top-level navigations, but WebID could make it more effective because the IDP seeing the RP’s CLIENT_ID would allow significantly better disambiguation.
# Mitigation
## Directed identifiers
* Mitigates: [RP1](#rp1-Multiple-Relying-Parties-correlate-user-information-for-tracking-purposes)

The problem of RPs joining user data via back-channels is inherent to the proliferation of identifying user data. This can be solved by issuing ‘directed’ identifiers that provide an effective handle to a user’s identity with a given IDP that is unique and therefore cannot be correlated with other RPs. The term ‘directed’ implies that it is unidirectionally identifying, such as in a directed graph. In the past, there have been schemes to accomplish this using one-way hashes of, for example, the user’s name, the IDP and the RP. Notably, this mitigation is not robust against collusion from between the IDP and the RP, or the IDP participating in tracking itself. Also, collaborating RPs might be able to defeat this mitigation by sharing the same CLIENT_ID, although possibly this could be detected and presumably would violate RP agreements with IDPs.
## Browser-enforced consent
* Mitigates: [RP2](#rp2-relying-party-obtains-personal-user-information-from-idp-without-user-consent), [IDP1](#idp1-identity-provider-tracking-user-sign-ins-to-relying-party-sites), [COL2](#col2-rp-sharing-user-identifying-information-with-the-idp)

IDPs, whom the user has entrusted with their personal data, are currently responsible for ensuring that the user consents to their information being shared. With browser mediation in place, the user agent might have to assume responsibility for ensuring the user understands what is being shared and that it is intentional. This is certainly the case if the browser is able to entirely intermediate the identity flow without showing any IDP web content, but also might be desirable if there are concerns that the IDP is not collecting consent in an adequate manner.
Additionally, a consent prompt preceding the sharing of the RP’s request to the IDP can mitigate risks around IDP tracking of user visits to RPs.
## Identity Provider policy
* Mitigates: [IDP2](#idp2-identity-provider-misusing-federated-sign-in-capabilities), [COL1](#col1-idp-exceeding-users-information-sharing-permission)

Beyond technical constraints, the browser can recognize explicit assertions by the IDP about the privacy characteristics it provides and rely on those assertions in order to guide the user appropriately. An example is a hypothetical case in which the IDP asserts it will only issue directed identifiers and will not provide identifying information to the RPs out of view of the browser. In that case the browser may not have to warn the user about sharing personalized information.
## Denylists
* Mitigates: Potentially all threats, but is subject to the likelihood of bad behavior being detected, which for some might be difficult.

Any RPs or IDPs observed to be using this API to compromise user privacy in a deceptive or abusive manner could be explicitly blocked from using it, or potentially added to the SafeBrowsing blocklist so that they cannot be loaded at all.
## Hiding the RP from the IDP
* Mitigates: [IDP1](#idp1-identity-provider-tracking-user-sign-ins-to-relying-party-sites), [COL2](#col2-rp-sharing-user-identifying-information-with-the-idp)

Preventing tracking of users by the IDP is difficult because the RP has to be coded into the identity token for security reasons, to prevent reuse of the token. There have been cryptographic schemes developed to blind the IDP to the RP while still preventing token reuse in that way (see Mozilla’s [personas](https://wiki.mozilla.org/Identity/Persona_AAR)) but there are other valid uses that the IDP has for knowing the RP, such as fraud and abuse prevention. Also, it may conflict with [directed identifiers](#directed-identifiers), since the IDP has to have the ability to map RP+User → directed ID.
## Identity Provider has a relationship with the RP
* Mitigates: [RP2](#rp2-relying-party-obtains-personal-user-information-from-idp-without-user-consent), [RP3](#rp3-relying-party-uses-user-information-for-purposes-to-which-the-user-did-not-consent)

Currently, IDPs require that an RP agree to specific terms before the IDP will issue an ID token to them. This conflicts with [the previous mitigation](#Hiding-the-RP-from-the-IDP), but can provide a measure of RP accountability.
# Related reading
* [A Potential Privacy Model for the Web](https://github.com/michaelkleber/privacy-model)
* [Editor’s Draft for a Web Privacy Threat Model](https://w3cping.github.io/privacy-threat-model/)
* [Security and Privacy Considerations for SAML V2.0](https://docs.oasis-open.org/security/saml/v2.0/saml-sec-consider-2.0-os.pdf)
