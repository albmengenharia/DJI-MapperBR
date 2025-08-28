// Supabase Edge Function for GeoPilot API
//
// This function contains the core logic for calculating drone mission waypoints,
// translated from the original Dart implementation.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper interfaces for type safety
interface Point {
  x: number;
  y: number;
}

interface LatLng {
  latitude: number;
  longitude: number;
}

// The core logic, translated from DJI-Mapper's drone_mapping_engine.dart
class DroneMappingEngine {
  // Input parameters
  altitude: number;
  forwardOverlap: number;
  sideOverlap: number;
  sensorWidth: number;
  sensorHeight: number;
  focalLength: number;
  imageWidth: number;
  imageHeight: number;
  angle: number;

  constructor(params: {
    altitude: number,
    forwardOverlap: number,
    sideOverlap: number,
    sensorWidth: number,
    sensorHeight: number,
    focalLength: number,
    imageWidth: number,
    imageHeight: number,
    angle: number,
  }) {
    this.altitude = params.altitude;
    this.forwardOverlap = params.forwardOverlap;
    this.sideOverlap = params.sideOverlap;
    this.sensorWidth = params.sensorWidth;
    this.sensorHeight = params.sensorHeight;
    this.focalLength = params.focalLength;
    this.imageWidth = params.imageWidth;
    this.imageHeight = params.imageHeight;
    this.angle = params.angle;
  }

  // Calculated properties
  get gsdX(): number { return (this.altitude * this.sensorWidth) / (this.imageWidth * this.focalLength); }
  get gsdY(): number { return (this.altitude * this.sensorHeight) / (this.imageHeight * this.focalLength); }

  get footprintWidth(): number { return this.gsdX * this.imageWidth; }
  get footprintHeight(): number { return this.gsdY * this.imageHeight; }

  get horizontalLineSpacing(): number { return this.footprintHeight * (1 - this.sideOverlap); }
  get horizontalWaypointSpacing(): number { return this.footprintWidth * (1 - this.forwardOverlap); }


  // --- Static utility functions for geometric calculations ---

  private static _latLngToMeters(polygon: LatLng[]): { points: Point[], origin: LatLng } {
    const origin = polygon[0];
    const originLat = origin.latitude;
    const originLng = origin.longitude;
    const points = polygon.map(latLng => {
      const x = (latLng.longitude - originLng) * (40075000 * Math.cos(originLat * Math.PI / 180) / 360);
      const y = (latLng.latitude - originLat) * (40075000 / 360);
      return { x, y };
    });
    return { points, origin };
  }

  private static _metersToLatLng(points: Point[], origin: LatLng): LatLng[] {
    const originLat = origin.latitude;
    const originLng = origin.longitude;
    return points.map(point => {
      const lat = originLat + (point.y / (40075000 / 360));
      const lng = originLng + (point.x / (40075000 * Math.cos(originLat * Math.PI / 180) / 360));
      return { latitude: lat, longitude: lng };
    });
  }

  private static _rotatePoint(point: Point, angle: number): Point {
    const radians = angle * (Math.PI / 180);
    const cosTheta = Math.cos(radians);
    const sinTheta = Math.sin(radians);
    const x = point.x * cosTheta - point.y * sinTheta;
    const y = point.x * sinTheta + point.y * cosTheta;
    return { x, y };
  }

  private static _rotatePolygon(polygon: Point[], angle: number): Point[] {
    return polygon.map(point => DroneMappingEngine._rotatePoint(point, angle));
  }

