import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ModListPage } from './pages/ModListPage';
import { ModDetailPage } from './pages/ModDetailPage';
import { ModUploadPage } from './pages/ModUploadPage';
import { ModManagePage } from './pages/ModManagePage';
import { ModReviewPage } from './pages/ModReviewPage';
import { AdminPanel } from './pages/AdminPanel';
import { R2ManagementPage } from './pages/R2ManagementPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { UserDashboardPage } from './pages/UserDashboardPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { PublicUserProfilePage } from './pages/PublicUserProfilePage';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { AdminRoute } from './components/routing/AdminRoute';
import { UploadPermissionRoute } from './components/routing/UploadPermissionRoute';

function ConditionalLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const isLoginPage = location.pathname === '/login';

    if (isLoginPage) {
        return <>{children}</>;
    }

    return <Layout>{children}</Layout>;
}

export function App() {
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
                                <UserDashboardPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/profile" 
                        element={
                            <ProtectedRoute>
                                <UserProfilePage />
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
                        path="/admin/users" 
                        element={
                            <AdminRoute>
                                <UserManagementPage />
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
                    {/* Support both /users/:username and /:username for user profiles (for subdomain and non-subdomain) */}
                    <Route path="/users/:username" element={<PublicUserProfilePage />} />
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

