---
"strixun-stream-suite": minor
"strixun-twitch-api": minor
"strixun-chat-signaling": minor
"@strixun/otp-auth-service": minor
"strixun-url-shortener": minor
---

feat: enhance OTP authentication service with JWT encryption, new dashboard, and improved UX

- Add JWT-based encryption/decryption for dashboard data (backward compatible)
- Implement new Svelte dashboard with analytics, API key management, and audit logs
- Add landing page with Swagger UI integration for interactive API documentation
- Refactor OtpLogin component into smaller composable components (EmailForm, OtpForm, ErrorDisplay)
- Enhance error handling with error mapping system and tooltip support for rate limits
- Improve authentication flow with customer account auto-creation and enhanced signup process
- Add rate limiting improvements with super-admin endpoints and countdown displays
- Update shared components (RateLimitInfoCard, ErrorDisplay, Tooltip) for better embedded usage
- Implement pnpm workspaces for centralized dependency management
- Enhance build processes, deployment workflows, and health checks
- Add comprehensive documentation for idle game system and API endpoints
- Update configuration with shared styles support and improved warning suppression
