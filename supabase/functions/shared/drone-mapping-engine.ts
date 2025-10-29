import {
  Point,
  LatLng,
} from "https://deno.land/x/geodesy@v2.0.2/common.ts";

export class DroneMappingEngine {
  altitude: number;
  forwardOverlap: number;
  sideOverlap: number;
  sensorWidth: number;
  sensorHeight: number;
  focalLength: number;
  imageWidth: number;
  imageHeight: number;
  angle: number;

  constructor(options: {
    altitude: number;
    forwardOverlap: number;
    sideOverlap: number;
    sensorWidth: number;
    sensorHeight: number;
    focalLength: number;
    imageWidth: number;
    imageHeight: number;
    angle: number;
  }) {
    this.altitude = options.altitude;
    this.forwardOverlap = options.forwardOverlap;
    this.sideOverlap = options.sideOverlap;
    this.sensorWidth = options.sensorWidth;
    this.sensorHeight = options.sensorHeight;
    this.focalLength = options.focalLength;
    this.imageWidth = options.imageWidth;
    this.imageHeight = options.imageHeight;
    this.angle = options.angle;
  }

  get gsdX(): number {
    return (this.altitude * this.sensorWidth) / (this.imageWidth * this.focalLength);
  }

  get gsdY(): number {
    return (this.altitude * this.sensorHeight) / (this.imageHeight * this.focalLength);
  }

  get footprintWidth(): number {
    return this.gsdX * this.imageWidth;
  }

  get footprintHeight(): number {
    return this.gsdY * this.imageHeight;
  }

  get effectiveFootprintWidth(): number {
    return this.footprintWidth * (1 - this.sideOverlap);
  }

  get effectiveFootprintHeight(): number {
    return this.footprintHeight * (1 - this.forwardOverlap);
  }

  get flightLineSpacing(): number {
    return this.footprintWidth * (1 - this.sideOverlap);
  }

  get pathSpacing(): number {
    return this.footprintHeight * (1 - this.forwardOverlap);
  }

  get horizontalLineSpacing(): number {
    return this.footprintHeight * (1 - this.sideOverlap);
  }

  get horizontalWaypointSpacing(): number {
    return this.footprintWidth * (1 - this.forwardOverlap);
  }

  private static _latLngToMeters(polygon: LatLng[]): Point[] {
    const origin = polygon[0];
    const originLat = origin.latitude;
    const originLng = origin.longitude;
    return polygon.map((latLng) => {
      const x = (latLng.longitude - originLng) * (40075000 * Math.cos((originLat * Math.PI) / 180) / 360);
      const y = (latLng.latitude - originLat) * (40075000 / 360);
      return { x, y };
    });
  }

