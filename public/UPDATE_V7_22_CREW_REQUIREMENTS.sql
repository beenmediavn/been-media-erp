-- BEEN MEDIA ERP V7.22 - so luong tho can cho moi Job
alter table public.jobs add column if not exists required_photo_count integer not null default 0;
alter table public.jobs add column if not exists required_video_count integer not null default 0;
notify pgrst, 'reload schema';
