import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireRole } from '@/auth/RequireRole';
import { supabaseConfigured } from '@/lib/supabase';
import { PortalLayout } from '@/layouts/PortalLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { ToastProvider } from '@/components/ui/overlay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SetupScreen } from '@/components/SetupScreen';
import { FullPageSpinner } from '@/components/ui/core';
import PortalHome from '@/pages/portal/PortalHome';
import PortalVerify from '@/pages/portal/PortalVerify';
import PortalDossier from '@/pages/portal/PortalDossier';
import PortalMy from '@/pages/portal/PortalMy';
import PortalCheck from '@/pages/portal/PortalCheck';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminSandbox from '@/pages/admin/AdminSandbox';
import AdminConsole from '@/pages/admin/AdminConsole';
import LoginPage from '@/pages/LoginPage';
import VerifyCode from '@/pages/public/VerifyCode';
import NotFound from '@/pages/NotFound';

const UiGallery = import.meta.env.DEV ? lazy(() => import('@/pages/portal/UiGallery')) : null;
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } } });

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          {!supabaseConfigured && !(import.meta.env.DEV && location.pathname === '/portal/_ui') ? <SetupScreen /> : (
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <Suspense fallback={<FullPageSpinner />}>
                  <Routes>
                    <Route path="/portal/login" element={<LoginPage kind="citizen" />} />
                    <Route path="/admin/login" element={<LoginPage kind="admin" />} />
                    <Route path="/verify/:code" element={<VerifyCode />} />
                    <Route path="/portal" element={<PortalLayout />}>
                      <Route index element={<PortalHome />} />
                      <Route path="verify" element={<PortalVerify />} />
                      <Route path="plot/:id" element={<PortalDossier />} />
                      <Route path="check" element={<PortalCheck />} />
                      <Route path="my" element={<RequireRole role="citizen"><PortalMy /></RequireRole>} />
                      {UiGallery && <Route path="_ui" element={<UiGallery />} />}
                      <Route path="*" element={<NotFound />} />
                    </Route>
                    <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="sandbox" element={<AdminSandbox />} />
                      <Route path="records" element={<AdminConsole tab="records" />} />
                      <Route path="fraud" element={<AdminConsole tab="fraud" />} />
                      <Route path="inbox" element={<AdminConsole tab="inbox" />} />
                      <Route path="rules" element={<AdminConsole tab="rules" />} />
                      <Route path="reports" element={<AdminConsole tab="reports" />} />
                      <Route path="audit" element={<AdminConsole tab="audit" />} />
                      <Route path="system" element={<AdminConsole tab="system" />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AuthProvider>
            </QueryClientProvider>
          )}
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
