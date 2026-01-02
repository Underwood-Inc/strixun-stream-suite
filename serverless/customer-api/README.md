# Customer API - Cloudflare Worker

Dedicated Cloudflare Worker for customer data management with full CRUD operations.

## Overview

This service provides a complete API for managing customer data, integrated with the OTP authentication service for secure access control.

## Features

- ✓ **Customer CRUD** - Create, read, update, and delete customer records
- ✓ **JWT Authentication** - Integrated with OTP auth service
- ✓ **TypeScript** - Fully typed API
- ✓ **Cloudflare Workers** - Edge computing for low latency
- ✓ **KV Storage** - Fast metadata storage

## Setup

### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Node.js 18+
- pnpm package manager

### Installation

```bash
cd serverless/customer-api
pnpm install
```

### Configuration

1. **Create KV Namespace:**
```bash
wrangler kv namespace create "CUSTOMER_KV"
```

2. **Update `wrangler.toml`** with the KV namespace ID

3. **Set Secrets:**
```bash
wrangler secret put JWT_SECRET          # REQUIRED: Must match OTP auth service
wrangler secret put ALLOWED_ORIGINS    # OPTIONAL: CORS origins
```

### Development

```bash
pnpm dev
```

The dev server runs on `http://localhost:8790`

### Deployment

```bash
pnpm deploy
```

## API Endpoints

### Customers

- `GET /customers` - List customers (requires auth)
- `GET /customers/:customerId` - Get customer detail (requires auth)
- `POST /customers` - Create customer (requires auth)
- `PATCH /customers/:customerId` - Update customer (requires auth)
- `DELETE /customers/:customerId` - Delete customer (requires auth)

### Health

- `GET /health` - Health check

## Authentication

All endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

The JWT token is obtained from the OTP auth service and must use the same `JWT_SECRET`.

## Tech Stack

- **Cloudflare Workers** - Edge runtime
- **TypeScript** - Type safety
- **@strixun/api-framework** - Shared API framework
- **Cloudflare KV** - Data storage

## License

Private - Part of Strixun Stream Suite
