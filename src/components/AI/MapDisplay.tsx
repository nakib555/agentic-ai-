
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import { geocoders } from 'leaflet-control-geocoder';

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

type SearchState = 'idle' | 'searching' | 'found' | 'error' | 'map';

// Component to handle map view updates and smooth animation
const MapController = ({ 
    center, 
    zoom 
}: { 
    center: [number, number], 
    zoom: number 
}) => {
    const map = useMap();
    const firstRender = useRef(true);

    useEffect(() => {
        if (center) {
            if (firstRender.current) {
                map.setView(center, zoom);
                firstRender.current = false;
            } else {
                map.flyTo(center, zoom, {
                    duration: 2.0,
                    easeLinearity: 0.25
                });
            }
        }
    }, [center, zoom, map]);

    return null;
};

// Loading / Status UI Component
const GeocodeStatus = ({ state, locationName }: { state: SearchState, locationName: string }) => {
    return (
        <div className="h-[250px] md:h-[350px] w-full bg-slate-50 dark:bg-[#18181b] rounded-xl border border-gray-200 dark:border-white/10 flex flex-col items-center justify-center relative overflow-hidden">
            <AnimatePresence mode="wait">
                {state === 'searching' && (
                    <motion.div
                        key="searching"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className="relative">
                            <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-900 rounded-full"></div>
                            <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div className="text-center">
                             <p className="font-semibold text-slate-700 dark:text-slate-200 animate-pulse">Searching location...</p>
                             <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">"{locationName}"</p>
                        </div>
                    </motion.div>
                )}

                {state === 'found' && (
                    <motion.div
                        key="found"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .207 1.052l-7.5 10.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-11.9a.75.75 0 0 1 1.052-.207Z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="text-center">
                             <p className="font-bold text-green-600 dark:text-green-400">Search location complete</p>
                             <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rendering map...</p>
                        </div>
                    </motion.div>
                )}

                {state === 'error' && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-3 text-center px-6"
                    >
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        </div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Could not find location "{locationName}"</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const MapDisplay = ({ location, latitude, longitude, zoom = 13, markerText }: MapDisplayProps) => {
  const [isClient, setIsClient] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  
  // State for the resolved position and text
  const [position, setPosition] = useState<[number, number] | null>(
      (typeof latitude === 'number' && typeof longitude === 'number') 
      ? [latitude, longitude] 
      : null
  );
  const [displayText, setDisplayText] = useState(markerText || location || "Location");

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Geocoding Effect
  useEffect(() => {
    // If we already have explicit coordinates, skip searching
    if (typeof latitude === 'number' && typeof longitude === 'number') {
        setPosition([latitude, longitude]);
        setSearchState('map');
        return;
    }

    // If we have a location string but no coordinates, search
    if (location && !position) {
        setSearchState('searching');
        
        // Use Leaflet Control Geocoder (Nominatim by default)
        const GeocoderClass = (L.Control as any).Geocoder?.Nominatim || (geocoders as any)?.Nominatim;
        
        if (GeocoderClass) {
            const geocoder = new GeocoderClass();
            geocoder.geocode(location, (results: any[]) => {
                if (results && results.length > 0) {
                    // Success
                    const bestResult = results[0];
                    const newCenter: [number, number] = [bestResult.center.lat, bestResult.center.lng];
                    
                    // Artificial delay for UX (to show the tick mark)
                    setTimeout(() => {
                        setPosition(newCenter);
                        setDisplayText(bestResult.name);
                        setSearchState('found');
                        
                        // Transition to map after showing "Found" state
                        setTimeout(() => {
                            setSearchState('map');
                        }, 1200);
                    }, 800);
                } else {
                    setSearchState('error');
                }
            });
        } else {
            console.error("Geocoder not loaded");
            setSearchState('error');
        }
    } else if (position) {
        setSearchState('map');
    }
  }, [location, latitude, longitude]);


  if (!isClient) {
      return <div className="h-[250px] md:h-[350px] w-full bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse my-6" />;
  }

  // Render Status Screens (Searching, Found, Error)
  if (searchState !== 'map') {
      return (
          <div className="my-6">
            <GeocodeStatus state={searchState} locationName={location || 'Unknown'} />
          </div>
      );
  }

  // Render Map
  // Default to London if something goes wrong with position state despite 'map' status
  const renderPosition: [number, number] = position || [51.505, -0.09];

  return (
    <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="my-6 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 relative z-0 h-[250px] md:h-[350px] w-full bg-slate-100 dark:bg-[#121212] shadow-sm"
    >
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
        
        <Marker position={renderPosition}>
            <Popup>
                {displayText}
            </Popup>
        </Marker>
        
        {/* Handles smooth flying to new coordinates */}
        <MapController 
            center={renderPosition} 
            zoom={zoom} 
        />
      </MapContainer>
    </motion.div>
  );
};
