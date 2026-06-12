const fs = require('fs');

const path1 = 'C:/jpm_app/supabase/05_vouchers.sql';
let content1 = fs.readFileSync(path1, 'utf8');

const newFunction = `

-- Admin helper function to easily generate batches of vouchers
CREATE OR REPLACE FUNCTION generate_vouchers(p_value INTEGER, p_count INTEGER)
RETURNS TABLE(generated_code VARCHAR, value INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i INT;
    random_code VARCHAR(20);
BEGIN
    FOR i IN 1..p_count LOOP
        -- Generate format like: 2500-COIN-X8Y9Z0
        random_code := p_value::text || '-COIN-' || upper(substring(md5(random()::text) from 1 for 6));
        
        INSERT INTO vouchers (code, coin_value) 
        VALUES (random_code, p_value)
        ON CONFLICT (code) DO NOTHING;
        
        generated_code := random_code;
        value := p_value;
        RETURN NEXT;
    END LOOP;
END;
$$;
`;

if (!content1.includes('generate_vouchers')) {
    content1 += newFunction;
    fs.writeFileSync(path1, content1, 'utf8');
}

const path2 = 'C:/jpm_app/supabase/generate_vouchers_script.sql';
const content2 = `-- RUN THIS SCRIPT IN YOUR SUPABASE SQL EDITOR TO GENERATE NEW VOUCHERS --
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
`;

fs.writeFileSync(path2, content2, 'utf8');
console.log("SQL files updated for multiple voucher classes.");
