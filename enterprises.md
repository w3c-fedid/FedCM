---
title: Enterprise Single Sign-on
description: Observations around the applicability of this project to enterprise identity use cases.
---

# Enterprise Single Sign-on
[Enterprises](glossary.md#enterprise-context) commonly rely on identity federation to enable Single sign-on in web applications. Here is a typical example:

1. Sign-in to https://corporation.com with your corporate credentials.
1. Buy stuff with your corporate credit card.
1. Go to report expenses on https://www.expenses-sass.com/.
1. Sign-in with your corporate account on expenses-sass.
1. Report expenses tied to your corporate account.

Unfortunately, step (4) depends on primitives that are being restricted as a result of cross-site user tracking on the web; in particular, third-party cookies, link decoration on cross-site navigations and cross-site postMessage.

The problem is essentially the same as the [general federated identity problem](README.md#the-problem) that WebID is aiming to address, but for several reasons an API designed for consumer use cases on the open web might be a poor fit for enterprises. These include:
* Enterprises can use a wider variety of protocols and implementations.
* User tracking is often not a concern, reducing or eliminating consent requirements.
* System administrators can have control over clients, services, or both.

This document explores some of the open questions and possible solutions in this area.

# First Party Sets

[First Party Sets](https://github.com/WICG/first-party-sets)(FPS) is a proposal for a mechanism that would allow user identity to span related origins, where consistent with privacy requirements. However, the intent of FPS is to bundle origins within a unified organization. For example, https://google.com, https://google.co.uk, and https://youtube.com are owned by the same entity, as are https://apple.com and https://icloud.com, or https://amazon.com and https://amazon.de.

From the earlier example, it is clear that https://corporation.com and https://www.expenses-sass.com/ are not owned by the same organization, but rather a contracted service provided by two different organizations. This breaks from the FPS model and is likely to have undesirable consequences.

# Enterprise Policies

Most browsers implement some form of policy-based controls that system administrators can use to configure settings on enterprise devices for the purposes of interoperability, security and IT support.

It is possible to add enterprise policies that enable administrators to control browser privacy interventions for specific sets of origins. Two approaches come from this:
1. Administrators can exempt specific sites or origins from the privacy controls that make WebID necessary, such as third party cookie restrictions.
2. Administrators can configure WebID settings so that some sites or origins can call the API without any user permission prompts appearing.

For example, corporation.com could have an enterprise policy setting accounts.corporation.com as the IDP, which would allow things like https://www.expenses-sass.com and https://www.vacations-sass.com to pass through but disallow other unintended origins.

One problem with this is that enterprises do not always manage all devices that are allowed to connect to their resources (e.g. Bring-Your-Own-Device hardware policies), so there might be cases where default consumer behavior is still relevant.

Also, enterprise controls are discretionary by browser developers and are not typically a part of web standards.
