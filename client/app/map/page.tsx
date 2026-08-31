'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/card';
import { Button } from '../../components/button';
import { Search, MapPin, Layers } from 'lucide-react';

export default function MapPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);

  const mockPlots = [
    { id: 'plot-101', khasra: '123/45', owners: 'Ram Lal', area: '1.5 Hectares', coords: 'M 100,100 L 250,100 L 220,250 L 80,220 Z' },
    { id: 'plot-102', khasra: '124/11', owners: 'Hari Singh', area: '0.8 Hectares', coords: 'M 250,100 L 400,120 L 380,240 L 220,250 Z' },
    { id: 'plot-103', khasra: '125/2', owners: 'Gopal Prasad', area: '2.1 Hectares', coords: 'M 80,220 L 220,250 L 180,380 L 50,320 Z' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Geospatial Plot Viewer</h1>
        <p className="text-slate-500 mt-1">
          Verify GIS parcel boundaries mapped from scanned coordinate registers against satellite PostGIS records.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar Controls */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader>
            <CardTitle>Search Parcel</CardTitle>
            <CardDescription>Locate boundaries by Khasra or Village</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter Khasra number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-200 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Layers
              </label>
              <div className="flex flex-col space-y-1">
                <button className="flex items-center space-x-2 text-sm font-medium text-brand-600 bg-brand-50/50 p-2 rounded">
                  <Layers className="w-4 h-4" />
                  <span>Cadastral Survey Map</span>
                </button>
                <button className="flex items-center space-x-2 text-sm font-medium text-slate-600 hover:bg-slate-50 p-2 rounded">
                  <MapPin className="w-4 h-4" />
                  <span>Satellite Ortho-imagery</span>
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Selected Plot Details
              </label>
              
              {selectedPlot ? (
                (() => {
                  const plot = mockPlots.find((p) => p.id === selectedPlot);
                  return plot ? (
                    <div className="text-sm space-y-2 bg-slate-50 p-3 rounded-lg border">
                      <div><strong>Khasra No:</strong> {plot.khasra}</div>
                      <div><strong>Area:</strong> {plot.area}</div>
                      <div><strong>Owner:</strong> {plot.owners}</div>
                      <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setSelectedPlot(null)}>
                        Clear Selection
                      </Button>
                    </div>
                  ) : null;
                })()
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Click a boundary on the map to show ownership registry properties.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Map Rendering Container */}
        <Card className="lg:col-span-3 min-h-[500px] flex flex-col relative overflow-hidden bg-slate-950">
          <CardHeader className="text-white border-b border-slate-800 z-10">
            <CardTitle className="text-lg">Interactive Map Canvas</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              District: Jaipur | Village: Rampur | Tehsil: Sanganer
            </CardDescription>
          </CardHeader>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* SVG grid patterns representing land plot mapping grid */}
            <svg className="w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="flex-1 relative flex items-center justify-center p-6">
            <svg viewBox="0 0 500 500" className="w-full max-w-[500px] aspect-square">
              {mockPlots.map((plot) => (
                <path
                  key={plot.id}
                  d={plot.coords}
                  onClick={() => setSelectedPlot(plot.id)}
                  className={`cursor-pointer transition-all duration-300 stroke-2 outline-none ${
                    selectedPlot === plot.id
                      ? 'fill-brand-500/40 stroke-brand-400'
                      : 'fill-transparent stroke-slate-500 hover:fill-slate-500/20 hover:stroke-slate-300'
                  }`}
                />
              ))}
              {/* Text overlays representing Khasra plot Numbers */}
              <text x="140" y="160" fill="white" className="text-xs font-mono font-bold pointer-events-none select-none opacity-60">123/45</text>
              <text x="300" y="170" fill="white" className="text-xs font-mono font-bold pointer-events-none select-none opacity-60">124/11</text>
              <text x="120" y="300" fill="white" className="text-xs font-mono font-bold pointer-events-none select-none opacity-60">125/2</text>
            </svg>
          </div>

          <div className="absolute bottom-4 right-4 bg-slate-900/80 text-white text-xs px-3 py-1.5 rounded backdrop-blur border border-slate-800 pointer-events-none">
            Scale: 1 : 2,000 | Spatial Reference: EPSG:4326 (WGS 84 / PostGIS)
          </div>
        </Card>
      </div>
    </div>
  );
}
