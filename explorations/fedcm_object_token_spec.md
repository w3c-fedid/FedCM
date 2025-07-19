# FedCM Object Token Enhancement Proposal

## 1. Introduction

The Federated Credential Management (FedCM) API currently requires Identity Providers (IdPs) to return tokens as USVString values through the identity assertion endpoint. This requires serializing complex data structures to JSON strings, which Relying Parties (RPs) must then parse before use. This proposal extends the FedCM API to allow IdPs to return structured objects directly as tokens, improving developer experience while maintaining backward compatibility.

## 2. Background

Currently, IdPs must return tokens in this format:

`{ "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." }`

This requires IdPs to serialize complex objects into strings and RPs to parse these strings back into objects. 
With this new enhancement, IdPs can return objects directly:

```
{
  "object_token": {
    "sub": "1234567890",
    "name": "John Doe",
    "additional_claims": {
      "permissions": [
        "read",
        "write"
      ]
    }
  }
}
```

## 3. API Changes

This specification presents two alternative approaches for implementing object tokens.

### 3.1. Approach 1: Separate Attribute

The `IdentityCredential` interface is extended with a new `objectToken` attribute:

```
[ Exposed=Window, SecureContext ]
partial interface IdentityCredential
 // attribute for structured token data
 readonly attribute object? objectToken;
};
```

The `IdentityProviderToken` dictionary is extended to support object tokens:

```
dictionary IdentityProviderToken { 
required USVString token; 
any object_token; 
};
```
### 3.2. Approach 2: Union Type

As an alternative, the existing token attribute could use a union type:

```
[ Exposed=Window, SecureContext ]
interface IdentityCredential : Credential {
 // Use a union type instead of separate attributes
 readonly attribute (USVString or object) token;
};
```

The `IdentityProviderToken` dictionary changes:

```
dictionary IdentityProviderToken {
  required (USVString or object) token;
};
```

## 4. Behavioral Requirements

### 4.1. Browser Behavior

#### 4.1.1. For Separate Attribute Approach

1. When processing the identity assertion endpoint response:
   - If `token` is present in the response, set `IdentityCredential.token` to its value
   - If `object_token` is present in the response, set `IdentityCredential.objectToken` to the parsed object
   - If both are present, both attributes should be set accordingly
   - If neither is present but no error is reported, treat as an invalid response

2. For backwards compatibility:
   - When `object_token` is present but `token` is not, the browser MUST generate a string representation of the object and set it as `IdentityCredential.token`

#### 4.1.2. For Union Type Approach

1. When processing the identity assertion endpoint response:
   - If `token` is present in the response as a string, set `IdentityCredential.token` to that string value
   - If `object_token` is present in the response, set `IdentityCredential.token` to the parsed object
   - If both are present, prefer the object token over the string token
   - If neither is present but no error is reported, treat as an invalid response

2. For backwards compatibility:
   - When `object_token` is present but `token` is not, the browser MUST generate a string representation of the object and set it as `IdentityCredential.token`

### 4.2. Identity Provider Requirements

1. IdPs MAY return either:
   - A `token` property containing a string value
   - An `object_token` property containing a JSON object
   - Both properties (where `token` might, and might not, be a string representation of `object_token`)

2. If providing an `object_token`:
   - The value MUST be a valid JSON object
   - The object SHOULD follow standard token structures (e.g., JWT claims where applicable)
   - The object MAY contain nested objects and arrays

### 4.3. Relying Party Behavior

#### 4.3.1. For Separate Attribute Approach

RPs SHOULD check for the existence of `objectToken` before falling back to `token`

```const supportsObjectTokens = 'objectToken' in IdentityCredential.prototype;```

#### 4.3.2. For Union Type Approach

RPs SHOULD check the type of the token to determine how to handle it:

```const isObjectToken = typeof credential.token === 'object' && credential.token !== null;```

## 5. Implementation Guidelines

### 5.1. Feature Detection (Separate Attribute)

```
if ('objectToken' in IdentityCredential.prototype) { 
// Object tokens are supported 
} else { 
// Fall back to string tokens 
}
```

### 5.2. Feature Detection (Union Type)

```
async function getCredential() {
  const credential = await navigator.credentials.get({
    identity: { providers: [{ configURL: 'https://idp.example/fedcm.json' }] }
  });
  
  const isObjectToken = typeof credential.token === 'object' && credential.token !== null;
  return { credential, isObjectToken };
}
``` 

