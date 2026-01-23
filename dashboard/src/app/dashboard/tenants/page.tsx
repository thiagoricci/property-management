"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { Tenant } from "@/types";
import {
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Trash2,
  Search,
  Plus,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmation } from "@/components/modals/DeleteConfirmation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    tenantId: number | null;
    tenantName: string;
  }>({ isOpen: false, tenantId: null, tenantName: "" });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, tenants]);

  const fetchTenants = async () => {
    try {
      const response = await apiClient.get<Tenant[]>("/tenants");
      setTenants(response.data);
    } catch (error) {
      console.error("Failed to fetch tenants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = tenants;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tenant) =>
          tenant.name.toLowerCase().includes(query) ||
          (tenant.email && tenant.email.toLowerCase().includes(query))
      );
    }

    setFilteredTenants(filtered);
  };

  const handleDeleteClick = (id: number, name: string) => {
    setDeleteDialog({ isOpen: true, tenantId: id, tenantName: name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.tenantId) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/tenants/${deleteDialog.tenantId}`);
      setTenants(tenants.filter((t) => t.id !== deleteDialog.tenantId));
      setDeleteDialog({ isOpen: false, tenantId: null, tenantName: "" });
    } catch (error) {
      console.error("Failed to delete tenant:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
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

  const hasActiveFilters = searchQuery.trim();

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Table Skeleton */}
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-4 bg-muted/30 border-b">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-8 ml-auto" />
            </div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 border-b last:border-b-0"
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-8 ml-auto" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tenants
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage all tenants across your properties
          </p>
        </div>
        <Link href="/dashboard/properties">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      {filteredTenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {hasActiveFilters ? "No tenants found" : "No tenants yet"}
            </h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              {hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Add tenants through the Properties page by viewing a property's details"}
            </p>
            {!hasActiveFilters && (
              <Link href="/dashboard/properties">
                <Button>
                  <Building2 className="h-4 w-4 mr-2" />
                  Go to Properties
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Tenant</TableHead>
                    <TableHead className="w-[150px]">Phone</TableHead>
                    <TableHead className="w-[200px]">Email</TableHead>
                    <TableHead className="w-[220px]">Property Address</TableHead>
                    <TableHead className="w-[140px]">Move-in Date</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      {/* Tenant Name with Avatar */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                              {getInitials(tenant.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {tenant.name}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Phone */}
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{tenant.phone}</span>
                        </div>
                      </TableCell>

                      {/* Email */}
                      <TableCell>
                        {tenant.email ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{tenant.email}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Property Address */}
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {tenant.property_address || "Unknown"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Move-in Date */}
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>{formatDate(tenant.move_in_date)}</span>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            handleDeleteClick(tenant.id, tenant.name)
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmation
        isOpen={deleteDialog.isOpen}
        onClose={() =>
          setDeleteDialog({ isOpen: false, tenantId: null, tenantName: "" })
        }
        onConfirm={handleDeleteConfirm}
        title="Delete Tenant"
        description={`Are you sure you want to delete ${deleteDialog.tenantName}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
