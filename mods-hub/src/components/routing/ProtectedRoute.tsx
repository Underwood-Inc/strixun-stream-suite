/**
 * Protected Route Component
 * Redirects to landing page if user is not authenticated
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated } = useAuthStore();

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

