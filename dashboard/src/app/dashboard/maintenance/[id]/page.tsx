"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { MaintenanceRequest } from "@/types";
import {
  ArrowLeft,
  Clock,
  Building2,
  User,
  AlertTriangle,
  CheckCircle2,
  Save,
  MessageSquare,
  Flag,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface MaintenanceDetail extends MaintenanceRequest {
  conversation_message?: string;
}

export default function MaintenanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [request, setRequest] = useState<MaintenanceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchRequest();
  }, [params.id]);

  const fetchRequest = async () => {
    try {
      const response = await apiClient.get<MaintenanceDetail>(
        `/maintenance-requests/${params.id}`
      );
      setRequest(response.data);
    } catch (error) {
      console.error("Failed to fetch request:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!request) return;

    setIsUpdatingStatus(true);

    try {
      await apiClient.patch(`/maintenance-requests/${request.id}/status`, {
        status: newStatus,
      });
      setRequest({ ...request, status: newStatus as any });
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const updateNotes = async (notes: string) => {
    if (!request) return;

    setIsSavingNotes(true);

    try {
      await apiClient.patch(`/maintenance-requests/${request.id}/notes`, { notes });
      setRequest({ ...request, notes });
    } catch (error) {
      console.error("Failed to update notes:", error);
      alert("Failed to update notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const deleteRequest = async () => {
    if (!request) return;

    if (!confirm("Are you sure you want to delete this maintenance request? This action cannot be undone.")) {
      return;
    }

    try {
      await apiClient.delete(`/maintenance-requests/${request.id}`);
      router.push("/dashboard/maintenance");
    } catch (error) {
      console.error("Failed to delete request:", error);
      alert("Failed to delete request");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "emergency":
        return "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400";
      case "urgent":
        return "text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400";
      case "normal":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400";
      case "low":
        return "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-950 dark:text-gray-400";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400";
      case "in_progress":
        return "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400";
      case "resolved":
        return "text-gray-600 bg-gray-50 dark:bg-gray-950 dark:text-gray-400";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-950 dark:text-gray-400";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">
          Loading maintenance request...
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">
          Maintenance request not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/maintenance">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Maintenance Request Details
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and manage this maintenance issue
          </p>
        </div>
      </div>

      {/* Request Details */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getPriorityColor(
                  request.priority
                )}`}
              >
                {request.priority}
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(
                  request.status
                )}`}
              >
                {request.status.replace("_", " ")}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              #{request.id}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Issue Description */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Issue Description
            </label>
            <p className="text-lg">{request.issue_description}</p>
          </div>

          {/* Metadata */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Property</p>
                <p className="font-medium">
                  {request.property_address || "Unknown Property"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Tenant</p>
                <p className="font-medium">
                  {request.tenant_name || "Unknown"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium">
                  {new Date(request.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            {request.resolved_at && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                  <p className="font-medium">
                    {new Date(request.resolved_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Original Message */}
          {request.conversation_message && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Original Tenant Message
              </label>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">{request.conversation_message}</p>
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Manager Notes
            </label>
            <textarea
              value={request.notes || ""}
              onChange={(e) => setRequest({ ...request, notes: e.target.value })}
              onBlur={(e) => updateNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
              placeholder="Add notes about this maintenance request..."
            />
            {isSavingNotes && (
              <p className="text-xs text-muted-foreground mt-1">
                Saving notes...
              </p>
            )}
          </div>

          {/* Status Actions */}
          <div className="flex gap-3 pt-4 border-t">
            {request.status === "open" && (
              <Button
                onClick={() => updateStatus("in_progress")}
                disabled={isUpdatingStatus}
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Mark as In Progress
              </Button>
            )}
            {request.status === "in_progress" && (
              <Button
                onClick={() => updateStatus("resolved")}
                disabled={isUpdatingStatus}
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Resolved
              </Button>
            )}
            {request.status === "resolved" && (
              <Button
                variant="outline"
                onClick={() => updateStatus("open")}
                disabled={isUpdatingStatus}
                className="flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Reopen Request
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={deleteRequest}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Request
            </Button>
            {isUpdatingStatus && (
              <p className="text-sm text-muted-foreground self-center">
                Updating status...
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
