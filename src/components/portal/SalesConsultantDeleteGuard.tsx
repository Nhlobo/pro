import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * Mounted inside AdminPortalLayout when the active user is a sales_consultant.
 * Hides any UI element whose accessible name suggests a destructive action
 * (Delete / Remove / Trash / Discard) and intercepts clicks as a safety net.
 *
 * Strictly UI-side. Server-side enforcement would require RLS policy changes.
 */
const DELETE_RX = /\b(delete|remove|trash|discard)\b/i;

const matchesDeleteIntent = (el: Element | null): boolean => {
  if (!el) return false;
  const aria = (el.getAttribute('aria-label') || '').trim();
  const title = (el.getAttribute('title') || '').trim();
  const text = (el.textContent || '').trim();
  if (DELETE_RX.test(aria) || DELETE_RX.test(title)) return true;
  // Only treat short, button-like text as a delete action to avoid hiding paragraphs
  if (text.length > 0 && text.length <= 40 && DELETE_RX.test(text)) return true;
  return false;
};

const STYLE_ID = 'sc-delete-guard-style';

export const SalesConsultantDeleteGuard: React.FC = () => {
  const { toast } = useToast();

  useEffect(() => {
    // Inject CSS that hides obvious delete triggers
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        [aria-label*="Delete" i],
        [aria-label*="Remove" i],
        [aria-label*="Trash" i],
        [title*="Delete" i],
        [title*="Remove" i],
        [title*="Trash" i],
        button[data-action="delete"],
        [data-role-restrict="no-delete"] {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Click interceptor as a safety net for buttons whose text contains "Delete"
    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const btn = target?.closest('button, a, [role="button"]') as Element | null;
      if (btn && matchesDeleteIntent(btn)) {
        e.preventDefault();
        e.stopPropagation();
        toast({
          title: 'Action restricted',
          description: 'Sales Consultants are not permitted to delete data.',
          variant: 'destructive',
        });
      }
    };
    document.addEventListener('click', handler, true);

    return () => {
      document.removeEventListener('click', handler, true);
      const style = document.getElementById(STYLE_ID);
      if (style) style.remove();
    };
  }, [toast]);

  return null;
};

export default SalesConsultantDeleteGuard;
