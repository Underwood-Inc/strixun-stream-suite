/**
 * Admin Handlers
 * Re-exports all admin handlers from sub-modules
 */

// API Key Management
export {
    handleCreateApiKey, handleListApiKeys, handleRevokeApiKey, handleRotateApiKey, handleRevealApiKey
} from './admin/api-keys.js';

// Configuration Management
export {
    handleGetConfig,
    handleUpdateConfig,
    handleUpdateEmailConfig
} from './admin/config.js';

// Customer Management
export {
    handleActivateCustomer, handleSuspendCustomer, handleUpdateCustomerStatus, handleListCustomersEnriched
} from './admin/customers.js';

// Analytics
export {
    handleGetAnalytics, handleGetErrorAnalytics, handleGetRealtimeAnalytics, handleGetEmailAnalytics
} from './admin/analytics.js';

// Onboarding
export {
    handleGetOnboarding, handleTestOTP, handleUpdateOnboarding
} from './admin/onboarding.js';

// GDPR
export {
    handleDeleteCustomerData, handleExportCustomerData, handleGetAuditLogs
} from './admin/gdpr.js';

// API Key Usage
export {
    handleGetKeyUsage, handleGetUsageSummary
} from './admin/api-key-usage.js';

// API Key Origins
export {
    handleUpdateKeyOrigins
} from './admin/api-keys.js';
