/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToolError } from '../utils/apiError';

export const executeDisplayMap = (args: { latitude: number; longitude: number; zoom?: number, markerText?: string }): string => {
  const { latitude, longitude, zoom = 13, markerText } = args;

  if (typeof latitude !== 'number' || isNaN(latitude) || typeof longitude !== 'number' || isNaN(longitude)) {
      throw new ToolError('displayMap', 'INVALID_COORDINATES', 'Latitude and longitude must be numbers.', undefined, "The AI provided invalid coordinates (latitude/longitude). This can happen if it fails to find a location. Try rephrasing your request to be more specific.");
  }

  const mapData = {
      latitude,
      longitude,
      zoom,
      markerText
  };

  return `<map>${JSON.stringify(mapData)}</map>`;
};