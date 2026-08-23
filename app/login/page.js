ALTER TABLE public.guests
ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.guests
DROP CONSTRAINT IF EXISTS guests_user_id_fkey;

ALTER TABLE public.guests
ADD CONSTRAINT guests_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS guests_user_id_unique
ON public.guests(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS guests_email_idx
ON public.guests(email);

CREATE INDEX IF NOT EXISTS guests_phone_idx
ON public.guests(phone);

NOTIFY pgrst, 'reload schema';