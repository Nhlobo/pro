--- orig/pro-main/src/pages/NewAppointment.tsx	2026-09-13 20:51:37.000000000 +0000
+++ pro-main/src/pages/NewAppointment.tsx	2026-09-14 18:28:15.283362768 +0000
@@ -104,7 +104,7 @@
   const [attorneys, setAttorneys] = useState([]);
   const [claimants, setClaimants] = useState([]);
   const [experts, setExperts] = useState([]);
-  const [salesConsultants, setSalesConsultants] = useState<{id: string; name: string}[]>([]);
+  const [salesConsultants, setSalesConsultants] = useState<{id: string; name: string; is_active: boolean}[]>([]);
   const [loading, setLoading] = useState(true);
   const [submitting, setSubmitting] = useState(false);
   const [appointmentQueue, setAppointmentQueue] = useState([]);
@@ -496,13 +496,14 @@
       // that filters sales_consultants down to real, current company staff
       // (admin/employee/sales_consultant on a @kutlwanoassociate.com email),
       // excluding referring attorneys, test accounts, and director/finance
-      // roles regardless of email domain. Active-only stays a client-side
-      // filter here since this form's "no consultants available" placeholder
-      // depends on it.
+      // roles regardless of email domain. The full list (active + inactive)
+      // is kept in state so editing an appointment already assigned to a
+      // since-deactivated consultant still shows their name correctly;
+      // active-only filtering for what can be newly *selected* happens at
+      // render time (see activeSalesConsultants below).
       const { data: assignableStaff } = await supabase.rpc('get_assignable_staff');
       const consultantsData = (assignableStaff || [])
-        .filter((sc) => sc.is_active)
-        .map((sc) => ({ id: sc.id, name: sc.name }));
+        .map((sc) => ({ id: sc.id, name: sc.name, is_active: sc.is_active }));
       
       setAttorneys(finalAttorneysList);
       setClaimants(mappedClaimants);
@@ -1806,22 +1807,52 @@
 
                 <div className="space-y-2">
                   <Label htmlFor="sales-consultant">Sales Consultant</Label>
-                  <Select value={formData.salesConsultantId} onValueChange={(value) => handleInputChange('salesConsultantId', value)}>
-                    <SelectTrigger className="rounded-none">
-                      <SelectValue placeholder={salesConsultants.length === 0 ? "No consultants available" : "Select sales consultant"}>
-                        {formData.salesConsultantId && salesConsultants.find(sc => sc.id === formData.salesConsultantId)?.name}
-                      </SelectValue>
-                    </SelectTrigger>
-                    <SelectContent>
-                      {salesConsultants.map((consultant) => (
-                        <SelectItem key={consultant.id} value={consultant.id}>
-                          {consultant.name}
-                        </SelectItem>
-                      ))}
-                    </SelectContent>
-                  </Select>
+                  {(() => {
+                    // Assigned consultant may be inactive (e.g. editing an
+                    // older appointment after that consultant left) -- look
+                    // them up in the full list so their name still resolves
+                    // correctly instead of appearing as "Inhouse".
+                    const assignedConsultant = formData.salesConsultantId
+                      ? salesConsultants.find(sc => sc.id === formData.salesConsultantId)
+                      : undefined;
+                    const activeSalesConsultants = salesConsultants.filter(sc => sc.is_active);
+                    return (
+                      <Select
+                        value={formData.salesConsultantId || "unassigned"}
+                        onValueChange={(value) =>
+                          handleInputChange('salesConsultantId', value === "unassigned" ? "" : value)
+                        }
+                      >
+                        <SelectTrigger className="rounded-none">
+                          <SelectValue>
+                            {assignedConsultant ? assignedConsultant.name : "Inhouse (Business Deal)"}
+                          </SelectValue>
+                        </SelectTrigger>
+                        <SelectContent>
+                          {/* Deals made by the business itself rather than
+                              attributed to an individual sales consultant. */}
+                          <SelectItem value="unassigned">Inhouse (Business Deal)</SelectItem>
+                          {activeSalesConsultants.map((consultant) => (
+                            <SelectItem key={consultant.id} value={consultant.id}>
+                              {consultant.name}
+                            </SelectItem>
+                          ))}
+                          {/* Kept visible (but not re-selectable) only when
+                              it's this appointment's current assignment, so a
+                              deactivated consultant's name isn't lost when
+                              editing an older appointment. */}
+                          {assignedConsultant && !assignedConsultant.is_active && (
+                            <SelectItem key={assignedConsultant.id} value={assignedConsultant.id} disabled>
+                              {assignedConsultant.name} (Inactive)
+                            </SelectItem>
+                          )}
+                        </SelectContent>
+                      </Select>
+                    );
+                  })()}
                   <p className="text-xs text-slate-500">
-                    Attribute this appointment to a sales consultant for tracking.
+                    Attribute this appointment to a sales consultant, or leave as Inhouse for
+                    deals made by the business rather than an individual.
                   </p>
                 </div>
               </div>
