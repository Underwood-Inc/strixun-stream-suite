import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ModListPage } from './pages/ModListPage';
import { ModDetailPage } from './pages/ModDetailPage';
import { ModUploadPage } from './pages/ModUploadPage';
import { ModManagePage } from './pages/ModManagePage';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/layout/Layout';

export function App() {
    return (
        <BrowserRouter>
            <Layout>
                <Routes>
                    <Route path="/" element={<ModListPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/mods/:modId" element={<ModDetailPage />} />
                    <Route path="/upload" element={<ModUploadPage />} />
                    <Route path="/manage/:modId" element={<ModManagePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}

