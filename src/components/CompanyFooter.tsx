import React from 'react';

const CompanyFooter: React.FC = () => {
  return (
    <footer className="mt-8 py-8 border-t bg-gradient-to-r from-kutlwano-blue via-kutlwano-teal to-kutlwano-blue">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {/* Logo container with background for better visibility */}
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg border border-white/30">
              <img 
                src="/lovable-uploads/d45f27ec-34bf-470c-bc47-015dff5748e0.png" 
                alt="Kutlwano & Associate Logo - Medico Legal Services" 
                className="h-16 object-contain filter drop-shadow-lg"
              />
            </div>
            {/* Company name for extra visibility */}
            <div className="text-white">
              <h3 className="text-lg font-bold text-white drop-shadow-md">
                Kutlwano & Associate
              </h3>
              <p className="text-sm text-white/90 font-medium">
                Medico Legal Services
              </p>
            </div>
          </div>
          <div className="text-center md:text-right">
            <p className="text-white font-medium text-sm drop-shadow-md bg-black/20 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
              "We tough a file, We change a life, We are Kutlwano and Associate"
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default CompanyFooter;