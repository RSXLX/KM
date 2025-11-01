'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';

const WalletButtonNoSSR = dynamic(() => import('@/components/wallet/WalletButton').then(m => m.WalletButton), { ssr: false });

export function MobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background z-50">
        <div className="flex items-center justify-between h-full px-4">
          {/* Menu Button */}
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
            <Menu className="w-6 h-6" />
          </Button>

          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <span className="font-bold text-xl text-foreground">K Market</span>
          </div>

          {/* Wallet Button */}
          <div className="scale-90">
            <WalletButtonNoSSR />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="w-64 h-full bg-background"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center p-4">
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="ml-2 text-sm text-muted-foreground">Close</span>
              </div>
              <Sidebar onClose={() => setIsOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}