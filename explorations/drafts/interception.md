# Navigation Interception API

## Problem Statement

The mechanism that enables federation today is largely based on using  top level redirects to allow websites to communicate with one another. As an oversimplification, there is a convention (typically, OAuth and SAML) that allows a requesting website (called a Relying Party) to request the user’s identity from another website (called an identity provider) by redirecting the user to the identity provider’s website (using well-defined URL parameters) and then back to the relying party (using, again, well defined URL parameters) to communicate requests/responses.

For example, take [chatgpt.com](http://chatgpt.com/) for example: a user clicks on “Continue with Google”, which redirects the user to [google.com](http://accounts.google.com/) (with a well-defined set of URL parameters, including, notably, a “redirect_uri” that tells where to redirect the user at the end of the flow) which asks for the user’s permission to share their identity to [chatgpt.com](http://chatgpt.com/) and then redirects (using the “redirect_uri” specified before) the user back to [chatgpt.com](http://chatgpt.com/) with the user’s identity in it (e.g. with a well-defined URL parameter called “code”).

![Image](https://github.com/user-attachments/assets/815503d7-5c21-4a69-b61f-7802be90428c)

When RPs embed JS SDKs that IdPs can re-deploy, migrating the traffic becomes much easier, because just changing the JS SDK can deploy FedCM to many RPs. 

For example, here is part of the federation traffic migrated to FedCM which isn’t using redirect flows, but rather rely on updating JS SDKs that an Identity Provider controls live on a Relying Party, in this case https://pinterest.com.

![Image](https://github.com/user-attachments/assets/244ab21a-7064-48f7-9e1b-aa58a36c6279)

In redirect flows, however, RPs directly navigate the user to the Identity Provider’s OAuth authorization endpoint without any opportunity for the IdP to tell the browser that this is a FedCM flow through JS calls.

Redirect flows account for the vast majority of the deployment of federation at large, so really important to be able to be migrated at scale.

One trivial answer to this problem is to ask every website in the world to change and call FedCM instead (when the corresponding IdP supports it), but that’s intractable based on the scale of the number of Relying Parties.

So, the problem is: how might an IdP migrate redirect flows without requiring changes to Relying Parties?
