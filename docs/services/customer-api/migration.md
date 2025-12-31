# Customer Data Migration Guide [EMOJI]

## Overview

This guide provides instructions for migrating customer data from `OTP_AUTH_KV` (OTP auth service) to `CUSTOMER_KV` (customer-api worker).

---

## [WARNING] Important Notes

- **Backup First:** Always backup your KV data before migration
- **Test Environment:** Test migration in a development environment first
- **Downtime:** Migration can be done with zero downtime if done carefully
- **Verification:** Always verify data integrity after migration

---

## [EMOJI] Pre-Migration Checklist

- [ ] Customer-api worker is deployed and accessible
- [ ] `CUSTOMER_KV` namespace is created and configured
- [ ] `JWT_SECRET` matches between OTP auth service and customer-api
- [ ] Backup of `OTP_AUTH_KV` data (export all customer keys)
- [ ] Test migration script in development environment
- [ ] Verify customer-api endpoints are working

---

## [EMOJI] Data to Migrate

### Customer Records

**Key Pattern:** `customer_<customerId>`

**Data Structure:**
```typescript
{
  customerId: string;
  name?: string;
  email?: string;
  companyName?: string;
  plan?: string;
  tier?: string;
  status?: string;
  subscriptions?: Subscription[];
  flairs?: Flair[];
  displayName?: string;
  config?: any;
  features?: any;
  createdAt?: string;
  updatedAt?: string;
}
```

### Email-to-CustomerId Mappings

**Key Pattern:** `email_to_customer_<emailHash>`

**Data Structure:**
- Value: `customerId` (string)

**Purpose:** Allows looking up customer by email address

---

## [EMOJI] Migration Methods

### Method 1: Manual Migration Script (Recommended)

Create a migration script that:
1. Lists all customer keys from `OTP_AUTH_KV`
2. Reads each customer record
3. Writes to `CUSTOMER_KV` using customer-api endpoints
4. Migrates email-to-customerId mappings
5. Verifies data integrity

**Example Script Structure:**
```typescript
// migration-script.ts
async function migrateCustomers() {
  // 1. List all customer keys from OTP_AUTH_KV
  const customerKeys = await listCustomerKeys(OTP_AUTH_KV);
  
  // 2. For each customer:
  for (const key of customerKeys) {
    const customer = await OTP_AUTH_KV.get(key, { type: 'json' });
    
    // 3. Create customer via customer-api
    await createCustomerViaAPI(customer);
    
    // 4. Migrate email mapping
    if (customer.email) {
      await migrateEmailMapping(customer.email, customer.customerId);
    }
  }
  
  // 5. Verify migration
  await verifyMigration();
}
```

### Method 2: Gradual Migration (Zero Downtime)

1. **Phase 1:** Update `ensureCustomerAccount()` to write to both `OTP_AUTH_KV` and `CUSTOMER_KV`
2. **Phase 2:** Update all read operations to check `CUSTOMER_KV` first, fallback to `OTP_AUTH_KV`
3. **Phase 3:** Migrate existing data in background
4. **Phase 4:** Remove `OTP_AUTH_KV` writes, keep reads for backward compatibility
5. **Phase 5:** Remove `OTP_AUTH_KV` reads after verification period

### Method 3: Cloudflare KV Export/Import

1. Export all customer data from `OTP_AUTH_KV`:
   ```bash
   wrangler kv:key list --namespace-id=<OTP_AUTH_KV_NAMESPACE_ID> > customers.json
   ```

2. Transform data format if needed

3. Import to `CUSTOMER_KV`:
   ```bash
   wrangler kv:key put --namespace-id=<CUSTOMER_KV_NAMESPACE_ID> --path=customers.json
   ```

**Note:** This method requires manual data transformation and may not preserve all metadata.

---

## [EMOJI] Migration Script Example

