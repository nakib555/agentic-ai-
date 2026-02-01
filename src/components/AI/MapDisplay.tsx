
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with webpack/bundlers
// We use the CDN URLs matching what's in index.html for consistency,
// but explicitly setting them ensures the Marker component finds them.
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type MapDisplayProps = {
  latitude: number;
  longitude: number;
  zoom?: number;
  markerText?: string;
};

// Component to handle map view updates when props change
const MapUpdater = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, {
            duration: 1.5 // Smooth fly animation
        });
    }, [center, zoom, map]);
    return null;
};

export const MapDisplay = ({ latitude, longitude, zoom = 13, markerText }: MapDisplayProps) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isValidCoords = typeof latitude === 'number' && isFinite(latitude) && typeof longitude === 'number' && isFinite(longitude);

  if (!isValidCoords) {
    return (
      <div className="my-6 rounded-xl overflow-hidden border border-red-200 dark:border-red-900/50 shadow-sm relative z-0">
        <div
          className="h-64 w-full bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500 p-4 text-center text-sm"
        >
          <p>Invalid map coordinates.</p>
        </div>
      </div>
    );
  }

  if (!isClient) {
      return <div className="h-[400px] w-full bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse my-6" />;
  }

  const position: [number, number] = [latitude, longitude];

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 relative z-0 h-[400px] w-full bg-slate-100 dark:bg-[#121212]">
      <MapContainer 
        center={position} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true} 
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            {markerText || `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
          </Popup>
        </Marker>
        <MapUpdater center={position} zoom={zoom} />
      </MapContainer>
    </div>
  );
};
