"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { 
  Mail, 
  Phone, 
  Building2, 
  User, 
  Calendar,
  Check,
  X,
  Clock,
  Filter
} from "lucide-react";

interface Lead {
  id: string;
  full_name: string;
  business_email: string;
  business_name: string;
  phone: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG = {
  new: { label: "New", color: "bg-blue-100 text-blue-800", icon: Clock },
  contacted: { label: "Contacted", color: "bg-yellow-100 text-yellow-800", icon: Mail },
  qualified: { label: "Qualified", color: "bg-purple-100 text-purple-800", icon: Check },
  converted: { label: "Converted", color: "bg-green-100 text-green-800", icon: Check },
  rejected: { label: "Rejected", color: "bg-gray-100 text-gray-800", icon: X },
};

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await fetch("/api/admin/leads");
      const data = await response.json();
      setLeads(data.leads || []);
    } catch (error) {
      console.error("Failed to fetch leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchLeads();
    } catch (error) {
      console.error("Failed to update lead:", error);
    }
  };

  const filteredLeads = filterStatus === "all" 
    ? leads 
    : leads.filter(lead => lead.status === filterStatus);

  if (loading) {
    return <div className="text-center py-8">Loading leads...</div>;
  }

  return (
    <div className="space-y-4">

      {/* Filter Bar */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-white p-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filter:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All ({leads.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filterStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {config.label} ({leads.filter(l => l.status === status).length})
            </button>
          ))}
        </div>
      </div>

      {/* Leads Grid */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No leads found
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredLeads.map((lead) => {
            const statusConfig = STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG];
            const StatusIcon = statusConfig.icon;
            
            return (
              <div
                key={lead.id}
                className="rounded-lg border border-border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{lead.business_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Submitted {format(new Date(lead.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.full_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${lead.business_email}`} className="text-primary hover:underline">
                          {lead.business_email}
                        </a>
                      </div>
                    </div>

                    {lead.message && (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <p className="font-medium mb-1">Message:</p>
                        <p className="text-muted-foreground">{lead.message}</p>
                      </div>
                    )}

                    {lead.notes && (
                      <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm">
                        <p className="font-medium mb-1 text-yellow-900">Notes:</p>
                        <p className="text-yellow-800">{lead.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Status Badge & Actions */}
                  <div className="flex flex-col items-end gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusConfig.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </span>

                    <select
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                      className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                        <option key={status} value={status}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
