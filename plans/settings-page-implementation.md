# Settings Page Implementation Plan

## Overview

Create a comprehensive settings page for property managers to:

1. Update their personal profile (name, email, password)
2. Configure the system's Twilio account (account SID, auth token, phone number)

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Settings Page                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tabs: Profile Settings | Twilio Configuration        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API Endpoints                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Profile    │  │  Password    │  │   Twilio     │  │
│  │   Endpoints  │  │  Endpoints   │  │  Endpoints   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │    users     │  │ user_settings │                     │
│  │   table      │  │   table      │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema Changes

### New Table: user_settings

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  twilio_account_sid VARCHAR(255),
  twilio_auth_token_encrypted TEXT, -- Encrypted for security
  twilio_phone_number VARCHAR(20),
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
```

### Update users table (optional - add phone field)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
```

## Backend API Endpoints

### Profile Management Endpoints

#### GET /api/user/profile

- Returns current user's profile information
- Response: `{ id, email, name, phone, created_at }`

#### PUT /api/user/profile

- Updates user's profile (name, email, phone)
- Request: `{ name, email, phone }`
- Response: Updated user object

#### PUT /api/user/password

- Changes user's password
- Request: `{ current_password, new_password }`
- Validates current password before updating
- Response: Success message

### Twilio Configuration Endpoints

#### GET /api/settings/twilio

- Returns Twilio configuration (with masked auth token)
- Response: `{ account_sid, auth_token_masked, phone_number }`

#### PUT /api/settings/twilio

- Updates Twilio configuration
- Request: `{ account_sid, auth_token, phone_number }`
- Encrypts auth_token before storing
- Response: Success message

#### POST /api/settings/twilio/test

- Tests Twilio connection with provided credentials
- Request: `{ account_sid, auth_token, phone_number }`
- Sends test SMS to verify configuration
- Response: `{ success, message, test_message_sid }`

## Frontend Components

### Settings Page Structure

```
/dashboard/settings/
├── page.tsx                    # Main settings page with tabs
├── components/
│   ├── ProfileSettings.tsx      # Profile form component
│   ├── PasswordChange.tsx       # Password change form
│   └── TwilioConfig.tsx        # Twilio configuration form
```

### UI Components

#### 1. Profile Settings Tab

- Form fields:
  - Name (text input)
  - Email (email input, readonly if used for login)
  - Phone (text input, optional)
- Save button
- Success/error notifications

#### 2. Twilio Configuration Tab

- Form fields:
  - Account SID (text input)
  - Auth Token (password input, toggle visibility)
  - Phone Number (text input with format helper)
- Test Connection button
- Save button
- Connection status indicator
- Success/error notifications

#### 3. Password Change Tab

- Form fields:
  - Current Password (password input)
  - New Password (password input)
  - Confirm Password (password input)
- Change Password button
- Password strength indicator
- Success/error notifications

## Security Considerations

### Data Protection

1. **Twilio Auth Token Encryption**
   - Store encrypted in database using AES-256
   - Decrypt only in memory when making API calls
   - Never return decrypted token to frontend

2. **Password Security**
   - Hash passwords using bcrypt (cost factor 10+)
   - Validate password strength (min 8 chars, mix of types)
   - Require current password for changes

3. **API Security**
   - All endpoints require JWT authentication
   - Rate limiting on password change attempts
   - Input validation and sanitization

### Validation Rules

**Profile Update:**

- Name: 2-100 characters
- Email: Valid email format, unique across users
- Phone: Optional, valid phone format

**Password Change:**

- Current password: Must match stored hash
- New password: Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
- Confirm password: Must match new password

**Twilio Config:**

- Account SID: Valid Twilio SID format (ACxxxxxxxx)
- Auth Token: Min 32 characters
- Phone Number: Valid E.164 format (+1xxxxxxxxxx)

## Implementation Steps

### Step 1: Database Migration

- [ ] Create migration file: `013_add_user_settings.sql`
- [ ] Add user_settings table
- [ ] Add phone column to users table
- [ ] Run migration

### Step 2: Backend API - User Profile

- [ ] Create `src/routes/user.js` for user endpoints
- [ ] Implement GET /api/user/profile
- [ ] Implement PUT /api/user/profile
- [ ] Implement PUT /api/user/password
- [ ] Add validation middleware
- [ ] Add error handling

### Step 3: Backend API - Settings

