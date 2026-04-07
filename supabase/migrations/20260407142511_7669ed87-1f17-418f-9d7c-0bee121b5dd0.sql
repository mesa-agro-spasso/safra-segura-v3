INSERT INTO public.user_profiles (id, email, full_name, status, is_admin, access_level, approved_at)
SELECT id, email, 'Mesa Agro', 'active', true, 'full', now()
FROM auth.users
WHERE email = 'mesaagro@grupospasso.com.br'
ON CONFLICT (id) DO UPDATE
SET status='active', is_admin=true, access_level='full', approved_at=now();