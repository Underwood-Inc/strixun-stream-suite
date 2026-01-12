/**
 * Mods Services - Unified Exports
 * Re-exports all mod-related API functions from their focused modules
 */

// Core CRUD
export { 
    API_BASE_URL,
    listMods,
    getModDetail,
    uploadMod,
    updateMod,
    deleteMod,
} from './modsApi';

// Version Management
export {
    uploadVersion,
    deleteModVersion,
    updateModVersion,
    downloadVersion,
} from './modVersionsApi';

// Variant Management
export {
    listVariantVersions,
    deleteVariant,
    updateVariantVersion,
    downloadVariant,
} from './modVariantsApi';

// Ratings
export {
    getModRatings,
    submitModRating,
} from './modRatingsApi';

// Admin Operations
export {
    listAllMods,
    getModReview,
    updateModStatus,
    addReviewComment,
    adminDeleteMod,
    getCustomerMods,
} from './modAdminApi';

// Permissions & Settings
export {
    checkUploadPermission,
    getModSettings,
    getAdminSettings,
    updateAdminSettings,
} from './modPermissionsApi';

// R2 File Management
export {
    listR2Files,
    detectDuplicates,
    deleteR2File,
    bulkDeleteR2Files,
} from './modR2Api';

// R2 Types
export type {
    R2FileInfo,
    R2FileAssociatedMod,
    R2FileAssociatedVersion,
    R2FileAssociatedCustomer,
    R2FileAssociatedData,
} from '../../types/r2';

// Re-export getAuthToken for convenience
export { getAuthToken } from '../authConfig';
