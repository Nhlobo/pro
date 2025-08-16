import React from 'react';

const CompanyFooter: React.FC = () => {
  return (
    <footer className="mt-8 py-6 border-t bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img 
              src="/lovable-uploads/d45f27ec-34bf-470c-bc47-015dff5748e0.png" 
              alt="Kutlwano & Associate Logo" 
              className="h-12 object-contain brightness-0 invert"
            />
          </div>
          <div className="text-center md:text-right">
            <p className="text-white font-medium text-sm">
              "We tough a file, We change a life, We are Kutlwano and Associate"
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default CompanyFooter;