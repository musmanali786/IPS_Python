import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Map,
  Database,
  FlaskConical,
  BarChart3,
  Moon,
  Sun,
  Hammer,
  Radio,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import MapSetup from './pages/MapSetup';
import DatasetManager from './pages/DatasetManager';
import ExperimentLab, { TrilaterationPanel, FingerprintPanel, PlaceholderPanel } from './pages/ExperimentLab';
import ResultsGallery from './pages/ResultsGallery';
import MapBuilder from './pages/MapBuilder';
import SignalAnalyzer from './pages/SignalAnalyzer';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/map-builder', label: 'Map Builder', icon: Hammer },
  { to: '/map-setup', label: 'Map Setup', icon: Map },
  { to: '/signal', label: 'Signal Analyzer', icon: Radio },
  { to: '/datasets', label: 'Datasets', icon: Database },
  { to: '/lab', label: 'Experiment Lab', icon: FlaskConical },
  { to: '/results', label: 'Results', icon: BarChart3 },
];

export default function App() {
  const [dark, setDark] = useState(false);

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="flex h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {/* Sidebar */}
        <aside
          className="w-64 flex flex-col shrink-0"
          style={{ background: 'var(--bg-sidebar)' }}
        >
          <div className="p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-sidebar)' }}>
              IPS Platform
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Indoor Positioning Lab
            </p>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setDark(!dark)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
              {dark ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-secondary)' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/map-builder" element={<MapBuilder />} />
            <Route path="/map-setup" element={<MapSetup />} />
            <Route path="/signal" element={<SignalAnalyzer />} />
            <Route path="/datasets" element={<DatasetManager />} />
            <Route path="/lab/*" element={<ExperimentLab />}>
              <Route index element={<Navigate to="trilateration" replace />} />
              <Route path="trilateration" element={<TrilaterationPanel />} />
              <Route path="fingerprint" element={<FingerprintPanel />} />
              <Route path="pdr" element={<PlaceholderPanel name="Pedestrian Dead Reckoning" />} />
              <Route path="ble" element={<PlaceholderPanel name="BLE Kalman Smoothing" />} />
              <Route path="ftm" element={<PlaceholderPanel name="FTM Multilateration" />} />
              <Route path="dfp" element={<PlaceholderPanel name="Device-Free Positioning" />} />
            </Route>
            <Route path="/results" element={<ResultsGallery />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
