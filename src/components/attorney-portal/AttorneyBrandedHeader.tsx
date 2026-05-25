import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown, FileText, CreditCard, Calendar, Bell,
  Building2, LogOut, User, Upload, Download, ClipboardList,
  FileSignature, Scale, Briefcase, CalendarPlus, Home, Phone
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import InternalChatWidget from '@/components/internalChat/InternalChatWidget';

interface AttorneyBrandedHeaderProps {
  attorneyName?: string;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
  showBackButton?: boolean;
  backTo?: string;
}

const AttorneyBrandedHeader: React.FC<AttorneyBrandedHeaderProps> = ({
  attorneyName,
  onTabChange,
  activeTab,
  showBackButton = true,
  backTo = '/',
}) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleNav = (tab: string) => {
    if (onTabChange) onTabChange(tab);
  };

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b shadow-md"
      style={{ background: 'linear-gradient(135deg, hsl(var(--kutlwano-blue)), hsl(var(--kutlwano-teal)))' }}
    >
      {/* Top brand bar */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Company Name */}
          <div className="flex items-center gap-3 min-w-0">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backTo)}
                className="text-white/80 hover:text-white hover:bg-white/10 shrink-0 px-2"
              >
                <Home className="h-4 w-4" />
              </Button>
            )}
            <div className="bg-white/10 backdrop-blur-sm p-1.5 rounded-lg border border-white/20 shrink-0">
              <Scale className="h-9 w-9 text-white" />
            </div>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-white font-bold text-base leading-tight truncate">
                Medico-Legal Pro
              </h1>
              <p className="text-white/75 text-xs leading-tight">Medico-Legal Services</p>
            </div>
          </div>

          {/* Right side: attorney name + sign out */}
          <div className="flex items-center gap-2 shrink-0">
            {attorneyName && (
              <div className="hidden md:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 border border-white/20">
                <User className="h-3.5 w-3.5 text-white/70" />
                <span className="text-white text-xs font-medium truncate max-w-[180px]">{attorneyName}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="text-white/80 hover:text-white hover:bg-white/10 gap-1 px-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Navigation dropdown bar */}
        <nav className="flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide">
          {/* Dashboard */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav('profile')}
            className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'profile' ? 'bg-white/20 text-white' : ''}`}
          >
            <Building2 className="h-3.5 w-3.5 mr-1" />
            Profile
          </Button>

          {/* Case Status (Claimant-centric dashboard) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav('case-status')}
            className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'case-status' ? 'bg-white/20 text-white' : ''}`}
          >
            <ClipboardList className="h-3.5 w-3.5 mr-1" />
            Case Status
          </Button>

          {/* Cases — single tap, fetches reports uploaded from scheduled assessments in real-time */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav('cases')}
            className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'cases' ? 'bg-white/20 text-white' : ''}`}
          >
            <Briefcase className="h-3.5 w-3.5 mr-1" />
            View All Cases
          </Button>

          {/* Documents — Supporting Documents from Document Vault */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav('documents')}
            className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'documents' ? 'bg-white/20 text-white' : ''}`}
          >
            <FileSignature className="h-3.5 w-3.5 mr-1" />
            Supporting Documents
          </Button>

          {/* Request Appointment — email request only with CC */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav('request')}
            className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'request' ? 'bg-white/20 text-white' : ''}`}
          >
            <CalendarPlus className="h-3.5 w-3.5 mr-1" />
            Request Appointment
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav('notifications')}
            className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'notifications' ? 'bg-white/20 text-white' : ''}`}
          >
            <Bell className="h-3.5 w-3.5 mr-1" />
            Notifications
          </Button>

          {/* Contact Us */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/contact-us')}
            className="text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0"
          >
            <Phone className="h-3.5 w-3.5 mr-1" />
            Contact Us
          </Button>
        </nav>
      </div>

      {/* Bottom accent line */}
      <div className="h-0.5 bg-white/20" />
    </header>
    <InternalChatWidget />
    </>
  );
};

export default AttorneyBrandedHeader;
