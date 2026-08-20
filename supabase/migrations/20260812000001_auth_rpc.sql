CREATE OR REPLACE FUNCTION public.authenticate_employee(p_employee_id text, p_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee record;
BEGIN
  SELECT id, employee_id, name, department, access_status, is_admin
  INTO v_employee
  FROM public.employees
  WHERE employee_id ILIKE p_employee_id AND name ILIKE p_name;

  IF FOUND THEN
    RETURN row_to_json(v_employee);
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.authenticate_employee TO anon, authenticated;
