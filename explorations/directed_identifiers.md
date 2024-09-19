* [Directed identifiers](#directed_identifiers)
* [General implementation approaches](#general-implementation-approaches)
* [Directed identifiers in FedCM](#directed-identifiers-in-fedcm)
  * [Essential fields](#essential-fields)
  * [Other fields](#other-fields)
  * [Directed basic profile](#directed-basic-profile)
* [User agent behavior](#user-agent-behavior)
  * [Policy-based approach](#policy-based-approach)
  * [Verifiably directed identifiers](#verifiably-directed-identifiers)
    * [Caveats of verifiably directed identifiers](#caveats-of-verifiably-directed-identifiers)
* [Challenges](#challenges)
  * [IdP concerns](#idp-concerns)
  * [RP concerns](#rp-concerns)
    * [Customer support](#customer-support)
    * [Duplicate accounts](#duplicate-accounts)
    * [Collaboration](#collaboration)
    * [Regulatory compliance](#regulatory-compliance)
  * [Enterprise use cases](#enterprise-use-cases)
* [Prior art considered](#prior-art-considered)

# Directed identifiers
This document explores the ideas of [directed identifiers](glossary.md#directed-identifier) and [verifiably directed identifiers](glossary.md#verifiably-directed-identifier) in FedCM.

Directed identifiers are included in the FedCM proposal as an attempt to mitigate [Relying Party tracking](README.md#the-rp-tracking-problem) of users by means of [identifier correlation](https://w3c-fedid.github.io/FedCM#attack-scenarios-by-rp-cross-site-correlation). As traditional tracking mechanisms have become less accessible, a fallback method for following user activity across the web has been for web sites with account systems to correlate personal identifiers associated with each account. For example, all sites that require users to use email addresses as login identifiers can collude to uniquely identify a given user across all of those sites, and profile that user's full activity across them.

Conceptually, a directed identifer is a limited-scope identifier that has a one-way mapping from a user identifier that is known to an Identity Provider. The original identifier cannot practically be derived from the directed identifier by anyone other than the IdP or possibly the user.

Directed identifiers are equivalent to _persistent identifiers_ in the SAML 2.0 Core specification.

OpenID Connect has the notion of _pairwise subject identifiers_ which also correspond to directed identifiers.

# General implementation approaches
There are two straightforward ways of implementing directed identifiers for an IdP:
1. Generate a random string, and store it in a table keyed by the real identifier, or
2. Use a cryptographic hash function to make it one-way derivable from the original identifier.

The latter is used by [Shibboleth in its peristent identifier implementation](https://wiki.shibboleth.net/confluence/display/IDP30/PersistentNameIDGenerationConfiguration), and also described in [OpenID Connect for generating pairwise Subject Identifiers](https://openid.net/specs/openid-connect-core-1_0.html#PairwiseAlg).

# Directed identifiers in FedCM
While there exist examples of directed identifiers being used in closed identity systems, there are challenges to adapting them in a broad way to federated sign-in. The privacy goals of this project require that the entire ID token be directed, not just a single identifier field. For instance, the set of [OIDC standard Claims](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims) mostly contains fields that cannot exist in a token containing only directed identifiers, or else would have to contain random or obfuscated data.

## Essential fields
A minimal directed identifier token that could be suitable for most federated sign-in cases would contain a stable identifier (_sub_) and an email address (_email_). The _verified_email_ boolean would likely also be a part. The _sub_ can be trivially directed using either of the methods mentioned above. Providing a non-correlatable email address, however, requires an email aliasing or proxying system, and has constraints on its form due to the limitations of a valid email address.

Unfortunately the phone number field can be used in much of the world as a primary communication channel for RPs to users (via SMS), and does not lend itself to any kind of directedness due to the difficulty in imagining a proxying system. This is an open problem.

## Other fields
The remaining OIDC standard Claims have varying levels of value and usefulness in a directed scenario. Some, such as _website_ or _picture_ would have to be omitted or provide a generic non-identifying value. Others, such as _birthdate_, could conceivably be included even though it provides a degree of correlation. It is possible to imagine an entropy budget that FedCM could allow within a single token, outside of which the identifier is no longer considered directed.

There are also non-standard Claims sometimes included in some federated sign-in scenarios, which do not necessarily violate the directedness requirements. An example is an IdP with multiple subscriber levels, in a case where it is useful for an RP to know which subscriber level is associated with that user. Adding a few bits of information should be possible, though it is an open question how the user agent can know that this does not pose a tracking risk requiring additional user consent, especially if there are other non-essential fields present that might cumulatively create undirected entropy.

## Directed basic profile
This proposal defines the concept of a [directed basic profile](https://github.com/WICG/FedCM/blob/master/design.md#directed-basic-profile) which attempts to provide a set of directed fields that, when populated in a conforming way, can allow federated sign-in without risk of user tracking by identifier correlation. The precise definition of a directed basic profile is still a topic for discussion.

# User agent behavior
The value of a directed identifier is that a user agent can cooperate with it being passed from an IdP to an RP without having to attempt to acquire user consent for the tracking risk that is associated with correlatable identifiers. The precise shape of the user consent flow is discussed elsewhere in the FedCM proposal.

An important question, however, is how the user agent can be **confident** that the identifier that is being passed in not correlatable. It is an open question as to whether this should require technical enforcement on the part of the user agent.

## Policy-based approach
The simplest way for the user agent to obtain a degree of confidence in the directedness of the identifier is for the IdP to assert that all identifiers within the token are directed, via a mechanism defined by FedCM. Since the user has entrusted some amount of identifying data to the IdP, it might be reasonable to expect that the IdP acts in good faith with respect to that data and not falsely assert the identifier is directed. IdPs discovered to be acting in bad faith could be exposed to penalties, possibly including being added to a denylist by user agents which would prohibit them from using these APIs in future.

## Verifiably directed identifiers
A stricter approach is for FedCM to be prescriptive about the format of directed identifiers and require that they be verifiable by user agents in order to avoid tracking consent requirements. This could be done with a hashing scheme similar to what is used in Shibboleth or OpenID pairwise subject identifiers, where the IdP gives the user agent the inputs to a hash function and the output of the hash is included in the signed token. The user agent can then verify that the claim values in the token match the hashes, and therefore are not global identifiers.

The following is an example structure of such a scheme:
```
IDP_USER_ID = (general-purpose global identifier for a specific user within an IDP, possibly secret)
IDP_DIRECTED_ID_KEY = (secret IDP key for creating a set of special purpose IDs for directed identifiers; not per-user)
USER_DIRECTED_ID_SEED = SHA256( IDP_USER_ID + IDP_DIRECTED_ID_KEY )

CLIENT_ID = (value to identify a specific RP to which a token will be granted)
IDP_HOST_NAME = (host name associated with the Identity Provider service)
USER_DIRECTED_IDENTIFIER = `vdi://` + HEX2STRING( SHA256( USER_DIRECTED_ID_SEED + IDP_HOST_NAME + CLIENT_ID ) )
```
In the above example, `IDP_DIRECTED_ID_KEY` is a secret IDP key used to generate special purpose user IDs (`USER_DIRECTED_ID_SEED`) from general purpose user IDs (`IDP_USER_ID`). When an ID token is produced and given to the user agent, `USER_DIRECTED_ID_SEED` is also provided to the user agent. The user agent can verify that `USER_DIRECTED_IDENTIFIER` is correctly constructed has a hash of the three values.

For simplicity, `HEX2STRING` is assumed to return a string representation of the binary hash value. Other encodings might be appropriate.

The `vdi://` scheme establishes a namespace.

Verifiability of direected email addresses can be done in a similar fashion, where the email address is constructed as:
```
USER_DIRECTED_IDENTIFIER + '@idp.example.com'
```
Notably, colons are not legal characters in email addresses, so an encoding would need to be specified to make the address compliant with [RFC 5322](https://tools.ietf.org/html/rfc5322).

### Caveats of verifiably directed identifiers
One issue with this approach is that the inputs to the hash function have to be sufficiently **secret** and **high-entropy**. One problematic approach would be using the user's email address as an input to the hash, eg. `DirectedID = SHA256('abc@example.com' + 'idp.example.com' + 'rp.com')`. In that case, the RP could possibly acquire a large set of known email addresses (spam lists, for instance) and hash them forward to find any matches, effectively defeating the scheme. It is hard to for user agents to be confident that the underlying inputs to these hashes are satisfactory. This potential issue could be mitigated by adding a high-entropy salt as a hash input, although it then adds a requirement for the IdP to have to manage those.

A second problem is that verifiably directed identifiers are not compatible with the OIDC [authorization code flow](https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowAuth) and [hybrid flow](https://openid.net/specs/openid-connect-core-1_0.html#HybridFlowAuth) because in those cases there is server-to-server communication between the RP and the IdP, invisible to the user agent.

# Challenges
## IdP concerns
The primary concern for IdPs is development and deployment costs. Few commercial IdPs currently have any directed identifier implementations. Also this requires an email aliasing system (where IdPs are also email providers) or email proxying system that allowed emails sent to directed email addresses to be forwarded to users' real email addresses. This is expected to require substantial resource investments to deploy.

## RP concerns
The following is a list of concerns that we are aware of from RPs with being given directed identifiers during account sign-up and sign-in.

### Customer support
The majority of support flows require the support agent to validate the user identity and look up data related to that user in order to resolve the user’s issue. Users likely do not know any directed identifier values with RPs, though they could probably access them. Customer support flows could be adapted, but this would raise costs.

### Duplicate accounts
Duplicate accounts can be a significant source of user friction (e.g., missing history, missing features / access due to entitlements being account specific). This issue boils down to users not consistently using the IdP who minted the directed identifier for authentication. This can happen under a number of scenarios:
* User is signed out of IdP on the same browser instance and uses a login form or different IdP to authenticate on a return visit.
* User returns to a RP on a new browser instance and uses a login form or different IdP than what they used previously.
* User returns to the RP on a platform that does not support the IdP.

Note that these scenarios are possible in today’s world but are made worse by directed identifiers because email addresses cannot be used as a join key to prevent account duplication.

### Collaboration
Collaborative products rely on the ability for users to reference other users via an email address (e.g., adding a significant other as a collaborator to a list. E.g., AnyList).  A breaking scenario with directed identifiers is:
1. User A uses a directed email to sign up to the service.
2. User B tries to add User A as a collaborator on content X using their undirected email.
3. User A does not see content X in their account and potentially gets a confusing communication asking them to create an account (if the service provider has not seen that email in the past).

Another common example of this is social networks that help users connect to friends and colleagues using address books.

### Regulatory compliance
The claim has been made that relay emails may not be a reliable enough bar for contacting users for a variety of regulatory use-cases, including:
* Data breach laws that require data controllers to notify individuals in a timely manner (30-45 days) in the event of a data breach.
* Data access / deletion laws which require the RP to identify the user upon request for data access / deletion followed by timely execution (e.g., within 30 days).
* Laws requiring notices for Terms of Service / Privacy Policy changes.
* Notification to users related to copyright / trademark infringements (e.g., DMCA).

More investigation is needed, as it is unclear exactly what properties of relay emails create issues and whether these issues are meaningful from a regulator perspective.

## Enterprise use cases
This document is focused on consumer IdPs, and it is unclear whether an API that takes a prescriptive approach around directed identifiers would have any usefulness for enterprise identity systems.

# Prior art considered
* [Shibboleth](https://wiki.shibboleth.net/confluence/display/IDP30/PersistentNameIDGenerationConfiguration)
* [OpenID Connect Pairwise Subject Identifiers](https://openid.net/specs/openid-connect-core-1_0.html#SubjectIDTypes)
* Apple's [Hide My Email](https://support.apple.com/en-us/HT210425)
* Province of British Columbia [BCeID](https://www2.gov.bc.ca/gov/content/governments/services-for-government/information-management-technology/identity-and-authentication-services/bc-services-card-authentication-service/design-develop-test/solution-design/identity-attributes)
