-- Enable Realtime for Messages and Notifications
begin;
  -- Remove tables from publication if they exist to avoid duplicate errors, ignoring errors
  -- (not really needed since ADD TABLE handles it, but just in case)
  
  -- Add to supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
commit;
