 FedCM Object Token Enhancement Proposal

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

### 3.1. IDL Changes

The `IdentityCredential` interface is extended with a new `objectToken` attribute:

```
[ Exposed=Window, SecureContext, RuntimeEnabled=FedCm ]
interface IdentityCredential : Credential { 
// Existing attribute for backwards compatibility 
readonly attribute USVString token;

// New attribute for structured token data
[RuntimeEnabled=FedCmObjectToken] readonly attribute object? objectToken;
};
```

The `IdentityProviderToken` dictionary is extended to support object tokens:

```
dictionary IdentityProviderToken { 
required USVString token; 
any object_token; 
};
```

### 3.2. Network Protocol Changes

The identity assertion endpoint response format is extended to support an `object_token` field:

#### Existing format (maintained for backwards compatibility):
'{ "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." }'


#### New format (allows direct object return):
```
{
  "object_token": {
    "sub": "1234567890",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "additional_data": {
      "permissions": [
        "read",
        "write"
      ],
      "groups": [
        "users",
        "premium"
      ]
    }
  }
}
```

## 4. Behavioral Requirements

### 4.1. Browser Behavior

1. When processing the identity assertion endpoint response:
   - If `token` is present in the response, set `IdentityCredential.token` to its value
   - If `object_token` is present in the response, set `IdentityCredential.objectToken` to the parsed object
   - If both are present, both attributes should be set accordingly
   - If neither is present but no error is reported, treat as an invalid response

2. For backwards compatibility:
   - When `object_token` is present but `token` is not, the browser MUST generate a string representation of the object and set it as `IdentityCredential.token`
   - This string representation MUST be valid JSON of the object

3. The browser MUST NOT expose the `objectToken` attribute when the `FedCmObjectToken` feature flag is disabled

### 4.2. Identity Provider Requirements

1. IdPs MAY return either:
   - A `token` property containing a string value
   - An `object_token` property containing a JSON object
   - Both properties (where `token` might be a string representation of `object_token` or a different value)

2. If providing an `object_token`:
   - The value MUST be a valid JSON object
   - The object SHOULD follow standard token structures (e.g., JWT claims where applicable)
   - The object MAY contain nested objects and arrays

3. Content Type Requirements:
   - The response MUST use a JSON-compatible Content-Type (e.g., `application/json`)

### 4.3. Relying Party Behavior

1. RPs SHOULD check for the existence of `objectToken` before falling back to `token`
2. RPs SHOULD implement appropriate feature detection:

`const supportsObjectTokens = 'objectToken' in IdentityCredential.prototype;`

## 5. Implementation Guidelines

### 5.1. Feature Detection

```
if ('objectToken' in IdentityCredential.prototype) { 
// Object tokens are supported 
} else { 
// Fall back to string tokens 
}
```

### 5.2. Handling Both Token Types

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
  }
}
```

## 6. Examples

### 6.1. Identity Provider Implementation

// IdP token endpoint handler 
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

### 6.2. Relying Party Implementation

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

## 7. Migration Path

For a smooth transition period, both IdPs and RPs should support both token formats:

- IdPs should consider providing both `token` and `object_token` properties during the transition
- RPs should implement graceful degradation when `objectToken` is not available
- RPs using older browsers should continue to work with IdPs that only provide `object_token`, due to the automatic string representation fallback