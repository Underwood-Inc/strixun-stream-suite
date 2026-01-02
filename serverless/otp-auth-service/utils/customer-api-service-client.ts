/**
 * Customer API Service Client
 * 
 * Re-exports from @strixun/api-framework (which re-exports from customer-lookup)
 * This file maintains backward compatibility
 * 
 * @deprecated Use @strixun/api-framework directly for new code (customer-lookup functions are re-exported there)
 */

import { 
    getCustomerService,
    getCustomerByEmailService,
    createCustomer,
    updateCustomer,
    type CustomerData,
    type CustomerLookupEnv 
} from '@strixun/api-framework';

// Re-export types for backward compatibility
export type { CustomerData, CustomerLookupEnv };

// Re-export functions with original names for backward compatibility
export { getCustomerService, getCustomerByEmailService };
export const createCustomerService = createCustomer;
export const updateCustomerService = updateCustomer;
