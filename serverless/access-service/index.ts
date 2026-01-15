/**
 * Access Service - Public Type Exports
 * 
 * This file exports types that other services can import and use.
 * Services should import from '@strixun/access-service' to get these types.
 */

export type {
    CustomerAuthorization,
    RoleDefinition,
    PermissionDefinition,
    QuotaInfo,
    QuotaMap,
    AuditLogEntry,
    AuditAction,
    CheckPermissionRequest,
    CheckPermissionResponse,
    CheckQuotaRequest,
    CheckQuotaResponse,
} from './types/authorization.js';
