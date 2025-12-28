# Account Recovery System [SYNC]

## Overview

The account recovery system ensures that customer accounts persist indefinitely while allowing automated cleanup of user accounts. When a previously deleted user account is reactivated via new account creation, the system automatically recovers the associated customer account by email, retaining all customer information.

---

## Architecture

### Data Persistence Strategy

1. **Customer Accounts** - Persist indefinitely (no TTL)
   - Customer data is stored without expiration
   - Email-to-customerId mapping also persists indefinitely
   - Allows recovery of customer information even after user account deletion

2. **User Accounts** - 1-year TTL (automated cleanup)
   - User data expires after 1 year of inactivity
   - Allows automated cleanup of inactive accounts
   - Can be recreated with recovered customer account

3. **User Preferences** - 1-year TTL (synced with user data)
   - Preferences expire with user data
   - Recreated with default values on account recovery

---

## Recovery Flow

### Scenario: User Account Deleted, Customer Account Exists

```
1. User signs in/up with email: user@example.com
   [EMOJI]
2. ensureCustomerAccount() is called:
   - Checks for existing customer by email
   - Finds customer account: cust_abc123
   - Reactivates customer if status was 'suspended' or 'cancelled'
   - Returns recovered customerId: cust_abc123
   [EMOJI]
3. getOrCreateUser() is called with recovered customerId:
   - User account doesn't exist (was deleted/expired)
   - Creates new user account with recovered customerId
   - Links user to existing customer account
   [EMOJI]
4. Result:
   - Customer account: [SUCCESS] Recovered and reactivated
   - User account: [SUCCESS] Recreated with recovered customerId
   - Customer information: [SUCCESS] Retained indefinitely
```

### Scenario: Both Accounts Exist

```
1. User signs in with email: user@example.com
   [EMOJI]
2. ensureCustomerAccount() finds existing customer
   - Returns existing customerId
   - Reactivates if needed
   [EMOJI]
3. getOrCreateUser() finds existing user
   - Updates lastLogin timestamp
   - Resets TTL (extends account lifetime)
   - Returns existing user
```

### Scenario: No Accounts Exist (New User)

```
1. User signs up with email: newuser@example.com
   [EMOJI]
2. ensureCustomerAccount() finds no existing customer
   - Creates new customer account
   - Stores email-to-customerId mapping (no TTL)
   - Returns new customerId
   [EMOJI]
3. getOrCreateUser() finds no existing user
   - Creates new user account (1-year TTL)
   - Links to new customer account
   [EMOJI]
4. Result:
   - Customer account: [SUCCESS] Created (persists indefinitely)
   - User account: [SUCCESS] Created (1-year TTL)
```

---

## Implementation Details

### Customer Account Storage

**File:** `services/customer.ts`

```typescript
export async function storeCustomer(
    customerId: string, 
    customerData: CustomerData, 
    env: Env,
    expirationTtl?: number  // Optional - defaults to no expiration
): Promise<void> {
    // Customer accounts persist indefinitely (no TTL) by default
    const putOptions = expirationTtl ? { expirationTtl } : undefined;
    await env.OTP_AUTH_KV.put(customerKey, JSON.stringify(customerData), putOptions);
    
    // Email mapping also persists indefinitely
    await env.OTP_AUTH_KV.put(emailMappingKey, customerId, putOptions);
}
```

**Key Points:**
- Customer accounts stored without TTL by default
- Email-to-customerId mapping also persists indefinitely
- Allows recovery by email even after user account deletion

### Customer Account Recovery

**File:** `handlers/auth/customer-creation.ts`

```typescript
export async function ensureCustomerAccount(
    email: string,
    customerId: string | null,
    env: Env
): Promise<string | null> {
    // 1. If customerId provided, verify it exists
    if (customerId) {
        const existing = await getCustomer(customerId, env);
        if (existing) {
            // Reactivate if suspended/cancelled
            if (existing.status === 'suspended' || existing.status === 'cancelled') {
                existing.status = 'active';
                await storeCustomer(customerId, existing, env);
            }
            return customerId;
        }
    }
    
    // 2. Check for existing customer by email (smart recovery)
    const existingCustomer = await getCustomerByEmail(emailLower, env);
    if (existingCustomer) {
        // Reactivate if suspended/cancelled
        if (existingCustomer.status === 'suspended' || existingCustomer.status === 'cancelled') {
            existingCustomer.status = 'active';
            await storeCustomer(existingCustomer.customerId, existingCustomer, env);
        }
        return existingCustomer.customerId;
    }
    
    // 3. Create new customer account if none exists
    // ... (new account creation logic)
}
```

**Key Points:**
- Always checks for existing customer by email first
- Automatically reactivates suspended/cancelled accounts
- Returns recovered customerId if found
- Creates new customer only if none exists

### User Account Recovery

**File:** `handlers/auth/verify-otp.ts`

```typescript
async function getOrCreateUser(
    email: string,
    customerId: string | null,  // Recovered customerId from ensureCustomerAccount
    env: Env
): Promise<User> {
    const userKey = getCustomerKey(customerId, `user_${emailHash}`);
    let user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });
    
    // If user doesn't exist but we have customerId, this is account recovery
    if (!user && customerId) {
        console.log(`[User Recovery] Recreating user account with recovered customerId: ${customerId}`);
    }
    
    if (!user) {
        // Create new user account with recovered customerId
        user = {
            userId,
            email: emailLower,
            displayName,
            customerId: customerId || null,  // Uses recovered customerId
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
        };
        await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
    }
    
    return user;
}
```

