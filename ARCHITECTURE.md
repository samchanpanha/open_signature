# OpenSignature Architecture

## System Overview

OpenSignature is a digital signature platform that combines natural drawing input with advanced biometric verification and fraud detection. The system is designed for security, scalability, and legal compliance.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Web App    │  │  Mobile App │  │  Embedded   │            │
│  │   (React)    │  │  (Future)   │  │  SDK        │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Gateway                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Express.js + Rate Limiting                  │   │
│  │              CORS + Helmet + Logging                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Signature  │  │  Biometric  │  │  Document   │            │
│  │  Service    │  │  Service    │  │  Service    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Fraud      │  │  Evidence   │  │  User       │            │
│  │  Detection  │  │  Service    │  │  Service    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ PostgreSQL  │  │    Redis    │  │     S3      │            │
│  │  (Primary)  │  │  (Cache)    │  │  (Storage)  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Signature Drawing Component

The signature component captures natural drawing input with high precision:

**Features:**
- Multi-touch support for natural signing
- Pressure sensitivity (when available)
- Real-time rendering with canvas optimization
- Undo/redo functionality
- Mobile-optimized touch handling

**Technical Implementation:**
- HTML5 Canvas for drawing
- Touch event handling with gesture prevention
- requestAnimationFrame for smooth rendering
- Points array with pressure and timing data

### 2. Biometric Analysis Engine

Real-time analysis of physical signing characteristics:

**Analysis Components:**
- **Pressure Analysis**: Variation and consistency of pen/finger pressure
- **Speed Analysis**: Velocity patterns and acceleration
- **Movement Analysis**: Stroke smoothness and jitter detection
- **Timing Analysis**: Rhythm and pause patterns
- **Gyroscopic Data**: Device movement (mobile devices)

**Confidence Scoring:**
```typescript
confidence = (
  pressureScore * 0.25 +
  speedScore * 0.25 +
  movementScore * 0.25 +
  timingScore * 0.15 +
  gyroScore * 0.10
)
```

### 3. Fraud Detection System

Multi-layered approach to detect suspicious activity:

**Detection Layers:**
1. **Real-time Analysis**: During signature capture
2. **Pattern Recognition**: Historical behavior analysis
3. **Anomaly Detection**: Statistical deviation detection
4. **Device Fingerprinting**: Device consistency verification

**Risk Scoring:**
- 0.0 - 0.3: Low risk (green)
- 0.3 - 0.6: Medium risk (yellow)
- 0.6 - 0.8: High risk (orange)
- 0.8 - 1.0: Critical risk (red)

### 4. Evidence Packaging System

Comprehensive audit trail for legal validity:

**Evidence Components:**
- Original document hash (SHA-256)
- Signature image and points data
- Biometric analysis results
- Device and browser information
- IP address and geolocation (if permitted)
- Timestamps with timezone
- User consent records
- Cryptographic signatures

**Package Structure:**
```
evidence-package/
├── manifest.json           # Package metadata
├── document.pdf           # Original document
├── signature.png          # Signature image
├── signature-data.json    # Points and metrics
├── biometric-report.json  # Analysis results
├── audit-log.json         # Complete audit trail
├── metadata.json          # Device and session info
└── checksums.sha256       # File integrity verification
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  biometric_profile_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

### Signature Sessions Table
```sql
CREATE TABLE signature_sessions (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  signer_email VARCHAR(255) NOT NULL,
  signer_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  signing_token VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### Documents Table
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_hash VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255),
  mime_type VARCHAR(100),
  size INTEGER,
  owner_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'draft',
  form_fields JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Signatures Table
```sql
CREATE TABLE signatures (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES signature_sessions(id),
  document_id UUID REFERENCES documents(id),
  signer_id UUID REFERENCES users(id),
  signature_image TEXT,
  signature_points JSONB,
  biometric_analysis JSONB,
  risk_score DECIMAL(3,2),
  evidence_package_id UUID,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  consent_given BOOLEAN DEFAULT false,
  signed_at TIMESTAMP DEFAULT NOW()
);
```

### Biometric Profiles Table
```sql
CREATE TABLE biometric_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  template JSONB NOT NULL,
  confidence_threshold DECIMAL(3,2) DEFAULT 0.8,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Architecture

### Authentication Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Client  │────▶│  Auth   │────▶│  JWT    │────▶│ Redis   │
│         │     │ Service │     │ Service │     │ (Token) │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │              │               │               │
     │              ▼               │               │
     │         ┌─────────┐         │               │
     │         │ bcrypt  │         │               │
     │         │ (Hash)  │         │               │
     │         └─────────┘         │               │
     │                             ▼               │
     │                        ┌─────────┐          │
     └────────────────────────│ Refresh │◀─────────┘
                              │ Token   │
                              └─────────┘
```

### Data Protection

1. **Encryption at Rest**: AES-256 for sensitive data
2. **Encryption in Transit**: TLS 1.3 for all communications
3. **Password Hashing**: bcrypt with salt rounds = 12
4. **Biometric Storage**: Mathematical templates only, never raw images
5. **API Keys**: Environment variables, never committed to code

### Access Control

- **Role-Based Access Control (RBAC)**: user, admin, superadmin
- **Resource-Level Permissions**: Users can only access their own resources
- **Session Management**: Redis-based token storage with expiration
- **Rate Limiting**: Per-endpoint and per-user limits

## Performance Considerations

### Optimization Strategies

1. **Canvas Rendering**:
   - requestAnimationFrame for smooth drawing
   - Point simplification for large signatures
   - Off-screen canvas for complex operations

2. **API Response**:
   - Redis caching for frequently accessed data
   - Database query optimization
   - Pagination for large datasets

3. **File Handling**:
   - Stream processing for large PDFs
   - Async file operations
   - Temporary file cleanup

### Scalability

- **Horizontal Scaling**: Stateless API servers behind load balancer
- **Database Scaling**: Read replicas for query distribution
- **Cache Layer**: Redis cluster for session and data caching
- **File Storage**: S3-compatible object storage for documents

## Monitoring and Observability

### Metrics Collection

- Request latency and throughput
- Error rates by endpoint
- Biometric verification success rates
- Fraud detection accuracy
- System resource utilization

### Logging

- Structured JSON logging
- Request/response logging
- Error tracking with stack traces
- Audit logging for compliance

### Alerting

- High error rate alerts
- Security event notifications
- Performance degradation warnings
- Resource exhaustion alerts

## Future Considerations

1. **Mobile Apps**: Native iOS/Android applications
2. **Blockchain Integration**: Immutable audit trail
3. **AI Enhancement**: Machine learning for fraud detection
4. **Multi-Language Support**: Internationalization
5. **Enterprise Features**: SSO, advanced admin controls
6. **Compliance Certifications**: eIDAS, ESIGN Act compliance