### 5.3. Handling Both Token Types (Separate Attribute)

```
const credential = await navigator.credentials.get({
  identity: {
    providers: [
      {
        configURL: 'https://idp.example/fedcm.json',
        clientId: 'client123'
      }
    ]
  }
});

let userData;

if (credential.objectToken) {
  // Use structured token data directly
  userData = credential.objectToken;
} else {
  try {
    // Attempt to parse the token as JSON
    userData = JSON.parse(credential.token);
  } catch {
    // If parsing fails, treat it as an opaque token
    userData = { token: credential.token };
  }
}
```

### 5.4. Handling Both Token Types (Union Type)

```
const credential = await navigator.credentials.get({
  identity: {
    providers: [{ configURL: 'https://idp.example/fedcm.json' }]
  }
});

let userData;
if (typeof credential.token === 'object' && credential.token !== null) {
  // Use structured token data directly
  userData = credential.token;
} else {
  try {
    // Attempt to parse the token as JSON
    userData = JSON.parse(credential.token);
  } catch {
    // If parsing fails, treat it as an opaque token
    userData = { token: credential.token };
  }
}
```

## 6. Examples

### 6.1. Identity Provider Implementation

```
app.post('/token', (req, res) => {
  // Authenticate request and generate token data
  const userData = {
    sub: "user123",
    name: "Jane Doe",
    email: "jane@example.com",
    groups: ["users"],
    exp: Math.floor(Date.now() / 1000) + 3600 // Token expires in 1 hour
  };

  // Return structured object directly
  res.json({
    object_token: userData,

    // Optional: also include string version for backwards compatibility
    token: JSON.stringify(userData)
  });
});
```

### 6.2. Relying Party Implementation (Separate Attribute)

```
// Request credentials 
const credential = await navigator.credentials.get({
  identity: {
    providers: [
      {
        configURL: 'https://idp.example/fedcm.json',
        clientId: 'client123'
      }
    ]
  }
});

// Check if object tokens are supported
if (credential.objectToken) {
  console.log(`Hello ${credential.objectToken.name}!`);

  // Access nested properties directly
  if (credential.objectToken.groups?.includes('admin')) {
    showAdminInterface();
  }

} else {
  // Legacy handling with string token
  const parsedToken = parseJwt(credential.token);
  console.log(`Hello ${parsedToken.name}!`);
}
```

### 6.3. Relying Party Implementation (Union Type)

```
// Request credentials 
const credential = await navigator.credentials.get({
  identity: {
    providers: [
      {
        configURL: 'https://idp.example/fedcm.json',
        clientId: 'client123'
      }
    ]
  }
});

// Check if we received an object token
if (typeof credential.token === 'object' && credential.token !== null) {
  console.log(`Hello ${credential.token.name}!`);

  // Access nested properties directly
  if (credential.token.groups?.includes('admin')) {
    showAdminInterface();
  }
} else {
  // Legacy handling with string token
  const parsedToken = parseJwt(credential.token);
  console.log(`Hello ${parsedToken.name}!`);
}
```

## 7. Migration Path

For a smooth transition period, both IdPs and RPs should support both token formats:

- IdPs should consider providing both `token` and `object_token` properties during the transition
- RPs should implement graceful degradation when `objectToken` is not available
- RPs using older browsers should continue to work with IdPs that only provide `object_token`, due to the automatic string representation fallback

## 8. Comparison of Approaches

| **Aspect**               | **Separate Attribute**                                                                 | **Union Type**                                                                 |
|--------------------------|----------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| **API Design**           | Offers a more explicit and clearly separated structure                                | Provides a more elegant and unified representation                            |
| **Backward Compatibility** | Safer approach—existing code continues to function without modification               | Riskier—may require changes due to altered property types                     |
| **Feature Detection**    | Enables simple checks based on the presence of specific properties                    | Requires more complex type checking logic                                     |
| **Developer Experience** | Developers need to check multiple properties, which may increase complexity           | Simplifies usage by consolidating logic into a single property with type checks |
| **Future Extensibility** | Easier to introduce additional token formats by adding new properties                 | More challenging to extend due to the constraints of a unified structure      |
| **Performance**          | Slightly more overhead due to multiple property accesses                              | Potentially more efficient with a single property access                      |