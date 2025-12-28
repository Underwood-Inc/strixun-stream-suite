/**
 * User data types for admin user management
 */

export interface UserListItem {
    userId: string;
    displayName: string | null;
    customerId: string | null;
    createdAt: string | null;
    lastLogin: string | null;
    hasUploadPermission: boolean;
    modCount: number;
}

export interface UserDetail extends UserListItem {
    emailHash?: string; // For admin reference only, not the actual email
    approvedAt?: string | null;
}

export interface UserListResponse {
    users: UserListItem[];
    total: number;
    page: number;
    pageSize: number;
}

export interface UpdateUserRequest {
    hasUploadPermission?: boolean;
    [key: string]: any;
}

