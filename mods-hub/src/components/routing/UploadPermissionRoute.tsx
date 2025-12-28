/**
 * Upload Permission Route Component
 * Redirects to landing page if user doesn't have upload permission
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useUploadPermission } from '../../hooks/useUploadPermission';

interface UploadPermissionRouteProps {
    children: React.ReactNode;
}

export function UploadPermissionRoute({ children }: UploadPermissionRouteProps) {
    const { isAuthenticated } = useAuthStore();
    const { hasPermission, isLoading } = useUploadPermission();

    // Show nothing while checking permissions
    if (isLoading) {
        return null;
    }

    // Redirect if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    // Redirect if no upload permission
    if (!hasPermission) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

