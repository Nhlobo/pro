import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MedicalExpertFormPage from '@/pages/MedicalExpertFormPage';

interface ExpertFormModuleProps {
  editExpertId?: string | null;
  onSaved?: () => void;
  /** Close the host panel without saving (used by the docked sliding sheet). */
  onCancel?: () => void;
}

const ExpertFormModule: React.FC<ExpertFormModuleProps> = ({ editExpertId, onSaved, onCancel }) => {
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (editExpertId) {
      setSearchParams({ edit: editExpertId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    return () => {
      // Clean up search params when unmounting
      setSearchParams({}, { replace: true });
    };
  }, [editExpertId]);

  return (
    <MedicalExpertFormPage editExpertId={editExpertId} onSaved={onSaved} onCancel={onCancel} embedded />
  );
};

export default ExpertFormModule;
