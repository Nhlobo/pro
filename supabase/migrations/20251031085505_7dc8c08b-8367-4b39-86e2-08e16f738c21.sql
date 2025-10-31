-- Fix search_path for security definer functions

-- Update create_case_timeline_phases function with search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update update_case_timeline_on_report_change function with search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;