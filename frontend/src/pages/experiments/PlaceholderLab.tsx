import { FlaskConical } from 'lucide-react';

interface PlaceholderLabProps {
  name: string;
  description: string;
}

export default function PlaceholderLab({ name, description }: PlaceholderLabProps) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <FlaskConical size={56} className="mx-auto mb-4 opacity-20" />
        <h2 className="text-2xl font-bold mb-2">{name}</h2>
        <p className="mb-4 text-base" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
        <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
          Backend API is ready. UI coming soon.
        </p>
      </div>
    </div>
  );
}
