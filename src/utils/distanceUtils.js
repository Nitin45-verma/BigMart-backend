/**
 * Geographic Distance Utility using the Haversine formula.
 * Calculates great-circle distance between two (latitude, longitude) coordinates on Earth.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Validates whether latitude and longitude are valid numbers within geographic boundaries.
 */
const isValidCoordinates = (lat, lon) => {
  const numLat = Number(lat);
  const numLon = Number(lon);

  if (typeof lat !== 'number' || isNaN(numLat) || numLat < -90 || numLat > 90) {
    return false;
  }
  if (typeof lon !== 'number' || isNaN(numLon) || numLon < -180 || numLon > 180) {
    return false;
  }
  return true;
};

/**
 * Converts degrees to radians.
 */
const toRadians = (degrees) => {
  return (degrees * Math.PI) / 180;
};

/**
 * Calculates straight-line geographic distance between two coordinates in kilometers.
 * Returns distance in kilometers rounded to 2 decimal places.
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!isValidCoordinates(lat1, lon1) || !isValidCoordinates(lat2, lon2)) {
    throw new Error('Invalid geographic coordinates provided for distance calculation');
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceKm = EARTH_RADIUS_KM * c;

  return Math.round(distanceKm * 100) / 100;
};

module.exports = {
  isValidCoordinates,
  calculateDistance
};
