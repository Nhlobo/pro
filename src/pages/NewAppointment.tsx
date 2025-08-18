import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";

const NewAppointment = () => {
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/new-appointment';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Schedule New Appointment - Medico-Legal Assessment System</title>
        <meta name="description" content="Schedule a new medical assessment appointment for claimants with available medical experts." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Schedule New Appointment</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              New Assessment Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="claimant">Claimant Name</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select claimant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="john-doe">John Doe</SelectItem>
                    <SelectItem value="jane-smith">Jane Smith</SelectItem>
                    <SelectItem value="mike-johnson">Mike Johnson</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="medical-expert">Medical Expert</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select medical expert" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dr-smith">Dr. Smith - Orthopedic</SelectItem>
                    <SelectItem value="dr-jones">Dr. Jones - Neurologist</SelectItem>
                    <SelectItem value="dr-brown">Dr. Brown - Psychiatrist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-date">Appointment Date</Label>
                <Input type="date" id="appointment-date" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-time">Appointment Time</Label>
                <Input type="time" id="appointment-time" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assessment-type">Assessment Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assessment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initial">Initial Assessment</SelectItem>
                    <SelectItem value="follow-up">Follow-up Assessment</SelectItem>
                    <SelectItem value="final">Final Assessment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="Assessment location" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Special Instructions/Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="Any special instructions or notes for the assessment"
                rows={4}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1">
                Schedule Appointment
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default NewAppointment;