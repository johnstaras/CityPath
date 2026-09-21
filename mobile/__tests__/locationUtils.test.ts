import { distanceToRouteMeters, haversineDistance, isNearLineEnd } from '../src/utils/locationUtils';

// Around Athens (lat ~37.97) one degree of longitude is ~87.8 km and one
// degree of latitude ~111 km, so 0.00045 deg of latitude is ~50 m.
const LAT = 37.9734;

// A straight west-to-east line ~175 m long.
const line: [number, number][] = [
  [23.732, LAT],
  [23.733, LAT],
  [23.734, LAT],
];

describe('distanceToRouteMeters', () => {
  it('is ~0 for a point on the line', () => {
    expect(distanceToRouteMeters(LAT, 23.7325, line)).toBeLessThan(1);
  });

  it('is ~0 at a vertex', () => {
    expect(distanceToRouteMeters(LAT, 23.733, line)).toBeLessThan(1);
  });

  it('measures perpendicular offset from a segment interior', () => {
    const d = distanceToRouteMeters(LAT + 0.00045, 23.7325, line);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(55);
  });

  it('uses the nearest endpoint when the point is beyond the line end', () => {
    const d = distanceToRouteMeters(LAT, 23.7355, line);
    const toEnd = haversineDistance(LAT, 23.7355, LAT, 23.734);
    expect(Math.abs(d - toEnd)).toBeLessThan(1);
  });

  it('picks the nearest of several segments', () => {
    const corner: [number, number][] = [
      [23.732, LAT],
      [23.733, LAT],
      [23.733, LAT + 0.001], // turns north
    ];
    // Point just west of the northern segment, far from the southern one.
    const d = distanceToRouteMeters(LAT + 0.0009, 23.73295, corner);
    expect(d).toBeLessThan(10);
  });

  it('falls back to point distance for a single-point line', () => {
    const d = distanceToRouteMeters(LAT, 23.7325, [[23.732, LAT]]);
    const direct = haversineDistance(LAT, 23.7325, LAT, 23.732);
    expect(Math.abs(d - direct)).toBeLessThan(1);
  });

  it('returns Infinity for an empty line', () => {
    expect(distanceToRouteMeters(LAT, 23.7325, [])).toBe(Infinity);
  });
});

describe('isNearLineEnd', () => {
  it('is true right at the last coordinate', () => {
    expect(isNearLineEnd(LAT, 23.734, line, 40)).toBe(true);
  });

  it('is true within the radius of the end', () => {
    // ~0.0003 deg lat ≈ 33 m north of the end point.
    expect(isNearLineEnd(LAT + 0.0003, 23.734, line, 40)).toBe(true);
  });

  it('is false beyond the radius', () => {
    // ~55 m north of the end point.
    expect(isNearLineEnd(LAT + 0.0005, 23.734, line, 40)).toBe(false);
  });

  it('is false near the START of the line (only the end counts)', () => {
    expect(isNearLineEnd(LAT, 23.732, line, 40)).toBe(false);
  });

  it('is false for an empty line', () => {
    expect(isNearLineEnd(LAT, 23.734, [], 40)).toBe(false);
  });
});
