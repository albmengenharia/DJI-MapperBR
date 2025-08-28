// This is a helper script to generate a new, secure API key for a user.
// To run this script, use Deno:
// deno run --allow-read supabase/functions/_shared/generate_api_key.ts

function generateApiKey(): string {
  // Generate 24 random bytes (will result in a 48-character hex string)
  const buffer = new Uint8Array(24);
  crypto.getRandomValues(buffer);

  // Convert bytes to a hexadecimal string
  const hex = Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Add a prefix for easy identification
  const apiKey = `gp_${hex}`;

  return apiKey;
}

if (import.meta.main) {
  const newApiKey = generateApiKey();
  console.log("Generated GeoPilot API Key:");
  console.log(newApiKey);
}

// Export for potential use in other parts of the application
export { generateApiKey };
