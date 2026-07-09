// src/pages/admin/AdminTrialReadiness.tsx
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Scale, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminStatCard,
  AdminPill,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

const mockCases = [
  { id: 'TR-001', claimant: 'J. Mokoena', expert: 'Dr. Smith', reportsNeeded: 3, reportsSubmitted: 3, ready: true },
  { id: 'TR-002', claimant: 'S. Naidoo', expert: 'Dr. Patel', reportsNeeded: 2, reportsSubmitted: 1, ready: false },
  { id: 'TR-003', claimant: 'M. van der Berg', expert: 'Dr. Jones', reportsNeeded: 4, reportsSubmitted: 2, ready: false },
  { id: 'TR-004', claimant: 'T. Dlamini', expert: 'Dr. Nkosi', reportsNeeded: 2, reportsSubmitted: 2, ready: true },
  { id: 'TR-005', claimant: 'R. Pillay', expert: 'Dr. Williams', reportsNeeded: 3, reportsSubmitted: 0, ready: false },
];

const AdminTrialReadiness: React.FC = () => {
  const readyCases = mockCases.filter((c) => c.ready).length;
  const totalCases = mockCases.length;
  const readinessRate = Math.round((readyCases / totalCases) * 100);

  return (
    <AdminPage>
      <AdminHeader
        eyebrow="Litigation"
        title="Trial Readiness Dashboard"
        description="Expert report requirements vs. reports submitted"
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <AdminStatCard label="Overall Readiness" value={`${readinessRate}%`} icon={Scale} />
        <AdminStatCard label="Trial Ready" value={readyCases} icon={CheckCircle2} />
        <AdminStatCard label="Reports Pending" value={totalCases - readyCases} icon={AlertCircle} />
      </div>

      {/* Case List */}
      <AdminCard>
        <AdminCardHeader icon={Scale} title="Case Trial Readiness" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.02]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Case</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Claimant</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expert</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reports</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockCases.map((c) => (
                <tr key={c.id} className="border-b border-black/10 last:border-b-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.id}</td>
                  <td className="px-4 py-3 font-medium text-black">{c.claimant}</td>
                  <td className="px-4 py-3 text-slate-500">{c.expert}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={(c.reportsSubmitted / c.reportsNeeded) * 100} className="h-2 w-20" />
                      <span className="text-xs text-slate-500">{c.reportsSubmitted}/{c.reportsNeeded}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.ready ? (
                      <AdminPill tone="success"><CheckCircle2 className="h-3 w-3" />Ready</AdminPill>
                    ) : (
                      <AdminPill tone="warning"><AlertCircle className="h-3 w-3" />Pending</AdminPill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPage>
  );
};

export default AdminTrialReadiness;
