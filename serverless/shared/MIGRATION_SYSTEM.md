## Generic Migration System

Reusable migration system for any Cloudflare Workers service with KV storage.

### Features

- ✓ Track which migrations have been run per service
- ✓ Run pending migrations automatically
- ✓ Support for rollback (if migration implements `down()`)
- ✓ Isolated per-service (multiple services can use same KV)
- ✓ Type-safe with TypeScript

### Usage

#### 1. Create a Migration File

```typescript
// serverless/my-service/migrations/001_add_feature.ts
import type { Migration } from '../../shared/migration-runner.js';

export const migration: Migration = {
    id: '001_add_feature',
    description: 'Add new feature to system',
    
    async up(kv): Promise<void> {
        // Update KV data
        await kv.put('feature_enabled', 'true');
        console.log('[Migration] ✓ Feature enabled');
    },
    
    // Optional: implement down() for rollback support
    async down(kv): Promise<void> {
        await kv.delete('feature_enabled');
        console.log('[Migration] ✓ Feature disabled');
    },
};
```

#### 2. Register Migration in Index

```typescript
// serverless/my-service/migrations/index.ts
import type { Migration } from '../../shared/migration-runner.js';
import { migration as migration001 } from './001_add_feature.js';

export const migrations: Migration[] = [
    migration001,
    // Add new migrations here in order
];
```

#### 3. Add Migration Endpoints to Router

```typescript
// serverless/my-service/router/routes.ts
import { MigrationRunner } from '../../shared/migration-runner.js';
import { migrations } from '../migrations/index.js';

// POST /migrate - Run pending migrations
if (request.method === 'POST' && path === '/migrate') {
    const runner = new MigrationRunner(env.MY_SERVICE_KV, 'my-service');
    const result = await runner.runPending(migrations);
    return new Response(JSON.stringify(result), { status: 200 });
}

// GET /migrations/status - Check migration status
if (request.method === 'GET' && path === '/migrations/status') {
    const runner = new MigrationRunner(env.MY_SERVICE_KV, 'my-service');
    const status = await runner.getStatus(migrations);
    return new Response(JSON.stringify(status), { status: 200 });
}
```

#### 4. Run Migrations After Deployment

```bash
# Check what migrations need to run
curl https://my-service.workers.dev/migrations/status

# Run pending migrations
curl -X POST https://my-service.workers.dev/migrate
```

### How It Works

**Migration Tracking:**
- Each migration is tracked in KV with key: `migration_{servicePrefix}_{migrationId}`
- Value: `'true'` if run, with metadata: `{ runAt: ISO8601 timestamp }`

**Service Isolation:**
- Multiple services can use the same KV namespace
- Each service has a unique prefix (e.g., 'authz', 'mods', 'customer')
- No conflicts between services

**Ordering:**
- Migrations run in the order they appear in the migrations array
- Use numeric prefixes (001_, 002_, etc.) to ensure correct order

### Best Practices

1. **Never delete migrations** - once deployed, keep them forever (even if rolled back)
2. **Always test migrations locally** - use `wrangler dev --local` first
3. **Make migrations idempotent** - safe to run multiple times
4. **Keep migrations small** - one logical change per migration
5. **Add rollback support** - implement `down()` for easy revert

### Example Services Using This System

- **Authorization Service**: `serverless/authorization-service/migrations/`
- **Mods API** (future): `serverless/mods-api/migrations/`
- **Customer API** (future): `serverless/customer-api/migrations/`

### Advanced: Passing Arguments to Migrations

```typescript
// Migration that needs additional env data
export const migration: Migration = {
    id: '002_with_args',
    description: 'Migration that uses environment variables',
    
    async up(kv, env): Promise<void> {
        // Access env passed from runner
        const apiUrl = env.API_URL;
        await kv.put('api_url', apiUrl);
    },
};

// In router:
const runner = new MigrationRunner(env.MY_KV, 'service');
await runner.runPending(migrations, env); // Pass env as extra arg
```

### Troubleshooting

**Migration failed mid-way:**
- Migration won't be marked as complete
- Next run will retry from the failed migration
- Fix the issue and re-deploy

**Need to rollback a migration:**
```typescript
import { MigrationRunner } from '../../shared/migration-runner.js';
import { migration001 } from './migrations/001_feature.js';

const runner = new MigrationRunner(env.MY_KV, 'service');
await runner.rollback(migration001);
```

**Check if specific migration has run:**
```typescript
const runner = new MigrationRunner(env.MY_KV, 'service');
const hasRun = await runner.isRun('001_feature');
console.log(`Migration 001 has run: ${hasRun}`);
```
