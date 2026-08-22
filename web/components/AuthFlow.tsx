'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { motion } from 'framer-motion';

const AuthFlowContext = createContext<{ leave: () => Promise<void> } | null>(null);

export function useAuthFlow() {
  const ctx = useContext(AuthFlowContext);
  if (!ctx) throw new Error('useAuthFlow');
  return ctx;
}

export default function AuthFlow({ children }: { children: React.ReactNode }) {
  const [leaving, setLeaving] = useState(false);

  const leave = useCallback(() => {
    setLeaving(true);
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, 520);
    });
  }, []);

  return (
    <AuthFlowContext.Provider value={{ leave }}>
      <motion.div
        className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]"
        initial={{ opacity: 0 }}
        animate={
          leaving
            ? { opacity: 0, y: -18, scale: 0.985, filter: 'blur(6px)' }
            : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
        }
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AuthFlowContext.Provider>
  );
}
