import { useState } from "react";
import apiClient from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddPropertyModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    address: "",
    owner_name: "",
    owner_email: "",
    owner_phone: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    address?: string;
    owner_name?: string;
    owner_email?: string;
    owner_phone?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }

    if (!formData.owner_name.trim()) {
      newErrors.owner_name = "Owner name is required";
    }

    if (!formData.owner_email.trim()) {
      newErrors.owner_email = "Owner email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.owner_email)) {
      newErrors.owner_email = "Invalid email address";
    }

    if (!formData.owner_phone.trim()) {
      newErrors.owner_phone = "Owner phone is required";
    } else if (formData.owner_phone.replace(/\D/g, "").length < 10) {
      newErrors.owner_phone = "Phone number must be at least 10 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post("/properties", formData);
      onSuccess();
      setFormData({
        address: "",
        owner_name: "",
        owner_email: "",
        owner_phone: "",
      });
      setErrors({});
    } catch (error) {
      console.error("Failed to create property:", error);
      alert("Failed to create property. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({ ...formData, [field]: e.target.value });
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>
            Enter the property details below. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">
              Address *
            </Label>
            <Input
              id="address"
              type="text"
              required
              value={formData.address}
              onChange={handleInputChange("address")}
              placeholder="123 Main St, City, State 12345"
              className={errors.address ? "border-destructive" : ""}
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_name">
              Owner Name *
            </Label>
            <Input
              id="owner_name"
              type="text"
              required
              value={formData.owner_name}
              onChange={handleInputChange("owner_name")}
              placeholder="John Doe"
              className={errors.owner_name ? "border-destructive" : ""}
            />
            {errors.owner_name && (
              <p className="text-sm text-destructive">{errors.owner_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_email">
              Owner Email *
            </Label>
            <Input
              id="owner_email"
              type="email"
              required
              value={formData.owner_email}
              onChange={handleInputChange("owner_email")}
              placeholder="owner@example.com"
              className={errors.owner_email ? "border-destructive" : ""}
            />
            {errors.owner_email && (
              <p className="text-sm text-destructive">{errors.owner_email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_phone">
              Owner Phone *
            </Label>
            <Input
              id="owner_phone"
              type="tel"
              required
              value={formData.owner_phone}
              onChange={handleInputChange("owner_phone")}
              placeholder="+1 234 567 8900"
              className={errors.owner_phone ? "border-destructive" : ""}
            />
            {errors.owner_phone && (
              <p className="text-sm text-destructive">{errors.owner_phone}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Add Property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
