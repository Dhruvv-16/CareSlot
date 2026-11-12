// Preload hook to mock server-only for standalone tsx test runs
try {
  require.cache[require.resolve("server-only")] = {
    id: "server-only",
    filename: "server-only",
    loaded: true,
    exports: {},
  };
} catch (_) {}

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://dummy.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-secret-key";

