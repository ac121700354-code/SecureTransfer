import React from 'react';
import { FaTimes, FaFileAlt } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import { WhitepaperContentZh, WhitepaperContentEn } from './WhitepaperContent';

export default function WhitepaperModal({ isOpen, onClose }) {
  const { lang } = useLanguage(); // Only need lang, not t

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div 
        className="bg-slate-900 border border-white/10 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <FaFileAlt size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Handshk Protocol
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {lang === 'zh' ? <WhitepaperContentZh /> : <WhitepaperContentEn />}
          
          <div className="text-center pt-8 mt-8 border-t border-white/5 text-slate-500 text-sm">
            &copy; 2025 Handshk Protocol. All Rights Reserved.
          </div>
        </div>
      </div>
    </div>
  );
}