import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, GeoJSON, useMapEvents, useMap } from 'react-leaflet';
import { CloudRain, Map as MapIcon, BarChart3, Activity, Droplets, Zap, ShieldAlert, Cpu, Search } from 'lucide-react';
import VerificationReport from './VerificationReport';
import './App.css';

const StormXLogo = () => (
    <svg width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="stormxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#d8b4fe" />
            </linearGradient>
            <filter id="stormNeon" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <polygon points="50,5 90,27 90,73 50,95 10,73 10,27" fill="none" stroke="url(#stormxGrad)" strokeWidth="8" filter="url(#stormNeon)" />
        <path d="M58 20 L32 55 L48 55 L38 85 L68 45 L48 45 Z" fill="white" filter="url(#stormNeon)" />
    </svg>
);

// Component to handle map clicks
function MapInteraction({ onMapClick }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng);
        },
    });
    return null;
}

// Component to handle map auto flying
function MapFlyer({ coords }) {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.flyTo([coords.lat, coords.lng], 8);
        }
    }, [coords, map]);
    return null;
}

function App() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("map");
    const [selectedCoords, setSelectedCoords] = useState({ lat: 13.0827, lng: 80.2707, name: "Chennai" });
    const [geoJsonData, setGeoJsonData] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        // Fetch India States GeoJSON
        fetch("https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson")
            .then(res => res.json())
            .then(data => setGeoJsonData(data))
            .catch(err => console.error("Could not load shapefile:", err));
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const searchData = await response.json();
            if (searchData && searchData.length > 0) {
                const bestMatch = searchData[0];
                const cleanName = bestMatch.display_name.split(',')[0];
                setSelectedCoords({ lat: parseFloat(bestMatch.lat), lng: parseFloat(bestMatch.lon), name: cleanName });
                setData(null);
            } else {
                alert("Location not found! Try searching for a known city name.");
            }
        } catch (error) {
            console.error("Search API Error:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const fetchForecast = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8000/api/forecast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: selectedCoords.lat, longitude: selectedCoords.lng }),
            });
            const realData = await response.json();
            if (realData.error) {
                alert(`Error: ${realData.error}. Backend might be missing data.`);
                setData(null);
            } else {
                setData(realData);
            }
        } catch (error) {
            console.error("Failed to run pipeline:", error);
            alert("Backend verification failed. Please start the Python FastAPI server.");
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleMapClick = async (latlng) => {
        setSelectedCoords({ lat: latlng.lat, lng: latlng.lng, name: `Fetching location...` });
        setData(null);
        try {
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latlng.lat}&longitude=${latlng.lng}&localityLanguage=en`);
            const resData = await response.json();
            let locationName = `Grid [${latlng.lat.toFixed(2)}, ${latlng.lng.toFixed(2)}]`;
            if (resData && (resData.city || resData.locality || resData.principalSubdivision)) {
                locationName = `${resData.city || resData.locality || 'Unknown'}, ${resData.principalSubdivision || resData.countryName || ''}`;
                // cleanup if one is missing
                locationName = locationName.replace(/^, | ,$|Unknown, /g, '').trim();
            }
            setSelectedCoords({ lat: latlng.lat, lng: latlng.lng, name: locationName });
        } catch (error) {
            console.error("Reverse geocoding failed", error);
            setSelectedCoords({ lat: latlng.lat, lng: latlng.lng, name: `Grid [${latlng.lat.toFixed(2)}, ${latlng.lng.toFixed(2)}]` });
        }
    };

    return (
        <div className="dashboard-layout">
            {/* Glass Navbar */}
            <nav className="top-navbar">
                <div className="nav-brand">
                    <div className="brand-icon-wrapper">
                        <StormXLogo />
                    </div>
                    <h1>StormX <span>AI</span></h1>
                </div>

                <div className="nav-tabs">
                    <button
                        className={`nav-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
                        onClick={() => setActiveTab('map')}
                    >
                        <MapIcon size={18} /> Geospatial AI
                    </button>
                    <button
                        className={`nav-tab-btn ${activeTab === 'verification' ? 'active' : ''}`}
                        onClick={() => setActiveTab('verification')}
                    >
                        <BarChart3 size={18} /> Analytics & Skill
                    </button>
                </div>
            </nav>

            <main className="main-container">
                {activeTab === 'map' ? (
                    <>
                        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 className="dashboard-title">Regime-Aware Rainfall Predictor</h2>
                                <p className="dashboard-subtitle">Select a geographical grid to run the Deep Learning NWP Post-Processing Pipeline.</p>
                            </div>

                            <form onSubmit={handleSearch} className="search-form" style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    placeholder="Search a city..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="search-input"
                                    style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                />
                                <button type="submit" disabled={isSearching} className="btn-primary" style={{ padding: '0 15px', width: 'auto' }}>
                                    {isSearching ? <Activity className="animate-spin" size={20} /> : <Search size={20} />}
                                </button>
                            </form>
                        </div>

                        <div className="dashboard-grid">
                            {/* Left Side: Map */}
                            <div className="card">
                                <div className="card-header">
                                    <h2><MapIcon className="text-primary" size={22} /> Indian Subcontinent Map</h2>
                                </div>
                                <div className="map-card-wrapper">
                                    <MapContainer
                                        center={[selectedCoords.lat, selectedCoords.lng]}
                                        zoom={6}
                                        minZoom={5}
                                        maxZoom={18}
                                        maxBounds={[[6.5, 68.0], [37.5, 97.5]]}
                                        maxBoundsViscosity={1.0}
                                        scrollWheelZoom={true}
                                        style={{ height: '100%', width: '100%', backgroundColor: '#f8fafc' }}
                                    >
                                        <MapFlyer coords={selectedCoords} />
                                        <MapInteraction onMapClick={handleMapClick} />

                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        />

                                        {geoJsonData && (
                                            <GeoJSON
                                                data={geoJsonData}
                                                style={() => ({
                                                    color: '#4318ff',
                                                    weight: 1.5,
                                                    fillOpacity: 0.03,
                                                    dashArray: '4'
                                                })}
                                            />
                                        )}
                                        <Marker position={[selectedCoords.lat, selectedCoords.lng]}>
                                            <Popup><strong>{selectedCoords.name}</strong></Popup>
                                        </Marker>
                                        {data && (
                                            <CircleMarker
                                                center={[selectedCoords.lat, selectedCoords.lng]}
                                                radius={Math.min(45, Math.max(15, data.bias_corrected_rainfall / 1.5))}
                                                fillColor={data.heavy_rain_probability > 0.5 ? "var(--warning)" : "var(--success)"}
                                                color="white"
                                                weight={3}
                                                fillOpacity={0.4}
                                            />
                                        )}
                                    </MapContainer>
                                </div>
                            </div>

                            {/* Right Side: Execution Panel */}
                            <div className="card ai-panel">
                                <div className="card-header">
                                    <h2><Cpu size={22} /> AI Execution Engine</h2>
                                </div>

                                <div className="location-badge">
                                    <MapIcon size={16} /> {selectedCoords.name}
                                </div>

                                <button onClick={fetchForecast} className="btn-primary" disabled={loading}>
                                    {loading ? <><Activity className="animate-spin" /> Processing Neural Weights...</> : <><Zap /> Launch Prediction Pipeline</>}
                                </button>

                                {data ? (
                                    <div className="results-container slide-up">
                                        <div className="result-card">
                                            <div className="result-left">
                                                <div className="result-icon primary"><Activity size={20} /></div>
                                                <span className="result-label">Weather Regime</span>
                                            </div>
                                            <span className="result-value" style={{ color: 'var(--primary)' }}>{data.predicted_regime}</span>
                                        </div>

                                        <div className="result-card">
                                            <div className="result-left">
                                                <div className="result-icon accent"><CloudRain size={20} /></div>
                                                <span className="result-label">Raw NWP Output</span>
                                            </div>
                                            <span className="result-value">{data.raw_rainfall_nwp} mm</span>
                                        </div>

                                        <div className="result-card" style={{ borderColor: 'var(--success)' }}>
                                            <div className="result-left">
                                                <div className="result-icon success"><Droplets size={20} /></div>
                                                <span className="result-label">AI Corrected</span>
                                            </div>
                                            <span className="result-value" style={{ color: 'var(--success)' }}>{data.bias_corrected_rainfall} mm</span>
                                        </div>

                                        <div className="result-card" style={{
                                            borderColor: data.heavy_rain_probability > 0.5 ? 'var(--warning)' : 'var(--border)',
                                            background: data.heavy_rain_probability > 0.5 ? 'var(--warning-bg)' : ''
                                        }}>
                                            <div className="result-left">
                                                <div className={`result-icon ${data.heavy_rain_probability > 0.5 ? 'warning' : 'success'}`}>
                                                    {data.heavy_rain_probability > 0.5 ? <ShieldAlert size={20} /> : <Activity size={20} />}
                                                </div>
                                                <span className="result-label">Heavy Rain Risk</span>
                                            </div>
                                            <span className="result-value" style={{ color: data.heavy_rain_probability > 0.5 ? 'var(--warning)' : 'var(--success)' }}>
                                                {(data.heavy_rain_probability * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <MapIcon size={48} className="empty-icon" />
                                        <p>Select a location on the map and launch the pipeline to generate AI-corrected forecasts.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <VerificationReport />
                )}
            </main>
        </div>
    );
}

export default App;
