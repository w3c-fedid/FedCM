# FedCM nonce Parameter Deprecation Proposal

## 1. Introduction

The Federated Credential Management (FedCM) API currently allows Identity Providers (IdPs) to specify a `nonce` parameter as a top-level field in the provider configuration object. This proposal proposes deprecating this top-level parameter and moving it to the `params` object, which is the intended location for all IdP-specific parameters. This change will improve API consistency while maintaining backward compatibility during a transition period.

## 2. Background

Currently, when making a FedCM API call, the `nonce` parameter is specified as a direct property of the provider object:

```js
let {token} = await navigator.credentials.get({
  identity: {
    providers: [{
      clientId: "1234",
      nonce: "234234",    // Top-level parameter 
      loginHint: "previous@user.com",
      configURL: "https://idp.example/fedcm.json",
      // A string with parameters that need to be passed from the
      // RP to the IdP but that don't really play any role with
      // the browser.
      params: {
        "IDP_SPECIFIC_PARAM": "1",
        "foo": "BAR",
        "ETC": "MOAR",
        "response_type": "id_token",
        "scope": "photos:read photos:write",
      }
    },
  }
  // If possible, return without prompting the user, if not possible
  // prompt the user.
  mediation: "optional",
});
```

The `nonce` value is used when constructing token requests to the IdP's assertion endpoint to prevent replay attacks. However, this approach creates inconsistency in the API design, as other IdP-specific parameters are grouped in the `params` object.

## 3. API Changes

### 3.1. Parameter Location Changes

The `nonce` parameter should be moved from the top level of the identity provider configuration to the `params` object:

#### Current usage:
```js
{ 
  clientId: "1234", 
  nonce: "234234",  // Top-level parameter 
  configURL: "https://idp.example/fedcm.json", 
  params: { 
   "response_type": "id_token", 
   "scope": "photos:read"
  }
}
```

#### New usage:
```js
{ 
  clientId: "1234", 
  configURL: "https://idp.example/fedcm.json", 
  params: { 
   "nonce": "234234",  // Moved into params
   "response_type": "id_token", 
   "scope": "photos:read"
  }
}
```

## 4. Behavioral Requirements

### 4.1. Browser Behavior

1. During a transition period, the browser MUST:
   - First, check for `nonce` in the `params` object
   - Fall back to the top-level `nonce` parameter if not found in `params`
   - Show a deprecation warning in developer tools when the top-level parameter is used

2. After the transition period, the browser:
   - MAY reject requests that use the top-level `nonce` parameter
   - SHOULD continue to show deprecation warnings until the parameter is fully removed

3. When constructing token requests to the IdP:
   - Use the `nonce` from `params` if available
   - Use the top-level `nonce` as fallback during transition
   - Pass the `nonce` value to the assertion endpoint as before

### 4.2. Identity Provider Requirements

IdPs are unaffected by this change as the browser will continue to send the `nonce` parameter to the assertion endpoint in the same format.

### 4.3. Relying Party Requirements

1. Relying Parties SHOULD update their code to place the `nonce` parameter in the `params` object
2. During the transition period, RPs can continue to use the top-level parameter, though they will receive deprecation warnings

## 5. Implementation Guidelines

### 5.1. Browser Implementation

The browser should modify the token request generation code to extract the `nonce` from the `params` object when available.

### 5.2. Relying Party Migration

Relying Parties should update their code to use the new parameter location:

// Before 
```js
navigator.credentials.get({
  identity: {
    providers: [{
      clientId: "1234",
      nonce: "234234",    // // Old location
      loginHint: "previous@user.com",
      configURL: "https://idp.example/fedcm.json",
      // A string with parameters that need to be passed from the
      // RP to the IdP but that don't really play any role with
      // the browser.
      params: { /* ... */ } }] }
    },
  }
  mediation: "optional",
});
```

// After 
```js
navigator.credentials.get({
  identity: {
    providers: [{
      clientId: "1234",
      loginHint: "previous@user.com",
      configURL: "https://idp.example/fedcm.json",
      params: {  
	   nonce: "234234",   // New location 
	   /* ... */ 
	  } }] }
    },
  }
  mediation: "optional",
});
```
 
## 6. Examples

### 6.1. Relying Party Implementation with New Format

// Request with nonce in params object 
```js
let credential = await navigator.credentials.get({
  identity: {
    providers: [{
      clientId: "1234",
      loginHint: "previous@user.com",
      configURL: "https://idp.example/fedcm.json",
      params: {
        nonce: generateSecureNonce(),
       /* ... */ 
      }
    },
  }
  mediation: "optional",
});
```

### 6.2. Identity Provider Implementation (Unchanged)

The IdP implementation remains unchanged as the browser will continue to pass the `nonce` parameter to the token endpoint in the same format.

## 7. Migration Path

### Phase 1: Support Both Formats with Deprecation Warning

- Browser supports both parameter locations
- Top-level usage triggers a warning in developer tools
- Recommended format is documented in browser developer documentation

### Phase 2: Elevate Warning to Error

- Warning is upgraded to an error-level message
- Both formats continue to work to maintain compatibility
- Documentation is updated to indicate future removal of top-level support

### Phase 3: Remove Support for Top-level Parameter

- Support for the top-level `nonce` parameter is removed
- Only the `params`-based approach continues to work
- Full removal date is communicated well in advance

## 8. Security Considerations

This change maintains the security properties of the `nonce` parameter. The value will continue to be used for the same security purpose (preventing replay attacks) regardless of its location in the API.

## 9. Privacy Considerations

There are no privacy implications from this change as it only affects the structure of the API, not its functionality or data handling.

## 10. Compatibility Considerations

This change follows a gradual deprecation process to ensure backward compatibility:
- During the transition period, both parameter locations will function correctly
- Deprecation warnings provide developers time to update their code
- The clear migration path allows for a smooth transition to the new format