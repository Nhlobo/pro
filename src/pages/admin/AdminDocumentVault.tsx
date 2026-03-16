import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderLock, FileText, Shield, Eye, Upload, Lock } from 'lucide-react';

const mockDocs = [
  { name: 'Medical Report - Mokoena.pdf', type: 'Expert Report', access: 'Restricted', date: '2026-03-14' },
  { name: 'RAF Claim - Naidoo.docx', type: 'Legal Document', access: 'Internal', date: '2026-03-13' },
  { name: 'Assessment Notes - van der Berg.pdf', type: 'Assessment', access: 'Restricted', date: '2026-03-12' },
  { name: 'AOD Agreement - Pillay.pdf', type: 'Agreement', access: 'Confidential', date: '2026-03-11' },
  { name: 'Expert CV - Dr. Smith.pdf', type: 'CV', access: 'Public', date: '2026-03-10' },
];

const AdminDocumentVault: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Secure Document Vault</h1>
        <p className="text-sm text-muted-foreground">Access-controlled document storage with security indicators</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: 1248, icon: FileText, color: 'text-primary' },
          { label: 'Restricted', value: 342, icon: Lock, color: 'text-destructive' },
          { label: 'Pending Review', value: 28, icon: Eye, color: 'text-warning' },
          { label: 'Uploaded Today', value: 12, icon: Upload, color: 'text-success' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Document List */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderLock className="h-4 w-4 text-primary" />
            Recent Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Document</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Access</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {mockDocs.map((doc, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium text-foreground">{doc.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{doc.type}</td>
                  <td className="py-3 px-4">
                    <Badge className={`text-[10px] ${
                      doc.access === 'Confidential' ? 'bg-destructive/10 text-destructive' :
                      doc.access === 'Restricted' ? 'bg-warning/10 text-warning' :
                      doc.access === 'Internal' ? 'bg-info/10 text-info' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <Shield className="h-3 w-3 mr-1" />{doc.access}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{doc.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDocumentVault;
