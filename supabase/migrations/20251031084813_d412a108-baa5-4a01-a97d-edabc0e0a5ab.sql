-- Create case_timelines table to track appointment phases
CREATE TABLE IF NOT EXISTS public.case_timelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  law_firm_id UUID NOT NULL,
  phase_name TEXT NOT NULL,
  phase_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_case_timelines_appointment ON case_timelines(appointment_id);
CREATE INDEX idx_case_timelines_law_firm ON case_timelines(law_firm_id);
CREATE INDEX idx_case_timelines_status ON case_timelines(status);

-- Enable RLS
ALTER TABLE public.case_timelines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view timelines from their law firm"
  ON case_timelines FOR SELECT
  USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create timelines for their law firm"
  ON case_timelines FOR INSERT
  WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can update timelines from their law firm"
  ON case_timelines FOR UPDATE
  USING (law_firm_id = get_current_user_law_firm())
  WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "System admins full access to case timelines"
  ON case_timelines FOR ALL
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- Function to auto-create timeline phases when appointment is created
CREATE OR REPLACE FUNCTION create_case_timeline_phases()
RETURNS TRIGGER AS $$
BEGIN
  -- Create timeline phases for the new appointment
  INSERT INTO case_timelines (appointment_id, law_firm_id, phase_name, phase_order, status, started_at)
  VALUES
    (NEW.id, NEW.law_firm_id, 'Assessment', 1, 'in_progress', NEW.appointment_date),
    (NEW.id, NEW.law_firm_id, 'Preparation of Report', 2, 'pending', NULL),
    (NEW.id, NEW.law_firm_id, 'Report Review', 3, 'pending', NULL),
    (NEW.id, NEW.law_firm_id, 'Submission', 4, 'pending', NULL);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create timeline when appointment is created
CREATE TRIGGER trigger_create_case_timeline
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION create_case_timeline_phases();

-- Function to update timeline phases based on report status changes
CREATE OR REPLACE FUNCTION update_case_timeline_on_report_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When report status changes, update timeline accordingly
  IF NEW.report_status = 'in_progress' AND (OLD.report_status IS NULL OR OLD.report_status != 'in_progress') THEN
    -- Mark Assessment as completed and start Preparation
    UPDATE case_timelines 
    SET status = 'completed', completed_at = now()
    WHERE appointment_id = NEW.appointment_id AND phase_name = 'Assessment' AND status != 'completed';
    
    UPDATE case_timelines 
    SET status = 'in_progress', started_at = now()
    WHERE appointment_id = NEW.appointment_id AND phase_name = 'Preparation of Report' AND status = 'pending';
  END IF;
  
  IF NEW.report_status = 'under_review' AND (OLD.report_status IS NULL OR OLD.report_status != 'under_review') THEN
    -- Mark Preparation as completed and start Review
    UPDATE case_timelines 
    SET status = 'completed', completed_at = now()
    WHERE appointment_id = NEW.appointment_id AND phase_name = 'Preparation of Report' AND status != 'completed';
    
    UPDATE case_timelines 
    SET status = 'in_progress', started_at = now()
    WHERE appointment_id = NEW.appointment_id AND phase_name = 'Report Review' AND status = 'pending';
  END IF;
  
  IF NEW.report_status = 'completed' AND NEW.report_submitted_date IS NOT NULL AND (OLD.report_status IS NULL OR OLD.report_status != 'completed') THEN
    -- Mark Review as completed and start Submission
    UPDATE case_timelines 
    SET status = 'completed', completed_at = now()
    WHERE appointment_id = NEW.appointment_id AND phase_name = 'Report Review' AND status != 'completed';
    
    UPDATE case_timelines 
    SET status = 'in_progress', started_at = now()
    WHERE appointment_id = NEW.appointment_id AND phase_name = 'Submission' AND status = 'pending';
    
    -- Mark Submission as completed when report is submitted
    UPDATE case_timelines 
    SET status = 'completed', completed_at = NEW.report_submitted_date
    WHERE appointment_id = NEW.appointment_id AND phase_name = 'Submission';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on expert_reports to update timeline
CREATE TRIGGER trigger_update_case_timeline_on_report
  AFTER INSERT OR UPDATE ON expert_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_case_timeline_on_report_change();

-- Create updated_at trigger
CREATE TRIGGER update_case_timelines_updated_at
  BEFORE UPDATE ON case_timelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();