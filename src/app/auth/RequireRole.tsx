import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type Role } from './AuthProvider';
import { FullPageSpinner } from '@/components/ui/core';

/** Guards a route by role. Signed out -> login (remembering where you were going). Wrong role -> signed out + explained. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { session, profile, role: myRole, loading, signOut } = useAuth();
  const loc = useLocation();
  const loginPath = role === 'admin' ? '/admin/login' : '/portal/login';
  const wrong = !!session && !!profile && myRole !== role;

  useEffect(() => { if (wrong) void signOut(); }, [wrong, signOut]);

  if (loading) return <FullPageSpinner />;
  if (wrong) return <Navigate to={loginPath} replace state={{ reason: role === 'admin' ? 'notAdmin' : 'notCitizen' }} />;
  if (!session) return <Navigate to={loginPath} replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}
