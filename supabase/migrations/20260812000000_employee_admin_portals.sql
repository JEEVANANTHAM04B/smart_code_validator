CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id text NOT NULL UNIQUE,
  name text NOT NULL,
  department text NOT NULL,
  access_status boolean NOT NULL DEFAULT true,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_uuid uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.submissions
  ADD COLUMN employee_uuid uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN file_id uuid REFERENCES public.employee_files(id) ON DELETE SET NULL;

GRANT ALL ON public.employees TO service_role;
GRANT ALL ON public.employee_files TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_files ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.employees FROM anon;
REVOKE ALL ON public.employees FROM authenticated;
REVOKE ALL ON public.employee_files FROM anon;
REVOKE ALL ON public.employee_files FROM authenticated;

-- Seed admin user
INSERT INTO public.employees (employee_id, name, department, is_admin)
VALUES ('8667435676', 'Jeevanantham Balamurugan', 'Cognitive Tech', true)
ON CONFLICT (employee_id) DO NOTHING;

-- Seed additional employee
INSERT INTO public.employees (employee_id, name, department, is_admin)
VALUES ('CI256', 'Sandhiya sri', 'Cognitive Tech', false)
ON CONFLICT (employee_id) DO NOTHING;

-- Insert storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('assessments', 'assessments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Give service role access to assessments bucket"
  ON storage.objects FOR ALL USING (bucket_id = 'assessments') WITH CHECK (bucket_id = 'assessments');
