-- Add publish workflow columns to submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS total_questions integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS correct_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS wrong_count integer NOT NULL DEFAULT 0;

-- Add validation_status to employee_files
ALTER TABLE public.employee_files
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending';
