# Structured Data Support in FedCM

**Authors:**
Suresh Potti (sureshpotti@microsoft.com)

## Participate

Feature request: https://issues.chromium.org/346567168  
FedCM Spec: https://w3c-fedid.github.io/FedCM

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

**Current (String only):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Proposed (Any JSON type):**
```json
{
  "token": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "def50200f3d5b...",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

#### 2. JavaScript API Usage

**Current (Manual parsing required):**
```javascript
const credential = await navigator.credentials.get({...});
// Must manually parse string token
const tokenData = JSON.parse(credential.token);
const accessToken = tokenData.access_token;
```

**Proposed (Direct access):**
```javascript
const credential = await navigator.credentials.get({...});
// Direct access to structured data
const accessToken = credential.token.access_token;
const expiresIn = credential.token.expires_in;
```

## Design Decisions and Alternatives Considered

This section addresses key design questions and explains how alternative approaches would look in practice.

### Why a Unified `any` Type Instead of Separate Fields?

**Rejected Alternative - Separate Fields Approach:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "structured_data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

**Problems with this approach:**
- Which field should RPs use? What if both are present?
- IDPs might feel compelled to populate both fields
- Creates ecosystem fragmentation

**Our Unified Approach:**
```json
{
  "token": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

**Benefits:**
- Single source of truth eliminates confusion
- Natural migration path from strings to objects
- Backward compatible (strings remain valid)

### Why No Type Indicator Attribute?

**Rejected Alternative - Type Indicator Approach:**
```json
{
  "token_format": "structured",
  "token": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

**Problems with this approach:**
- Adds unnecessary complexity
- Risk of mismatched indicators and actual data
- JSON is already self-describing

**Our Approach (No indicator needed):**
```javascript
// Simple runtime detection
if (typeof credential.token === 'string') {
  // Handle string token
} else {
  // Handle structured token
}
```

### What About Compatibility with Existing IDPs?

**Current IDPs (continue working unchanged):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**New IDPs can use structured format:**
```json
{
  "token": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

**RPs can handle both:**
```javascript
let tokenData;
if (typeof credential.token === 'string') {
  tokenData = JSON.parse(credential.token);
} else {
  tokenData = credential.token;
}
```

### Why Not Support Both Formats Simultaneously?

**Rejected Alternative - Dual Format Support:**
```json
{
  "string_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "structured_token": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

**Problems with this approach:**
- Which format takes precedence?
- Security risks from format confusion
- Complex validation logic required

**Our Single Format Approach:**
```json
{
  "token": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

**Benefits:**
- Clear semantics with single authoritative value
- Simpler validation and fewer security risks
- Better developer experience

### Rejected Alternatives Summary

1. **Do Nothing**: Poor developer ergonomics and competitiveness
2. **Separate Fields**: API complexity and developer confusion
3. **Type Indicators**: Unnecessary overhead when JSON is self-describing
4. **Dual Format Support**: Security risks and validation complexity
5. **Content Negotiation**: HTTP layer complexity without addressing type system issues

**Recommended compatibility approaches**: Version-based endpoints, client capability detection, or gradual migration strategies.

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

## Examples

This section provides comprehensive examples showing how structured tokens work in practice, demonstrating the improvements in developer ergonomics and API usability.

### Basic Usage Comparison

#### Before: String Token (Current FedCM)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### After: Structured Token (Proposed)
```json
{
  "token": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "def50200f3d5b...",
    "expires_in": 3600,
    "token_type": "Bearer",
    "user_info": {
      "sub": "user123",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

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

### Type Detection Pattern

```javascript
// Simple runtime type detection for IDPs and RPs
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

### Direct Data Access Example

```javascript
// With structured tokens, RPs can directly access nested data
const credential = await navigator.credentials.get({
  identity: {
    providers: [{
      configURL: "https://accounts.example.com/.well-known/web-identity",
      clientId: "rp-client-id"
    }]
  }
});

// Direct access without manual parsing
const userRoles = credential.token.custom_claims?.roles || [];
const expiresAt = new Date(credential.token.expires_in * 1000 + Date.now());
const organizationId = credential.token.tenant_info?.tenant_id;

// Use the data immediately
if (userRoles.includes('admin')) {
  // Grant admin access
}
```