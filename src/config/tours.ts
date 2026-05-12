import { TourStep } from '@/components/tour/GuidedTour';

export const ADMIN_TOUR_KEY = 'tour:admin:v1';
export const ATTORNEY_TOUR_KEY = 'tour:attorney:v1';
export const EXPERT_TOUR_KEY = 'tour:expert:v1';

export const ADMIN_TOUR: TourStep[] = [
  {
    title: 'Welcome to the Admin Portal',
    content:
      'This quick tour will walk you through the key tools you\'ll use every day. You can replay it anytime from the Help button in the top bar.',
    placement: 'center',
  },
  {
    selector: '[data-tour="admin-sidebar"]',
    title: 'Module navigation',
    content:
      'Jump between Cases, Appointments, Reports, Finance, Documents, Experts and Attorneys from the grouped sidebar.',
    placement: 'right',
  },
  {
    selector: '[data-tour="global-search"]',
    title: 'Global search',
    content: 'Search across modules, claimants, attorneys and reports without leaving the page.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="portal-switcher"]',
    title: 'Switch portals',
    content: 'Hop between Admin, Attorney and Expert portals depending on what you need to do.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="notifications"]',
    title: 'Notifications',
    content: 'Real-time alerts for new appointments, report requests and payment events land here.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="help-button"]',
    title: 'Replay this tour anytime',
    content: 'Click Help whenever you want a refresher. You\'re all set — happy working!',
    placement: 'bottom',
  },
];

export const ATTORNEY_TOUR: TourStep[] = [
  {
    title: 'Welcome to your Attorney Portal',
    content:
      'A quick tour to show you how to track cases, appointments, reports and payments. Replay it anytime from the Help button.',
    placement: 'center',
  },
  {
    selector: '[data-tour="attorney-sidebar"]',
    title: 'Your workspace',
    content:
      'Use the sidebar to view My Cases, Appointments, Reports, Payments and Agreements.',
    placement: 'right',
  },
  {
    selector: '[data-tour="help-button"]',
    title: 'Need help?',
    content: 'Click Help anytime to replay this tour or open the support hub.',
    placement: 'bottom',
  },
];

export const EXPERT_TOUR: TourStep[] = [
  {
    title: 'Welcome to your Expert Portal',
    content:
      'A quick walk-through of your dashboard, schedule and report tracking. Replay it anytime from the Help button.',
    placement: 'center',
  },
  {
    selector: '[data-tour="expert-nav"]',
    title: 'Navigation',
    content: 'Switch between Dashboard, Cases, Schedule, Reports, Performance and Profile.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="help-button"]',
    title: 'Help is always here',
    content: 'Click Help anytime to replay this tour.',
    placement: 'bottom',
  },
];
