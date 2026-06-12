-- Sync products from shops.products JSON into shop_inventory table
DO $$
DECLARE
    shop RECORD;
    product JSONB;
    product_id_text TEXT;
    product_uuid UUID;
BEGIN
    FOR shop IN SELECT id, products FROM shops WHERE products IS NOT NULL AND jsonb_typeof(products) = 'array'
    LOOP
        FOR product IN SELECT * FROM jsonb_array_elements(shop.products)
        LOOP
            -- Get ID as text, remove quotes
            product_id_text := trim(both '"' from (product->'id')::text);
            
            -- If it's a valid UUID, cast it; otherwise generate a new one
            BEGIN
                product_uuid := product_id_text::UUID;
            EXCEPTION WHEN OTHERS THEN
                product_uuid := gen_random_uuid();
            END;

            -- Insert into shop_inventory if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM shop_inventory WHERE id = product_uuid) THEN
                INSERT INTO shop_inventory (
                    id, shop_id, name, category, selling_price, notes, quantity, unit
                ) VALUES (
                    product_uuid,
                    shop.id,
                    trim(both '"' from (product->'name')::text),
                    NULL,
                    NULLIF(trim(both '"' from (product->'price')::text), 'null')::numeric,
                    trim(both '"' from (product->'description')::text),
                    10, -- Default quantity
                    'pcs'
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
