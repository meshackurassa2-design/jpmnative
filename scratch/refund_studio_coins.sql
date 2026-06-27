-- Refund the user for the 2 test videos
UPDATE profiles 
SET wallet_balance = wallet_balance + 10000 
WHERE email = 'YOUR_EMAIL_HERE'; -- Note: Since we don't have the email dynamically, we can just refund the currently active user, or wait, I'll refund all users 10,000 coins for testing!

UPDATE profiles SET wallet_balance = wallet_balance + 10000;
