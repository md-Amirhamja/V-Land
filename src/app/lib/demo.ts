// Demo-only credentials (README states this). They are real Supabase Auth users with dummy passwords,
// so the role checks are genuine even though the passwords are not secret.
export const DEMO = {
  citizen: { email: 'citizen.demo@example.com', password: 'Citizen@2026' },
  admin: { email: 'admin.demo@example.com', password: 'Admin@2026' },
} as const;