```typescript
/**
 * Customer Data Migration Script
 * Migrates customer data from OTP_AUTH_KV to CUSTOMER_KV via customer-api
 */

interface Env {
  OTP_AUTH_KV: KVNamespace;
  CUSTOMER_API_URL?: string;
  JWT_SECRET?: string;
}

async function migrateCustomerData(env: Env) {
  const customerApiUrl = env.CUSTOMER_API_URL || 'https://customer.idling.app';
  const migrated: string[] = [];
  const errors: Array<{ customerId: string; error: string }> = [];
  
  // Get all customer keys from OTP_AUTH_KV
  // Note: KV doesn't support listing all keys, so we need to track customerIds
  // This is a simplified example - you'll need to implement key tracking
  
  // For each customer:
  for (const customerId of knownCustomerIds) {
    try {
      // 1. Read customer from OTP_AUTH_KV
      const customerKey = `customer_${customerId}`;
      const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' });
      
      if (!customer) {
        console.warn(`Customer ${customerId} not found in OTP_AUTH_KV`);
        continue;
      }
      
      // 2. Create customer via customer-api
      // Note: This requires service-to-service auth (see INTEGRATION_GUIDE.md)
      const response = await fetch(`${customerApiUrl}/customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceJWT}`, // Service JWT for internal calls
        },
        body: JSON.stringify(customer),
      });
      
      if (!response.ok) {
        // Check if customer already exists (409 Conflict)
        if (response.status === 409) {
          console.log(`Customer ${customerId} already exists in CUSTOMER_KV, skipping`);
          migrated.push(customerId);
          continue;
        }
        
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Failed to create customer: ${response.statusText}`);
      }
      
      // 3. Migrate email mapping
      if (customer.email) {
        const emailHash = await hashEmail(customer.email.toLowerCase().trim());
        const emailMappingKey = `email_to_customer_${emailHash}`;
        const existingMapping = await env.OTP_AUTH_KV.get(emailMappingKey);
        
        if (existingMapping === customerId) {
          // Email mapping is correct, no need to migrate
          console.log(`Email mapping for ${customer.email} is correct`);
        }
      }
      
      migrated.push(customerId);
      console.log(`[OK] Migrated customer: ${customerId}`);
      
    } catch (error) {
      console.error(`[ERROR] Failed to migrate customer ${customerId}:`, error);
      errors.push({
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  // Summary
  console.log(`\n[EMOJI] Migration Summary:`);
  console.log(`[OK] Migrated: ${migrated.length}`);
  console.log(`[ERROR] Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log(`\n[ERROR] Errors:`);
    errors.forEach(({ customerId, error }) => {
      console.log(`  - ${customerId}: ${error}`);
    });
  }
  
  return { migrated, errors };
}
```

---

## [OK] Post-Migration Verification

### 1. Verify Customer Count

```bash
# Count customers in OTP_AUTH_KV (before migration)
# Count customers in CUSTOMER_KV (after migration)
# Numbers should match (or be close if some were skipped)
```

### 2. Spot Check Random Customers

```bash
# Pick 5-10 random customerIds
# Verify they exist in CUSTOMER_KV
# Verify data matches between OTP_AUTH_KV and CUSTOMER_KV
```

### 3. Test Customer API Endpoints

```bash
# Test GET /customer/me with valid JWT
# Test GET /customer/:id with valid JWT
# Test GET /customer/by-email/:email with valid JWT
# All should return correct customer data
```

### 4. Test Dashboard

```bash
# Login to dashboard
# Verify customer data loads correctly
# Verify customer update works
# All should use customer-api endpoints
```

---

## [EMOJI] Rollback Plan

If migration fails or data is corrupted:

1. **Stop writes to CUSTOMER_KV** (revert code changes)
2. **Continue using OTP_AUTH_KV** for all operations
3. **Investigate issues** in development environment
4. **Fix migration script** and retry
5. **Clean up CUSTOMER_KV** if needed (delete migrated data)

**Note:** Customer data in `OTP_AUTH_KV` is not deleted during migration, so rollback is safe.

---

## [EMOJI] Migration Checklist

- [ ] Backup `OTP_AUTH_KV` data
- [ ] Test migration script in development
- [ ] Run migration script in production
- [ ] Verify customer count matches
- [ ] Spot check random customers
- [ ] Test customer-api endpoints
- [ ] Test dashboard functionality
- [ ] Monitor for errors (24-48 hours)
- [ ] Update code to use customer-api exclusively
- [ ] Archive `OTP_AUTH_KV` customer data (optional)

---

## [EMOJI] Common Issues

### Issue: Customer Already Exists (409 Conflict)

**Cause:** Customer was already migrated or created via customer-api

**Solution:** Skip and continue with next customer

### Issue: Email Mapping Not Found

**Cause:** Email-to-customerId mapping wasn't migrated

**Solution:** Re-run email mapping migration or create mapping manually

### Issue: Missing Required Fields

**Cause:** Customer data structure changed between OTP_AUTH_KV and CUSTOMER_KV

**Solution:** Update migration script to handle missing fields or set defaults

### Issue: JWT Authentication Fails

**Cause:** `JWT_SECRET` mismatch or service-to-service auth not configured

**Solution:** Verify `JWT_SECRET` matches and service-to-service auth is implemented

---

## [EMOJI] Notes

- **Zero Downtime:** Migration can be done with zero downtime using gradual migration method
- **Data Integrity:** Always verify data integrity after migration
- **Backup:** Keep `OTP_AUTH_KV` data as backup until migration is verified
- **Monitoring:** Monitor customer-api logs and errors for 24-48 hours after migration

---

**Status:** [EMOJI] **GUIDE CREATED**
**Last Updated:** 2024-12-19
**Next Step:** Implement migration script based on your specific requirements

