# Proposals

This is a directory with the proposals to extend FedCM that we are actively working on:


1. **[The IdP Sign-in Status API](https://fedidcg.github.io/FedCM/#the-idp-sign-in-status-api)**
    - Stage: prototype
    - Champions: @cbiesinger, @bvandersloot-mozilla
    - Description: addresses the timing attack problem described [here](https://github.com/fedidcg/FedCM/issues/230#issuecomment-1233290946)
1. **[The Multi-IdP API](https://github.com/fedidcg/FedCM/issues/319#issuecomment-1270753874)**
    - Stage: prototype
    - Champions: @npm1, @tttzach, @bvandersloot-mozilla
    - Description: allows the account chooser to contain multiple IdPs as described [here](https://github.com/fedidcg/FedCM/issues/319)
1. **The Iframe API**
    - Stage: devtrial
    - Champions: @yi-gu
    - Description: allows IdPs to call the FedCM API from iframes
1. **[The Metrics API](https://github.com/fedidcg/FedCM/issues/352)**
    - Stage: draft
    - Champions: @yi-gu
    - Description: allows IdPs to monitor the performance of IdP in a privacy-preserving manner
1. **The User Info API**
    - Stage: draft
    - Champions: @yi-gu
    - Description: allows IdPs to get the logged-in user information to personalize buttons
1. **The Revocation API**
    - Stage: draft
    - Champions: @yi-gu
    - Description: allows an RP to indicate to the IdP that the user is interested in unregistering
1. **The Auto Sign-in API**
    - Stage: draft
    - Champions: @yi-gu
    - Description: allows a user to get automatically signed-in across devices after the browser has observed the sign-up
1. **[The Context API](context-api.md)**
    - Stage: draft
    - Champions: @samuelgoto
    - Description: allows an RP to specify and customize the context of the FedCM prompt
1. ... add yours below with the template ...
1. **[Your API](yours.md)**
    - Stage: draft > interest > prototype > devtrial > origin trial > launch
    - Champions: @you
    - Description: does this awesome thing!

# Stages

We are still trying to figure out what are the most meaningful stages a proposal goes through and what's the entrance criteria for each, but as an early approximation here is a starting point:

`draft` > `interest` > `prototype` > `devtrial` > `origin trial` > `launch`

Anyone can create `draft`s, here, in bugs or in personal repos.

# Champions

Anyone can be champion, and is encouraged to. Champions (or, frequently "champion groups" of several members) are authors and editors of proposals. The champion is responsible for the evolution of the proposal, at which point maintenance transfers to the editor group. Champions have admin permissions in the proposal repository and can freely make changes within this repository. Periodically, champions may bring their proposal guidance, for consensus on stage advancement.

> This is more or less based on the good parts of TC39's Process [here](https://tc39.es/process-document/).
