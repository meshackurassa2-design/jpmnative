-- Function to distribute AdMob revenue fairly, with a strict $0.01 RPM cap
CREATE OR REPLACE FUNCTION distribute_admob_revenue(
  p_total_revenue numeric,
  p_admin_cut_percentage numeric
) RETURNS json AS $$
DECLARE
  v_creator_pool numeric;
  v_total_unpaid_views bigint := 0;
  v_rpm numeric := 0;
  v_rec record;
  v_distributed_count int := 0;
BEGIN
  -- Calculate the amount available for creators
  v_creator_pool := p_total_revenue * (1.0 - (p_admin_cut_percentage / 100.0));

  -- Find total unpaid views from approved creators
  SELECT COALESCE(SUM(p.view_count - COALESCE(p.paid_views_count, 0)), 0)
  INTO v_total_unpaid_views
  FROM posts p
  JOIN profiles pr ON pr.id = p.creator_id
  WHERE (p.view_count - COALESCE(p.paid_views_count, 0)) > 0
    AND pr.settings->>'creator_application_status' = 'approved';

  IF v_total_unpaid_views = 0 THEN
    RETURN json_build_object('success', false, 'message', 'No unpaid views found');
  END IF;

  -- Calculate actual value of 1,000 views (RPM)
  v_rpm := (v_creator_pool / v_total_unpaid_views) * 1000.0;
  
  -- STRICT CAP: Do not allow RPM to exceed $0.01
  IF v_rpm > 0.01 THEN
    v_rpm := 0.01;
  END IF;

  -- Distribute the exact amount to each creator
  FOR v_rec IN 
    SELECT p.creator_id, SUM(p.view_count - COALESCE(p.paid_views_count, 0)) as unpaid_views
    FROM posts p
    JOIN profiles pr ON pr.id = p.creator_id
    WHERE (p.view_count - COALESCE(p.paid_views_count, 0)) > 0
      AND pr.settings->>'creator_application_status' = 'approved'
    GROUP BY p.creator_id
  LOOP
    -- Add the earnings to their dashboard
    UPDATE profiles
    SET monetization_earnings = COALESCE(monetization_earnings, 0) + (v_rec.unpaid_views * (v_rpm / 1000.0))
    WHERE id = v_rec.creator_id;
    
    v_distributed_count := v_distributed_count + 1;
  END LOOP;

  -- Update posts to mark these views as "paid" so they aren't paid again tomorrow
  UPDATE posts
  SET paid_views_count = view_count
  WHERE (view_count - COALESCE(paid_views_count, 0)) > 0
    AND creator_id IN (
      SELECT id FROM profiles WHERE settings->>'creator_application_status' = 'approved'
    );

  RETURN json_build_object(
    'success', true, 
    'message', 'Revenue distributed successfully with $0.01 RPM cap',
    'creator_pool', v_creator_pool,
    'total_unpaid_views', v_total_unpaid_views,
    'rpm', v_rpm,
    'creators_paid', v_distributed_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
