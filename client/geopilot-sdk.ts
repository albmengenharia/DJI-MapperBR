// GeoPilot API Client SDK
// A TypeScript library for interacting with the GeoPilot API.

// --- Type Definitions ---

/**
 * Represents a geographical coordinate.
 */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Parameters for the drone and camera for mission calculation.
 */
export interface MissionParams {
  altitude: number;
  forwardOverlap: number;
  sideOverlap: number;
  sensorWidth: number;
  sensorHeight: number;
  focalLength: number;
  imageWidth: number;
  imageHeight: number;
  angle: number;
}

/**
 * The payload required to create a new mission.
 */
export interface CreateMissionPayload {
  params: MissionParams;
  polygon: LatLng[];
  createCameraPoints?: boolean;
}

/**
 * Represents a mission object as stored and returned by the API.
 */
export interface Mission {
  id: string;
  user_id: string;
  status: string;
  request_payload: CreateMissionPayload;
  result_payload: {
    waypoints: LatLng[];
  };
  created_at: string;
  expires_at: string | null;
}

/**
 * Custom error class for API-specific errors.
 */
export class GeoPilotAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response: any
  ) {
    super(message);
    this.name = 'GeoPilotAPIError';
  }
}

// --- Main SDK Class ---

export class GeoPilotAPI {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * Creates an instance of the GeoPilot API client.
   * @param apiKey Your secret API key (e.g., "gp_...").
   * @param projectRef The project reference ID from your Supabase dashboard.
   * @param baseUrl (Optional) A custom base URL to override the default Supabase URL.
   */
  constructor(apiKey: string, projectRef: string, baseUrl?: string) {
    if (!apiKey) {
      throw new Error("GeoPilot SDK: API key is required.");
    }
    if (!projectRef && !baseUrl) {
      throw new Error("GeoPilot SDK: A Supabase projectRef or a custom baseUrl is required.");
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || `https://${projectRef}.supabase.co/functions/v1`;
  }

  /**
   * A private helper method to handle all API requests.
   */
  private async _request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    headers.set('Content-Type', 'application/json');

    const config: RequestInit = { ...options, headers };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred.' }));
        throw new GeoPilotAPIError(
          errorData.error || `Request failed with status ${response.status}`,
          response.status,
          errorData
        );
      }
      return await response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof GeoPilotAPIError) {
        throw error;
      }
      throw new Error(`Network or unexpected error: ${error.message}`);
    }
  }

  /**
   * Creates a new mission.
   * @param payload The data required to calculate the mission.
   * @returns The newly created mission object.
   */
  public async createMission(payload: CreateMissionPayload): Promise<Mission> {
    return this._request<Mission>('missions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Retrieves a list of all missions for the authenticated user.
   * @returns An array of mission objects.
   */
  public async getMissions(): Promise<Mission[]> {
    return this._request<Mission[]>('missions', {
      method: 'GET',
    });
  }

  /**
   * Retrieves a specific mission by its ID.
   * @param id The UUID of the mission to retrieve.
   * @returns A single mission object.
   */
  public async getMissionById(id: string): Promise<Mission> {
    if (!id) {
      throw new Error("GeoPilot SDK: Mission ID is required for getMissionById.");
    }
    return this._request<Mission>(`missions/${id}`, {
      method: 'GET',
    });
  }
}
