import React from 'react';
import { FaLock, FaCheckDouble, FaUndoAlt, FaBell, FaCheckCircle, FaExchangeAlt } from 'react-icons/fa';
import { useLanguage } from '../App';

const IntroSection = () => {
  const { t } = useLanguage();

  return (
    <div className="mb-6 px-4 md:px-8 py-8 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 rounded-[2rem] border border-blue-500/10 backdrop-blur-sm">
      <div className="flex flex-col gap-8">
        {/* Title Section */}
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-3 flex items-center gap-3">
            <span className="w-1.5 h-8 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
            {t.introTitle}
          </h2>
          <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-4xl">
            {t.introDesc}
          </p>
        </div>
          
        {/* Steps Flow Chart */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          
          {/* Step 1: Lock */}
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-blue-500/20 relative group hover:border-blue-500/40 transition-all hover:transform hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/20">
             <div className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-white/10 text-slate-400 font-bold text-sm shadow-lg z-10">1</div>
             
             <div className="flex items-center gap-3 mb-4">
               <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform duration-300">
                 <FaLock size={24} />
               </div>
               <h3 className="text-lg font-bold text-white">{t.step1Title}</h3>
             </div>
             
             <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
               {t.step1Desc}
             </p>
          </div>

          {/* Arrow 1 (Desktop) */}
          <div className="hidden md:flex absolute left-1/3 top-1/2 -translate-y-1/2 -translate-x-1/2 text-slate-600 z-0">
             {/* <FaExchangeAlt size={20} className="opacity-30" /> */}
          </div>

          {/* Step 2: Verify */}
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-blue-500/20 relative group hover:border-blue-500/40 transition-all hover:transform hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/20">
             <div className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-white/10 text-slate-400 font-bold text-sm shadow-lg z-10">2</div>
             
             <div className="flex items-center gap-3 mb-4">
               <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                 <FaBell size={24} />
               </div>
               <h3 className="text-lg font-bold text-white">{t.step2Title}</h3>
             </div>
             
             <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
               {t.step2Desc}
             </p>
          </div>

          {/* Arrow 2 (Desktop) */}
          <div className="hidden md:flex absolute left-2/3 top-1/2 -translate-y-1/2 -translate-x-1/2 text-slate-600 z-0">
             {/* <FaExchangeAlt size={20} className="opacity-30" /> */}
          </div>

          {/* Step 3: Execute */}
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-blue-500/20 relative group hover:border-blue-500/40 transition-all hover:transform hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/20">
             <div className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-white/10 text-slate-400 font-bold text-sm shadow-lg z-10">3</div>
             
             <div className="flex items-center gap-3 mb-4">
               <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                 <FaCheckCircle size={24} />
               </div>
               <h3 className="text-lg font-bold text-white">{t.step3Title}</h3>
             </div>
             
             <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
               {t.step3Desc}
             </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default IntroSection;
