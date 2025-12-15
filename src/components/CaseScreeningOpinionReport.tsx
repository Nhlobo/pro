import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Download, Edit2, Save, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface CaseScreeningOpinionReportProps {
  result: any;
  claimantName?: string;
}

const CaseScreeningOpinionReport = ({ result, claimantName }: CaseScreeningOpinionReportProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedOpinion, setEditedOpinion] = useState({
    caseTypeSummary: result.screeningOpinion?.caseTypeSummary || '',
    factsSummary: result.screeningOpinion?.factsSummary || '',
    injuriesSummary: result.screeningOpinion?.injuriesSummary || '',
    medicalConsistency: result.screeningOpinion?.medicalConsistency || '',
    legalIssues: result.screeningOpinion?.legalIssues?.join('\n') || '',
    finalRecommendation: result.screeningOpinion?.finalRecommendation || '',
  });

  const getCaseTypeLabel = (type: string) => {
    switch (type) {
      case 'road_accident': return 'Road Accident (RAF)';
      case 'slip_and_fall': return 'Slip and Fall';
      case 'unlawful_arrest': return 'Unlawful Arrest/Detention';
      default: return type;
    }
  };

  const getViabilityText = (recommendation: string) => {
    switch (recommendation) {
      case 'take': return 'RECOMMENDED TO TAKE CASE';
      case 'caution': return 'PROCEED WITH CAUTION';
      case 'do_not_take': return 'NOT RECOMMENDED TO TAKE';
      default: return 'ASSESSMENT PENDING';
    }
  };

  const getPrescriptionText = (status: string) => {
    switch (status) {
      case 'within_period': return 'Within Prescription Period';
      case 'approaching': return 'Approaching Prescription Deadline';
      case 'likely_expired': return 'Likely Expired';
      default: return 'Unknown';
    }
  };

  const downloadReport = () => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = 20;

      // Header with branding
      pdf.setFillColor(30, 64, 110);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('KUTLWANO & ASSOCIATE', margin, 18);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('We Touch a File, We Change a Life', margin, 26);
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('CASE SCREENING OPINION', margin, 36);

      yPosition = 50;
      pdf.setTextColor(0, 0, 0);

      // Draft Warning
      pdf.setFillColor(255, 243, 205);
      pdf.rect(margin, yPosition, contentWidth, 15, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(133, 100, 4);
      pdf.text('SCREENING OPINION – Subject to Legal & Expert Review', margin + 5, yPosition + 10);
      yPosition += 25;

      pdf.setTextColor(0, 0, 0);

      // Claimant Name if provided
      if (claimantName) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Claimant:', margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(claimantName, margin + 25, yPosition);
        yPosition += 10;
      }

      // Date
      pdf.setFont('helvetica', 'bold');
      pdf.text('Date:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(new Date().toLocaleDateString(), margin + 25, yPosition);
      yPosition += 15;

      // Case Type
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('1. CASE TYPE', margin, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const caseTypes = result.caseTypes?.map((t: string) => getCaseTypeLabel(t)).join(', ') || 'Not identified';
      pdf.text(caseTypes, margin, yPosition);
      yPosition += 12;

      // Recommendation Banner
      const viabilityText = getViabilityText(result.viability?.recommendation);
      const bgColor = result.viability?.recommendation === 'take' ? [200, 250, 200] :
                      result.viability?.recommendation === 'caution' ? [255, 243, 205] : [255, 200, 200];
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(margin, yPosition, contentWidth, 12, 'F');
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`SCREENING RECOMMENDATION: ${viabilityText}`, margin + 5, yPosition + 8);
      yPosition += 20;

      // Helper function to add wrapped text
      const addSection = (title: string, content: string) => {
        if (yPosition > 260) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, margin, yPosition);
        yPosition += 8;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(content || 'Not available', contentWidth);
        pdf.text(lines, margin, yPosition);
        yPosition += lines.length * 5 + 10;
      };

      // Sections
      addSection('2. SUMMARY OF FACTS', editedOpinion.factsSummary);
      addSection('3. INJURIES SUMMARY', editedOpinion.injuriesSummary);
      addSection('4. MEDICAL RECORD CONSISTENCY', editedOpinion.medicalConsistency);

      // Prescription Status
      if (yPosition > 260) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('5. PRESCRIPTION STATUS', margin, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Status: ${getPrescriptionText(result.prescriptionStatus?.status)}`, margin, yPosition);
      yPosition += 5;
      pdf.text(`Time Elapsed: ${result.prescriptionStatus?.timeElapsed || 'Unknown'}`, margin, yPosition);
      yPosition += 12;

      // Expert Recommendations
      if (result.expertRecommendations?.length > 0) {
        if (yPosition > 240) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('6. RECOMMENDED EXPERTS', margin, yPosition);
        yPosition += 8;
        pdf.setFontSize(10);
        result.expertRecommendations.forEach((expert: any, index: number) => {
          if (yPosition > 270) {
            pdf.addPage();
            yPosition = 20;
          }
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${index + 1}. ${expert.expertType}`, margin, yPosition);
          yPosition += 5;
          pdf.setFont('helvetica', 'normal');
          const reasonLines = pdf.splitTextToSize(`Reason: ${expert.reason}`, contentWidth - 5);
          pdf.text(reasonLines, margin + 5, yPosition);
          yPosition += reasonLines.length * 5 + 5;
        });
        yPosition += 5;
      }

      // Legal Issues
      if (editedOpinion.legalIssues) {
        addSection('7. POTENTIAL LEGAL ISSUES', editedOpinion.legalIssues);
      }

      // Final Recommendation
      addSection('8. FINAL RECOMMENDATION', editedOpinion.finalRecommendation);

      // Disclaimer Footer
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition, contentWidth, 25, 'F');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      const disclaimer = result.disclaimer || 'This is an initial screening opinion only and does not constitute legal advice.';
      const disclaimerLines = pdf.splitTextToSize(disclaimer, contentWidth - 10);
      pdf.text(disclaimerLines, margin + 5, yPosition + 8);

      // Footer on each page
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Page ${i} of ${totalPages} | Generated: ${new Date().toLocaleString()}`,
          margin,
          pdf.internal.pageSize.getHeight() - 10
        );
      }

      const fileName = `case_screening_${claimantName?.replace(/\s+/g, '_') || 'report'}_${Date.now()}.pdf`;
      pdf.save(fileName);
      toast.success('Case screening report downloaded');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Case Screening Opinion Report
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <Save className="h-4 w-4 mr-1" /> : <Edit2 className="h-4 w-4 mr-1" />}
            {isEditing ? 'Save' : 'Edit'}
          </Button>
          <Button size="sm" onClick={downloadReport}>
            <Download className="h-4 w-4 mr-1" />
            Download PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Draft Label */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 mb-2">
            SCREENING OPINION – Subject to Legal & Expert Review
          </Badge>
          <p className="text-xs text-yellow-700">
            This is an initial screening opinion only and does not constitute legal advice. 
            Final decisions must be made by qualified legal practitioners and medical experts.
          </p>
        </div>

        {/* Case Type */}
        <div>
          <label className="text-sm font-medium">Case Type</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {result.caseTypes?.map((type: string, index: number) => (
              <Badge key={index} variant="secondary">
                {getCaseTypeLabel(type)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Editable Sections */}
        <div>
          <label className="text-sm font-medium">Case Type Summary</label>
          {isEditing ? (
            <Textarea
              value={editedOpinion.caseTypeSummary}
              onChange={(e) => setEditedOpinion({ ...editedOpinion, caseTypeSummary: e.target.value })}
              className="mt-1"
              rows={3}
            />
          ) : (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md mt-1">
              {editedOpinion.caseTypeSummary || 'Not available'}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Summary of Facts</label>
          {isEditing ? (
            <Textarea
              value={editedOpinion.factsSummary}
              onChange={(e) => setEditedOpinion({ ...editedOpinion, factsSummary: e.target.value })}
              className="mt-1"
              rows={4}
            />
          ) : (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md mt-1">
              {editedOpinion.factsSummary || 'Not available'}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Injuries Summary</label>
          {isEditing ? (
            <Textarea
              value={editedOpinion.injuriesSummary}
              onChange={(e) => setEditedOpinion({ ...editedOpinion, injuriesSummary: e.target.value })}
              className="mt-1"
              rows={3}
            />
          ) : (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md mt-1">
              {editedOpinion.injuriesSummary || 'Not available'}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Medical Record Consistency</label>
          {isEditing ? (
            <Textarea
              value={editedOpinion.medicalConsistency}
              onChange={(e) => setEditedOpinion({ ...editedOpinion, medicalConsistency: e.target.value })}
              className="mt-1"
              rows={3}
            />
          ) : (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md mt-1">
              {editedOpinion.medicalConsistency || 'Not available'}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Potential Legal Issues</label>
          {isEditing ? (
            <Textarea
              value={editedOpinion.legalIssues}
              onChange={(e) => setEditedOpinion({ ...editedOpinion, legalIssues: e.target.value })}
              className="mt-1"
              rows={3}
              placeholder="Enter each issue on a new line"
            />
          ) : (
            <ul className="list-disc list-inside text-sm text-muted-foreground bg-muted p-3 rounded-md mt-1">
              {editedOpinion.legalIssues?.split('\n').filter(Boolean).map((issue: string, index: number) => (
                <li key={index}>{issue}</li>
              )) || <li>None identified</li>}
            </ul>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Final Recommendation</label>
          {isEditing ? (
            <Textarea
              value={editedOpinion.finalRecommendation}
              onChange={(e) => setEditedOpinion({ ...editedOpinion, finalRecommendation: e.target.value })}
              className="mt-1"
              rows={4}
            />
          ) : (
            <p className="text-sm bg-muted p-3 rounded-md mt-1 font-medium">
              {editedOpinion.finalRecommendation || 'Not available'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CaseScreeningOpinionReport;
