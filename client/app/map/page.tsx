'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/card';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import { Loader2, MapPin, Eye } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue in Next.js
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// --- Status color scheme (matches dashboard) ---
const STATUS_COLORS: Record<string, string> = {
  uploaded:          '#94a3b8', // slate-400
  extracting:        '#eab308', // yellow-500
  extracted:         '#3b82f6', // blue-500
  extraction_failed: '#ef4444', // red-500
  needs_review:      '#f97316', // orange-500
  auto_approved:     '#22c55e', // green-500
  reviewed_approved: '#14b8a6', // teal-500
  reviewed_rejected: '#ef4444', // red-500
};

const DEFAULT_COLOR = '#94a3b8';

interface Feature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    plotId: number;
    khasraNumber: string;
    village: string;
    district: string;
    recordId: string | null;
    status: string | null;
    ownerName: string | null;
  };
}

interface FeatureCollection {
  type: string;
  features: Feature[];
}

/** Component that flies the map to the bounds of loaded features */
function FitBoundsOnLoad({ features }: { features: Feature[] }) {
  const map = useMap();
  useEffect(() => {
    if (features.length === 0) return;
    const coords = features.flatMap((f) =>
      f.geometry.coordinates[0].map((c) => [c[1], c[0]] as [number, number]),
    );
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [features, map]);
  return null;
}

function MapContent({ villageList, preselectedVillage }: { villageList: string[]; preselectedVillage: string | null }) {
  const router = useRouter();
  const [selectedVillage, setSelectedVillage] = useState(preselectedVillage || '');
  const [featureCollection, setFeatureCollection] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchVillagePlots = useCallback(async (village: string) => {
    if (!village) {
      setFeatureCollection(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (!supabase) {
        router.push('/login');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }
      const token = sessionData.session.access_token;
      const res = await fetch(`${API_BASE_URL}/api/gis/village/${encodeURIComponent(village)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch plots (${res.status})`);
      }
      const data = await res.json();
      setFeatureCollection(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Auto-fetch if preselected
  useEffect(() => {
    if (preselectedVillage) {
      setSelectedVillage(preselectedVillage);
      fetchVillagePlots(preselectedVillage);
    }
  }, [preselectedVillage, fetchVillagePlots]);

  const handleVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setSelectedVillage(v);
    fetchVillagePlots(v);
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return DEFAULT_COLOR;
    return STATUS_COLORS[status] || DEFAULT_COLOR;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Geospatial Plot Viewer</h1>
        <p className="text-slate-500 mt-1">
          View cadastral plot boundaries on an interactive map. Polygons are color-coded by document status.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Village Selector</CardTitle>
            <CardDescription>Choose a village to display its plot boundaries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <select
              value={selectedVillage}
              onChange={handleVillageChange}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 bg-white"
            >
              <option value="">Select a village...</option>
              {villageList.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Legend</label>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-green-500" /> Auto Approved</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-teal-500" /> Reviewed Approved</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-orange-500" /> Needs Review</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-slate-400" /> Uploaded / No Record</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-500" /> Failed / Rejected</div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                {error}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading plots...
              </div>
            )}

            {featureCollection && !loading && (
              <div className="text-xs text-slate-500 border-t border-slate-100 pt-3">
                {featureCollection.features.length} plot{featureCollection.features.length !== 1 ? 's' : ''} loaded
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="lg:col-span-3 flex flex-col overflow-hidden">
          <CardContent className="p-0 flex-1 relative" style={{ minHeight: '500px' }}>
            {!selectedVillage ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                <MapPin className="w-12 h-12" />
                <p className="text-sm">Select a village to view plot boundaries</p>
              </div>
            ) : (
              <MapContainer
                center={[31.68, 76.53]}
                zoom={14}
                style={{ height: '100%', width: '100%', minHeight: '500px' }}
                className="z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {featureCollection?.features.map((feature) => {
                  const coords = feature.geometry.coordinates[0].map(
                    (c) => [c[1], c[0]] as [number, number],
                  );
                  const color = getStatusColor(feature.properties.status);
                  return (
                    <Polygon
                      key={feature.properties.plotId}
                      positions={coords}
                      pathOptions={{
                        color: color,
                        weight: 2,
                        fillColor: color,
                        fillOpacity: 0.3,
                      }}
                    >
                      <Popup>
                        <div className="text-sm space-y-1 min-w-[180px]">
                          <div className="font-bold">Khasra: {feature.properties.khasraNumber}</div>
                          <div>Village: {feature.properties.village}</div>
                          {feature.properties.ownerName && (
                            <div>Owner: {feature.properties.ownerName}</div>
                          )}
                          <div>
                            Status:{' '}
                            <span style={{ color }} className="font-medium capitalize">
                              {feature.properties.status?.replace(/_/g, ' ') || 'No record'}
                            </span>
                          </div>
                          {feature.properties.recordId && (
                            <a
                              href={`/documents/${feature.properties.recordId}`}
                              className="inline-flex items-center gap-1 text-brand-600 hover:underline mt-1"
                            >
                              <Eye className="w-3 h-3" /> View Record
                            </a>
                          )}
                        </div>
                      </Popup>
                    </Polygon>
                  );
                })}
                {featureCollection && <FitBoundsOnLoad features={featureCollection.features} />}
              </MapContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function MapPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [villageList, setVillageList] = useState<string[]>([]);
  const preselectedVillage = searchParams.get('village');

  useEffect(() => {
    const fetchVillages = async () => {
      try {
        if (!supabase) {
          router.push('/login');
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          router.push('/login');
          return;
        }
        const token = sessionData.session.access_token;
        const res = await fetch(`${API_BASE_URL}/api/documents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const villages = [...new Set((data.documents || []).map((d: any) => d.village).filter(Boolean))];
        setVillageList(villages.sort());
      } catch {
        // Silently fail — village list is optional
      } finally {
        setLoadingVillages(false);
      }
    };
    fetchVillages();
  }, [router]);

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading map...
      </div>
    }>
      <MapContent villageList={villageList} preselectedVillage={preselectedVillage} />
    </Suspense>
  );
}
