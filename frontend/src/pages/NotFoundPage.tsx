import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface NotFoundPageProps {
  onNavigate: (page: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-md mx-auto py-24 px-4 text-center">
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        <ShieldAlert className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">404</h1>
        <h2 className="text-base font-bold text-slate-200 mb-2">Vault Resource Not Found</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          The requested path does not exist or has been securely decommissioned.
        </p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
};
