import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  end?: boolean;
  activeClassName?: string;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, end, className, activeClassName, children, ...props }) => {
  const location = useLocation();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <Link to={to} className={cn(className, isActive && activeClassName)} {...props}>
      {children}
    </Link>
  );
};

export { NavLink };
export default NavLink;