  private static _isPointInPolygon(point: Point, polygon: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y))
          && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // --- Main waypoint generation logic ---

  public generateWaypoints(polygon: LatLng[], createCameraPoints = false): LatLng[] {
    if (polygon.length < 3) {
        return [];
    }

    const { points: localPolygon, origin } = DroneMappingEngine._latLngToMeters(polygon);
    const rotatedPolygon = DroneMappingEngine._rotatePolygon(localPolygon, this.angle);

    const minX = Math.min(...rotatedPolygon.map(p => p.x));
    const maxX = Math.max(...rotatedPolygon.map(p => p.x));
    const minY = Math.min(...rotatedPolygon.map(p => p.y));
    const maxY = Math.max(...rotatedPolygon.map(p => p.y));

    const waypoints: Point[] = [];
    let reverse = false;

    for (let y = minY; y <= maxY; y += this.horizontalLineSpacing) {
        let line: Point[] = [];
        // Simplified logic from the original for clarity.
        // The full implementation would handle camera points and fill grids.
        for (let x = minX; x <= maxX; x += this.horizontalWaypointSpacing) {
            const p = { x, y };
            if (DroneMappingEngine._isPointInPolygon(p, rotatedPolygon)) {
                line.push(p);
            }
        }

        if (line.length > 0) {
          // In a real scenario, we might want to handle edge cases and add boundary points.
          // For this translation, we will keep it simple.
          if (createCameraPoints) {
            // Add all points in the line
          } else {
            // Only add start and end points of the scan line
            const firstPoint = line[0];
            const lastPoint = line[line.length - 1];
            line = [firstPoint];
            if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
               line.push(lastPoint);
            }
          }

          if (reverse) {
              line.reverse();
          }
          waypoints.push(...line);
        }
        reverse = !reverse;
    }

    const rotatedWaypointsBack = DroneMappingEngine._rotatePolygon(waypoints, -this.angle);
    return DroneMappingEngine._metersToLatLng(rotatedWaypointsBack, origin);
  }
}


// Define API call limits for different subscription tiers
const TIER_LIMITS = {
  free: 100,
  pro: 10000,
  enterprise: Infinity, // Or a very large number
};

// --- Supabase Edge Function Handler ---

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    } });
  }

  try {
    // 1. Initialize Supabase Admin Client
    // Use the Service Role Key for admin-level access to bypass RLS.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. API Key Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid API key.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const apiKey = authHeader.replace('Bearer ', '');

    // 3. Validate API Key
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, subscription_tier, api_call_count')
      .eq('api_key', apiKey)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Invalid API key.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Check Usage-Based Logic
    const limit = TIER_LIMITS[profile.subscription_tier] || 0;
    if (profile.api_call_count >= limit) {
      return new Response(JSON.stringify({ error: 'API call limit exceeded for your current plan.' }), {
        status: 429, // Too Many Requests
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Route request based on HTTP method
    const url = new URL(req.url);
    const missionId = url.pathname.split('/').pop();

    // --- POST /missions: Create a new mission ---
    if (req.method === 'POST') {
      const body = await req.json();

      if (!body.polygon || !body.params) {
        return new Response(JSON.stringify({ error: 'Missing polygon or params' }), { status: 400 });
      }

      const engine = new DroneMappingEngine(body.params);
      const waypoints = engine.generateWaypoints(body.polygon, body.createCameraPoints);

      const missionData = {
        user_id: profile.id,
        request_payload: body,
        result_payload: { waypoints },
      };

      const { data: newMission, error: insertError } = await supabaseAdmin
        .from('missions')
        .insert(missionData)
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to save mission: ${insertError.message}`);
      }

      // Increment API call count
      await supabaseAdmin
        .from('profiles')
        .update({ api_call_count: profile.api_call_count + 1 })
        .eq('id', profile.id);

      return new Response(JSON.stringify(newMission), {
        status: 201, // Created
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // --- GET /missions: List all missions for the user ---
    if (req.method === 'GET' && !missionId) {
      const { data, error } = await supabaseAdmin
        .from('missions')
        .select('*')
        .eq('user_id', profile.id);

      if (error) throw new Error(error.message);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // --- GET /missions/:id: Get a specific mission ---
    if (req.method === 'GET' && missionId) {
      const { data, error } = await supabaseAdmin
        .from('missions')
        .select('*')
        .eq('id', missionId)
        .eq('user_id', profile.id) // Security check
        .single();

      if (error) throw new Error(error.message);
      if (!data) return new Response(JSON.stringify({error: "Mission not found"}), { status: 404 });

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
