import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ModListPage } from './pages/ModListPage';
import { ModDetailPage } from './pages/ModDetailPage';
import { ModUploadPage } from './pages/ModUploadPage';
import { ModManagePage } from './pages/ModManagePage';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/layout/Layout';

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
                    <Route path="/mods/:slug" element={<ModDetailPage />} />
                    <Route path="/upload" element={<ModUploadPage />} />
                    <Route path="/manage/:slug" element={<ModManagePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </ConditionalLayout>
        </BrowserRouter>
    );
}

