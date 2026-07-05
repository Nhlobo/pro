import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface LegalSectionCardProps {
  number: number;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}

// Matches the card treatment already used for the contact tiles on the
// Help page (border border-black/10, bg-white, hover:border-[#00BAAD]),
// so Privacy / Terms sections look consistent with the rest of the
// legal pages instead of plain numbered prose headings.
const LegalSectionCard = ({ number, title, icon: Icon, children }: LegalSectionCardProps) => (
  <div className="not-prose flex flex-col gap-3 border border-black/10 bg-white p-5 transition hover:border-[#00BAAD] sm:p-6">
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#00BAAD]/10 text-sm font-bold text-[#00BAAD]">
        {String(number).padStart(2, '0')}
      </span>
      <Icon className="h-5 w-5 shrink-0 text-[#00BAAD]" />
      <h2 className="m-0 text-base font-semibold text-black sm:text-lg">{title}</h2>
    </div>
    <div className="space-y-3 text-sm leading-relaxed text-slate-600 [&_a]:text-[#00BAAD] [&_a]:no-underline [&_a:hover]:underline [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
      {children}
    </div>
  </div>
);

export default LegalSectionCard;
