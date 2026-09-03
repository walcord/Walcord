import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient'; 
import { useLanguage } from '../../context/LanguageContext';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MenuDrawer({ isOpen, onClose }: MenuDrawerProps) {
  const [user, setUser] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { t } = useLanguage();

  // EFECTO PARA BLOQUEAR EL SCROLL DEL FONDO EN MÓVILES
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const fetchUserProfile = async (sessionUser: any) => {
      if (!sessionUser) {
        setUser(null);
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', sessionUser.id)
        .single();

      setUser({
        ...sessionUser,
        full_name: profile?.full_name || sessionUser.user_metadata?.full_name || t('my_account')
      });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserProfile(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserProfile(session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [t]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsUserMenuOpen(false);
  };

  return (
    <>
      {/* Fondo oscuro z-50 para cubrir la barra de meses y todo el contenido */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-50 transition-opacity duration-700" 
          onClick={onClose}
        />
      )}

      {/* Menú lateral con z-[60] por encima del fondo oscuro */}
      <div 
        className={`fixed top-0 left-0 h-[100dvh] w-[85vw] md:w-[420px] bg-white z-[60] transform transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col border-r border-gray-50 overscroll-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-10 md:p-14 flex flex-col h-full overflow-y-auto">
          <div className="flex justify-start mb-14 shrink-0">
            <button onClick={onClose} className="text-4xl font-light text-gray-400 hover:text-black transition-colors">
              &times;
            </button>
          </div>

          <nav className="flex-grow flex flex-col space-y-7 text-[15px] tracking-[0.15em] uppercase font-light text-gray-900 shrink-0">
            <Link href="/feed" onClick={onClose} className="hover:opacity-50 transition-opacity">{t('latest')}</Link>
            <Link href="/campaigns" onClick={onClose} className="hover:opacity-50 transition-opacity">{t('campaigns')}</Link>
            <Link href="/lifestyle" onClick={onClose} className="hover:opacity-50 transition-opacity">{t('lifestyle')}</Link>
            <Link href="/events" onClick={onClose} className="hover:opacity-50 transition-opacity">{t('season')}</Link>
            <Link href="/about" onClick={onClose} className="hover:opacity-50 transition-opacity">{t('about')}</Link>
          </nav>

          <div className="mt-auto pt-8 border-t border-gray-100 flex flex-col space-y-6 shrink-0">
            
            <div className="flex flex-col space-y-3 text-[11px] tracking-[0.2em] uppercase font-medium">
              {user ? (
                <div className="flex flex-col space-y-4">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="text-left flex items-center justify-between text-black hover:opacity-50 transition-opacity"
                  >
                    <span>{user.full_name}</span>
                    <span className="text-gray-400 font-light text-lg leading-none">
                      {isUserMenuOpen ? '−' : '+'}
                    </span>
                  </button>
                  
                  {isUserMenuOpen && (
                    <div className="flex flex-col space-y-4 pl-3 border-l border-gray-200 mt-2">
                      <button onClick={handleLogout} className="text-left text-gray-500 hover:text-black transition-colors">
                        {t('log_out')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link 
                  href="/login" 
                  onClick={onClose}
                  className="text-left hover:opacity-50 transition-opacity text-black"
                >
                  {t('sign_in')}
                </Link>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[9px] tracking-wider uppercase text-gray-400 pb-6 md:pb-0">
              <Link href="/terms" className="hover:text-black transition-colors">{t('terms')}</Link>
              <Link href="/child-safety" className="hover:text-black transition-colors">{t('safety')}</Link>
              <Link href="/support" className="hover:text-black transition-colors">{t('support')}</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}