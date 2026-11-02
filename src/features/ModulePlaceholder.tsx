import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

interface PlaceholderProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: string;
}

export const ModulePlaceholder: React.FC<PlaceholderProps> = ({
  title,
  description,
  icon: Icon,
  phase
}) => {
  return (
    <div className="max-w-3xl mx-auto py-12 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
        <Icon className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
          Módulo em Construção • {phase}
        </span>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {description}
        </p>
      </div>

      <div className="flex justify-center gap-4">
        <Link to="/">
          <Button variant="secondary">Voltar ao Painel</Button>
        </Link>
        <Link to="/settings">
          <Button variant="outline">Ver Persistência Local</Button>
        </Link>
      </div>
    </div>
  );
};
