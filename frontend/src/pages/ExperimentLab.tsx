import { NavLink, Outlet } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';

const TABS: { key: string; label: string }[] = [
  { key: 'trilateration', label: 'Trilateration' },
  { key: 'fingerprint', label: 'Fingerprinting' },
  { key: 'pdr', label: 'PDR' },
  { key: 'ble', label: 'BLE' },
  { key: 'ftm', label: 'FTM' },
  { key: 'dfp', label: 'Device-Free' },
];

export default function ExperimentLab() {
  return (
    <div className="flex h-full">
      {/* Left Sidebar Navigation */}
      <div
        className="w-52 shrink-0 p-3 space-y-1 overflow-y-auto"
        style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
          Experiment Modules
        </p>
        {TABS.map(({ key, label }) => (
          <NavLink
            key={key}
            to={`/lab/${key}`}
            className={({ isActive }) =>
              `w-full block text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}

// Export placeholder component for backward compatibility
export function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <FlaskConical size={48} className="mx-auto mb-3 opacity-20" />
        <p className="text-lg font-medium">{name}</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Backend API is ready. UI coming soon.
        </p>
      </div>
    </div>
  );
}
