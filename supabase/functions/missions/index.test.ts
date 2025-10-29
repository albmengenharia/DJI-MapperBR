import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { sinon } from "https://deno.land/x/sinon@v2.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// Mock the DroneMappingEngine
const mockGenerateWaypoints = sinon.stub().returns([
  { latitude: 1, longitude: 1 },
]);
const DroneMappingEngine = sinon.stub().returns({
  generateWaypoints: mockGenerateWaypoints,
});

// Mock createClient
const mockSupabaseClient = {
  from: sinon.stub().returnsThis(),
  select: sinon.stub().returnsThis(),
  eq: sinon.stub().returnsThis(),
  insert: sinon.stub().returnsThis(),
  single: sinon.stub(),
};
const createClientStub = sinon.stub(createClient).returns(mockSupabaseClient);

// Import the server logic after mocking
const serverLogic = (await import("./index.ts")).default;

Deno.test("Missions Endpoint", async (t) => {
  const handler = async (req: Request) => {
    // This is a simplified way to handle the async generator `serve` returns
    for await (const handle of serve(() => serverLogic(req))) {
      return handle.respondWith(new Response());
    }
    return new Response("Error: Handler finished unexpectedly", { status: 500 });
  };

  await t.step("POST /missions - should return 401 if no API key is provided", async () => {
    const req = new Request("http://localhost/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await serverLogic(req);
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "API key is required.");
  });

  await t.step("POST /missions - should return 401 for invalid API key", async () => {
    mockSupabaseClient.single.resolves({ data: null, error: new Error("Not found") });
    const req = new Request("http://localhost/missions", {
      method: "POST",
      headers: { "Authorization": "Bearer invalid-key", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await serverLogic(req);
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Invalid API key.");
  });

  await t.step("POST /missions - should create a mission successfully", async () => {
    // Mock a valid profile lookup
    mockSupabaseClient.from.withArgs("profiles").select().eq().single.resolves({
        data: { user_id: "test-user-id" },
        error: null
    });
    // Mock a successful mission insert
    mockSupabaseClient.from.withArgs("missions").insert().select().single.resolves({
        data: { id: "new-mission-id" },
        error: null
    });

    const req = new Request("http://localhost/missions", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-key", "Content-Type": "application/json" },
      body: JSON.stringify({
        polygon: [{ latitude: 0, longitude: 0 }],
        drone_model: "test-drone",
        quality: "high",
      }),
    });

    const res = await serverLogic(req);
    assertEquals(res.status, 202);
    const body = await res.json();
    assertEquals(body.mission_id, "new-mission-id");
  });

  await t.step("GET /missions/{id} - should retrieve a mission successfully", async () => {
    // Mock a valid profile lookup
    mockSupabaseClient.from.withArgs("profiles").select().eq().single.resolves({
        data: { user_id: "test-user-id" },
        error: null
    });
    // Mock a successful mission lookup
    const missionPayload = { id: "mission-to-get", result_payload: {} };
    mockSupabaseClient.from.withArgs("missions").select().eq("id", "mission-to-get").eq("user_id", "test-user-id").single.resolves({
        data: missionPayload,
        error: null
    });

    const req = new Request("http://localhost/missions/mission-to-get", {
      method: "GET",
      headers: { "Authorization": "Bearer valid-key" },
    });

    const res = await serverLogic(req);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.id, "mission-to-get");
  });

  await t.step("GET /missions/{id} - should return 404 for non-existent mission", async () => {
    mockSupabaseClient.from.withArgs("profiles").select().eq().single.resolves({
        data: { user_id: "test-user-id" },
        error: null
    });
    // Mock a failed mission lookup
    mockSupabaseClient.from.withArgs("missions").select().eq("id", "not-found-id").eq("user_id", "test-user-id").single.resolves({
        data: null,
        error: new Error("Not found")
    });

    const req = new Request("http://localhost/missions/not-found-id", {
      method: "GET",
      headers: { "Authorization": "Bearer valid-key" },
    });

    const res = await serverLogic(req);
    assertEquals(res.status, 404);
  });

  // Restore stubs
  sinon.restore();
});
