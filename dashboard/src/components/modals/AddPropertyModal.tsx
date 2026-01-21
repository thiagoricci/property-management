import { useState } from "react";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiClient.post("/properties", formData);
      onSuccess();
    } catch (error) {
      console.error("Failed to create property:", error);
      alert("Failed to create property");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Add New Property</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Address *</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                placeholder="123 Main St, City, State 12345"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Owner Name *</label>
              <input
                type="text"
                required
                value={formData.owner_name}
                onChange={(e) =>
                  setFormData({ ...formData, owner_name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Owner Email *</label>
              <input
                type="email"
                required
                value={formData.owner_email}
                onChange={(e) =>
                  setFormData({ ...formData, owner_email: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                placeholder="owner@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Owner Phone *</label>
              <input
                type="tel"
                required
                value={formData.owner_phone}
                onChange={(e) =>
                  setFormData({ ...formData, owner_phone: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                placeholder="+1 234 567 8900"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? "Creating..." : "Add Property"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
