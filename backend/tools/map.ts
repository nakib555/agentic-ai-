/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToolError } from '../utils/apiError';

export const executeDisplayMap = (args: { location?: string, latitude?: number; longitude?: number; zoom?: number, markerText?: string }): string => {
  const { location, latitude, longitude, zoom = 13, markerText } = args;

  // Validation: Must have either location string OR valid coordinates
  const hasCoordinates = typeof latitude === 'number' && !isNaN(latitude) && typeof longitude === 'number' && !isNaN(longitude);
  const hasLocation = location && typeof location === 'string' && location.trim().length > 0;

  if (!hasCoordinates && !hasLocation) {
      throw new ToolError('displayMap', 'INVALID_ARGUMENTS', 'Either a location name OR valid coordinates (latitude/longitude) must be provided.', undefined, "The map tool requires a location. Please provide a city name, address, or explicit coordinates.");
  }

  const mapData = {
      location,
      latitude,
      longitude,
      zoom,
      markerText
  };

  return `<map>${JSON.stringify(mapData)}</map>`;
};