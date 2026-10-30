/**
 * Test-only server configuration for the E2E suite. None of these are real
 * credentials: the Google client doesn't exist, and the secret only encrypts
 * cookies for the throwaway `next start` the suite launches.
 */
export const E2E_PORT = 3100;

export const E2E_AUTH_SECRET = "e2e-test-secret-not-real-0123456789abcdef";

export const E2E_AUTH_ENV = {
  AUTH_SECRET: E2E_AUTH_SECRET,
  AUTH_GOOGLE_ID: "e2e-dummy.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "e2e-dummy-google-secret",
  AUTH_TRUST_HOST: "true",
};
