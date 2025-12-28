/**
 * Admin Route Component
 * Redirects to landing page if user is not a super admin
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

interface AdminRouteProps {
    children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
    const { isAuthenticated, isSuperAdmin } = useAuthStore();

    if (!isAuthenticated || !isSuperAdmin) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

