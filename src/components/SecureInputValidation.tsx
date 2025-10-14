import React from 'react';
import { z } from 'zod';
import { AlertCircle, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Input validation schemas for security compliance
export const securitySchemas = {
  // Personal Information Schemas
  personalName: z.string()
    .trim()
    .nonempty({ message: "Name is required" })
    .min(1, { message: "Name must be at least 1 character" })
    .max(100, { message: "Name must be less than 100 characters" })
    .regex(/^[a-zA-Z\s\-'\.]+$/, { message: "Name contains invalid characters" }),

  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),

  phone: z.string()
    .trim()
    .nonempty({ message: "Phone number is required" })
    .min(10, { message: "Phone number must be at least 10 digits" })
    .max(15, { message: "Phone number must be less than 15 digits" })
    .regex(/^[\+]?[0-9\s\-\(\)]+$/, { message: "Invalid phone number format" }),

  // Address and Location Schemas  
  address: z.string()
    .trim()
    .max(500, { message: "Address must be less than 500 characters" })
    .optional(),

  // Professional Information Schemas
  lawFirmName: z.string()
    .trim()
    .nonempty({ message: "Law firm name is required" })
    .max(200, { message: "Law firm name must be less than 200 characters" }),

  // Content Schemas
  notes: z.string()
    .trim()
    .max(2000, { message: "Notes must be less than 2000 characters" })
    .optional(),

  // System Schemas
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password must be less than 128 characters" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
      message: "Password must contain uppercase, lowercase, number, and special character"
    }),

  // File Upload Schemas
  fileName: z.string()
    .trim()
    .max(255, { message: "File name must be less than 255 characters" })
    .regex(/^[a-zA-Z0-9\s\-_\.]+$/, { message: "File name contains invalid characters" }),
};

interface SecureInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  schema: z.ZodString;
  type?: 'text' | 'email' | 'tel' | 'password';
  placeholder?: string;
  required?: boolean;
  className?: string;
  multiline?: boolean;
  rows?: number;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const SecureInput: React.FC<SecureInputProps> = ({
  label,
  value,
  onChange,
  schema,
  type = 'text',
  placeholder,
  required = false,
  className = '',
  multiline = false,
  rows = 3
}) => {
  const [validationResult, setValidationResult] = React.useState<ValidationResult>({ isValid: true });
  const [touched, setTouched] = React.useState(false);

  const validateInput = (inputValue: string): ValidationResult => {
    try {
      schema.parse(inputValue);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          error: error.issues[0]?.message || 'Invalid input'
        };
      }
      return { isValid: false, error: 'Validation failed' };
    }
  };

  const handleChange = (newValue: string) => {
    onChange(newValue);
    
    if (touched) {
      const result = validateInput(newValue);
      setValidationResult(result);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    const result = validateInput(value);
    setValidationResult(result);
  };

  const inputId = `secure-input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={inputId} className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-kutlwano-blue" />
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      
      {multiline ? (
        <Textarea
          id={inputId}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={rows}
          className={`
            ${!validationResult.isValid && touched 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-kutlwano-blue/20 focus:border-kutlwano-blue'
            }
          `}
        />
      ) : (
        <Input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`
            ${!validationResult.isValid && touched 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-kutlwano-blue/20 focus:border-kutlwano-blue'
            }
          `}
        />
      )}
      
      {!validationResult.isValid && touched && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          {validationResult.error}
        </div>
      )}
      
      {validationResult.isValid && touched && (
        <div className="text-green-600 text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Input validated and secure
        </div>
      )}
    </div>
  );
};

// Utility function to sanitize user input for external API calls
export const sanitizeForExternalAPI = (input: string): string => {
  return encodeURIComponent(input.trim());
};

// Utility function to validate and format phone numbers
export const validatePhoneNumber = (phone: string): { isValid: boolean; formatted?: string } => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    // Format as international number if it doesn't start with +
    const formatted = cleaned.startsWith('27') ? `+${cleaned}` : 
                     cleaned.length === 10 ? `+27${cleaned}` : 
                     `+${cleaned}`;
    
    return { isValid: true, formatted };
  }
  
  return { isValid: false };
};

// Utility function to validate and format email addresses
export const validateEmailDomain = (email: string): { isValid: boolean; domain?: string } => {
  try {
    securitySchemas.email.parse(email);
    const domain = email.split('@')[1];
    return { isValid: true, domain };
  } catch {
    return { isValid: false };
  }
};

// Security validation for file uploads
export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ];

  if (file.size > maxSize) {
    return { isValid: false, error: 'File size must be less than 10MB' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid file type. Only PDF, Word documents, and images are allowed.' };
  }

  // Validate file name
  try {
    securitySchemas.fileName.parse(file.name);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.issues[0]?.message || 'Invalid file name' };
    }
    return { isValid: false, error: 'File validation failed' };
  }
};