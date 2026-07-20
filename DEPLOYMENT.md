# OpenSignature Deployment Guide

## Deployment Options

### 1. Local Development

**Prerequisites:**
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

**Steps:**
```bash
# Clone and install
git clone <repository-url>
cd open-signature
npm run install-all

# Set up database
createdb open_signature
cd backend
cp .env.example .env
# Edit .env with your database credentials
npm run db:init

# Start servers
npm run dev  # Backend on port 3000
cd ../frontend
npm run dev  # Frontend on port 5173
```

### 2. Docker Deployment

**Prerequisites:**
- Docker 20.10+
- Docker Compose 2.0+

**Steps:**
```bash
# Clone repository
git clone <repository-url>
cd open-signature

# Create docker-compose.yml (see below)
# Set up environment variables
cp .env.example .env
# Edit .env file

# Build and start containers
docker-compose up -d

# Initialize database
docker-compose exec backend npm run db:init
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: open_signature
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/open_signature
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/evidence:/app/evidence
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      VITE_API_URL: http://localhost:3000/api
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Cloud Deployment

#### AWS Deployment

**Infrastructure:**
- EC2 or ECS for application servers
- RDS for PostgreSQL
- ElastiCache for Redis
- S3 for file storage
- CloudFront for CDN
- Route 53 for DNS

**Steps:**
1. Set up RDS PostgreSQL instance
2. Set up ElastiCache Redis cluster
3. Create S3 bucket for documents
4. Deploy backend to EC2/ECS
5. Build and deploy frontend to S3/CloudFront
6. Configure environment variables
7. Set up SSL certificates
8. Configure domain and DNS

#### Google Cloud Deployment

**Infrastructure:**
- Cloud Run or GKE for application
- Cloud SQL for PostgreSQL
- Memorystore for Redis
- Cloud Storage for files
- Cloud CDN for caching
- Cloud DNS for domain

#### Azure Deployment

**Infrastructure:**
- App Service or Azure Container Instances
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Azure Blob Storage
- Azure CDN
- Azure DNS

### 4. Kubernetes Deployment

**Prerequisites:**
- Kubernetes cluster
- kubectl configured
- Helm 3.0+

**Steps:**
```bash
# Add Helm repositories
helm repo add bitnami https://charts.bitnami.com/bitnami

# Install PostgreSQL
helm install postgresql bitnami/postgresql

# Install Redis
helm install redis bitnami/redis

# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods
kubectl get services
```

**k8s/backend-deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: open-signature-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: open-signature/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: backend
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Environment Variables

### Backend (.env)

```bash
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/open_signature

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Evidence Packages
EVIDENCE_DIR=./evidence

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

### Frontend (.env)

```bash
# API
VITE_API_URL=http://localhost:3000/api

# App
VITE_APP_NAME=OpenSignature
VITE_APP_VERSION=1.0.0

# Features
VITE_ENABLE_BIOMETRIC=true
VITE_ENABLE_FRAUD_DETECTION=true

# Analytics (optional)
VITE_ANALYTICS_ID=
```

## SSL/TLS Configuration

### Using Let's Encrypt

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        root /var/www/frontend;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database Migration

### Running Migrations

```bash
# Development
npm run db:migrate

# Production
npm run db:migrate:prod

# Rollback
npm run db:rollback
```

### Creating New Migrations

```bash
# Generate migration file
npm run db:migration:create -- --name=add_new_table

# Run pending migrations
npm run db:migrate
```

## Monitoring

### Health Check Endpoint

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345,
  "database": "connected",
  "redis": "connected"
}
```

### Metrics Endpoint (Prometheus)

```
GET /metrics
```

### Logging

Logs are written to:
- Console (development)
- File (production): `./logs/app.log`
- Error file: `./logs/error.log`

### Log Rotation

```bash
# /etc/logrotate.d/open-signature
/var/log/open-signature/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        [ -f /var/run/open-signature.pid ] && kill -USR1 $(cat /var/run/open-signature.pid)
    endscript
}
```

## Backup and Recovery

### Database Backup

```bash
# Manual backup
pg_dump -U postgres open_signature > backup_$(date +%Y%m%d).sql

# Automated backup (cron)
0 2 * * * pg_dump -U postgres open_signature | gzip > /backups/open_signature_$(date +\%Y\%m\%d).sql.gz
```

### Database Restore

```bash
# From SQL file
psql -U postgres open_signature < backup.sql

# From gzipped file
gunzip -c backup.sql.gz | psql -U postgres open_signature
```

### File Backup

```bash
# Backup evidence packages
aws s3 sync ./evidence s3://your-backup-bucket/evidence/$(date +%Y%m%d)/

# Backup uploaded documents
aws s3 sync ./uploads s3://your-backup-bucket/uploads/$(date +%Y%m%d)/
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection string in .env
   - Ensure database exists

2. **Redis Connection Failed**
   - Check Redis is running
   - Verify REDIS_URL in .env

3. **Port Already in Use**
   - Kill process using port: `lsof -ti:3000 | xargs kill -9`
   - Or change PORT in .env

4. **Permission Denied**
   - Check file permissions: `chmod -R 755 ./uploads`
   - Ensure user has write access

5. **Memory Issues**
   - Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`
   - Check for memory leaks in logs

### Debug Mode

```bash
# Enable debug logging
DEBUG=open-signature:* npm run dev

# Or specific modules
DEBUG=open-signature:auth,open-signature:biometric npm run dev
```

### Performance Tuning

```bash
# Node.js optimization
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# Database connection pooling
DATABASE_URL=postgresql://...?pool=20&idleTimeoutMillis=30000
```

## Security Checklist

- [ ] Environment variables set securely
- [ ] JWT secret is strong and unique
- [ ] Database password is strong
- [ ] HTTPS enabled
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] Input validation enabled
- [ ] SQL injection prevention
- [ ] XSS protection enabled
- [ ] CSRF protection enabled
- [ ] Security headers configured
- [ ] Audit logging enabled
- [ ] Backup schedule configured
- [ ] Monitoring alerts configured
