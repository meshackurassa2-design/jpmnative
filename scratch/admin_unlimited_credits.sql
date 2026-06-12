-- Give admin user unlimited credits (999,999,999 tokens)
-- Also mark them as premium and bypass any spend checks

UPDATE public.profiles 
SET 
  wallet_balance = 999999999,
  is_premium = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'meshackurassa2@gmail.com'
);

-- Verify it worked
SELECT id, full_name, email, wallet_balance, is_premium 
FROM public.profiles 
JOIN auth.users ON auth.users.id = profiles.id
WHERE auth.users.email = 'meshackurassa2@gmail.com';
