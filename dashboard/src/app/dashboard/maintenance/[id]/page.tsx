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
  MoreHorizontal,
  History,
  FileText,
  Share2,
  Printer,
  ChevronDown,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteConfirmation } from "@/components/modals/DeleteConfirmation";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    requestId: number | null;
  }>({ isOpen: false, requestId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [relatedRequests, setRelatedRequests] = useState<MaintenanceRequest[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  useEffect(() => {
    fetchRequest();
    fetchRelatedRequests();
  }, [params.id]);

  const fetchRequest = async () => {
    try {
      const response = await apiClient.get<MaintenanceDetail>(
        `/maintenance-requests/${params.id}`
      );
      setRequest(response.data);
    } catch (error) {
      console.error("Failed to fetch request:", error);
      toast.error("Failed to load maintenance request");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRelatedRequests = async () => {
    try {
      setIsLoadingRelated(true);
      const response = await apiClient.get<MaintenanceRequest[]>(
        `/maintenance-requests/${params.id}/related`
      );
      setRelatedRequests(response.data);
    } catch (error) {
      console.error("Failed to fetch related requests:", error);
      // Don't show error toast for related requests - it's optional
    } finally {
      setIsLoadingRelated(false);
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
      toast.success(`Request marked as ${newStatus.replace("_", " ")}`);
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
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
      toast.success("Notes saved successfully");
    } catch (error) {
      console.error("Failed to update notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const updatePriority = async (newPriority: string) => {
    if (!request || newPriority === request.priority) return;

    setIsUpdatingPriority(true);

    try {
      await apiClient.patch(`/maintenance-requests/${request.id}/priority`, {
        priority: newPriority,
      });
      setRequest({ ...request, priority: newPriority as any });
      toast.success(`Priority updated to ${newPriority}`);
    } catch (error) {
      console.error("Failed to update priority:", error);
      toast.error("Failed to update priority");
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleDeleteClick = () => {
    if (!request) return;
    setDeleteDialog({ isOpen: true, requestId: request.id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.requestId) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/maintenance-requests/${deleteDialog.requestId}`);
      toast.success("Request deleted successfully");
      router.push("/dashboard/maintenance");
    } catch (error) {
      console.error("Failed to delete request:", error);
      toast.error("Failed to delete request");
    } finally {
      setIsDeleting(false);
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
      {/* Header */}
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

        {/* Quick Actions Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                Quick Actions
              </p>
              <Button variant="ghost" className="w-full justify-start">
                <Share2 className="h-4 w-4 mr-2" />
                Share Request
              </Button>
              <Button variant="ghost" className="w-full justify-start">
                <Printer className="h-4 w-4 mr-2" />
                Print Details
              </Button>
              <Separator />
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleDeleteClick}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Request
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Main Content with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Request Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
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
                <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Issue Description
                </Label>
                <p className="text-lg">{request.issue_description}</p>
              </div>

              {/* Priority Control */}
              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Priority
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      disabled={isUpdatingPriority}
                    >
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold uppercase mr-2 ${getPriorityColor(
                          request.priority
                        )}`}
                      >
                        {request.priority}
                      </div>
                      <ChevronDown className="h-4 w-4 ml-auto" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-48">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                        Change Priority
                      </p>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => updatePriority("emergency")}
                        disabled={isUpdatingPriority || request.priority === "emergency"}
                      >
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase mr-2 ${getPriorityColor(
                            "emergency"
                          )}`}
                        >
                          emergency
                        </div>
                        {request.priority === "emergency" && (
                          <CheckCircle2 className="h-4 w-4 ml-auto" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => updatePriority("urgent")}
                        disabled={isUpdatingPriority || request.priority === "urgent"}
                      >
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase mr-2 ${getPriorityColor(
                            "urgent"
                          )}`}
                        >
                          urgent
                        </div>
                        {request.priority === "urgent" && (
                          <CheckCircle2 className="h-4 w-4 ml-auto" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => updatePriority("normal")}
                        disabled={isUpdatingPriority || request.priority === "normal"}
                      >
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase mr-2 ${getPriorityColor(
                            "normal"
                          )}`}
                        >
                          normal
                        </div>
                        {request.priority === "normal" && (
                          <CheckCircle2 className="h-4 w-4 ml-auto" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => updatePriority("low")}
                        disabled={isUpdatingPriority || request.priority === "low"}
                      >
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase mr-2 ${getPriorityColor(
                            "low"
                          )}`}
                        >
                          low
                        </div>
                        {request.priority === "low" && (
                          <CheckCircle2 className="h-4 w-4 ml-auto" />
                        )}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                {isUpdatingPriority && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Updating priority...
                  </p>
                )}
              </div>

              {/* Metadata Accordion */}
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="metadata">
                  <AccordionTrigger className="text-base font-semibold">
                    Property & Tenant Details
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
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
                  </AccordionContent>
                </AccordionItem>

                {/* Original Message */}
                {request.conversation_message && (
                  <AccordionItem value="message">
                    <AccordionTrigger className="text-base font-semibold">
                      Original Tenant Message
                    </AccordionTrigger>
                    <AccordionContent className="pt-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm">{request.conversation_message}</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>

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
                {isUpdatingStatus && (
                  <p className="text-sm text-muted-foreground self-center">
                    Updating status...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Manager Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Add Notes</Label>
                <textarea
                  id="notes"
                  value={request.notes || ""}
                  onChange={(e) => setRequest({ ...request, notes: e.target.value })}
                  onBlur={(e) => updateNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
                  placeholder="Add notes about this maintenance request..."
                />
                {isSavingNotes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Saving notes...
                  </p>
                )}
              </div>

              {/* Notes History */}
              {request.notes && (
                <div className="space-y-2">
                  <Label>Notes History</Label>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm">{request.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversation Tab */}
        <TabsContent value="conversation" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Related Conversation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {request.conversation_message ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4" />
                      <span className="text-sm font-medium">Tenant Message</span>
                    </div>
                    <p className="text-sm">{request.conversation_message}</p>
                  </div>
                  <div className="text-center text-sm text-muted-foreground">
                    <MessageSquare className="h-4 w-4 inline mr-1" />
                    Full conversation history available in Conversations section
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No conversation message available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Status Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Created */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <div className="w-0.5 h-full bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">Request Created</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Status Changes */}
                {request.status !== "open" && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <div className="w-0.5 h-full bg-border" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium">Status Changed</p>
                      <p className="text-xs text-muted-foreground">
                        Moved to {request.status.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Resolved */}
                {request.resolved_at && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Request Resolved</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.resolved_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Related Requests Tab */}
        <TabsContent value="related" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Related Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingRelated ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Loading related requests...</p>
                </div>
              ) : relatedRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No related requests found</p>
                  <p className="text-sm mt-2">
                    This request is not linked to any other maintenance requests.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {relatedRequests.map((relatedReq) => (
                    <div
                      key={relatedReq.id}
                      className={`border-l-4 pl-4 py-3 ${
                        relatedReq.is_duplicate
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                          : "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant={relatedReq.is_duplicate ? "secondary" : "default"}
                              className="text-xs"
                            >
                              {relatedReq.is_duplicate ? "Duplicate" : "Original"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getPriorityColor(relatedReq.priority)}`}
                            >
                              {relatedReq.priority}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getStatusColor(relatedReq.status)}`}
                            >
                              {relatedReq.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="font-medium">{relatedReq.issue_description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(relatedReq.created_at).toLocaleDateString()}
                            </span>
                            {relatedReq.thread_channel && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {relatedReq.thread_channel}
                              </span>
                            )}
                            {relatedReq.thread_subject && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {relatedReq.thread_subject}
                              </span>
                            )}
                          </div>
                        </div>
                        <Link href={`/dashboard/maintenance/${relatedReq.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                      {relatedReq.duplicate_reason && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <span className="font-medium">Reason:</span> {relatedReq.duplicate_reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmation
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, requestId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Maintenance Request"
        description="Are you sure you want to delete this maintenance request? This action cannot be undone."
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
