/** Cookie-setting auth routes — do not JSON-merge feature flags on these responses. */
export const AUTH_FLAG_PIGGYBACK_SKIP_PATHS: RegExp[] = [
  /^\/auth\/verify-otp$/,
  /^\/auth\/request-otp$/,
  /^\/auth\/refresh$/,
];