import React from 'react';
import ExpertCreditControl from '@/pages/ExpertCreditControl';

const ExpertCreditControlModule: React.FC = () => {
  return (
    <div className="mt-2 [&>div>div:first-child]:hidden [&>nav]:hidden [&>footer]:hidden [&>header]:hidden">
      <ExpertCreditControl />
    </div>
  );
};

export default ExpertCreditControlModule;
