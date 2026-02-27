import { BarChart3 } from 'lucide-react';

export default function ResultsGallery() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Results Gallery</h2>
      <div
        className="rounded-xl p-12 text-center"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        <BarChart3 size={48} className="mx-auto mb-3 opacity-20" />
        <p className="text-lg font-medium">No Results Yet</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Run experiments in the Lab to see CDF plots, error analysis, and trajectory playback here.
        </p>
      </div>
    </div>
  );
}
