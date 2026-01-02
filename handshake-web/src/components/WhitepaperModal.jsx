import React from 'react';
import { FaTimes, FaFileAlt } from 'react-icons/fa';
import { useLanguage } from '../App';

export default function WhitepaperModal({ isOpen, onClose }) {
  const { t } = useLanguage();

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
              <h2 className="text-xl font-bold text-white">On-Chain Secure Transfer Protocol {t.whitepaper}</h2>
              <p className="text-xs text-slate-400">A Secure, Trusted, and Reversible Next-Generation Blockchain Transfer Protocol</p>
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
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar text-slate-300 leading-relaxed space-y-8">
          
          <section>
            <h3 className="text-2xl font-bold text-white mb-4">1. {t.introduction}</h3>
            <p>{t.whitepaperIntro}</p>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">2. Problem Statement</h3>
            <p>
              While the decentralized nature of blockchain technology offers transparency, it also brings significant risks. Once a transfer transaction is initiated, the funds are instantly irreversible. Situations such as incorrect address entry, fraudulent transfer requests, and contract interaction errors result in the permanent loss of hundreds of millions of dollars in assets annually.
            </p>
            <p className="mt-2">
              The existing market lacks a native, trustless on-chain transaction protection mechanism.
            </p>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">3. {t.coreMechanism}</h3>
            <div className="pl-4 border-l-2 border-blue-500/30 space-y-4">
              <div>
                <p>{t.whitepaperMech}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">4. {t.technicalArchitecture}</h3>
            <p>{t.whitepaperArch}</p>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">5. {t.securityAudit}</h3>
            <p>{t.whitepaperAudit}</p>
          </section>

          <div className="text-center pt-8 border-t border-white/5 text-slate-500 text-sm">
            &copy; 2025 SecureTransfer Protocol. All Rights Reserved.
          </div>

        </div>
      </div>
    </div>
  );
}