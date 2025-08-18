-- Fix security vulnerability in law_firms table
-- Remove overly permissive policy that exposes all law firms' contact information

-- Drop the problematic policy that allows all authenticated users to view all law firms
DROP POLICY IF EXISTS "Authenticated users can view law firms" ON public.law_firms;

-- The existing secure policies remain:
-- 1. "Users can view their own law firm" - allows users to see only their law firm
-- 2. "Admins can manage law firms" - allows admins to manage all law firms
-- 3. "Authenticated users can create law firms" - allows creating new law firms

-- This ensures users can only access their own law firm's sensitive contact information
-- while maintaining admin access and the ability to create new law firms