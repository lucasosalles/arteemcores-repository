
-- Fix 1: Restrict profiles SELECT policy
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Make chamados storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chamados';

-- Fix 3: Replace public storage policies with authenticated ones
DROP POLICY IF EXISTS "Anyone can view chamado photos" ON storage.objects;

CREATE POLICY "Authenticated users can view chamado photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chamados');

-- Fix 4: Add UPDATE policy for chamados storage
CREATE POLICY "Users can update own chamado photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chamados' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Fix 5: Add DELETE policy for chamados storage
CREATE POLICY "Users can delete own chamado photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chamados' AND auth.uid()::text = (storage.foldername(name))[1]);