- [ ] Create `src/routes/settings.js` for settings endpoints
- [ ] Implement GET /api/settings/twilio
- [ ] Implement PUT /api/settings/twilio
- [ ] Implement POST /api/settings/twilio/test
- [ ] Add encryption utility for auth token
- [ ] Add Twilio connection validation

### Step 4: TypeScript Types

- [ ] Update `dashboard/src/types/index.ts` with:
  - UserProfile interface
  - UserSettings interface
  - TwilioConfig interface
  - PasswordChangeRequest interface

### Step 5: Frontend - Settings Page

- [ ] Create `dashboard/src/app/dashboard/settings/page.tsx`
- [ ] Implement tab navigation (Profile | Twilio)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success notifications

### Step 6: Frontend - Profile Settings Component

- [ ] Create `dashboard/src/app/dashboard/settings/components/ProfileSettings.tsx`
- [ ] Implement profile form
- [ ] Add form validation
- [ ] Add save functionality
- [ ] Add success/error feedback

### Step 7: Frontend - Password Change Component

- [ ] Create `dashboard/src/app/dashboard/settings/components/PasswordChange.tsx`
- [ ] Implement password change form
- [ ] Add password strength indicator
- [ ] Add form validation
- [ ] Add success/error feedback

### Step 8: Frontend - Twilio Configuration Component

- [ ] Create `dashboard/src/app/dashboard/settings/components/TwilioConfig.tsx`
- [ ] Implement Twilio config form
- [ ] Add auth token visibility toggle
- [ ] Add test connection functionality
- [ ] Add connection status indicator
- [ ] Add save functionality
- [ ] Add success/error feedback

### Step 9: Navigation Update

- [ ] Add Settings to dashboard sidebar navigation
- [ ] Use Settings icon from lucide-react
- [ ] Add route to navigation array

### Step 10: Testing

- [ ] Test profile update flow
- [ ] Test password change flow
- [ ] Test Twilio configuration flow
- [ ] Test Twilio connection testing
- [ ] Test error handling
- [ ] Test form validation
- [ ] Test security (encryption, auth)

## User Flow

### Profile Update Flow

```
1. User navigates to /dashboard/settings
2. Clicks "Profile Settings" tab
3. Edits name and/or phone
4. Clicks "Save Changes"
5. System validates input
6. System updates database
7. User sees success notification
```

### Password Change Flow

```
1. User navigates to /dashboard/settings
2. Clicks "Password Change" tab
3. Enters current password
4. Enters new password
5. Confirms new password
6. System validates passwords
7. System updates password hash
8. User sees success notification
9. User is logged out and redirected to login
```

### Twilio Configuration Flow

```
1. User navigates to /dashboard/settings
2. Clicks "Twilio Configuration" tab
3. Enters Account SID, Auth Token, Phone Number
4. Clicks "Test Connection"
5. System sends test SMS
6. User receives test SMS
7. User clicks "Save Configuration"
8. System encrypts and stores credentials
9. User sees success notification
```

## Error Handling

### Common Error Scenarios

1. **Profile Update Errors**
   - Email already in use: "This email is already registered"
   - Invalid email format: "Please enter a valid email address"
   - Network error: "Failed to update profile. Please try again."

2. **Password Change Errors**
   - Wrong current password: "Current password is incorrect"
   - Weak password: "Password must be at least 8 characters with uppercase, lowercase, and numbers"
   - Passwords don't match: "New passwords do not match"
   - Network error: "Failed to change password. Please try again."

3. **Twilio Configuration Errors**
   - Invalid credentials: "Invalid Twilio credentials"
   - Test SMS failed: "Failed to send test SMS. Please check your credentials."
   - Network error: "Failed to save configuration. Please try again."

## Success Metrics

- Profile updates complete successfully with <2 second response time
- Password changes complete successfully with proper security measures
- Twilio configuration saves securely with encrypted auth token
- Connection testing provides immediate feedback
- All forms have proper validation and error messages
- User experience is intuitive and consistent with existing dashboard

## Future Enhancements

1. **Additional Settings**
   - Notification preferences (email, SMS, in-app)
   - Theme selection (light/dark mode)
   - Language preferences
   - Timezone settings

2. **Advanced Twilio Features**
   - Multiple phone numbers
   - WhatsApp integration
   - Voice configuration
   - Webhook URL configuration

3. **Audit Log**
   - Track all settings changes
   - Show change history
   - Allow rollback to previous settings

4. **Two-Factor Authentication**
   - Enable 2FA for dashboard access
   - SMS or authenticator app options
   - Backup codes for recovery
