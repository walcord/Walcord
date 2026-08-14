import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'EN' | 'ES' | 'FR' | 'IT';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  EN: {
    latest: 'Latest',
    campaigns: 'Campaigns',
    lifestyle: 'Lifestyle',
    season: 'Season',
    loading_season: 'Loading Season...',
    no_events: 'No upcoming events scheduled.',
    terms: 'Terms',
    safety: 'Safety',
    support: 'Support',
    sign_in: 'Sign In',
    log_out: 'Log Out',
    my_account: 'My Account',
    watch_video: 'Watch Video',
    close: 'Close',
    season_programme: 'Season Programme',
    choreography: 'Choreography',
    music: 'Music',
    principal_cast: 'Principal Cast / Dancers',
    programme_cast: 'PROGRAMME & CAST',
    lookbook: 'Lookbook',
    loading: 'Loading...',
    not_found: 'Not Found',
    read_article: 'Read Article',
    explore_campaign: 'Explore',
    back: 'Back',
    coming_soon: 'Coming Soon',
    journal_description: 'The editorial journal of Classical Dance and Opera.'
  },
  ES: {
    latest: 'Principal', 
    campaigns: 'Campañas', 
    lifestyle: 'Lifestyle', 
    season: 'Temporada', 
    loading_season: 'Cargando Temporada...',
    no_events: 'No hay eventos programados.',
    terms: 'Términos',
    safety: 'Seguridad',
    support: 'Soporte',
    sign_in: 'Iniciar Sesión',
    log_out: 'Cerrar Sesión',
    my_account: 'Mi Cuenta',
    watch_video: 'Ver Vídeo',
    close: 'Cerrar',
    season_programme: 'Programa de Temporada',
    choreography: 'Coreografía',
    music: 'Música',
    principal_cast: 'Elenco Principal / Bailarines',
    programme_cast: 'PROGRAMA Y ELENCO',
    lookbook: 'Lookbook',
    loading: 'Cargando...',
    not_found: 'No Encontrado',
    read_article: 'Leer Artículo',
    explore_campaign: 'Explorar',
    back: 'Volver',
    coming_soon: 'Próximamente',
    journal_description: 'El diario editorial de Danza Clásica y Ópera.'
  },
  FR: {
    latest: 'Principal',
    campaigns: 'Campagnes',
    lifestyle: 'Lifestyle',
    season: 'Saison',
    loading_season: 'Chargement Saison...',
    no_events: 'Aucun événement à venir.',
    terms: 'Conditions',
    safety: 'Sécurité',
    support: 'Support',
    sign_in: 'Connexion',
    log_out: 'Déconnexion',
    my_account: 'Mon Compte',
    watch_video: 'Voir la Vidéo',
    close: 'Fermer',
    season_programme: 'Programme de la Saison',
    choreography: 'Chorégraphie',
    music: 'Musique',
    principal_cast: 'Distribution Principale',
    programme_cast: 'PROGRAMME ET DISTRIBUTION',
    lookbook: 'Lookbook',
    loading: 'Chargement...',
    not_found: 'Non Trouvé',
    read_article: 'Lire l\'Article',
    explore_campaign: 'Explorer',
    back: 'Retour',
    coming_soon: 'Bientôt',
    journal_description: 'Le journal éditorial de la Danse Classique et de l\'Opéra.'
  },
  IT: {
    latest: 'Principale',
    campaigns: 'Campagne',
    lifestyle: 'Lifestyle',
    season: 'Stagione',
    loading_season: 'Caricamento Stagione...',
    no_events: 'Nessun evento in programma.',
    terms: 'Termini',
    safety: 'Sicurezza',
    support: 'Supporto',
    sign_in: 'Accedi',
    log_out: 'Disconnetti',
    my_account: 'Il Mio Account',
    watch_video: 'Guarda il Video',
    close: 'Chiudi',
    season_programme: 'Programma della Stagione',
    choreography: 'Coreografia',
    music: 'Musica',
    principal_cast: 'Cast Principale / Ballerini',
    programme_cast: 'PROGRAMMA E CAST',
    lookbook: 'Lookbook',
    loading: 'Caricamento...',
    not_found: 'Non Trovato',
    read_article: 'Leggi l\'Articolo',
    explore_campaign: 'Esplora',
    back: 'Indietro',
    coming_soon: 'Prossimamente',
    journal_description: 'Il giornale editoriale di Danza Classica e Opera.'
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('EN');

  useEffect(() => {
    const savedLang = localStorage.getItem('walcord_lang') as Language;
    if (savedLang && ['EN', 'ES', 'FR', 'IT'].includes(savedLang)) {
      setLanguageState(savedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('walcord_lang', lang);
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations['EN']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return { language: 'EN' as Language, setLanguage: () => {}, t: (k: string) => k };
  }
  return context;
}