**Key Points:**
- Uses recovered customerId when creating new user account
- Links user to existing customer account
- User account has 1-year TTL (can be cleaned up)
- Customer account persists (retains information)

---

## Benefits

### 1. **Indefinite Customer Data Retention**
- Customer accounts never expire
- Customer information (subscriptions, tiers, flairs, etc.) is retained
- Email-to-customerId mapping persists for recovery

### 2. **Automated User Account Cleanup**
- User accounts expire after 1 year of inactivity
- Reduces storage costs for inactive accounts
- User preferences also expire with user accounts

### 3. **Smart Account Recovery**
- Automatic recovery by email lookup
- Reactivation of suspended/cancelled accounts
- Seamless user experience (no manual recovery needed)

### 4. **Data Consistency**
- User accounts always linked to customer accounts
- CustomerId preserved across account lifecycle
- No orphaned customer accounts

---

## Storage Architecture

### Customer Account Keys

```
customer_{customerId}                    # Customer data (no TTL)
email_to_customer_{emailHash}            # Email mapping (no TTL)
```

### User Account Keys

```
cust_{customerId}_user_{emailHash}      # User data (1-year TTL)
cust_{customerId}_preferences_{userId}   # User preferences (1-year TTL)
```

### Recovery Process

1. **Email Lookup:**
   ```
   email_to_customer_{emailHash} [EMOJI] customerId
   ```

2. **Customer Recovery:**
   ```
   customer_{customerId} [EMOJI] CustomerData
   ```

3. **User Recreation:**
   ```
   cust_{customerId}_user_{emailHash} [EMOJI] UserData (new, 1-year TTL)
   ```

---

## Edge Cases Handled

### 1. **Customer Account Suspended/Cancelled**
- Automatically reactivated to 'active' status
- Updated timestamp recorded
- User can immediately use recovered account

### 2. **CustomerId in JWT but Customer Doesn't Exist**
- Falls back to email lookup
- Recovers customer account if found
- Creates new customer only if none exists

### 3. **User Account Exists but CustomerId Missing**
- CustomerId is set from recovered customer account
- Ensures data consistency
- Updates user account with correct customerId

### 4. **Multiple Accounts with Same Email**
- Email-to-customerId mapping ensures single customer per email
- Latest customer account is used
- Prevents duplicate customer accounts

---

## Testing Scenarios

### Test 1: Account Recovery After Deletion
```
1. Create user account with customerId: cust_abc123
2. Wait for user account to expire (or manually delete)
3. Sign in again with same email
4. Verify: Customer account recovered, user account recreated
```

### Test 2: Suspended Account Reactivation
```
1. Suspend customer account (status: 'suspended')
2. Sign in with email
3. Verify: Customer account reactivated (status: 'active')
```

### Test 3: New User Creation
```
1. Sign up with new email
2. Verify: New customer account created (no TTL)
3. Verify: New user account created (1-year TTL)
4. Verify: Email mapping stored (no TTL)
```

### Test 4: Existing User Login
```
1. Sign in with existing account
2. Verify: Customer account found (no new creation)
3. Verify: User account updated (lastLogin, TTL reset)
```

---

## Configuration

### Customer Account TTL
- **Default:** No expiration (indefinite)
- **Override:** Can set `expirationTtl` parameter in `storeCustomer()` for special cases
- **Recommendation:** Never set TTL on customer accounts (defeats recovery purpose)

### User Account TTL
- **Current:** 1 year (31536000 seconds)
- **Location:** `handlers/auth/verify-otp.ts:73`
- **Reset:** TTL resets on every login

### User Preferences TTL
- **Current:** 1 year (31536000 seconds)
- **Location:** `services/user-preferences.ts`
- **Reset:** TTL resets on every login

---

## Migration Notes

### Existing Customer Accounts
- All existing customer accounts already have no TTL
- No migration needed
- Email mappings also have no TTL

### Existing User Accounts
- Continue with 1-year TTL
- Will be recovered if customer account exists
- No data loss on recovery

---

## Security Considerations

1. **Email Verification Required**
   - OTP verification ensures email ownership
   - Prevents unauthorized account recovery
   - Email must be verified before recovery

2. **Customer Account Status**
   - Suspended/cancelled accounts are reactivated
   - Consider adding admin approval for reactivation if needed
   - Current implementation auto-reactivates for user convenience

3. **Data Privacy**
   - Customer accounts retain all historical data
   - User accounts are recreated (fresh start)
   - Preferences reset to defaults on recovery

---

## Future Enhancements

1. **Recovery Notification**
   - Notify user when account is recovered
   - Email notification with recovery details
   - Dashboard notification

2. **Recovery Audit Log**
   - Track all account recoveries
   - Log recovery timestamps and reasons
   - Admin dashboard for recovery history

3. **Selective Data Recovery**
   - Option to restore user preferences from backup
   - Option to restore display name history
   - User choice on what to recover

4. **Account Merge**
   - Merge multiple customer accounts with same email
   - Consolidate customer data
   - Prevent duplicate accounts

---

**Status:** [SUCCESS] **IMPLEMENTED**
**Last Updated:** 2024-12-19
**Files Modified:**
- `serverless/otp-auth-service/services/customer.ts`
- `serverless/otp-auth-service/handlers/auth/customer-creation.ts`
- `serverless/otp-auth-service/handlers/auth/verify-otp.ts`

