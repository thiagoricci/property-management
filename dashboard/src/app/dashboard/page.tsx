"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { DashboardStats } from "@/types";
import {
  Building2,
  Users,
  AlertTriangle,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get<DashboardStats>("/dashboard/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard Overview
        </h1>
        <p className="text-muted-foreground mt-2">
          Welcome back! Here's what's happening with your properties.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Properties
            </CardTitle>
            <Building2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.total_properties || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active properties
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tenants
            </CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.total_tenants || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all properties
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Requests
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.open_requests || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Need attention
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Urgent Requests
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.urgent_requests || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Immediate action needed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Conversations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Conversations</CardTitle>
            <Link
              href="/dashboard/conversations"
              className="text-sm text-primary hover:underline flex items-center"
            >
              View all
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {stats?.recent_conversations && stats.recent_conversations.length > 0 ? (
            <div className="space-y-4">
              {stats.recent_conversations.slice(0, 5).map((conv) => (
                <Link
                  key={conv.id}
                  href={`/dashboard/conversations?tenant=${conv.tenant_id}&tenantName=${encodeURIComponent(conv.tenant_name || 'Unknown')}`}
                  className="block"
                >
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-sm">
                          {conv.tenant_name || "Unknown"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {conv.message_count || 1} message{conv.message_count && conv.message_count > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(conv.timestamp).toLocaleDateString()}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {conv.channel}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {conv.message}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent conversations</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
