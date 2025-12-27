// OpenAPI 3.1.0 Specification embedded as a module
// This file is generated from openapi.json
// To regenerate: node generate-openapi-embed.js

export default JSON.parse(`{
  "openapi": "3.1.0",
  "info": {
    "title": "OTP Auth API",
    "description": "Secure, passwordless OTP authentication API built for modern applications. Enterprise-grade security with multi-tenancy support.",
    "version": "2.0.0",
    "contact": {
      "name": "OTP Auth API Support",
      "url": "https://auth.idling.app"
    },
    "license": {
      "name": "Proprietary"
    }
  },
  "servers": [
    {
      "url": "https://auth.idling.app",
      "description": "Production server"
    }
  ],
  "tags": [
    {
      "name": "Authentication",
      "description": "OTP-based authentication endpoints"
    },
    {
      "name": "User",
      "description": "User information and session management"
    },
    {
      "name": "Admin",
      "description": "Administrative endpoints (requires authentication)"
    },
    {
      "name": "Health",
      "description": "Health check endpoints"
    }
  ],
  "paths": {
    "/auth/request-otp": {
      "post": {
        "tags": ["Authentication"],
        "summary": "Request OTP code",
        "description": "Request a 6-digit OTP code to be sent to the specified email address",
        "operationId": "requestOTP",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RequestOTPRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OTP sent successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RequestOTPResponse"
                }
              }
            }
          },
          "400": {
            "description": "Bad request",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          },
          "429": {
            "description": "Rate limit exceeded",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            },
            "headers": {
              "Retry-After": {
                "schema": {
                  "type": "integer"
                },
                "description": "Seconds to wait before retrying"
              }
            }
          }
        }
      }
    },
    "/auth/verify-otp": {
      "post": {
        "tags": ["Authentication"],
        "summary": "Verify OTP code",
        "description": "Verify the OTP code and receive a JWT access token",
        "operationId": "verifyOTP",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/VerifyOTPRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OTP verified successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TokenResponse"
                }
              }
            }
          },
          "401": {
            "description": "Invalid OTP code",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          },
          "404": {
            "description": "OTP not found or expired",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          },
          "429": {
            "description": "Too many attempts",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          }
        }
      }
    },
    "/auth/me": {
      "get": {
        "tags": ["User"],
        "summary": "Get current user",
        "description": "Get information about the currently authenticated user",
        "operationId": "getMe",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "User information",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/User"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          }
        }
      }
    },
    "/auth/logout": {
      "post": {
        "tags": ["User"],
        "summary": "Logout",
        "description": "Logout and revoke the current access token",
        "operationId": "logout",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Logged out successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LogoutResponse"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          }
        }
      }
    },
    "/auth/refresh": {
      "post": {
        "tags": ["User"],
        "summary": "Refresh token",
        "description": "Refresh an expiring access token",
        "operationId": "refreshToken",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RefreshTokenRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Token refreshed successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TokenResponse"
                }
              }
            }
          },
          "401": {
            "description": "Invalid or expired token",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/ProblemDetails"
                }
              }
            }
          }
        }
      }
    },
    "/admin/customers/me": {
      "get": {
        "tags": ["Admin"],
        "summary": "Get customer information",
        "description": "Get information about the current customer (requires API key or JWT)",
        "operationId": "getCustomer",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Customer information",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Customer"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized"
          }
        }
      }
    },
    "/admin/customers/{customerId}/api-keys": {
      "get": {
        "tags": ["Admin"],
        "summary": "List API keys",
        "description": "Get all API keys for a customer",
        "operationId": "listApiKeys",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "parameters": [
          {
            "name": "customerId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of API keys",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ApiKeysResponse"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": ["Admin"],
        "summary": "Create API key",
        "description": "Create a new API key for the customer",
        "operationId": "createApiKey",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "parameters": [
          {
            "name": "customerId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateApiKeyRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "API key created",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ApiKeyResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/audit-logs": {
      "get": {
        "tags": ["Admin"],
        "summary": "Get audit logs",
        "description": "Get audit logs for the customer with optional filtering",
        "operationId": "getAuditLogs",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "parameters": [
          {
            "name": "startDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date"
            }
          },
          {
            "name": "endDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date"
            }
          },
          {
            "name": "eventType",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Audit logs",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuditLogsResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/analytics": {
      "get": {
        "tags": ["Admin"],
        "summary": "Get analytics",
        "description": "Get analytics data for the customer",
        "operationId": "getAnalytics",
        "security": [
          {
            "BearerAuth": []
          },
          {
            "ApiKeyAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Analytics data",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Analytics"
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      "get": {
        "tags": ["Health"],
        "summary": "Health check",
        "description": "Check the health status of the service",
        "operationId": "healthCheck",
        "responses": {
          "200": {
            "description": "Service is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthResponse"
                }
              }
            }
          },
          "503": {
            "description": "Service is degraded or unhealthy"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT token obtained from /auth/verify-otp"
      },
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-OTP-API-Key",
        "description": "API key for multi-tenant authentication"
      }
    },
    "schemas": {
      "RequestOTPRequest": {
        "type": "object",
        "required": ["email"],
        "properties": {
          "email": {
            "type": "string",
            "format": "email",
            "example": "user@example.com"
          }
        }
      },
      "RequestOTPResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "example": true
          },
          "message": {
            "type": "string",
            "example": "OTP sent to email"
          },
          "expiresIn": {
            "type": "integer",
            "description": "OTP expiration time in seconds",
            "example": 600
          },
          "remaining": {
            "type": "integer",
            "description": "Remaining OTP requests for this email",
            "example": 2
          }
        }
      },
      "VerifyOTPRequest": {
        "type": "object",
        "required": ["email", "otp"],
        "properties": {
          "email": {
            "type": "string",
            "format": "email",
            "example": "user@example.com"
          },
          "otp": {
            "type": "string",
            "pattern": "^[0-9]{9}$",
            "example": "123456789"
          }
        }
      },
      "TokenResponse": {
        "type": "object",
        "properties": {
          "access_token": {
            "type": "string",
            "description": "JWT access token",
            "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          },
          "token_type": {
            "type": "string",
            "example": "Bearer"
          },
          "expires_in": {
            "type": "integer",
            "description": "Token expiration in seconds",
            "example": 25200
          },
          "scope": {
            "type": "string",
            "example": "openid email profile"
          },
          "sub": {
            "type": "string",
            "description": "Subject (user ID)",
            "example": "user_abc123"
          },
          "email": {
            "type": "string",
            "format": "email",
            "example": "user@example.com"
          },
          "email_verified": {
            "type": "boolean",
            "example": true
          }
        }
      },
      "User": {
        "type": "object",
        "properties": {
          "sub": {
            "type": "string",
            "description": "Subject (user ID)"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "email_verified": {
            "type": "boolean"
          },
          "iss": {
            "type": "string",
            "description": "Issuer"
          },
          "aud": {
            "type": "string",
            "description": "Audience (customer ID)"
          }
        }
      },
      "LogoutResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "example": true
          },
          "message": {
            "type": "string",
            "example": "Logged out successfully"
          }
        }
      },
      "RefreshTokenRequest": {
        "type": "object",
        "required": ["token"],
        "properties": {
          "token": {
            "type": "string",
            "description": "Current access token to refresh"
          }
        }
      },
      "Customer": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "name": {
            "type": "string"
          },
          "status": {
            "type": "string",
            "enum": ["active", "suspended", "pending"]
          },
          "plan": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "CreateApiKeyRequest": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Name for the API key",
            "example": "Production API Key"
          }
        }
      },
      "ApiKeyResponse": {
        "type": "object",
        "properties": {
          "apiKey": {
            "type": "string",
            "description": "The API key (only shown once)",
            "example": "otp_live_sk_..."
          },
          "keyId": {
            "type": "string",
            "description": "Unique identifier for the key"
          }
        }
      },
      "ApiKeysResponse": {
        "type": "object",
        "properties": {
          "apiKeys": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ApiKey"
            }
          }
        }
      },
      "ApiKey": {
        "type": "object",
        "properties": {
          "keyId": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "lastUsed": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          },
          "status": {
            "type": "string",
            "enum": ["active", "revoked"]
          }
        }
      },
      "AuditLogsResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "period": {
            "type": "object",
            "properties": {
              "start": {
                "type": "string",
                "format": "date"
              },
              "end": {
                "type": "string",
                "format": "date"
              }
            }
          },
          "total": {
            "type": "integer"
          },
          "events": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/AuditLog"
            }
          }
        }
      },
      "AuditLog": {
        "type": "object",
        "properties": {
          "eventType": {
            "type": "string"
          },
          "timestamp": {
            "type": "string",
            "format": "date-time"
          }
        },
        "additionalProperties": true
      },
      "Analytics": {
        "type": "object",
        "properties": {
          "today": {
            "type": "object",
            "properties": {
              "otpRequests": {
                "type": "integer"
              },
              "otpVerifications": {
                "type": "integer"
              },
              "successfulLogins": {
                "type": "integer"
              },
              "failedAttempts": {
                "type": "integer"
              },
              "emailsSent": {
                "type": "integer"
              },
              "successRate": {
                "type": "number"
              }
            }
          }
        }
      },
      "HealthResponse": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": ["healthy", "degraded", "unhealthy"]
          },
          "service": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "timestamp": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "ProblemDetails": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "format": "uri"
          },
          "title": {
            "type": "string"
          },
          "status": {
            "type": "integer"
          },
          "detail": {
            "type": "string"
          },
          "instance": {
            "type": "string",
            "format": "uri"
          }
        }
      }
    }
  }
}`);

