import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MedicalExpertFormPage from '@/pages/MedicalExpertFormPage';

interface ExpertFormModuleProps {
  editExpertId?: string | null;
  onSaved?: () => void;
}

const ExpertFormModule: React.FC<ExpertFormModuleProps> = ({ editExpertId, onSaved }) => {
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
    <div className="mt-2 [&>div>div:first-child]:hidden [&>nav]:hidden [&>footer]:hidden">
      <MedicalExpertFormPage editExpertId={editExpertId} onSaved={onSaved} />
    </div>
  );
};

export default ExpertFormModule;
