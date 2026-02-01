

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import { Geocoder, geocoders } from 'leaflet-control-geocoder';

// Fix for default marker icons in Leaflet with webpack/bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type MapDisplayProps = {
  location?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  markerText?: string;
};

// Component to handle map view updates and geocoding logic
const MapController = ({ 
    center, 
    zoom, 
    locationName, 
    onLocationFound 
}: { 
    center: [number, number] | null, 
    zoom: number, 
    locationName?: string, 
    onLocationFound: (pos: [number, number], name: string) => void 
}) => {
    const map = useMap();

    useEffect(() => {
        // If we have a specific location name but no coordinates yet (or to override), try to geocode
        if (locationName) {
            // Using Nominatim (OpenStreetMap) geocoder
            // Cast to any because the type definitions for this specific library can be tricky with imports
            const GeocoderClass = (L.Control as any).Geocoder?.Nominatim || (geocoders as any)?.Nominatim;
            
            if (GeocoderClass) {
                const geocoder = new GeocoderClass();
                geocoder.geocode(locationName, (results: any[]) => {
                    if (results && results.length > 0) {
                        const bestResult = results[0];
                        const newCenter = bestResult.center;
                        const latLng: [number, number] = [newCenter.lat, newCenter.lng];
                        
                        // Smooth animation to new location
                        map.flyTo(latLng, zoom, {
                            duration: 2.0, // Smooth 2s flight
                            easeLinearity: 0.25
                        });
                        
                        onLocationFound(latLng, bestResult.name);
                    }
                });
            } else {
                 console.warn("Leaflet Control Geocoder not loaded properly.");
            }
        } else if (center) {
            // If explicit coordinates provided without a name query to resolve, fly there directly
            map.flyTo(center, zoom, {
                duration: 1.5
            });
        }
    }, [locationName, center, zoom, map, onLocationFound]);

    return null;
};

export const MapDisplay = ({ location, latitude, longitude, zoom = 13, markerText }: MapDisplayProps) => {
  const [isClient, setIsClient] = useState(false);
  // Internal state for position, defaulting to props if available
  const [position, setPosition] = useState<[number, number] | null>(
      (typeof latitude === 'number' && typeof longitude === 'number') 
      ? [latitude, longitude] 
      : null
  );
  const [activeMarkerText, setActiveMarkerText] = useState(markerText || location || "Location");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLocationFound = (newPos: [number, number], name: string) => {
      setPosition(newPos);
      if (!markerText) {
          setActiveMarkerText(name);
      }
  };

  if (!isClient) {
      return <div className="h-[400px] w-full bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse my-6" />;
  }

  // Default to London if nothing provided (fallback)
  const renderPosition: [number, number] = position || [51.505, -0.09];

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 relative z-0 h-[400px] w-full bg-slate-100 dark:bg-[#121212] shadow-sm">
      <MapContainer 
        center={renderPosition} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true} 
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {position && (
            <Marker position={position}>
            <Popup>
                {activeMarkerText}
            </Popup>
            </Marker>
        )}
        
        <MapController 
            center={position} 
            zoom={zoom} 
            locationName={location} 
            onLocationFound={handleLocationFound}
        />
      </MapContainer>
    </div>
  );
};