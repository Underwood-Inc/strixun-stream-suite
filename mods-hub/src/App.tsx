import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ModListPage } from './pages/ModListPage';
import { ModDetailPage } from './pages/ModDetailPage';
import { ModUploadPage } from './pages/ModUploadPage';
import { ModManagePage } from './pages/ModManagePage';
import { ModReviewPage } from './pages/ModReviewPage';
import { AdminPanel } from './pages/AdminPanel';
import { R2ManagementPage } from './pages/R2ManagementPage';
import { CustomerManagementPage } from './pages/CustomerManagementPage';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { PublicCustomerProfilePage } from './pages/PublicCustomerProfilePage';
import { LoginPage } from './pages/LoginPage';
import { DraftsPage } from './pages/DraftsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { AdminRoute } from './components/routing/AdminRoute';
import { UploadPermissionRoute } from './components/routing/UploadPermissionRoute';
import { useAuthStore } from './stores/auth';

function ConditionalLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const isLoginPage = location.pathname === '/login';

    if (isLoginPage) {
        return <>{children}</>;
    }

    return <Layout>{children}</Layout>;
}

export function App() {
    const { restoreSession } = useAuthStore();

    // Restore session from backend on app initialization
    // This enables cross-application session sharing for the same device
    // Called early in app lifecycle, similar to main app's loadAuthState()
    useEffect(() => {
        // Always try to restore - it will check if restoration is needed
        // (validates existing tokens, checks expiration, etc.)
        restoreSession().catch(error => {
            console.debug('[App] Session restoration failed (non-critical):', error);
        });
    }, [restoreSession]); // Only run once on mount

    return (
        <BrowserRouter>
            <ConditionalLayout>
                <Routes>
                    <Route path="/" element={<ModListPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route 
                        path="/upload" 
                        element={
                            <UploadPermissionRoute>
                                <ModUploadPage />
                            </UploadPermissionRoute>
                        } 
                    />
                    <Route 
                        path="/dashboard" 
                        element={
                            <ProtectedRoute>
                                <CustomerDashboardPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/drafts" 
                        element={
                            <ProtectedRoute>
                                <DraftsPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/profile" 
                        element={
                            <ProtectedRoute>
                                <CustomerProfilePage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/manage/:slug" 
                        element={
                            <UploadPermissionRoute>
                                <ModManagePage />
                            </UploadPermissionRoute>
                        } 
                    />
                    <Route 
                        path="/admin" 
                        element={
                            <AdminRoute>
                                <AdminPanel />
                            </AdminRoute>
                        } 
                    />
                    <Route 
                        path="/admin/customers" 
                        element={
                            <AdminRoute>
                                <CustomerManagementPage />
                            </AdminRoute>
                        } 
                    />
                    <Route 
                        path="/admin/r2" 
                        element={
                            <AdminRoute>
                                <R2ManagementPage />
                            </AdminRoute>
                        } 
                    />
                    <Route 
                        path="/admin/settings" 
                        element={
                            <AdminRoute>
                                <AdminSettingsPage />
                            </AdminRoute>
                        } 
                    />
                    {/* Support both /customers/:username and /:username for customer profiles (for subdomain and non-subdomain) */}
                    <Route path="/customers/:username" element={<PublicCustomerProfilePage />} />
                    {/* Support both /mods/:slug (for non-subdomain deployments) and /:slug (for mods. subdomain) */}
                    <Route 
                        path="/mods/:slug/review" 
                        element={
                            <ProtectedRoute>
                                <ModReviewPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route path="/mods/:slug" element={<ModDetailPage />} />
                    <Route 
                        path="/:slug/review" 
                        element={
                            <ProtectedRoute>
                                <ModReviewPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route path="/:slug" element={<ModDetailPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </ConditionalLayout>
        </BrowserRouter>
    );
}

