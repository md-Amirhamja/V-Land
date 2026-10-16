import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/** Signs the admin out after `minutes` without any interaction. */
export function useIdleLogout(minutes = 30) {
  const { signOut, session } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!session) return;
    let timer: number;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => { await signOut(); nav('/admin/login', { replace: true, state: { reason: 'idle' } }); }, minutes * 60_000);
    };
    const ev = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    ev.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => { window.clearTimeout(timer); ev.forEach((e) => window.removeEventListener(e, arm)); };
  }, [session, signOut, nav, minutes]);
}
