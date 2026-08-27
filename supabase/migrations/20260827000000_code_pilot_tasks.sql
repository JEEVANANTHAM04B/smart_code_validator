-- Tasks defined by Admin
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  instructions text,
  document_id uuid REFERENCES public.employee_files(id) ON DELETE SET NULL,
  language text NOT NULL CHECK (language IN ('python', 'sql')),
  expected_output text,
  requirements text,
  validation_criteria text,
  due_date timestamptz,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Targeted Employee Task Assignments
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  employee_uuid uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Assigned' CHECK (status IN ('Assigned', 'In Progress', 'Attempted', 'Completed', 'Submitted')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  submitted_at timestamptz,
  CONSTRAINT unique_task_employee UNIQUE (task_id, employee_uuid)
);

-- In-App Webpage Notification Bar entries
CREATE TABLE IF NOT EXISTS public.task_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_uuid uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Task/Question level workspace & attempts
CREATE TABLE IF NOT EXISTS public.task_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_assignment_id uuid NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE,
  question_index integer NOT NULL DEFAULT 1,
  code text NOT NULL,
  language text NOT NULL CHECK (language IN ('python', 'sql')),
  syntax_status text NOT NULL DEFAULT 'passed',
  execution_status text NOT NULL DEFAULT 'success',
  output_match_status text NOT NULL DEFAULT 'matched',
  verdict text NOT NULL CHECK (verdict IN ('accepted', 'rejected')),
  actual_output text,
  execution_error text,
  score integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- Grants & Security
GRANT ALL ON public.tasks TO service_role, authenticated, anon;
GRANT ALL ON public.task_assignments TO service_role, authenticated, anon;
GRANT ALL ON public.task_notifications TO service_role, authenticated, anon;
GRANT ALL ON public.task_attempts TO service_role, authenticated, anon;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow insert tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update tasks" ON public.tasks FOR UPDATE USING (true);

CREATE POLICY "Allow read task_assignments" ON public.task_assignments FOR SELECT USING (true);
CREATE POLICY "Allow insert task_assignments" ON public.task_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update task_assignments" ON public.task_assignments FOR UPDATE USING (true);

CREATE POLICY "Allow read task_notifications" ON public.task_notifications FOR SELECT USING (true);
CREATE POLICY "Allow insert task_notifications" ON public.task_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update task_notifications" ON public.task_notifications FOR UPDATE USING (true);

CREATE POLICY "Allow read task_attempts" ON public.task_attempts FOR SELECT USING (true);
CREATE POLICY "Allow insert task_attempts" ON public.task_attempts FOR INSERT WITH CHECK (true);
