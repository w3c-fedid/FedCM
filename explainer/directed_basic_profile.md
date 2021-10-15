---
layout: "default"
---

# Directed Basic Profile

The data that is exchanged is designed to be consequence-free: minimize as much as possible the disclosure of information between IDPs and RPs while keeping it (a) viable for signing-in/signing-up and (b) backwards compatible.

For backwards compatibility, we use a restrictive subset of OpenId's [standard claims](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims), namely:

| field          | description                                                                   |
|----------------|-------------------------------------------------------------------------------|
| iss            | The issuer, per the OpenID specification                                      |
| aud            | The intended audience, per the OpenId specification                           |
| iat            | The creation time, per the OpenId specification                               |
| exp            | The expiration time, per the OpenId specification                             |
| sub            | The user's directed user ids (rather than global user ids)                    |
| email          | The user's email directed addresses (rather than global)                      |
| email_verified | Whether the email is verified or not                                          |
| profile        | static/guest/global/default profile pictures / avatars                        |
| name           | directed names (e.g. initials, just first names, etc)                         |

By consequence-free, we mean that the data that is exchanged at this stage isn't able to be joined across RPs. By minimally viable and backwards-compatible we mean that it is sufficient for authentication and could be used without RPs changing their servers.
