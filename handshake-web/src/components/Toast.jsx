import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = (msg) => addToast(msg, 'success');
  const error = (msg) => addToast(msg, 'error');
  const info = (msg) => addToast(msg, 'info');

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, info }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300); // Wait for exit animation
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const icons = {
    success: <FaCheckCircle className="text-emerald-400 text-lg" />,
    error: <FaExclamationCircle className="text-rose-400 text-lg" />,
    info: <FaInfoCircle className="text-blue-400 text-lg" />
  };

  const bgs = {
    success: 'bg-slate-800 border-emerald-500/20 shadow-emerald-500/10',
    error: 'bg-slate-800 border-rose-500/20 shadow-rose-500/10',
    info: 'bg-slate-800 border-blue-500/20 shadow-blue-500/10'
  };

  return (
    <div 
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md min-w-[300px] max-w-md
        transition-all duration-300 transform
        ${bgs[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0 animate-in slide-in-from-right-full'}
      `}
    >
      <div className="shrink-0">{icons[toast.type]}</div>
      <p className="text-sm font-medium text-slate-200 flex-1">{toast.message}</p>
      <button 
        onClick={() => { setIsExiting(true); setTimeout(() => onDismiss(toast.id), 300); }}
        className="text-slate-500 hover:text-white transition-colors p-1"
      >
        <FaTimes size={12} />
      </button>
    </div>
  );
};