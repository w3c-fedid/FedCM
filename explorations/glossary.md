# Glossary

Below is a list of definitions for important terms in common use related to FedCM. Many of the definitions are intended to match existing terms in identity standards, in some cases adapted and constrained for relevance in the context of FedCM.

This document is continually evolving. Feedback is welcome.

## Definitions
### Authentication
* _Process used by an [Identity Provider](#identity-provider-idp) to achieve sufficient confidence in the binding between the user and a presented identity._

Note that in some discussions and documentation, the term _authentication_ is used to refer to the federated sign-in process. However, the user does not authenticate to the RP during federated sign-in. The user authenticates to the IdP, which then provides a claim to the RP asserting the user’s identity. The user does not prove their identity to the RP directly.

External references: [OIDC terminology](https://openid.net/specs/openid-connect-core-1_0.html#Terminology), [OIDC authentication](https://openid.net/specs/openid-connect-core-1_0.html#Authentication), [SAML glossary](https://docs.oasis-open.org/security/saml/v2.0/saml-glossary-2.0-os.pdf)


### Authorization
* _Process used by a [Relying Party](#relying-party-rp) to obtain access grants to information or capabilities for the user on an [Identity Provider](#identity-provider-idp)._

References: [OAuth 2.0](https://tools.ietf.org/html/rfc6749), [SAML glossary](https://docs.oasis-open.org/security/saml/v2.0/saml-glossary-2.0-os.pdf)


### Browser-mediated
* _The property of data flows between a [Relying Party](#relying-party-rp) and an [Identity Provider](#identity-provider-idp) being forced through channels that are visible to and controllable by the [user agent](#user-agent)._


### Ceremony
* _A protocol that includes both network data flows and user interaction for the purpose of achieving [authentication](#authentication), [authorization](#authorization) or [sign-in](#federated-sign-in)._

References: [WebAuthn glossary](https://www.w3.org/TR/webauthn/#ceremony)


### Consent
* _A part of a [ceremony](#ceremony) that comprises a user interaction with a clear [user agent-controlled](#user-agent) UI element that can be taken to mean the user accepts privacy risk that has been explained in accompanying text, and the ceremony may proceed accordingly._


### Claim
* _A piece of information asserted by an [Identity Provider](#identity-provider-idp) about a user._

References: [OIDC terminology](https://openid.net/specs/openid-connect-core-1_0.html#Terminology)


### Consumer (context)
* _Category of use cases that apply generally to publicly-accessible [Relying Parties](#relying-party-rp) and [Identity Providers](#identity-provider-idp)._


### Directed basic profile
* _A set of [claims](#claim) that is a restricted subset of [OpenID standard claims](#standard-claims) that satisifes the restriction to be a [directed identifier](#directed-identifier)._

This term is novel in FedCM and its details could be subject to change.


### Directed identifier
* _A [claim](#claim) granted to a [Relying Party](#relying-party-rp) by an [Identity Provider](#identity-provider-idp) that constitutes an [identifier](#identifier) for the user but cannot be correlated with other identifiers granted to different Relying Parties._


### Enterprise (context)
* _Category of use cases that apply to private restricted-access [Relying Parties](#relying-party-rp) and [Identity Providers](#identity-provider-idp), in particular where organizations can have provisioning capabilities over [user agents](#user-agent). This typically encompasses use cases of corporations, institutions, or government agencies._


### Federated sign-in
* _Process used by a [Relying Party](#relying-party-rp) to obtain a user [identifier](#identifier) from an [Identity Provider](#identity-provider-idp) to which the user has [authenticated](#authentication)._

References: [OIDC](https://openid.net/specs/openid-connect-core-1_0.html)


### Identifier
* _A [claim](#claim) or set of claims that comprises a unique mapping to a user within a given scope, such as for a particular [Relying Party](#relying-party-rp)._

References: [SAML glossary](https://docs.oasis-open.org/security/saml/v2.0/saml-glossary-2.0-os.pdf)


### Identity Provider (IDP)
* _A service that has information about the user and can grant that information to [Relying Parties](#relying-party-rp)._

References: [OIDC terminology](https://openid.net/specs/openid-connect-core-1_0.html#Terminology)


### Identity Provider backwards compatibility
* _The property of a [federated sign-in](#federated-sign-in) and [authorization](#authorization) design that would allow deployment by [Identity Providers](#identity-provider-idp) who use existing standardized federation flows without them having to modify their services._


### Identity Provider blindness
* _The property of the [Identity Provider](#identity-provider-idp) not being aware of the specific [Relying Party](#relying-party-rp) through all or part of a [ceremony](#ceremony)._


### IDP tracking
* _A privacy threat in which an [Identity Provider](#identity-provider-idp) is able to surveil or correlate user activity across the web._

References: [FedCM Threat Model](https://w3c-fedid.github.io/FedCM/#idp-intrusion)


### Relying Party (RP)
* _A service that requests user information from an [Identity Provider](#identity-provider-idp) for user account [sign-in](#federated-sign-in) or for other purposes._

References: [OIDC terminology](https://openid.net/specs/openid-connect-core-1_0.html#Terminology), [SAML glossary](https://docs.oasis-open.org/security/saml/v2.0/saml-glossary-2.0-os.pdf)


### Relying Party backwards compatibility
* _The property of a [federated sign-in](#federated-sign-in) and [authorization](#authorization) design that would allow deployment by [Relying Parties](#relying-party-rp) who use existing standardized federation flows without them having to modify their web properties or account systems. This particularly applies to RPs that import scripts from [Identity Providers](#identity-provider-idp) to implement federation._


### Relying Party blindness
* _The property of the [Relying Party](#relying-party-rp) not having access to a correlatable [identifier](#identifier) (i.e. an identifier that is not a [directed identifier](#directed-identifier)) in a [federated sign-in](#federated-sign-in) [ceremony](#ceremony)._


### RP tracking
* _A privacy threat in which a [Relying Party](#relying-party-rp) is able to surveil or correlate user activity across the web._

References: [FedCM Threat Model](https://w3c-fedid.github.io/FedCM/#rp-fingerprinting)


### Standard claims
* _A predefined set of [claims](#claim) that are included in a standard OIDC request for the purpose of user identification._

This term is defined as a part of the OpenID Connect specification. The use of this term in FedCM refers to the OIDC definition.

References: [OIDC](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims)


### Verifiably directed identifier
* _A [directed identifier](#directed-identifier) that has the property that the [user agent](#user-agent) is able to validate that it is directed._


### User agent
* _Client software such as a web browser that renders web content and can implement FedCM._
