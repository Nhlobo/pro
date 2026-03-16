import React from 'react';
import MedicalExpertFormPage from '@/pages/MedicalExpertFormPage';

const ExpertFormModule: React.FC = () => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden [&>nav]:hidden [&>footer]:hidden">
      <MedicalExpertFormPage />
    </div>
  );
};

export default ExpertFormModule;
