"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { MaintenanceRequest, Property } from "@/types";
import {
  AlertTriangle,
  Filter,
  Clock,
  Building2,
  User,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function MaintenanceRequestsPage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    property_id: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [filters]);

  const fetchRequests = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append("status", filters.status);
      if (filters.priority) queryParams.append("priority", filters.priority);
      if (filters.property_id) queryParams.append("property_id", filters.property_id);

      const response = await apiClient.get<MaintenanceRequest[]>(
        `/maintenance-requests?${queryParams.toString()}`
      );
      setRequests(response.data);
    } catch (error) {
      console.error("Failed to fetch maintenance requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await apiClient.get<Property[]>("/properties");
      setProperties(response.data);
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "emergency":
        return "destructive";
      case "urgent":
        return "destructive"; // Or add an 'orange' variant to Badge
      case "normal":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "open":
        return "success";
      case "in_progress":
        return "info";
      case "resolved":
        return "secondary";
      default:
        return "outline";
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await apiClient.patch(`/maintenance-requests/${id}/status`, { status: newStatus });
      setRequests(
        requests.map((r) =>
          r.id === id ? { ...r, status: newStatus as any } : r
        )
      );
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status");
    }
  };

  const deleteRequest = async (id: number) => {
    if (!confirm("Are you sure you want to delete this maintenance request? This action cannot be undone.")) {
      return;
    }

    try {
      await apiClient.delete(`/maintenance-requests/${id}`);
      setRequests(requests.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Failed to delete request:", error);
      alert("Failed to delete request");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
             <Skeleton className="h-10 w-48" />
             <div className="flex gap-2">
                 <Skeleton className="h-10 w-24" />
                 <Skeleton className="h-10 w-32" />
             </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
             <div className="flex gap-4">
                 <Skeleton className="h-6 w-20 rounded-full" />
                 <div className="flex-1 space-y-2">
                     <Skeleton className="h-6 w-3/4" />
                     <div className="flex gap-4">
                         <Skeleton className="h-4 w-32" />
                         <Skeleton className="h-4 w-32" />
                         <Skeleton className="h-4 w-32" />
                     </div>
                 </div>
             </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Maintenance Requests
          </h1>
          <p className="text-muted-foreground mt-2">
            Track and manage all maintenance issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <select
                  value={filters.priority}
                  onChange={(e) =>
                    setFilters({ ...filters, priority: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Priorities</option>
                  <option value="emergency">Emergency</option>
                  <option value="urgent">Urgent</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Property</label>
                <select
                  value={filters.property_id}
                  onChange={(e) =>
                    setFilters({ ...filters, property_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id.toString()}>
                      {p.address}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No requests found</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              {filters.status || filters.priority || filters.property_id
                ? "Try adjusting your filters"
                : "No maintenance requests have been created yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card
              key={request.id}
              className="hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Priority Badge */}
                    <Badge variant={getPriorityVariant(request.priority) as any} className="uppercase shrink-0">
                      {request.priority}
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                            {request.issue_description}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              <span className="line-clamp-1">
                                {request.property_address || "Unknown Property"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{request.tenant_name || "Unknown"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {new Date(request.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <Badge variant={getStatusVariant(request.status) as any} className="uppercase shrink-0">
                            {request.status.replace("_", " ")}
                        </Badge>
                      </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex gap-2">
                        {request.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(request.id, "in_progress")}
                            className="flex items-center gap-1"
                          >
                            <Clock className="h-3 w-3" />
                            Start
                          </Button>
                        )}
                        {request.status === "in_progress" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(request.id, "resolved")}
                            className="flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Resolve
                          </Button>
                        )}
                        {request.status === "resolved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(request.id, "open")}
                            className="flex items-center gap-1"
                          >
                            <XCircle className="h-3 w-3" />
                            Reopen
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteRequest(request.id)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                      <Link href={`/dashboard/maintenance/${request.id}`}>
                        <Button size="sm" className="flex items-center gap-1">
                          View Details
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
