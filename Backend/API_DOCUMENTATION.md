# API Documentation

## Complete API Reference for Hackathon Backend

### Base URL
```
http://localhost:3000/api
```

---

## Authentication Endpoints

### 1. Register User
**POST** `/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Validation Rules:**
- Email must be valid format
- Password must be at least 8 characters with uppercase, lowercase, number, and special character

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstName": null,
    "lastName": null
  }
}
```

---

### 2. Login User
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstName": null,
    "lastName": null,
    "photo_url": null,
    "role": "user",
    "verified": true
  },
  "tokens": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Cookies Set:**
- `accessToken` (15 minutes)
- `refreshToken` (7 days)

---

### 3. Google OAuth Login
**POST** `/auth/login-google`

**Request Body:**
```json
{
  "token": "google_id_token_here"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": 1,
    "email": "user@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "photo_url": "https://...",
    "role": "user",
    "verified": true,
    "isNewUser": true
  },
  "tokens": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

---

### 4. Verify Email
**POST** `/auth/verify-email`

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "verification_code_from_email"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "verified": true
  }
}
```

---

### 5. Forgot Password
**POST** `/auth/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### 6. Reset Password
**POST** `/auth/reset-password`

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewPass123!",
  "confirmPassword": "NewPass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful",
  "data": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

---

### 7. Refresh Token
**POST** `/auth/refresh-token`

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**OR**
- Token can be sent via `refreshToken` cookie automatically

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "new_access_token_here"
  }
}
```

---

### 8. Change Password (Authenticated)
**POST** `/auth/change-password`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "oldPassword": "OldPass123!",
  "newPassword": "NewPass123!",
  "confirmPassword": "NewPass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

---

### 9. Logout (Authenticated)
**POST** `/auth/logout`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

## User Endpoints

### 1. Get Current User Profile (Authenticated)
**GET** `/users/me`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "photo_url": "/uploads/image/photo.jpg",
    "profileCompleted": true,
    "verified": true,
    "createdAt": "2024-02-11T10:30:00Z"
  }
}
```

---

### 2. Get User Profile by ID (Public)
**GET** `/users/profile/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "photo_url": "/uploads/image/photo.jpg",
    "profileCompleted": true,
    "verified": true,
    "createdAt": "2024-02-11T10:30:00Z"
  }
}
```

---

### 3. Update User Profile (Authenticated)
**PUT** `/users/me`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "photo_url": "/uploads/image/photo.jpg"
  }
}
```

---

### 4. Upload Profile Photo (Authenticated)
**POST** `/users/avatar`

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Form Data:**
- `file` (image file, max 5MB)

**Supported Formats:** JPEG, PNG, GIF, WebP

**Response (200):**
```json
{
  "success": true,
  "message": "Profile photo uploaded successfully",
  "data": {
    "id": 1,
    "photo_url": "/uploads/image/filename-123456789.jpg"
  }
}
```

---

### 5. Get All Users (Admin Only)
**GET** `/users?page=1&limit=10`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "role": "user",
      "verified": true,
      "createdAt": "2024-02-11T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

---

### 6. Search Users (Admin Only)
**GET** `/users/search?q=john&page=1&limit=10`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Query Parameters:**
- `q` (required): Search term
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "john@example.com",
      "firstName": "John",
      "role": "user"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10
  }
}
```

---

### 7. Update User Role (Admin Only)
**PUT** `/users/:id/role`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Request Body:**
```json
{
  "role": "admin"
}
```

**Valid Roles:** `user`, `admin`

**Response (200):**
```json
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "role": "admin"
  }
}
```

---

### 8. Delete User (Admin Only)
**DELETE** `/users/:id`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### 9. Get User Statistics (Admin Only)
**GET** `/users/stats/overview`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "localUsers": 120,
    "googleUsers": 30
  }
}
```

---

## Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "error": {
    "status": 400,
    "message": "Invalid email format"
  }
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "error": {
    "status": 401,
    "message": "Access token is required"
  }
}
```

### 403 - Forbidden
```json
{
  "success": false,
  "error": {
    "status": 403,
    "message": "You do not have permission to access this resource"
  }
}
```

### 404 - Not Found
```json
{
  "success": false,
  "error": {
    "status": 404,
    "message": "User not found"
  }
}
```

### 409 - Conflict
```json
{
  "success": false,
  "error": {
    "status": 409,
    "message": "Email already exists"
  }
}
```

### 500 - Internal Server Error
```json
{
  "success": false,
  "error": {
    "status": 500,
    "message": "Internal server error"
  }
}
```

---

## Authentication Methods

### 1. Bearer Token (Recommended)
```
Authorization: Bearer <accessToken>
```

### 2. Cookie
- `accessToken` cookie is automatically sent with requests
- Works for browsers and cookie-enabled clients

---

## File Upload

### Upload Photo
- **Endpoint:** `/users/avatar`
- **Method:** POST
- **Max Size:** 5MB
- **Formats:** JPEG, PNG, GIF, WebP
- **Location:** `/uploads/image/`

---

## Environment Variables Required

```env
PORT=3000
NODE_ENV=development
DOMAIN_URL=http://localhost:9000
APP_NAME=Hackathon_API
APP_VERSION=1.0.0
APP_DESCRIPTION=API for Hackathon Template
GOOGLE_CLIENT_ID=your_google_client_id
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
JWT_ACCESS_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_RESET_PASSWORD_SECRET=your_jwt_reset_password_secret
JWT_EXPIRES_IN_ACCESS=15m
JWT_EXPIRES_IN_REFRESH=7d
JWT_EXPIRES_IN_RESET_PASSWORD=15m
DATABASE_URL=postgresql://user:password@host:port/database
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently not implemented. Consider adding in production.

---

## CORS

Configured to accept requests from `DOMAIN_URL` environment variable.

---

## Cookie Settings

All authentication cookies are:
- `httpOnly` - Not accessible via JavaScript
- `sameSite: Strict` - CSRF protection
- `secure: true` - HTTPS only in production
