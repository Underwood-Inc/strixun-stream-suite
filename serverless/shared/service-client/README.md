# Service-to-Service Client Library

Reusable, agnostic library for making authenticated service-to-service API calls across all services.

## Features

- **Multiple Authentication Methods**: Supports both `SUPER_ADMIN_API_KEY` and `SERVICE_API_KEY`
- **Automatic Cache Prevention**: All service calls use `cache: 'no-store'` to ensure fresh data
- **Retry Logic**: Configurable exponential/linear/fixed backoff retry on failures
- **Type-Safe**: Full TypeScript support with generic types
- **Error Handling**: Comprehensive error handling with detailed error messages
- **Timeout Support**: Configurable request timeouts

## Usage

### Basic Usage

```typescript
import { createServiceClient } from '@strixun/service-client';

// Create client from environment variables
const client = createServiceClient('https://auth.idling.app', env);

// Make a GET request
const response = await client.get('/admin/users');
console.log(response.data); // Typed response data

// Make a POST request
const createResponse = await client.post('/admin/customers', {
    email: 'user@example.com',
    name: 'User Name'
});
```

### Advanced Configuration

```typescript
import { ServiceClient } from '@strixun/service-client';

// Create client with custom configuration
const client = new ServiceClient({
    baseURL: 'https://auth.idling.app',
    auth: {
        superAdminKey: env.SUPER_ADMIN_API_KEY, // For admin operations
        // OR
        serviceKey: env.SERVICE_API_KEY, // For general service calls
    },
    timeout: 60000, // 60 seconds
    retry: {
        maxAttempts: 5,
        backoff: 'exponential',
        retryableErrors: [408, 429, 500, 502, 503, 504, 530],
    },
    defaultHeaders: {
        'X-Custom-Header': 'value',
    },
});
```

### Authentication Methods

#### SUPER_ADMIN_API_KEY
Use for admin/system-wide operations. Authenticates as a super-admin with system-wide access.

```typescript
const client = new ServiceClient({
    baseURL: 'https://auth.idling.app',
    auth: {
        superAdminKey: env.SUPER_ADMIN_API_KEY,
    },
});
```

#### SERVICE_API_KEY
Use for general service-to-service calls. Authenticates as a service (not a user).

```typescript
const client = new ServiceClient({
    baseURL: 'https://customer-api.idling.app',
    auth: {
        serviceKey: env.SERVICE_API_KEY,
        serviceKeyHeader: 'X-Service-Key', // Optional, defaults to 'X-Service-Key'
    },
});
```

### Request Methods

```typescript
// GET
const response = await client.get('/admin/users', {
    params: { page: 1, pageSize: 50 },
});

// POST
const response = await client.post('/admin/customers', {
    email: 'user@example.com',
});

// PUT
const response = await client.put('/admin/customers/123', {
    name: 'Updated Name',
});

// PATCH
const response = await client.patch('/admin/customers/123', {
    status: 'active',
});

// DELETE
const response = await client.delete('/admin/customers/123');
```

### Error Handling

```typescript
try {
    const response = await client.get('/admin/users');
    if (response.status === 200) {
        // Success
        console.log(response.data);
    } else {
        // Handle non-200 status
        console.error('Request failed:', response.status, response.data);
    }
} catch (error) {
    // Handle network errors, timeouts, etc.
    console.error('Request error:', error);
}
```

## Migration Guide

### Before (Direct fetch)

```typescript
// ❌ Old way - manual fetch with authentication
const response = await fetch(`${authApiUrl}/admin/users`, {
    method: 'GET',
    headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
    },
    cache: 'no-store',
});
```

### After (Service Client)

```typescript
// ✅ New way - using service client
import { createServiceClient } from '@strixun/service-client';

const client = createServiceClient(authApiUrl, env);
const response = await client.get('/admin/users');
```

## Best Practices

1. **Use SUPER_ADMIN_API_KEY for admin operations**: When you need system-wide access
2. **Use SERVICE_API_KEY for general service calls**: For regular service-to-service communication
3. **Always handle errors**: Wrap service calls in try-catch blocks
4. **Use type parameters**: Specify response types for better type safety
5. **Configure timeouts appropriately**: Longer timeouts for complex operations

## Examples

### Example: Fetching all users from OTP auth service

```typescript
import { createServiceClient } from '@strixun/service-client';

async function listAllUsers(env: Env): Promise<User[]> {
    const client = createServiceClient(env.AUTH_API_URL || 'https://auth.idling.app', env);
    
    try {
        const response = await client.get<{ users: User[]; total: number }>('/admin/users');
        
        if (response.status === 200 && response.data.users) {
            return response.data.users;
        }
        
        throw new Error(`Failed to fetch users: ${response.status}`);
    } catch (error) {
        console.error('[UserManagement] Service call failed:', error);
        throw error;
    }
}
```

### Example: Creating a customer via customer-api

```typescript
import { createServiceClient } from '@strixun/service-client';

async function createCustomer(customerData: CustomerData, env: Env): Promise<CustomerData> {
    const client = createServiceClient(
        env.CUSTOMER_API_URL || 'https://customer-api.idling.app',
        env
    );
    
    try {
        const response = await client.post<CustomerData>('/customer', customerData);
        
        if (response.status === 200 && response.data) {
            return response.data;
        }
        
        throw new Error(`Failed to create customer: ${response.status}`);
    } catch (error) {
        console.error('[Customer Service] Failed to create customer:', error);
        throw error;
    }
}
```

