import React from 'react';
import { FaLock, FaCheckDouble, FaUndoAlt } from 'react-icons/fa';
import { useLanguage } from '../App';

const IntroSection = () => {
  const { t } = useLanguage();

  return (
    <div className="mb-6 px-4 md:px-8 py-6 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 rounded-2xl border border-blue-500/10 backdrop-blur-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-lg md:text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
            {t.introTitle}
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            {t.introDesc}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 flex items-start gap-3">
               <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 shrink-0">
                 <FaLock size={16} />
               </div>
               <div>
                 <h4 className="text-xs font-bold text-slate-200 mb-0.5">{t.introFeature1Title}</h4>
                 <p className="text-[10px] text-slate-500 leading-tight">{t.introFeature1Desc}</p>
               </div>
            </div>

            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 flex items-start gap-3">
               <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
                 <FaCheckDouble size={16} />
               </div>
               <div>
                 <h4 className="text-xs font-bold text-slate-200 mb-0.5">{t.introFeature2Title}</h4>
                 <p className="text-[10px] text-slate-500 leading-tight">{t.introFeature2Desc}</p>
               </div>
            </div>

            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 flex items-start gap-3">
               <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400 shrink-0">
                 <FaUndoAlt size={16} />
               </div>
               <div>
                 <h4 className="text-xs font-bold text-slate-200 mb-0.5">{t.introFeature3Title}</h4>
                 <p className="text-[10px] text-slate-500 leading-tight">{t.introFeature3Desc}</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntroSection;
