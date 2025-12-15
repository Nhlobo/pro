import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, Edit2, Save, AlertTriangle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { addBrandingToPDF, addBrandingFooter } from "@/utils/pdfBranding";

interface MeritReportSections {
  backgroundAndHistory: string;
  summaryOfTreatment: string;
  timelineOfEvents: string;
  riskIndicators: string;
  negligenceOpinion: string;
  negligenceTypes: string;
  recommendedExperts: string;
  conclusion: string;
}

interface MeritReportGeneratorProps {
  sections: MeritReportSections;
  fileName: string;
  meritOpinion: {
    opinion: 'possible_negligence' | 'no_clear_negligence';
    confidence: 'low' | 'medium' | 'high';
    summary: string;
  };
  disclaimer: {
    text: string;
    isDraft: boolean;
    requiresExpertConfirmation: boolean;
  };
}

const sectionLabels: Record<keyof MeritReportSections, string> = {
  backgroundAndHistory: "1. Background & Medical History",
  summaryOfTreatment: "2. Summary of Medical Treatment",
  timelineOfEvents: "3. Timeline of Key Events",
  riskIndicators: "4. Identified Risk Indicators",
  negligenceOpinion: "5. Possible Negligence Opinion",
  negligenceTypes: "6. Type(s) of Negligence",
  recommendedExperts: "7. Recommended Experts",
  conclusion: "8. Conclusion (Preliminary Merit Only)"
};

export const MeritReportGenerator: React.FC<MeritReportGeneratorProps> = ({
  sections,
  fileName,
  meritOpinion,
  disclaimer
}) => {
  const { toast } = useToast();
  const [editableSections, setEditableSections] = useState<MeritReportSections>(sections);
  const [editingSection, setEditingSection] = useState<keyof MeritReportSections | null>(null);
  const [tempEditValue, setTempEditValue] = useState("");

  const startEditing = (section: keyof MeritReportSections) => {
    setEditingSection(section);
    setTempEditValue(editableSections[section]);
  };

  const saveEdit = () => {
    if (editingSection) {
      setEditableSections(prev => ({
        ...prev,
        [editingSection]: tempEditValue
      }));
      setEditingSection(null);
      setTempEditValue("");
      toast({
        title: "Section updated",
        description: "Your changes have been saved to the draft report.",
      });
    }
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setTempEditValue("");
  };

  const downloadMeritReport = () => {
    const doc = new jsPDF();
    const startY = addBrandingToPDF(doc, 'MERIT REPORT (DRAFT)', 'PRELIMINARY MEDICO-LEGAL SCREENING');
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margins = { left: 20, right: 20, top: startY + 5, bottom: 35 };
    const maxLineWidth = pageWidth - margins.left - margins.right;
    let currentY = margins.top;

    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
      if (currentY > doc.internal.pageSize.getHeight() - margins.bottom) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      if (isBold) doc.setFont(undefined, 'bold');
      else doc.setFont(undefined, 'normal');
      
      const lines = doc.splitTextToSize(text, maxLineWidth);
      lines.forEach((line: string) => {
        if (currentY > doc.internal.pageSize.getHeight() - margins.bottom) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(line, margins.left, currentY);
        currentY += fontSize * 0.4;
      });
      currentY += 2;
    };

    const addSection = (title: string, content: string) => {
      currentY += 3;
      addText(title, 11, true);
      currentY += 1;
      addText(content, 9);
      currentY += 3;
    };

    // Draft watermark notice
    addText('⚠️ DRAFT – SUBJECT TO EXPERT CONFIRMATION', 12, true, [180, 0, 0]);
    currentY += 5;

    // File reference
    addText(`File Reference: ${fileName}`, 9);
    addText(`Generated: ${new Date().toLocaleString()}`, 9);
    currentY += 5;

    // Merit Opinion Summary
    const opinionColor: [number, number, number] = meritOpinion.opinion === 'possible_negligence' ? [180, 0, 0] : [0, 100, 0];
    addText(
      meritOpinion.opinion === 'possible_negligence' 
        ? 'PRELIMINARY OPINION: POSSIBLE NEGLIGENCE IDENTIFIED'
        : 'PRELIMINARY OPINION: NO CLEAR NEGLIGENCE IDENTIFIED AT THIS STAGE',
      11,
      true,
      opinionColor
    );
    addText(`Confidence Level: ${meritOpinion.confidence.toUpperCase()}`, 9);
    currentY += 5;

    // All sections
    Object.entries(sectionLabels).forEach(([key, label]) => {
      addSection(label, editableSections[key as keyof MeritReportSections]);
    });

    // Disclaimer
    currentY += 5;
    doc.setDrawColor(200, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(margins.left - 2, currentY - 2, maxLineWidth + 4, 30);
    
    addText('IMPORTANT DISCLAIMER', 10, true, [180, 0, 0]);
    addText(disclaimer.text, 8, false, [100, 100, 100]);
    
    addBrandingFooter(doc);
    
    const fileBaseName = fileName?.replace(/\.[^/.]+$/, '') || 'merit_report';
    doc.save(`merit_report_draft_${fileBaseName}.pdf`);
    
    toast({
      title: "Merit Report Downloaded",
      description: "Draft merit report saved as PDF. Remember: This is a preliminary screening only.",
    });
  };

  return (
    <Card className="border-2 border-amber-500/50">
      <CardHeader className="bg-amber-50 dark:bg-amber-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-amber-600" />
            <div>
              <CardTitle className="text-lg">Draft Merit Report</CardTitle>
              <p className="text-sm text-muted-foreground">Editable before finalisation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              DRAFT
            </Badge>
            <Button onClick={downloadMeritReport} className="gap-2">
              <Download className="h-4 w-4" />
              Download Report
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Opinion Badge */}
        <div className="p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3 mb-2">
            <Badge 
              variant={meritOpinion.opinion === 'possible_negligence' ? 'destructive' : 'secondary'}
              className="text-sm py-1"
            >
              {meritOpinion.opinion === 'possible_negligence' 
                ? '⚠️ POSSIBLE NEGLIGENCE IDENTIFIED'
                : '✓ NO CLEAR NEGLIGENCE IDENTIFIED'}
            </Badge>
            <Badge variant="outline">
              Confidence: {meritOpinion.confidence}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{meritOpinion.summary}</p>
        </div>

        {/* Editable Sections */}
        <div className="space-y-3">
          {Object.entries(sectionLabels).map(([key, label]) => (
            <div key={key} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="font-semibold text-sm">{label}</Label>
                {editingSection === key ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdit} className="gap-1">
                      <Save className="h-3 w-3" />
                      Save
                    </Button>
                  </div>
                ) : (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => startEditing(key as keyof MeritReportSections)}
                    className="gap-1"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Button>
                )}
              </div>
              {editingSection === key ? (
                <Textarea
                  value={tempEditValue}
                  onChange={(e) => setTempEditValue(e.target.value)}
                  className="min-h-[100px] text-sm"
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {editableSections[key as keyof MeritReportSections]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-200 text-sm">Important Disclaimer</p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">{disclaimer.text}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
