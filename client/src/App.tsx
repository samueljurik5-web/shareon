import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAdmin, RequireAuth } from './components/Guards';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { ItemFormPage } from './pages/ItemFormPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { ProfilePage } from './pages/ProfilePage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { RequestsPage } from './pages/RequestsPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { ProtectionPage } from './pages/ProtectionPage';
import { ReportPage } from './pages/ReportPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminItems } from './pages/admin/AdminItems';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminSettings } from './pages/admin/AdminSettings';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/items/new" element={<RequireAuth><ItemFormPage /></RequireAuth>} />
        <Route path="/items/:id" element={<ItemDetailPage />} />
        <Route path="/items/:id/edit" element={<RequireAuth><ItemFormPage /></RequireAuth>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/users/:id" element={<PublicProfilePage />} />
        <Route path="/requests" element={<RequireAuth><RequestsPage /></RequireAuth>} />
        <Route path="/requests/:id" element={<RequireAuth><RequestDetailPage /></RequireAuth>} />
        <Route path="/protection" element={<ProtectionPage />} />
        <Route path="/reports/:id" element={<RequireAuth><ReportPage /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="/admin/items" element={<RequireAdmin><AdminItems /></RequireAdmin>} />
        <Route path="/admin/reports" element={<RequireAdmin><AdminReports /></RequireAdmin>} />
        <Route path="/admin/settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