  private static _metersToLatLng(points: Point[], origin: LatLng): LatLng[] {
    const originLat = origin.latitude;
    const originLng = origin.longitude;
    return points.map((point) => {
      const lat = originLat + (point.y / (40075000 / 360));
      const lng = originLng + (point.x / (40075000 * Math.cos((originLat * Math.PI) / 180) / 360));
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
    return polygon.map((point) => DroneMappingEngine._rotatePoint(point, angle));
  }

  private static _isPointInPolygon(point: Point, polygon: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  public static calculateArea(polygon: LatLng[]): number {
    const localPolygon = DroneMappingEngine._latLngToMeters(polygon);
    let area = 0.0;
    for (let i = 0; i < localPolygon.length; i++) {
      const p1 = localPolygon[i];
      const p2 = localPolygon[(i + 1) % localPolygon.length];
      area += p1.x * p2.y - p2.x * p1.y;
    }
    return Math.abs(area) / 2.0;
  }

  public generateWaypoints(polygon: LatLng[], createCameraPoints: boolean, fillGrid = false): LatLng[] {
    const localPolygon = DroneMappingEngine._latLngToMeters(polygon);
    const rotatedPolygon = DroneMappingEngine._rotatePolygon(localPolygon, this.angle);
    const origin = polygon[0];

    const minX = Math.min(...rotatedPolygon.map((p) => p.x));
    const maxX = Math.max(...rotatedPolygon.map((p) => p.x));
    const minY = Math.min(...rotatedPolygon.map((p) => p.y));
    const maxY = Math.max(...rotatedPolygon.map((p) => p.y));

    const waypoints: Point[] = [];
    let reverse = false;

    for (let y = minY; y <= maxY; y += this.horizontalLineSpacing) {
      let line: Point[] = [];
      if (createCameraPoints) {
        for (let x = minX; x <= maxX; x += this.horizontalWaypointSpacing) {
          const p = { x, y };
          if (DroneMappingEngine._isPointInPolygon(p, rotatedPolygon)) {
            line.push(p);
          }
        }
        if (line.length > 0) {
          const lastInLine = line[line.length - 1];
          if (Math.abs(maxX - lastInLine.x) > 1e-6) {
            const candidate = { x: maxX, y };
            if (DroneMappingEngine._isPointInPolygon(candidate, rotatedPolygon)) {
              line.push(candidate);
            }
          }
        }
      } else {
        let firstPoint: Point | null = null;
        let lastPoint: Point | null = null;
        for (let x = minX; x <= maxX; x += this.horizontalWaypointSpacing) {
          const p = { x, y };
          if (DroneMappingEngine._isPointInPolygon(p, rotatedPolygon)) {
            if (!firstPoint) firstPoint = p;
            lastPoint = p;
          }
        }
        if (firstPoint) {
          if (lastPoint && Math.abs(maxX - lastPoint.x) > 1e-6) {
            const candidate = { x: maxX, y };
            if (DroneMappingEngine._isPointInPolygon(candidate, rotatedPolygon)) {
              lastPoint = candidate;
            }
          }
          line.push(firstPoint);
          if (lastPoint && lastPoint !== firstPoint) {
            line.push(lastPoint);
          }
        }
      }
      if (reverse) {
        line.reverse();
      }
      waypoints.push(...line);
      reverse = !reverse;
    }

    const lastHorizontalPoint = waypoints.length > 0 ? waypoints[waypoints.length - 1] : { x: minX, y: minY };

    if (fillGrid && waypoints.length > 0) {
        const minHorizontalX = waypoints.length > 0 ? Math.min(...waypoints.map(p => p.x)) : minX;
        const maxHorizontalX = waypoints.length > 0 ? Math.max(...waypoints.map(p => p.x)) : maxX;
        const minHorizontalY = waypoints.length > 0 ? Math.min(...waypoints.map(p => p.y)) : minY;
        const maxHorizontalY = waypoints.length > 0 ? Math.max(...waypoints.map(p => p.y)) : maxY;

        const verticalWaypoints = this.generateVerticalWaypoints(rotatedPolygon, createCameraPoints, lastHorizontalPoint, minHorizontalX, maxHorizontalX, minHorizontalY, maxHorizontalY);
        waypoints.push(...verticalWaypoints);
    }

    const rotatedWaypointsBack = DroneMappingEngine._rotatePolygon(waypoints, -this.angle);
    return DroneMappingEngine._metersToLatLng(rotatedWaypointsBack, origin);
  }

  private generateVerticalWaypoints(polygon: Point[], createCameraPoints: boolean, lastHorizontal: Point, minHorizontalX: number, maxHorizontalX: number, minHorizontalY: number, maxHorizontalY: number): Point[] {
    const verticalWaypoints: Point[] = [];
    const verticalLineSpacing = this.horizontalLineSpacing;
    const verticalWaypointSpacing = this.footprintHeight * (1 - this.forwardOverlap);
    const offset = verticalWaypointSpacing * 0.1;

    const verticalYCoords: number[] = [];
    const adjustedMinY = minHorizontalY - verticalWaypointSpacing / 2 - offset;
    for (let y = adjustedMinY; y <= maxHorizontalY + verticalWaypointSpacing / 2; y += verticalWaypointSpacing) {
        verticalYCoords.push(y);
    }

    const xLeft = minHorizontalX + verticalLineSpacing / 2;
    const yLeft = verticalYCoords.filter(y => DroneMappingEngine._isPointInPolygon({ x: xLeft, y }, polygon));
    let minDistLeft = Infinity;
    let distBottomLeft = Infinity;
    let distTopLeft = Infinity;
    if (yLeft.length > 0) {
        const yBottomLeft = yLeft[0];
        const yTopLeft = yLeft[yLeft.length - 1];
        distBottomLeft = Math.sqrt(Math.pow(xLeft - lastHorizontal.x, 2) + Math.pow(yBottomLeft - lastHorizontal.y, 2));
        distTopLeft = Math.sqrt(Math.pow(xLeft - lastHorizontal.x, 2) + Math.pow(yTopLeft - lastHorizontal.y, 2));
        minDistLeft = Math.min(distBottomLeft, distTopLeft);
    }

    const xRight = maxHorizontalX - verticalLineSpacing / 2;
    const yRight = verticalYCoords.filter(y => DroneMappingEngine._isPointInPolygon({ x: xRight, y }, polygon));
    let minDistRight = Infinity;
    let distBottomRight = Infinity;
    let distTopRight = Infinity;
    if (yRight.length > 0) {
        const yBottomRight = yRight[0];
        const yTopRight = yRight[yRight.length - 1];
        distBottomRight = Math.sqrt(Math.pow(xRight - lastHorizontal.x, 2) + Math.pow(yBottomRight - lastHorizontal.y, 2));
        distTopRight = Math.sqrt(Math.pow(xRight - lastHorizontal.x, 2) + Math.pow(yTopRight - lastHorizontal.y, 2));
        minDistRight = Math.min(distBottomRight, distTopRight);
    }

    let startX: number;
    let deltaX: number;
    let reverse: boolean;
    if (minDistLeft < minDistRight) {
        startX = xLeft;
        deltaX = verticalLineSpacing; // Move right
        reverse = distTopLeft < distBottomLeft; // True: top-to-bottom, False: bottom-to-top
    } else {
        startX = xRight;
        deltaX = -verticalLineSpacing; // Move left
        reverse = distTopRight < distBottomRight; // True: top-to-bottom, False: bottom-to-top
    }

    const condition = (x: number) => deltaX > 0 ? x <= maxHorizontalX + verticalLineSpacing / 2 : x >= minHorizontalX - verticalLineSpacing / 2;

    for (let x = startX; condition(x); x += deltaX) {
        let column: Point[] = [];
        for (const y of verticalYCoords) {
            const p = { x, y };
            if (DroneMappingEngine._isPointInPolygon(p, polygon)) {
                column.push(p);
            }
        }
        if (column.length === 0) continue;

        if (createCameraPoints) {
            if (reverse) column.reverse();
            verticalWaypoints.push(...column);
        } else {
            if (column.length > 0) {
                const firstPoint = column[0];
                const lastPoint = column[column.length - 1];
                if (reverse) {
                    verticalWaypoints.push(lastPoint);
                    if (lastPoint !== firstPoint) {
                        verticalWaypoints.push(firstPoint);
                    }
                } else {
                    verticalWaypoints.push(firstPoint);
                    if (firstPoint !== lastPoint) {
                        verticalWaypoints.push(lastPoint);
                    }
                }
            }
        }
        reverse = !reverse;
    }

    return verticalWaypoints;
  }

  public static calculateTotalDistance(waypoints: LatLng[]): number {
    if (waypoints.length < 2) return 0.0;
    let totalDistance = 0.0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      totalDistance += DroneMappingEngine._haversineDistance(waypoints[i], waypoints[i + 1]);
    }

    return totalDistance;
  }

  public static calculateRecommendedShutterSpeed(options: {
    altitude: number;
    sensorWidth: number;
    focalLength: number;
    imageWidth: number;
    droneSpeed: number;
  }): string {
    const { altitude, sensorWidth, focalLength, imageWidth, droneSpeed } = options;
    const gsd = (altitude * sensorWidth) / (imageWidth * focalLength);
    const shutterSpeed = gsd / droneSpeed;

    const standardSpeeds = [
      1 / 16000, 1 / 8000, 1 / 6400, 1 / 5000, 1 / 4000, 1 / 3200, 1 / 2500, 1 / 2000,
      1 / 1600, 1 / 1250, 1 / 1000, 1 / 800, 1 / 640, 1 / 500, 1 / 400, 1 / 320,
      1 / 240, 1 / 200, 1 / 160, 1 / 120, 1 / 100, 1 / 80, 1 / 60, 1 / 50, 1 / 40,
      1 / 30, 1 / 25, 1 / 20, 1 / 15, 1 / 12.5, 1 / 10, 1 / 8, 1 / 6.25, 1 / 5,
      1 / 4, 1 / 3, 1 / 2,
    ];

    let closest = standardSpeeds[0];
    for (const speed of standardSpeeds) {
      if (Math.abs(shutterSpeed - speed) < Math.abs(shutterSpeed - closest)) {
        closest = speed;
      }
    }

    return `1/${Math.round(1 / closest)}`;
  }

  private static _haversineDistance(p1: LatLng, p2: LatLng): number {
    const R = 6371e3; // Earth radius in meters
    const toRad = (x: number) => x * Math.PI / 180;
    const phi1 = toRad(p1.latitude);
    const phi2 = toRad(p2.latitude);
    const deltaPhi = toRad(p2.latitude - p1.latitude);
    const deltaLambda = toRad(p2.longitude - p1.longitude);

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}
