"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { Conversation } from "@/types";
import {
  MessageSquare,
  Search,
  Filter,
  Clock,
  User,
  Building2,
  Flag,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchConversations();
  }, [searchQuery, page]);

  const fetchConversations = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append("search", searchQuery);
      queryParams.append("page", page.toString());
      queryParams.append("limit", "20");

      const response = await apiClient.get<Conversation[]>(
        `/conversations?${queryParams.toString()}`
      );
      setConversations(response.data);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const toggleFlag = async (id: number, currentFlagged: boolean) => {
    try {
      await apiClient.patch(`/conversations/${id}/flag`, {
        flagged: !currentFlagged,
      });
      setConversations(
        conversations.map((c) =>
          c.id === id ? { ...c, flagged: !currentFlagged } : c
        )
      );
    } catch (error) {
      console.error("Failed to toggle flag:", error);
      alert("Failed to update flag status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">
          Loading conversations...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Conversations
          </h1>
          <p className="text-muted-foreground mt-2">
            Review all AI interactions with tenants
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by tenant name or message content..."
                className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button type="submit" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Conversations List */}
      {conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              {searchQuery
                ? "Try adjusting your search terms"
                : "Conversations will appear here when tenants interact with the AI"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {conversations.map((conv) => (
            <Card
              key={conv.id}
              className={`hover:shadow-lg transition-shadow ${
                conv.flagged ? "border-l-4 border-l-orange-500" : ""
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Channel Badge */}
                  <div
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                      conv.channel === "sms"
                        ? "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
                        : conv.channel === "email"
                        ? "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400"
                        : "text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400"
                    }`}
                  >
                    {conv.channel}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">
                            {conv.tenant_name || "Unknown Tenant"}
                          </h3>
                          {conv.flagged && (
                            <Flag className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {new Date(conv.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleFlag(conv.id, conv.flagged || false)}
                          className={conv.flagged ? "text-orange-500" : ""}
                        >
                          <Flag className="h-4 w-4" />
                        </Button>
                        <Link href={`/conversations/${conv.id}`}>
                          <Button size="sm" className="flex items-center gap-1">
                            View
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Message Preview */}
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Tenant Message:</span>
                      </div>
                      <p className="text-sm line-clamp-3">
                        {conv.message}
                      </p>
                    </div>

                    {/* AI Response Preview */}
                    <div className="p-3 bg-primary/5 rounded-lg mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">AI Response:</span>
                      </div>
                      <p className="text-sm line-clamp-3">
                        {conv.response}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {conversations.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
