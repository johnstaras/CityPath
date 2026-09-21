const axios = require('axios');
const { getOsrmUrl, OSRM_TIMEOUT_MS: OSRM_TIMEOUT } = require('../config/osrmConfig');

/**
 * Get a route between two points using OSRM pedestrian routing.
 * @param {number} startLng - Starting longitude
 * @param {number} startLat - Starting latitude
 * @param {number} endLng - Ending longitude
 * @param {number} endLat - Ending latitude
 * @param {boolean} alternatives - Whether to request alternative routes
 * @returns {Array|null} Array of route objects or null if OSRM is unreachable
 */
async function getRoute(startLng, startLat, endLng, endLat, alternatives = false) {
  const coords = `${startLng},${startLat};${endLng},${endLat}`;
  const url = `${getOsrmUrl()}/route/v1/foot/${coords}?overview=full&geometries=geojson&alternatives=${alternatives}&steps=true`;

  try {
    const response = await axios.get(url, { timeout: OSRM_TIMEOUT });

    if (response.data.code !== 'Ok') {
      console.warn(`OSRM returned non-Ok code: ${response.data.code}`);
      return null;
    }

    return response.data.routes.map(route => ({
      geometry: route.geometry,
      duration: route.duration,
      distance: route.distance,
      legs: route.legs,
    }));
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.warn(`OSRM server unreachable at ${getOsrmUrl()}: ${error.code}`);
    } else {
      console.warn(`OSRM request failed: ${error.message}`);
    }
    return null;
  }
}

/**
 * Get a route through multiple waypoints using OSRM.
 * @param {Array<{lat: number, lng: number}>} waypoints - Array of waypoint objects
 * @returns {Array|null} Array of route objects or null if OSRM is unreachable
 */
async function getRouteViaWaypoints(waypoints) {
  if (!waypoints || waypoints.length < 2) {
    console.warn('getRouteViaWaypoints requires at least 2 waypoints');
    return null;
  }

  const coords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
  const url = `${getOsrmUrl()}/route/v1/foot/${coords}?overview=full&geometries=geojson&alternatives=false&steps=true`;

  try {
    const response = await axios.get(url, { timeout: OSRM_TIMEOUT });

    if (response.data.code !== 'Ok') {
      console.warn(`OSRM returned non-Ok code: ${response.data.code}`);
      return null;
    }

    return response.data.routes.map(route => ({
      geometry: route.geometry,
      duration: route.duration,
      distance: route.distance,
      legs: route.legs,
    }));
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.warn(`OSRM server unreachable at ${getOsrmUrl()}: ${error.code}`);
    } else {
      console.warn(`OSRM request failed: ${error.message}`);
    }
    return null;
  }
}

/**
 * Get a full walking-duration matrix between a set of points using OSRM's
 * table service. One request replaces N route requests when only travel
 * times are needed (geometry is fetched separately for the winners).
 *
 * @param {Array<{lat: number, lng: number}>} points
 * @returns {number[][]|null} durations[i][j] in seconds (point i -> point j),
 *   null if OSRM is unreachable. Individual cells can be null when OSRM
 *   cannot snap a point to the network.
 */
async function getDurationTable(points) {
  if (!points || points.length < 2) {
    console.warn('getDurationTable requires at least 2 points');
    return null;
  }

  const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `${getOsrmUrl()}/table/v1/foot/${coords}?annotations=duration`;

  try {
    const response = await axios.get(url, { timeout: OSRM_TIMEOUT });

    if (response.data.code !== 'Ok') {
      console.warn(`OSRM table returned non-Ok code: ${response.data.code}`);
      return null;
    }

    return response.data.durations;
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.warn(`OSRM server unreachable at ${getOsrmUrl()}: ${error.code}`);
    } else {
      console.warn(`OSRM table request failed: ${error.message}`);
    }
    return null;
  }
}

module.exports = {
  getRoute,
  getRouteViaWaypoints,
  getDurationTable,
};
