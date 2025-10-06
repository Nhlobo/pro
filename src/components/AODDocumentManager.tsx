import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { FileText, Upload, Download, Trash2, Edit } from "lucide-react";
import { useAODDocuments } from "@/hooks/useAODDocuments";
import { format } from "date-fns";

type Attorney = {
  id: string;
  name: string;
  law_firm: string | null;
};

type AODDocumentManagerProps = {
  attorneys: Attorney[];
  lawFirmId: string;
};

export const AODDocumentManager = ({ attorneys, lawFirmId }: AODDocumentManagerProps) => {
  const { documents, loading, uploadDocument, downloadDocument, deleteDocument, updateDocument } = useAODDocuments();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAttorney, setSelectedAttorney] = useState<string>("");
  const [editingDoc, setEditingDoc] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    payment_plan_structure: "",
    payment_due_date: "",
    interest_rate_1_3_months: "",
    interest_rate_6_months: "",
    interest_rate_12_months: "",
    interest_rate_18_months: "",
    interest_rate_24_months: "",
    notes: "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedAttorney) {
      return;
    }

    const metadata = {
      payment_plan_structure: formData.payment_plan_structure || undefined,
      payment_due_date: formData.payment_due_date || undefined,
      interest_rate_1_3_months: formData.interest_rate_1_3_months ? parseFloat(formData.interest_rate_1_3_months) : undefined,
      interest_rate_6_months: formData.interest_rate_6_months ? parseFloat(formData.interest_rate_6_months) : undefined,
      interest_rate_12_months: formData.interest_rate_12_months ? parseFloat(formData.interest_rate_12_months) : undefined,
      interest_rate_18_months: formData.interest_rate_18_months ? parseFloat(formData.interest_rate_18_months) : undefined,
      interest_rate_24_months: formData.interest_rate_24_months ? parseFloat(formData.interest_rate_24_months) : undefined,
      notes: formData.notes || undefined,
    };

    const success = await uploadDocument(selectedFile, selectedAttorney, lawFirmId, metadata);
    
    if (success) {
      setIsUploadOpen(false);
      setSelectedFile(null);
      setSelectedAttorney("");
      setFormData({
        payment_plan_structure: "",
        payment_due_date: "",
        interest_rate_1_3_months: "",
        interest_rate_6_months: "",
        interest_rate_12_months: "",
        interest_rate_18_months: "",
        interest_rate_24_months: "",
        notes: "",
      });
    }
  };

  const handleEdit = (doc: any) => {
    setEditingDoc(doc);
    setFormData({
      payment_plan_structure: doc.payment_plan_structure || "",
      payment_due_date: doc.payment_due_date || "",
      interest_rate_1_3_months: doc.interest_rate_1_3_months?.toString() || "",
      interest_rate_6_months: doc.interest_rate_6_months?.toString() || "",
      interest_rate_12_months: doc.interest_rate_12_months?.toString() || "",
      interest_rate_18_months: doc.interest_rate_18_months?.toString() || "",
      interest_rate_24_months: doc.interest_rate_24_months?.toString() || "",
      notes: doc.notes || "",
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingDoc) return;

    const metadata = {
      payment_plan_structure: formData.payment_plan_structure || undefined,
      payment_due_date: formData.payment_due_date || undefined,
      interest_rate_1_3_months: formData.interest_rate_1_3_months ? parseFloat(formData.interest_rate_1_3_months) : undefined,
      interest_rate_6_months: formData.interest_rate_6_months ? parseFloat(formData.interest_rate_6_months) : undefined,
      interest_rate_12_months: formData.interest_rate_12_months ? parseFloat(formData.interest_rate_12_months) : undefined,
      interest_rate_18_months: formData.interest_rate_18_months ? parseFloat(formData.interest_rate_18_months) : undefined,
      interest_rate_24_months: formData.interest_rate_24_months ? parseFloat(formData.interest_rate_24_months) : undefined,
      notes: formData.notes || undefined,
    };

    await updateDocument(editingDoc.id, metadata);
    setIsEditOpen(false);
    setEditingDoc(null);
  };

  const getAttorneyName = (attorneyId: string) => {
    const attorney = attorneys.find(a => a.id === attorneyId);
    return attorney?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">AOD Documents (Acknowledgement of Debts)</h2>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload AOD Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload AOD Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Attorney</Label>
                <Select value={selectedAttorney} onValueChange={setSelectedAttorney}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an attorney" />
                  </SelectTrigger>
                  <SelectContent>
                    {attorneys.map((attorney) => (
                      <SelectItem key={attorney.id} value={attorney.id}>
                        {attorney.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Document File</Label>
                <Input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
              </div>

              <div>
                <Label>Payment Plan Structure</Label>
                <Textarea
                  value={formData.payment_plan_structure}
                  onChange={(e) => setFormData({ ...formData, payment_plan_structure: e.target.value })}
                  placeholder="Describe the payment plan structure..."
                />
              </div>

              <div>
                <Label>Payment Due Date</Label>
                <Input
                  type="date"
                  value={formData.payment_due_date}
                  onChange={(e) => setFormData({ ...formData, payment_due_date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Interest Rate (1-3 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_1_3_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_1_3_months: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate (6 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_6_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_6_months: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate (12 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_12_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_12_months: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate (18 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_18_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_18_months: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate (24 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_24_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_24_months: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                />
              </div>

              <Button onClick={handleUpload} disabled={!selectedFile || !selectedAttorney}>
                Upload Document
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Attorney</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead>Payment Due</TableHead>
              <TableHead>Interest Rates</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No AOD documents uploaded yet</TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{getAttorneyName(doc.attorney_id)}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {doc.file_name}
                  </TableCell>
                  <TableCell>
                    {doc.payment_due_date ? format(new Date(doc.payment_due_date), "PP") : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {doc.interest_rate_1_3_months && <div>1-3m: {doc.interest_rate_1_3_months}%</div>}
                      {doc.interest_rate_6_months && <div>6m: {doc.interest_rate_6_months}%</div>}
                      {doc.interest_rate_12_months && <div>12m: {doc.interest_rate_12_months}%</div>}
                      {doc.interest_rate_18_months && <div>18m: {doc.interest_rate_18_months}%</div>}
                      {doc.interest_rate_24_months && <div>24m: {doc.interest_rate_24_months}%</div>}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(doc.created_at), "PP")}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadDocument(doc.document_url, doc.file_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(doc)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteDocument(doc.id, doc.document_url)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit AOD Document Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment Plan Structure</Label>
              <Textarea
                value={formData.payment_plan_structure}
                onChange={(e) => setFormData({ ...formData, payment_plan_structure: e.target.value })}
                placeholder="Describe the payment plan structure..."
              />
            </div>

            <div>
              <Label>Payment Due Date</Label>
              <Input
                type="date"
                value={formData.payment_due_date}
                onChange={(e) => setFormData({ ...formData, payment_due_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Interest Rate (1-3 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_1_3_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_1_3_months: e.target.value })}
                />
              </div>
              <div>
                <Label>Interest Rate (6 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_6_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_6_months: e.target.value })}
                />
              </div>
              <div>
                <Label>Interest Rate (12 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_12_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_12_months: e.target.value })}
                />
              </div>
              <div>
                <Label>Interest Rate (18 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_18_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_18_months: e.target.value })}
                />
              </div>
              <div>
                <Label>Interest Rate (24 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_24_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_24_months: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Additional Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
              />
            </div>

            <Button onClick={handleUpdate}>Update Document</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
