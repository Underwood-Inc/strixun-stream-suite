/**
 * Customer API Service Client
 * 
 * Re-exports from consolidated customer-lookup package
 * This file maintains backward compatibility while using the consolidated implementation
 * 
 * @deprecated Use @strixun/customer-lookup directly for new code
 */

import { 
    getCustomerService,
    getCustomerByEmailService,
    createCustomer,
    updateCustomer,
    type CustomerData,
    type CustomerLookupEnv 
} from '@strixun/customer-lookup';

// Re-export types for backward compatibility
export type { CustomerData, CustomerLookupEnv };

// Re-export functions with original names for backward compatibility
export { getCustomerService, getCustomerByEmailService };
export const createCustomerService = createCustomer;
export const updateCustomerService = updateCustomer;
