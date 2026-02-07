# Password Management Scripts

This directory contains utility scripts for managing user passwords in the AI Property Manager system.

## Scripts

### 1. Create Admin User (`create-admin-user.js`)

Creates a new admin user or resets the password if the user already exists.

**Usage:**

```bash
node scripts/create-admin-user.js [email] [password] [name]
```

**Examples:**

Create default admin user:

```bash
node scripts/create-admin-user.js
```

This creates a user with:

- Email: `admin@example.com`
- Password: `admin123`
- Name: `Admin User`

Create custom admin user:

```bash
node scripts/create-admin-user.js manager@company.com securePass123 "John Manager"
```

**What it does:**

- Checks if user already exists
- If exists: Resets the password
- If doesn't exist: Creates new user with hashed password

---

### 2. Reset Password (`reset-password.js`)

Resets the password for an existing user.

**Usage:**

```bash
node scripts/reset-password.js [email] [new-password]
```

**Examples:**

Reset default user to default password:

```bash
node scripts/reset-password.js
```

Reset specific user:

```bash
node scripts/reset-password.js admin@example.com newSecurePassword123
```

**What it does:**

- Checks if user exists
- Hashes the new password
- Updates the password in the database

---

## Default Credentials

The default admin credentials for the AI Property Manager are:

- **Email:** `admin@example.com`
- **Password:** `admin123`

⚠️ **Important:** Change these credentials after first login for security!

---

## How to Change Password After Login

Once logged in to the dashboard:

1. Navigate to **Settings** in the sidebar
2. Go to the **Password** tab
3. Enter your current password
4. Enter your new password (must meet strength requirements)
5. Confirm your new password
6. Click **Change Password**

**Password Requirements:**

- At least 8 characters
- At least one lowercase letter
- At least one uppercase letter
- At least one number
- At least one special character (@$!%\*?&)

---

## Security Notes

- Passwords are hashed using bcrypt with a salt factor of 10
- Never share these scripts or credentials in version control
- Always use strong passwords in production
- Consider implementing email-based password reset for production use
- Rotate passwords regularly

---

## Troubleshooting

**User not found error:**

- The email address doesn't exist in the database
- Use `create-admin-user.js` to create the user first

**Database connection error:**

- Ensure PostgreSQL is running
- Check your `.env` file has correct database credentials
- Verify the database `property_manager` exists

**Permission denied:**

- Ensure you have write access to the database
- Check database user permissions

---

## Future Enhancements

For production use, consider implementing:

1. **Email-based password reset** - Send reset links via email
2. **Password expiration** - Force password changes after X days
3. **Two-factor authentication** - Add 2FA for enhanced security
4. **Password history** - Prevent reuse of recent passwords
5. **Rate limiting** - Prevent brute force attacks
6. **Audit logging** - Track password changes
