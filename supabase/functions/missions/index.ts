import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { DroneMappingEngine } from "../shared/drone-mapping-engine.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const { method } = req;

  if (method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey" } });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is required." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, subscription_tier, api_call_count")
      .eq("api_key", apiKey)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Invalid API key." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // TODO: Implement rate limiting based on subscription_tier and api_call_count (User Story 3.2)

    if (method === "POST") {
      const { polygon, drone_model, quality, fill_grid, create_camera_points } = await req.json();

      if (!polygon || !drone_model || !quality) {
        return new Response(JSON.stringify({ error: "Missing required fields: polygon, drone_model, quality." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // TODO: Get drone and camera presets based on drone_model and quality
      const engine = new DroneMappingEngine({
        altitude: 100,
        forwardOverlap: 0.8,
        sideOverlap: 0.8,
        sensorWidth: 13.2,
        sensorHeight: 8.8,
        focalLength: 8.8,
        imageWidth: 5472,
        imageHeight: 3648,
        angle: 90,
      });

      const waypoints = engine.generateWaypoints(polygon, create_camera_points, fill_grid);

      const missionData = {
        user_id: profile.user_id,
        request_payload: { polygon, drone_model, quality, fill_grid, create_camera_points },
        result_payload: { waypoints },
      };

      // The service role client bypasses RLS. This is intentional for the backend,
      // as we've already authenticated the user via their API key and will set the user_id manually.
      const { data: mission, error: insertError } = await supabase
        .from("missions")
        .insert(missionData)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      return new Response(JSON.stringify({ mission_id: mission.id }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "GET") {
      const url = new URL(req.url);
      const missionId = url.pathname.split("/").pop();

      if (!missionId) {
        return new Response(JSON.stringify({ error: "Mission ID is required." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Use the service role client to query, but manually enforce that
      // the user_id from the mission matches the user_id from the authenticated profile.
      const { data: mission, error: selectError } = await supabase
        .from("missions")
        .select("*")
        .eq("id", missionId)
        .eq("user_id", profile.user_id) // Manually enforce security
        .single();

      if (selectError || !mission) {
        return new Response(JSON.stringify({ error: "Mission not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(mission), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
