# Structured Data Support in FedCM

## Summary

This document describes improvements to FedCM's token handling to support structured data types beyond strings, addressing developer ergonomics concerns raised by Identity Providers (IDPs) who want to return rich, structured data to Relying Parties (RPs).

## Problem Statement

Currently, FedCM restricts token data to string types at multiple points in the flow:

1. **ID assertion endpoint response**: The `token` field must be a string
2. **IdentityProvider.resolve() parameter**: Only accepts string types  
3. **IdentityCredential.token property**: Limited to string values

This limitation forces IDPs and RPs to manually serialize and deserialize JSON data, creating unnecessary developer friction and reducing the ergonomic appeal of FedCM compared to existing federation solutions.

## Proposed Solution

Allow the `token` field to accept any valid JSON type (`any`) instead of restricting it to strings, providing native support for structured data throughout the FedCM flow.

### Changes

#### 1. ID Assertion Endpoint Response

**Before:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**After:**
```json
{
  "token": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "def50200f3d5b...",
    "expires_in": 3600,
    "token_type": "Bearer",
    "scope": ["openid", "profile", "email"],
    "user_info": {
      "sub": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

#### 2. IdentityProvider.resolve() Parameter Type

**Before:**
```typescript
interface IdentityProvider {
  resolve(token: string): Promise<IdentityCredential>;
}
```

**After:**
```typescript
interface IdentityProvider {
  resolve(token: any): Promise<IdentityCredential>;
}
```

#### 3. IdentityCredential.token Property Type

**Before:**
```typescript
interface IdentityCredential {
  readonly token: string;
  // ... other properties
}
```

**After:**
```typescript
interface IdentityCredential {
  readonly token: any;
  // ... other properties
}
```

### Example Usage

IDPs can now return structured tokens directly:

```javascript
// IDP endpoint response
{
  "token": {
    "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "metadata": {
      "issuer": "https://accounts.example.com",
      "audience": "https://rp.example.com",
      "expires_at": 1640995200
    },
    "claims": {
      "sub": "user123",
      "email": "user@example.com",
      "roles": ["user", "premium"]
    }
  }
}
```

RPs receive the structured data without manual parsing:

```javascript
const credential = await navigator.credentials.get({
  identity: {
    providers: [{
      configURL: "https://accounts.example.com/.well-known/web-identity",
      clientId: "rp-client-id"
    }]
  }
});

// Direct access to structured data
const jwt = credential.token.jwt;
const userRoles = credential.token.claims.roles;
const expiresAt = new Date(credential.token.metadata.expires_at * 1000);
```

## Privacy and Security Considerations

### Privacy Impact

**No additional privacy risks** are introduced by this change because:

- The data being transmitted remains the same
- Only the format/type of the data changes (from stringified JSON to native JSON)
- IDPs and RPs can already exchange structured data by serializing/deserializing manually
- No new tracking vectors are created

### Security Impact

**No additional security risks** are introduced because:

- The same data validation and sanitization practices apply regardless of format
- User agents already handle JSON parsing securely
- No new attack surfaces are created
- Existing token validation mechanisms remain applicable