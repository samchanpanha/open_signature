# OpenSignature API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Endpoints

### Auth Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

#### POST /auth/logout
Invalidate current session.

**Headers:** `Authorization: Bearer <token>`

#### GET /auth/me
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

### Signature Endpoints

#### POST /signatures/create
Create a new signature session.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "documentId": "doc-uuid",
  "signerEmail": "signer@example.com",
  "signerName": "Jane Smith",
  "expiresIn": 7200
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session-uuid",
    "documentId": "doc-uuid",
    "signerEmail": "signer@example.com",
    "signingUrl": "http://localhost:5173/sign/session-uuid",
    "expiresAt": "2024-01-01T02:00:00.000Z",
    "status": "pending"
  }
}
```

#### GET /signatures/:sessionId
Get signature session details.

**Headers:** `Authorization: Bearer <token>`

#### POST /signatures/:sessionId/biometric
Submit biometric data for verification.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "signatureData": "base64_signature_image",
  "pressureData": [0.5, 0.7, 0.8, ...],
  "timingData": [100, 150, 200, ...],
  "accelerometerData": [0.1, 0.2, 0.3, ...]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "biometricId": "bio-uuid",
    "confidence": 0.92,
    "isLive": true,
    "riskScore": 0.15,
    "metrics": {
      "pressureVariation": 0.23,
      "speedConsistency": 0.87,
      "accelerationPattern": "natural"
    }
  }
}
```

#### POST /signatures/:sessionId/complete
Complete the signing process.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "biometricId": "bio-uuid",
  "consent": true,
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signatureId": "sig-uuid",
    "status": "completed",
    "evidencePackage": {
      "id": "evidence-uuid",
      "checksum": "sha256_hash",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### GET /signatures/:sessionId/evidence
Download evidence package for a signature.

**Headers:** `Authorization: Bearer <token>`

**Response:** Binary file download (ZIP)

### Document Endpoints

#### POST /documents/upload
Upload a PDF document for signing.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body:**
```
file: <PDF file>
title: "Contract Agreement"
```

#### GET /documents
List all documents for current user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `status` (string): Filter by status (draft, pending, signed, completed)

#### GET /documents/:documentId
Get document details.

**Headers:** `Authorization: Bearer <token>`

#### POST /documents/:documentId/fields
Add form fields to a document.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "fields": [
    {
      "type": "signature",
      "name": "signature_1",
      "page": 1,
      "x": 100,
      "y": 200,
      "width": 200,
      "height": 50,
      "required": true
    },
    {
      "type": "text",
      "name": "full_name",
      "page": 1,
      "x": 100,
      "y": 150,
      "width": 300,
      "height": 30,
      "required": true,
      "defaultValue": ""
    }
  ]
}
```

#### POST /documents/:documentId/fill
Fill form fields in a document.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "fields": {
    "full_name": "John Doe",
    "date": "2024-01-01",
    "signature_1": "base64_signature_image"
  }
}
```

**Response:** Binary file download (PDF)

#### GET /documents/:documentId/download
Download the original or filled PDF.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `filled` (boolean): Download filled version (default: false)

### Dashboard Endpoints

#### GET /dashboard/stats
Get dashboard statistics.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSignatures": 150,
    "completedToday": 12,
    "pendingSignatures": 5,
    "activeUsers": 8,
    "averageSigningTime": 45,
    "securityScore": 95
  }
}
```

#### GET /dashboard/activity
Get recent activity feed.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (number): Number of items (default: 20)
- `offset` (number): Offset for pagination

#### GET /dashboard/security-events
Get security events.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (ISO string): Start date filter
- `endDate` (ISO string): End date filter
- `severity` (string): Filter by severity (low, medium, high, critical)

### Biometric Endpoints

#### POST /biometric/verify
Verify biometric data.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "type": "signature",
  "data": "base64_data",
  "metadata": {
    "deviceType": "touchscreen",
    "pressureSensitivity": true
  }
}
```

#### GET /biometric/profiles
Get user's biometric profiles.

**Headers:** `Authorization: Bearer <token>`

#### DELETE /biometric/profiles/:profileId
Delete a biometric profile.

**Headers:** `Authorization: Bearer <token>`

### Admin Endpoints

#### GET /admin/users
List all users (admin only).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `role` (string): Filter by role

#### PUT /admin/users/:userId/role
Update user role (admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "role": "admin"
}
```

#### GET /admin/audit-logs
Get audit logs (admin only).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (ISO string): Start date
- `endDate` (ISO string): End date
- `userId` (string): Filter by user
- `action` (string): Filter by action type

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `BIOMETRIC_LOW_CONFIDENCE` | 400 | Biometric verification failed |
| `SESSION_EXPIRED` | 401 | Signature session expired |
| `DOCUMENT_PROCESSING_ERROR` | 500 | Error processing document |

## Rate Limiting

- Authentication endpoints: 5 requests per minute
- Signature endpoints: 10 requests per minute
- Document endpoints: 20 requests per minute
- Dashboard endpoints: 30 requests per minute

## Webhooks

### Signature Completed

POST to your configured webhook URL when a signature is completed.

**Payload:**
```json
{
  "event": "signature.completed",
  "data": {
    "signatureId": "sig-uuid",
    "documentId": "doc-uuid",
    "signerEmail": "signer@example.com",
    "completedAt": "2024-01-01T00:00:00.000Z",
    "evidencePackageId": "evidence-uuid"
  }
}
```

### Security Alert

POST to your configured webhook URL for security events.

**Payload:**
```json
{
  "event": "security.alert",
  "data": {
    "alertId": "alert-uuid",
    "type": "suspicious_activity",
    "severity": "high",
    "details": {
      "ipAddress": "192.168.1.1",
      "reason": "Multiple failed biometric attempts"
    },
    "detectedAt": "2024-01-01T00:00:00.000Z"
  }
}
```
