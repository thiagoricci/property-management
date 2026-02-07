"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { DashboardStats, RecentRequest } from "@/types";
import {
  Building2,
  Users,
  AlertTriangle,
  MessageSquare,
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle,
  Home,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentRequests();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get<DashboardStats>("/dashboard/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchRecentRequests = async () => {
    try {
      const response = await apiClient.get<RecentRequest[]>(
        "/dashboard/recent-requests"
      );
      setRecentRequests(response.data);
    } catch (error) {
      console.error("Failed to fetch recent requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "emergency":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
      case "urgent":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      case "normal":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "low":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const emergencyRequests = recentRequests.filter(
    (req) => req.priority === "emergency"
  );
  const urgentRequests = recentRequests.filter((req) => req.priority === "urgent");

  // Calculate completion rates (mock data for demo)
  const completionRate = stats ? ((stats.total_requests - emergencyRequests.length - urgentRequests.length) / (stats.total_requests || 1)) * 100 : 0;
  const resolutionRate = stats ? ((stats.total_conversations - emergencyRequests.length) / (stats.total_conversations || 1)) * 100 : 0;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="min-h-[120px]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Requests Skeleton */}
        <div>
          <Skeleton className="h-7 w-40 mb-4" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-40">
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-32 mb-3" />
                  <Skeleton className="h-16 w-full mb-3" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Welcome back! Here's what's happening with your properties.
            </p>
          </div>
        </div>

        {/* Alert Banners */}
        {(emergencyRequests.length > 0 || urgentRequests.length > 0) && (
          <Alert
            variant="destructive"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Attention Required
            </AlertTitle>
            <AlertDescription>
              You have{" "}
              <span className="font-semibold">{emergencyRequests.length} emergency</span> and{" "}
              <span className="font-semibold">{urgentRequests.length} urgent</span> maintenance
              requests that need immediate attention.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="min-h-[120px]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Properties
                      </p>
                      <p className="text-3xl font-bold mt-2">
                        {stats?.total_properties || 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-h-[120px]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Tenants
                      </p>
                      <p className="text-3xl font-bold mt-2">
                        {stats?.total_tenants || 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-h-[120px]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Requests
                      </p>
                      <p className="text-3xl font-bold mt-2">
                        {stats?.total_requests || 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-h-[120px]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Conversations
                      </p>
                      <p className="text-3xl font-bold mt-2">
                        {stats?.total_conversations || 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator className="my-6" />

            {/* Recent Requests */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">
                  Recent Requests
                </h2>
                <Link
                  href="/dashboard/maintenance"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1 transition-colors"
                >
                  View All
                  <Wrench className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recentRequests.map((request) => (
                  <Link
                    key={request.id}
                    href={`/dashboard/maintenance/${request.id}`}
                    className="block group"
                  >
                    <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary to-primary/60">
                                {getInitials(request.tenant_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-semibold text-sm">
                                {request.tenant_name}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Badge className={getPriorityBadgeColor(request.priority)}>
                              {request.priority.toUpperCase()}
                            </Badge>
                            <Badge className={getStatusBadgeColor(request.status)}>
                              {request.status.replace("_", " ").toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2 group-hover:text-foreground transition-colors">
                          {request.issue_description}
                        </p>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(request.created_at)}</span>
                          </div>
                          {request.property_address && (
                            <div className="flex items-center gap-1">
                              <Home className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">
                                {request.property_address}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {recentRequests.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Wrench className="h-10 w-10" />
                    </EmptyMedia>
                    <EmptyTitle>No Recent Requests</EmptyTitle>
                    <EmptyDescription>
                      No maintenance requests have been created yet.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Link
                      href="/dashboard/maintenance"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <CheckCircle className="h-4 w-4" />
                      View all maintenance requests
                    </Link>
                  </EmptyContent>
                </Empty>
              )}
            </div>
      </div>
  );
}
