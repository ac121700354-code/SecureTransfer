import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FaSearch, FaTimes, FaCheckCircle } from 'react-icons/fa';

const TokenSelectorModal = ({ isOpen, onClose, onSelect, tokens, balances, prices, selectedToken }) => {
  const [searchQuery, setSearchQuery] = useState("");

  // 过滤代币：支持 Symbol、Name 和 Address 搜索
  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens;
    const lowerQuery = searchQuery.toLowerCase();
    return tokens.filter(t => 
      t.symbol.toLowerCase().includes(lowerQuery) || 
      t.name.toLowerCase().includes(lowerQuery) ||
      (t.address && t.address.toLowerCase().includes(lowerQuery))
    );
  }, [tokens, searchQuery]);

  if (!isOpen) return null;

  return createPortal(
    <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
    >
      <div 
        className="bg-[#1e2330] border border-white/10 w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5 bg-[#1e2330]">
          <h3 className="text-xl font-bold text-white">选择代币</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 bg-[#1e2330]">
          <div className="relative group">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="搜索名称或粘贴地址" 
              className="w-full bg-[#0f121a] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-[#1e2330]">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                <FaSearch size={32} className="mb-4 opacity-20" />
                <p>未找到代币</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTokens.map(t => {
                const balance = balances[t.symbol] ? parseFloat(balances[t.symbol]) : 0;
                const price = prices[t.symbol] || 0;
                const usdValue = balance * price;
                const isSelected = selectedToken?.symbol === t.symbol;

                return (
                  <button 
                    key={t.symbol}
                    onClick={() => { onSelect(t); onClose(); }}
                    className={`w-full p-3 flex items-center gap-3 rounded-xl transition-all group ${
                      isSelected 
                        ? 'bg-blue-600/10 border border-blue-500/20' 
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {/* Token Icon */}
                    <img src={t.logo} alt={t.symbol} className="w-9 h-9 rounded-full shadow-sm" />
                    
                    {/* Token Info */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                          <span className={`text-base font-bold ${isSelected ? 'text-blue-400' : 'text-white'}`}>
                              {t.symbol}
                          </span>
                          {isSelected && <FaCheckCircle className="text-blue-500 text-xs" />}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">{t.name}</div>
                    </div>

                    {/* Balance & Value */}
                    <div className="text-right">
                       <div className={`text-sm font-mono ${balance > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                           {balance > 0 ? balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 }) : "0"}
                       </div>
                       {usdValue > 0 && (
                           <div className="text-xs text-slate-500">
                               ${usdValue.toFixed(2)}
                           </div>
                       )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TokenSelectorModal;
