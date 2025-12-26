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
    handleActivateCustomer, handleAdminGetMe, handleSuspendCustomer, handleUpdateCustomerStatus, handleUpdateMe
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
    handleDeleteUserData, handleExportUserData, handleGetAuditLogs
} from './admin/gdpr.js';

