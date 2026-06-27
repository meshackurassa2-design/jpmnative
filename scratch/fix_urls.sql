UPDATE video_generations
SET video_url = video_url || '&key=YOUR_API_KEY_HERE'
WHERE video_url LIKE 'https://generativelanguage%' 
  AND video_url NOT LIKE '%key=%';
