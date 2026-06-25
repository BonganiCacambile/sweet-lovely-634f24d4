UPDATE public.delivery_zones
SET image_url = regexp_replace(image_url, '^https?://github\.com/([^/]+)/([^/]+)/blob/(.+?)(\?.*)?$', 'https://raw.githubusercontent.com/\1/\2/\3')
WHERE image_url ~* '^https?://github\.com/[^/]+/[^/]+/blob/';