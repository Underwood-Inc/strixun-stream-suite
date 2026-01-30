/**
 * Admin Route Component
 * Redirects to landing page if user doesn't have admin panel access
 * 
 * Access is granted to users with:
 * - Super admin role (wildcard permission)
 * - Admin role (has access:admin-panel permission)
 * - Moderator role (has access:admin-panel permission for mod review)
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useAdminAccess } from '../../hooks/useAdminAccess';

interface AdminRouteProps {
    children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
    const { isAuthenticated, isSuperAdmin } = useAuthStore();
    const { hasAdminPanelAccess, isLoading } = useAdminAccess();

    // Not authenticated - redirect immediately
    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }
    
    // Super admin always has access (fast path using auth store)
    if (isSuperAdmin) {
        return <>{children}</>;
    }
    
    // Still loading permissions - show nothing (or could show a loading state)
    if (isLoading) {
        return null;
    }

    // Check if user has admin panel access permission
    if (!hasAdminPanelAccess) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

