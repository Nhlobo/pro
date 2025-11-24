import React from 'react';
import { SecureDataDisplay } from './SecureDataDisplay';
import { Badge } from '@/components/ui/badge';
import { Building2, User, MapPin, Hash } from 'lucide-react';

interface SecureLawFirmData {
  id: string;
  name: string;
  contact_person: string;
  attorney_role: string;
  province: string;
  code: string;
  created_at: string;
  phone_masked: string;
  email_masked: string;
  address_masked?: string;
}

interface SecureLawFirmDisplayProps {
  lawFirm: SecureLawFirmData;
  showSensitiveData?: boolean;
  className?: string;
}

export const SecureLawFirmDisplay: React.FC<SecureLawFirmDisplayProps> = ({
  lawFirm,
  showSensitiveData = true,
  className = '',
}) => {
  const getMatterTypeBadge = (matterType: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'motor_vehicle_accident': 'default',
      'slip_and_fall': 'secondary', 
      'medical_malpractice': 'destructive',
      'workplace_injury': 'outline',
    };
    return (
      <Badge variant={variants[matterType] || 'default'}>
        {matterType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'senior_partner': 'default',
      'partner': 'secondary',
      'associate': 'outline',
      'junior_associate': 'outline',
    };
    return (
      <Badge variant={variants[role] || 'outline'}>
        {role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
      </Badge>
    );
  };

  return (
    <div className={`space-y-4 p-4 border rounded-lg bg-card ${className}`}>
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold text-lg">{lawFirm.name}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Hash className="h-3 w-3" />
            Code: {lawFirm.code}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            <strong>Contact Person:</strong> {lawFirm.contact_person}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            <strong>Province:</strong> {lawFirm.province || 'N/A'}
          </span>
        </div>

        {lawFirm.attorney_role && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Role:</span>
            {getRoleBadge(lawFirm.attorney_role)}
          </div>
        )}
      </div>

      {showSensitiveData && (
        <div className="space-y-2 pt-2 border-t">
          <SecureDataDisplay
            data={lawFirm.phone_masked}
            type="phone"
            label="Phone"
            requiresPermission="view_referring_attorney_contacts"
          />
          
          <SecureDataDisplay
            data={lawFirm.email_masked}
            type="email"
            label="Email"
            requiresPermission="view_referring_attorney_contacts"
          />
          
          {lawFirm.address_masked && (
            <SecureDataDisplay
              data={lawFirm.address_masked}
              type="address"
              label="Address"
              requiresPermission="view_referring_attorney_contacts"
            />
          )}
        </div>
      )}

      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          Added: {new Date(lawFirm.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};