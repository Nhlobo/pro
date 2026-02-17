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
  FileSignature, Scale, Briefcase, CalendarPlus, Home
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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
              <img
                src="/lovable-uploads/d45f27ec-34bf-470c-bc47-015dff5748e0.png"
                alt="Kutlwano & Associate Logo"
                className="h-9 w-auto object-contain brightness-0 invert"
              />
            </div>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-white font-bold text-base leading-tight truncate">
                Kutlwano & Associate (Pty) Ltd
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

          {/* Cases Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'cases' ? 'bg-white/20 text-white' : ''}`}
              >
                <Briefcase className="h-3.5 w-3.5 mr-1" />
                Cases
                <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 bg-popover z-[60]">
              <DropdownMenuLabel>Case Management</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNav('cases')}>
                <ClipboardList className="h-4 w-4 mr-2 text-primary" />
                View All Cases
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('reports')}>
                <FileText className="h-4 w-4 mr-2 text-secondary" />
                Reports & Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('documents')}>
                <Download className="h-4 w-4 mr-2 text-primary" />
                Download Medico-Reports
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Documents Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'documents' ? 'bg-white/20 text-white' : ''}`}
              >
                <FileSignature className="h-3.5 w-3.5 mr-1" />
                Documents
                <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-popover z-[60]">
              <DropdownMenuLabel>Document Management</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNav('documents')}>
                <Upload className="h-4 w-4 mr-2 text-primary" />
                Upload Claimant Docs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('documents')}>
                <Download className="h-4 w-4 mr-2 text-secondary" />
                Download Medico-Reports
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Document Types</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleNav('documents')}>
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                RAF1 / RAF4 Forms
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('documents')}>
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                Medical Records
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('documents')}>
                <Scale className="h-4 w-4 mr-2 text-muted-foreground" />
                Summons & Affidavits
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('documents')}>
                <FileSignature className="h-4 w-4 mr-2 text-muted-foreground" />
                Instruction Letters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Appointments Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'request' ? 'bg-white/20 text-white' : ''}`}
              >
                <Calendar className="h-3.5 w-3.5 mr-1" />
                Appointments
                <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 bg-popover z-[60]">
              <DropdownMenuLabel>Appointment Services</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNav('request')}>
                <CalendarPlus className="h-4 w-4 mr-2 text-primary" />
                Request Appointment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('request')}>
                <Briefcase className="h-4 w-4 mr-2 text-secondary" />
                Multi-Expert Request
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('request')}>
                <FileSignature className="h-4 w-4 mr-2 text-muted-foreground" />
                Attach Instruction Letter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Finance Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`text-white/80 hover:text-white hover:bg-white/15 text-xs shrink-0 ${activeTab === 'aod-payments' ? 'bg-white/20 text-white' : ''}`}
              >
                <CreditCard className="h-3.5 w-3.5 mr-1" />
                Finance
                <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 bg-popover z-[60]">
              <DropdownMenuLabel>Financial Overview</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNav('aod-payments')}>
                <CreditCard className="h-4 w-4 mr-2 text-primary" />
                AOD & Payments
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('aod-payments')}>
                <ClipboardList className="h-4 w-4 mr-2 text-secondary" />
                Invoice Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNav('aod-payments')}>
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                Payment History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
        </nav>
      </div>

      {/* Bottom accent line */}
      <div className="h-0.5 bg-white/20" />
    </header>
  );
};

export default AttorneyBrandedHeader;
