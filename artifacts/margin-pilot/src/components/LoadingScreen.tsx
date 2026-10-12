import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArthivaLogo } from './ArthivaLogo';

export function LoadingScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('arthiva-loaded') && !sessionStorage.getItem('naomi-loaded')) {
      setShow(true);
      sessionStorage.setItem('arthiva-loaded', 'true');
      const timer = setTimeout(() => setShow(false), 900);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          className="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setShow(false)}
        >
          <div className="loading-logo">
            <motion.div className="loading-bars">
              {[0, 1, 2, 3].map((i) => (
                <motion.div 
                  key={i} 
                  className="loading-bar"
                  style={{ originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.1, duration: 0.4, type: 'spring' }}
                />
              ))}
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex flex-col items-center gap-1.5"
            >
              <ArthivaLogo size="lg" theme="light" />
              <span className="text-[11px] font-bold tracking-widest text-[#6f847f] uppercase">
                PROFIT & DELIVERY INTELLIGENCE
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
