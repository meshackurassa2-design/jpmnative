-- Shop Reviews Migration

-- 1. Create shop_reviews table
CREATE TABLE IF NOT EXISTS public.shop_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating DOUBLE PRECISION NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(shop_id, user_id) -- One review per shop per user
);

-- Enable RLS
ALTER TABLE public.shop_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shop reviews" 
    ON public.shop_reviews FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert their own reviews" 
    ON public.shop_reviews FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" 
    ON public.shop_reviews FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
    ON public.shop_reviews FOR DELETE 
    USING (auth.uid() = user_id);

-- 2. Add aggregate columns to shops table
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- 3. Create function to update shop rating
CREATE OR REPLACE FUNCTION update_shop_rating()
RETURNS TRIGGER AS $$
DECLARE
    new_rating DOUBLE PRECISION;
    new_count INTEGER;
BEGIN
    -- Calculate new average rating and count for the shop
    SELECT 
        COALESCE(AVG(rating), 0),
        COUNT(id)
    INTO 
        new_rating,
        new_count
    FROM public.shop_reviews
    WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id);

    -- Update the shop record
    UPDATE public.shops
    SET 
        rating = new_rating,
        review_count = new_count
    WHERE id = COALESCE(NEW.shop_id, OLD.shop_id);

    RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger
DROP TRIGGER IF EXISTS trigger_update_shop_rating ON public.shop_reviews;
CREATE TRIGGER trigger_update_shop_rating
AFTER INSERT OR UPDATE OR DELETE ON public.shop_reviews
FOR EACH ROW
EXECUTE FUNCTION update_shop_rating();

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_reviews;
