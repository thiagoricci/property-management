"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { Property } from "@/types";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  Phone,
  Mail,
  Calendar,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AddPropertyModal } from "@/components/modals/AddPropertyModal";
import { DeleteConfirmation } from "@/components/modals/DeleteConfirmation";
import Link from "next/link";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    propertyId: number | null;
  }>({ isOpen: false, propertyId: null });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, properties]);

  const fetchProperties = async () => {
    try {
      const response = await apiClient.get<Property[]>("/properties");
      setProperties(response.data);
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = properties;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (property) =>
          property.address.toLowerCase().includes(query) ||
          property.owner_name.toLowerCase().includes(query) ||
          property.owner_email.toLowerCase().includes(query)
      );
    }

    setFilteredProperties(filtered);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteDialog({ isOpen: true, propertyId: id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.propertyId) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/properties/${deleteDialog.propertyId}`);
      setProperties(properties.filter((p) => p.id !== deleteDialog.propertyId));
      setDeleteDialog({ isOpen: false, propertyId: null });
    } catch (error) {
      console.error("Failed to delete property:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = searchQuery.trim();

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

        {/* Property Cards Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <Skeleton className="h-6 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-10 w-full mt-4" />
            </Card>
          ))}
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
            Properties
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your properties and associated tenants
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by address, owner name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Properties List */}
      {filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {hasActiveFilters ? "No properties found" : "No properties yet"}
            </h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              {hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Get started by adding your first property to system"}
            </p>
            {!hasActiveFilters && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Property
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((property) => (
            <Card key={property.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex items-start justify-between pb-3">
                <CardTitle className="text-lg font-semibold line-clamp-2">
                  {property.address}
                </CardTitle>
                <div className="flex gap-2">
                  <Link href={`/dashboard/properties/${property.id}/edit`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(property.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-medium">{property.owner_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">
                    {property.owner_email}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">
                    {property.owner_phone}
                  </span>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {property.tenant_count || 0} {property.tenant_count === 1 ? "tenant" : "tenants"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span className="text-xs">
                      {new Date(property.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <Link href={`/dashboard/properties/${property.id}`} className="block mt-4">
                  <Button variant="outline" className="w-full">
                    View Details
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Property Modal */}
      {showAddModal && (
        <AddPropertyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchProperties();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmation
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, propertyId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Property"
        description="Are you sure you want to delete this property? This action cannot be undone and will also remove all associated tenants and data."
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
