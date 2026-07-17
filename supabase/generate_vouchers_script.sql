-- RUN THIS SCRIPT IN YOUR SUPABASE SQL EDITOR TO GENERATE NEW VOUCHERS --
-- You can change the numbers below to generate different amounts!
-- Format is: SELECT * FROM generate_vouchers(COIN_VALUE, HOW_MANY_VOUCHERS);

-- Example 1: Generate 10 Starter Pack Vouchers (500 coins)
SELECT * FROM generate_vouchers(500, 10);

-- Example 2: Generate 5 Pro Pack Vouchers (2500 coins)
SELECT * FROM generate_vouchers(2500, 5);

-- Example 3: Generate 2 Business Pack Vouchers (10000 coins)
SELECT * FROM generate_vouchers(10000, 2);

-- To view all unused vouchers of a specific value later:
-- SELECT code, coin_value FROM vouchers WHERE is_used = false AND coin_value = 2500 ORDER BY created_at DESC;
