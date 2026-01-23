"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Check, X } from "lucide-react";

interface PasswordChangeProps {
  onChange: (data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export default function PasswordChange({ onChange }: PasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password strength validation
  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, feedback: [] };

    const feedback = [];
    let score = 0;

    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push("At least 8 characters");
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push("Lowercase letter");
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push("Uppercase letter");
    }

    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push("Number");
    }

    if (/[@$!%*?&]/.test(password)) {
      score += 1;
    } else {
      feedback.push("Special character (@$!%*?&)");
    }

    return { score, feedback };
  };

  const strength = getPasswordStrength(newPassword);

  const getStrengthColor = (score: number) => {
    if (score <= 1) return "bg-red-500";
    if (score <= 2) return "bg-orange-500";
    if (score <= 3) return "bg-yellow-500";
    if (score <= 4) return "bg-blue-500";
    return "bg-green-500";
  };

  const getStrengthText = (score: number) => {
    if (score <= 1) return "Weak";
    if (score <= 2) return "Fair";
    if (score <= 3) return "Good";
    if (score <= 4) return "Strong";
    return "Very Strong";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    // Validate password strength
    if (strength.score < 3) {
      setError("Password is too weak. Please make it stronger.");
      return;
    }

    setIsLoading(true);

    const result = await onChange({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });

    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || "Failed to change password");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Success Message */}
      {success && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-300 flex items-center gap-2">
            <Check className="h-4 w-4" />
            Password changed successfully! You will be logged out.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center gap-2">
            <X className="h-4 w-4" />
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Current Password Field */}
      <div className="space-y-2">
        <Label htmlFor="current_password">Current Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="current_password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
            className="pl-10"
            required
          />
        </div>
      </div>

      {/* New Password Field */}
      <div className="space-y-2">
        <Label htmlFor="new_password">New Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter a new password"
            className="pl-10"
            required
            minLength={8}
          />
        </div>

        {/* Password Strength Indicator */}
        {newPassword && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getStrengthColor(
                    strength.score
                  )}`}
                  style={{ width: `${(strength.score / 5) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium">
                {getStrengthText(strength.score)}
              </span>
            </div>

            {/* Password Requirements */}
            <div className="space-y-1">
              {[
                "At least 8 characters",
                "Lowercase letter",
                "Uppercase letter",
                "Number",
                "Special character (@$!%*?&)",
              ].map((req, index) => {
                const met = strength.feedback.includes(req);
                return (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    {met ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <X className="h-3 w-3 text-gray-400" />
                    )}
                    <span className={met ? "text-green-700 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}>
                      {req}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm New Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
            className="pl-10"
            required
            minLength={8}
          />
        </div>
        {confirmPassword && confirmPassword !== newPassword && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Passwords do not match
          </p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Changing Password..." : "Change Password"}
        </Button>
      </div>
    </form>
  );
}
