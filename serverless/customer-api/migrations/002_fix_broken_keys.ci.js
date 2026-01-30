/**
 * Migration 002: Fix Broken Keys from 001
 * 
 * Fixes:
 * - idx:customer:email-to-customer:to_customer_<hash> -> idx:customer:email-to-customer:<hash>
 * - Recreate customer entities from old keys with correct format
 */
export const migration = {
    id: '002_fix_broken_keys',
    description: 'Fix malformed keys from broken 001 migration',
    
    run(namespaceId, kv) {
        console.log('   Fixing broken customer keys...');
        let fixed = 0;
        
        // Fix email index keys - old format is email_to_customer_<hash>
        console.log('     Fixing email indexes...');
        for (const keyInfo of kv.listKeys('email_to_customer_')) {
            const key = keyInfo.name;
            if (!key.startsWith('email_to_customer_')) continue;
            
            // Extract just the hash (skip "email_to_customer_" which is 18 chars)
            const emailHash = key.substring(18);
            const value = kv.kvGet(key);
            
            if (value) {
                const correctKey = `idx:customer:email-to-customer:${emailHash}`;
                console.log(`       ${key} -> ${correctKey}`);
                kv.kvPut(correctKey, value);
                fixed++;
            }
        }
        
        // Fix customer entities - old format is customer_cust_<id>
        console.log('     Fixing customer entities...');
        for (const keyInfo of kv.listKeys('customer_cust_')) {
            const key = keyInfo.name;
            if (!key.startsWith('customer_cust_')) continue;
            if (key.includes('_preferences')) continue; // Handle separately
            if (key.includes('_displayname')) continue; // Skip displayname keys
            
            // Extract customerId (skip "customer_" which is 9 chars)
            const customerId = key.substring(9);
            const value = kv.kvGet(key);
            
            if (value) {
                const correctKey = `customer:customer:${customerId}`;
                console.log(`       ${key} -> ${correctKey}`);
                kv.kvPut(correctKey, value);
                fixed++;
            }
        }
        
        // Fix preferences - old format is customer_cust_<id>_preferences
        console.log('     Fixing preferences...');
        for (const keyInfo of kv.listKeys('customer_cust_')) {
            const key = keyInfo.name;
            if (!key.includes('_preferences')) continue;
            
            // Extract customerId from customer_cust_<id>_preferences
            const match = key.match(/^customer_(cust_[^_]+)_preferences$/);
            if (!match) continue;
            
            const customerId = match[1];
            const value = kv.kvGet(key);
            
            if (value) {
                const correctKey = `customer:preferences:${customerId}`;
                console.log(`       ${key} -> ${correctKey}`);
                kv.kvPut(correctKey, value);
                fixed++;
            }
        }
        
        // Delete malformed keys created by broken 001
        console.log('     Cleaning up malformed keys...');
        for (const keyInfo of kv.listKeys('idx:customer:email-to-customer:to_customer_')) {
            kv.kvDelete(keyInfo.name);
            console.log(`       Deleted: ${keyInfo.name}`);
        }
        
        for (const keyInfo of kv.listKeys('customer:customer:cust_cust_')) {
            kv.kvDelete(keyInfo.name);
            console.log(`       Deleted: ${keyInfo.name}`);
        }
        
        console.log(`   ✅ Fixed ${fixed} keys`);
    }
};
