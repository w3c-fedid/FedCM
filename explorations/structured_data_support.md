# Structured Data Support in FedCM

**Authors:**
Suresh Potti (sureshpotti@microsoft.com)

## Participate

Feature request: https://issues.chromium.org/346567168  
FedCM Spec: https://w3c-fedid.github.io/FedCM

## Table of Contents

- [Summary](#summary)
- [Problem Statement](#problem-statement)
- [Proposed Solution](#proposed-solution)
  - [Changes](#changes)
  - [Example Usage](#example-usage) 
- [Design Decisions](#design-decisions)
  - [Why Not a Separate Field/Property?](#why-not-a-separate-fieldproperty)
  - [Why Not a Type Indicator Attribute?](#why-not-a-type-indicator-attribute)
  - [Compatibility Risk with Existing IDPs](#compatibility-risk-with-existing-idps)
  - [Why Not Support Both Formats in the Payload?](#why-not-support-both-formats-in-the-payload)
- [Benefits](#benefits)
  - [For Identity Providers](#for-identity-providers)
  - [For Relying Parties](#for-relying-parties)
  - [For the Ecosystem](#for-the-ecosystem)
- [Considered Alternatives](#considered-alternatives)
  - [Alternative 1: Do Nothing](#alternative-1-do-nothing)
  - [Alternative 2: Separate Structured Data Field](#alternative-2-separate-structured-data-field)
  - [Alternative 3: Type Indicator with Dual Fields](#alternative-3-type-indicator-with-dual-fields)
  - [Alternative 4: Content Negotiation](#alternative-4-content-negotiation)
- [Privacy and Security Considerations](#privacy-and-security-considerations)
  - [Privacy Impact](#privacy-impact)
  - [Security Impact](#security-impact)
  - [Implementation Security](#implementation-security)
- [Implementation Considerations](#implementation-considerations)
  - [Backward Compatibility](#backward-compatibility)
  - [Size Considerations](#size-considerations)
  - [Compatibility Validation](#compatibility-validation)
- [Examples](#examples)
  - [OAuth 2.0 Token Response](#oauth-20-token-response)
  - [OpenID Connect with Custom Claims](#openid-connect-with-custom-claims)
  - [Enterprise Token with Metadata](#enterprise-token-with-metadata)
  - [Migration Example: Backward Compatible RP](#migration-example-backward-compatible-rp)
- [Specification Changes](#specification-changes)
  - [WebIDL Changes](#webidl-changes)
  - [HTTP API Changes](#http-api-changes)

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

## Design Decisions

### Why Not a Separate Field/Property?

**Question**: Why isn't this being proposed as a separate field alongside the existing `token` field?

**Analysis**: We considered adding a new `structured_token` or `token_data` field while keeping the existing string `token` field, but rejected this approach for several reasons:

**Cons of separate field approach**:
- **API complexity**: Having two token fields (`token` and `structured_token`) creates confusion about which field to use and when
- **Duplication concerns**: IDPs might feel compelled to populate both fields, leading to redundant data transmission
- **Inconsistent adoption**: The ecosystem could fragment between implementations using different fields
- **Developer confusion**: RPs would need logic to check multiple fields and determine precedence
- **Maintenance burden**: Two parallel token handling paths increase implementation complexity

**Benefits of unified approach**:
- **Single source of truth**: One token field eliminates ambiguity
- **Cleaner API**: Simpler interface with fewer concepts to understand
- **Natural migration**: IDPs can evolve from strings to structured data seamlessly
- **Type system alignment**: `any` type naturally encompasses both strings and objects

### Why Not a Type Indicator Attribute?

**Question**: Why not add another attribute to indicate which sort of payload this is?

**Analysis**: We considered adding a `token_type` or `token_format` field to explicitly indicate whether the token is a string or structured data, but determined this was unnecessary:

**Cons of type indicator approach**:
- **Runtime overhead**: Requires additional field parsing and validation
- **JSON already self-describing**: JSON types are inherently detectable at runtime
- **Additional complexity**: More fields to specify, validate, and maintain
- **Fragility**: Risk of mismatched type indicators and actual data

**Why it's unnecessary**:
- **Type detection**: `typeof` checks can easily distinguish strings from objects
- **JSON parsing**: Standard JSON parsing already handles type detection
- **Backward compatibility**: String tokens work naturally without indicators
- **Runtime flexibility**: RPs can adapt behavior based on actual data type received

```javascript
// Simple runtime type detection
if (typeof credential.token === 'string') {
  // Handle string token
  const parsedToken = JSON.parse(credential.token);
} else {
  // Handle structured token
  const structuredToken = credential.token;
}
```

### Compatibility Risk with Existing IDPs

**Question**: What is the compatibility risk with existing IDPs?

**Analysis**: The compatibility risk is **minimal to zero** because this change is designed to be fully backward compatible:

**Why existing IDPs are unaffected**:
- **String tokens remain valid**: All current string-based implementations continue to work unchanged
- **No breaking changes**: Existing API contracts are preserved
- **Gradual adoption**: IDPs can migrate at their own pace
- **Type system compatibility**: Strings are valid JSON types, so `any` includes string types

**Migration safety**:
- **Zero forced migration**: No IDP needs to change immediately
- **Testing flexibility**: IDPs can test structured tokens alongside existing implementations
- **Rollback capability**: IDPs can revert to string tokens if needed
- **Client compatibility**: RPs can handle both formats during transition periods

**Real-world impact**:
- **Current deployments**: Continue working exactly as before
- **New implementations**: Can choose between string or structured approaches
- **Mixed environments**: Can coexist without conflicts

### Why Not Support Both Formats in the Payload?

**Question**: Why not allow IDPs to support both string and structured formats simultaneously in the same response?

**Analysis**: Supporting both formats simultaneously would create unnecessary complexity and potential security issues:

**Cons of dual-format support**:
- **Precedence ambiguity**: Which format takes priority if both are present?
- **Validation complexity**: Need to validate both formats and ensure consistency
- **Security risks**: Potential for format confusion attacks or data inconsistencies
- **Implementation burden**: IDPs must maintain two parallel token generation paths
- **Client confusion**: RPs need complex logic to handle multiple token sources

**Why single format is better**:
- **Clear semantics**: One token field with one authoritative value
- **Simpler validation**: Single validation path reduces error opportunities
- **Reduced attack surface**: Fewer code paths mean fewer potential vulnerabilities
- **Developer experience**: Cleaner, more predictable API behavior

**Alternative approaches for compatibility**:
Instead of dual formats in a single response, IDPs can:
- **Version-based endpoints**: Offer different endpoint versions for different token formats
- **Content negotiation**: Use HTTP headers to negotiate preferred format
- **Client capability detection**: Adapt response format based on client capabilities
- **Gradual migration**: Transition client-by-client rather than supporting both simultaneously

## Benefits

### For Identity Providers

- **Reduced complexity**: No need for manual JSON stringification
- **Better error handling**: Structured data reduces parsing errors
- **Flexible response formats**: Support for complex token structures including multiple token types, metadata, and nested objects
- **Type safety**: IDPs can leverage TypeScript interfaces for better development experience

### For Relying Parties

- **Direct data access**: No manual JSON.parse() calls required
- **Type safety**: Better IDE support and compile-time checking
- **Cleaner code**: Reduced boilerplate for token handling
- **Consistent data structures**: Direct access to nested properties without string manipulation

### For the Ecosystem

- **Developer ergonomics**: Improved developer experience encourages FedCM adoption
- **Standards alignment**: Better compatibility with existing OAuth 2.0 and OpenID Connect response formats
- **Future-proofing**: Extensible approach accommodates evolving token standards

## Considered Alternatives

The design decisions outlined above represent our analysis of the main alternative approaches. Here's a summary of the key alternatives considered and why they were rejected:

### Alternative 1: Do Nothing

**Description**: Maintain the current string-only approach and require IDPs/RPs to handle serialization themselves.

**Pros**:
- No breaking changes
- Maintains current API simplicity
- Clear separation between transport and data formatting

**Cons**:
- Poor developer ergonomics
- Manual serialization/deserialization overhead
- Increased likelihood of implementation errors
- Reduced competitiveness compared to existing federation solutions

**Decision**: Rejected due to developer feedback and ergonomics concerns.

### Alternative 2: Separate Structured Data Field

**Description**: Add a new `structured_data` field alongside the existing string `token` field.

**Example**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "structured_data": {
    "access_token": "2YotnFZFEjr1zCsicMWpAA",
    "expires_in": 3600
  }
}
```

**Pros**:
- Maintains backward compatibility
- Clear separation between simple and complex use cases

**Cons**:
- API complexity with two token fields
- Confusion about which field to use and precedence rules
- Duplicated functionality and potential data inconsistency
- Still requires string handling for simple cases

**Decision**: Rejected in favor of a unified approach (see [Design Decisions](#design-decisions)).

### Alternative 3: Type Indicator with Dual Fields

**Description**: Add a `token_format` field to indicate the type, with both string and structured fields available.

**Example**:
```json
{
  "token_format": "structured",
  "string_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "structured_token": {
    "access_token": "2YotnFZFEjr1zCsicMWpAA"
  }
}
```

**Pros**:
- Explicit format declaration
- Supports both formats simultaneously

**Cons**:
- Significant API complexity
- Multiple validation paths
- Potential security risks from format confusion
- Developer confusion about which field to use

**Decision**: Rejected due to complexity and security concerns (see [Design Decisions](#design-decisions)).

### Alternative 4: Content Negotiation

**Description**: Use HTTP headers to negotiate the preferred token format.

**Example**:
```http
Accept: application/json; format=structured
```

**Pros**:
- Standard HTTP mechanism
- Client-driven format selection

**Cons**:
- Additional complexity in HTTP layer
- Requires changes to existing content negotiation
- Less discoverable than API-level changes
- Doesn't address the type system issues in JavaScript

**Decision**: Rejected in favor of simpler API-level approach.

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

### Implementation Security

User agents should:

- Apply standard JSON parsing security practices
- Maintain existing size limits for token data
- Preserve current validation requirements
- Continue to sanitize data appropriately

## Implementation Considerations

### Backward Compatibility

This change is **backward compatible** because:

- String tokens remain valid (strings are valid JSON types)
- Existing implementations continue to work unchanged
- IDPs can migrate incrementally
- RPs can adapt to handle both string and structured tokens

### Size Considerations

While this change enables richer data structures, existing size limits should remain in place to prevent abuse:

- Maintain current token size restrictions
- Consider nested object depth limits
- Apply standard JSON parsing safeguards

### Compatibility Validation

To ensure smooth migration, IDPs should:

```javascript
// Example: Support both formats during transition
function handleToken(token) {
  if (typeof token === 'string') {
    // Legacy string token handling
    try {
      return JSON.parse(token);
    } catch (e) {
      // Handle as opaque string token
      return { raw_token: token };
    }
  } else {
    // Native structured token
    return token;
  }
}
```

## Examples

### OAuth 2.0 Token Response

```json
{
  "token": {
    "access_token": "2YotnFZFEjr1zCsicMWpAA",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "tGzv3JOkF0XG5Qx2TlKWIA",
    "scope": "openid profile email"
  }
}
```

### OpenID Connect with Custom Claims

```json
{
  "token": {
    "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFlOWdkazcifQ...",
    "access_token": "SlAV32hkKG",
    "token_type": "Bearer",
    "expires_in": 3600,
    "custom_claims": {
      "organization": "example-corp",
      "roles": ["user", "admin"],
      "permissions": ["read", "write", "delete"]
    }
  }
}
```

### Enterprise Token with Metadata

```json
{
  "token": {
    "assertion": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tenant_info": {
      "tenant_id": "tenant-123",
      "tenant_name": "Example Corporation",
      "features": ["sso", "mfa", "audit_logs"]
    },
    "session_info": {
      "session_id": "sess_abc123",
      "mfa_verified": true,
      "last_activity": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Migration Example: Backward Compatible RP

```javascript
// RP code that handles both string and structured tokens
const credential = await navigator.credentials.get({
  identity: {
    providers: [{
      configURL: "https://accounts.example.com/.well-known/web-identity",
      clientId: "rp-client-id"
    }]
  }
});

let tokenData;
if (typeof credential.token === 'string') {
  // Handle legacy string token
  try {
    tokenData = JSON.parse(credential.token);
  } catch (e) {
    // Handle as JWT or opaque token
    tokenData = { jwt: credential.token };
  }
} else {
  // Handle structured token
  tokenData = credential.token;
}

// Use tokenData consistently regardless of source format
const accessToken = tokenData.access_token || tokenData.jwt;
```

## Specification Changes

The following sections of the FedCM specification require updates:

1. **Section [ID Assertion Endpoint]**: Update `token` field type from `string` to `any`
2. **Section [IdentityProvider Interface]**: Update `resolve()` parameter type
3. **Section [IdentityCredential Interface]**: Update `token` property type
4. **Section [Token Validation]**: Add guidance for structured token validation

### WebIDL Changes

```webidl
// Before
interface IdentityCredential : Credential {
  readonly attribute DOMString token;
};

// After  
interface IdentityCredential : Credential {
  readonly attribute any token;
};
```

### HTTP API Changes

```json
// ID Assertion endpoint response schema (before)
{
  "type": "object",
  "properties": {
    "token": {"type": "string"}
  }
}

// ID Assertion endpoint response schema (after)
{
  "type": "object", 
  "properties": {
    "token": {"type": ["string", "object", "array", "number", "boolean"]}
  }
}
```