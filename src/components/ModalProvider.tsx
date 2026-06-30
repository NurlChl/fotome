'use client';

import React, { createContext, useContext, useState } from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';

interface ConfirmContextType {
  confirm: (title: string, message: string) => Promise<boolean>;
  alert: (title: string, message: string, type?: 'success' | 'error' | 'warning') => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert';
    alertType?: 'success' | 'error' | 'warning';
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    resolve: null
  });

  const confirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title,
        message,
        type: 'confirm',
        resolve
      });
    });
  };

  const alert = (title: string, message: string, alertType: 'success' | 'error' | 'warning' = 'warning'): Promise<void> => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title,
        message,
        type: 'alert',
        alertType,
        resolve: () => resolve()
      });
    });
  };

  const handleClose = (value: boolean) => {
    if (modalState.resolve) {
      modalState.resolve(value);
    }
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-850 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => handleClose(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              {modalState.type === 'confirm' || modalState.alertType === 'warning' ? (
                <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              ) : modalState.alertType === 'success' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0" />
              )}
              <h3 className="text-base font-bold text-neutral-50">{modalState.title}</h3>
            </div>

            <p className="text-neutral-300 text-sm mb-6 leading-relaxed whitespace-pre-line font-light">
              {modalState.message}
            </p>

            <div className="flex gap-3 justify-end">
              {modalState.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => handleClose(false)}
                    className="btn btn-secondary px-4 py-2 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleClose(true)}
                    className="btn btn-primary px-4 py-2 text-xs font-semibold rounded-xl shadow-md shadow-primary-500/25"
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleClose(true)}
                  className="btn btn-primary px-5 py-2 text-xs font-semibold rounded-xl shadow-md shadow-primary-500/25"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ModalProvider');
  }
  return context;
}
