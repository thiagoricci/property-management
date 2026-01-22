"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { MaintenanceRequest, Property } from "@/types";
import {
  AlertTriangle,
  Clock,
  Building2,
  User,
  CheckCircle2,
  Plus,
  MoreHorizontal,
  XCircle,
  ChevronDown,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import Link from "next/link";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";

export default function MaintenanceRequestsPage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchRequests();
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  const fetchRequests = async () => {
    try {
      const response = await apiClient.get<MaintenanceRequest[]>(
        `/maintenance-requests`
      );
      setRequests(response.data);
    } catch (error) {
      console.error("Failed to fetch maintenance requests:", error);
      toast.error("Failed to load maintenance requests");
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
      toast.error("Failed to load properties");
    }
  };

  const updateRequestStatus = async (requestId: number, newStatus: string) => {
    try {
      await apiClient.patch(`/maintenance-requests/${requestId}/status`, {
        status: newStatus,
      });
      setRequests(
        requests.map((r) =>
          r.id === requestId ? { ...r, status: newStatus as any } : r
        )
      );
      toast.success(`Request marked as ${newStatus.replace("_", " ")}`);
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update request status");
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "emergency":
        return "destructive";
      case "urgent":
        return "destructive";
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

  // Filter requests based on active tab
  const getFilteredRequests = () => {
    if (activeTab === "all") return requests;
    return requests.filter((r) => r.status === activeTab);
  };

  const filteredRequests = getFilteredRequests();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm"
          >
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

  // Calculate statistics
  const totalRequests = requests.length;
  const openRequests = requests.filter((r) => r.status === "open").length;
  const inProgressRequests = requests.filter((r) => r.status === "in_progress").length;
  const resolvedRequests = requests.filter((r) => r.status === "resolved").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Requests
          </h1>
          <p className="text-muted-foreground mt-2">
            Track and manage all maintenance issues
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Requests
                </p>
                <p className="text-3xl font-bold mt-2">{totalRequests}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open</p>
                <p className="text-3xl font-bold mt-2">{openRequests}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  In Progress
                </p>
                <p className="text-3xl font-bold mt-2">{inProgressRequests}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Solved</p>
                <p className="text-3xl font-bold mt-2">{resolvedRequests}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredRequests.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Wrench className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>No maintenance requests</EmptyTitle>
                <EmptyDescription>
                  No maintenance requests have been created yet
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => {/* Open create modal */}}>
                  Create Request
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <Link
                  key={request.id}
                  href={`/dashboard/maintenance/${request.id}`}
                >
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Priority Badge */}
                        <Badge
                          variant={getPriorityVariant(request.priority) as any}
                          className="uppercase shrink-0"
                        >
                          {request.priority}
                        </Badge>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
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

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Status Badge */}
                              <Badge
                                variant={getStatusVariant(request.status) as any}
                                className="uppercase shrink-0"
                              >
                                {request.status.replace("_", " ")}
                              </Badge>

                              {/* Quick Status Update Popover */}
                              {request.status !== "resolved" && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => e.preventDefault()}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent align="end" className="w-48">
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                                        Quick Actions
                                      </p>
                                      {request.status === "open" && (
                                        <Button
                                          variant="ghost"
                                          className="w-full justify-start"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            updateRequestStatus(request.id, "in_progress");
                                          }}
                                        >
                                          <Clock className="h-4 w-4 mr-2" />
                                          Mark In Progress
                                        </Button>
                                      )}
                                      {request.status === "in_progress" && (
                                        <Button
                                          variant="ghost"
                                          className="w-full justify-start"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            updateRequestStatus(request.id, "resolved");
                                          }}
                                        >
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          Mark Resolved
                                        </Button>
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
