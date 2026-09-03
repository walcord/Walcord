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
    lifestyle: 'Videos',
    season: 'Season',
    about: 'About',
    adrian_role: 'Co-Director, Founder & Creative Director',
    antoine_role: 'Co-Director & Editor',
    about_manifesto: 'Welcome to Walcord — an independent editorial space dedicated to ballet and the artists who bring it to life. We felt a void in the media landscape; the absence of an editorial space specifically designed for classical artists. So we created this platform. Our goal is to celebrate the beauty of classical dance and the dedication of the artists who make it exist. We want to highlight those who dedicate their lives to this extraordinary art. This is our love letter to dance. A space for dancers, teachers, creators, and the audience.',
    adrian_bio: 'Emerging filmmaker from Lanzarote, now based in Paris. Raised in a family linked to classical dance, he places the physicality, precision, and rhythm of this discipline at the core of the aesthetic and narrative of his filmmaking. The idea for creating Walcord originated with him, where he serves as co-director and creative director. Alongside Walcord, he is currently presenting his debut work Op. 1 Yemaya at international film festivals and preparing his first film, silent and entirely danced, Op. 2 Traviato.',
    antoine_bio: 'Dancer and choreographer originally from Paris, he completed his training at the Basel Ballet Academy before joining the Thuringia State Ballet in Germany. He went on to dance in several productions in France and is now based in Paris. Co-director and editor of Walcord, he is also preparing several independent choreographic projects for this season.',
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
    lifestyle: 'Vídeos', 
    season: 'Temporada', 
    about: 'Nosotros',
    adrian_role: 'Codirector, Fundador y Director Creativo',
    antoine_role: 'Codirector y Editor',
    about_manifesto: 'Bienvenido a Walcord — un espacio editorial independiente dedicado al ballet y a los artistas que le dan vida. Tras sentir un vacío en el panorama mediático; la ausencia de un espacio editorial pensado específicamente para los artistas clásicos. Decidimos crear esta plataforma. Nuestro objetivo es el de celebrar la belleza de la danza clásica y la dedicación de los artistas que la hacen posible. Queremos destacar a aquellos que dedican sus vidas a este arte extraordinario. Esta es en otras palabras, nuestra carta de amor a la danza. Un espacio para bailarines, profesores, creadores y el público.',
    adrian_bio: 'Cineasta emergente originario de Lanzarote, reside actualmente en París. Crecido en el seno de una familia vinculada a la danza clásica, sitúa la fisicidad, la precisión y el ritmo de esta disciplina en el centro de la estética y la narrativa de su trabajo como cineasta. Fue él quien concibió la idea de la creación de Walcord, de la que es codirector y director artístico. En paralelo a Walcord, presenta actualmente su primera realización Op. 1 Yemaya en festivales internacionales de cine y prepara su primer largometraje, mudo e íntegramente danzado, Op. 2 Traviato.',
    antoine_bio: 'Bailarín y coreógrafo originario de París, realizó su formación en la Academia de Ballet de Basilea antes de unirse al Ballet Nacional de Turingia, en Alemania. Posteriormente bailó en varias producciones en Francia y actualmente reside en París. Codirector y editor de Walcord, prepara además varios proyectos coreográficos independientes para esta temporada.',
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
    lifestyle: 'Vidéos',
    season: 'Saison',
    about: 'À Propos',
    adrian_role: 'Co-directeur, Fondateur et Directeur Créatif',
    antoine_role: 'Co-directeur et Éditeur',
    about_manifesto: 'Bienvenue sur Walcord — un espace éditorial indépendant dédié au ballet et aux artistes qui lui donnent vie. Nous ressentions un vide dans le paysage médiatique ; l\'absence d\'un espace éditorial pensé spécifiquement pour les artistes classiques. Nous avons donc créé cette plateforme. Notre but est de célébrer la beauté de la danse classique et le dévouement des artistes qui la font exister. Nous voulons mettre en lumière celles et ceux qui consacrent leur vie à cet art extraordinaire. Voici notre lettre d\'amour à la danse. Un espace pour les danseurs, les professeurs, les créateurs et le public.',
    adrian_bio: 'Cinéaste émergent originaire de Lanzarote, maintenant installé à Paris. Élevé au sein d\'une famille liée à la danse classique, il place la physicalité, la précision et le rythme de cette discipline au cœur de l\'esthétique et de la narration de son travail de cinéaste. C’est à lui que revient l’idée de la création de Walcord, dont il est co-directeur et directeur artistique. En parallèle de Walcord, il présente actuellement sa première réalisation Op. 1 Yemaya dans les festivals internationaux du cinéma et prépare actuellement son premier long métrage, muet et entièrement dansé, Op. 2 Traviato.',
    antoine_bio: 'Danseur et chorégraphe originaire de Paris, il a effectué sa formation à l\'Académie de ballet de Bâle avant d\'intégrer le Ballet national de Thuringe, en Allemagne. Il a ensuite dansé dans plusieurs productions en France et est maintenant basé à Paris. Co-directeur et éditeur de Walcord, il prépare par ailleurs plusieurs projets chorégraphiques indépendants pour cette saison.',
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
    lifestyle: 'Video',
    season: 'Stagione',
    about: 'Chi Siamo',
    adrian_role: 'Codirettore, Fondatore e Direttore Creativo',
    antoine_role: 'Codirettore ed Editore',
    about_manifesto: 'Benvenuti su Walcord — uno spazio editoriale indipendente dedicato al balletto e agli artisti che gli danno vita. Sentivamo un vuoto nel panorama mediatico; l\'assenza di uno spazio editoriale pensato specificamente per gli artisti classici. Così abbiamo creato questa piattaforma. Il nostro obiettivo è celebrare la bellezza della danza classica e la dedizione degli artisti che la fanno esistere. Vogliamo mettere in luce coloro che dedicano la loro vita a quest\'arte straordinaria. Questa è la nostra lettera d\'amore alla danza. Uno spazio per ballerini, insegnanti, creatori e pubblico.',
    adrian_bio: 'Regista emergente originario di Lanzarote, attualmente stabilito a Parigi. Cresciuto in una famiglia legata alla danza classica, pone la fisicità, la precisione e il ritmo di questa disciplina al centro dell\'estetica e della narrazione del suo lavoro cinematografico. A lui si deve l\'idea della creazione di Walcord, di cui è codirettore e direttore artistico. In parallelo a Walcord, presenta attualmente la sua prima opera Op. 1 Yemaya nei festival internazionali del cinema e sta preparando il suo primo lungometraggio, muto e interamente danzato, Op. 2 Traviato.',
    antoine_bio: 'Danzatore e coreografo originario di Parigi, ha completato la sua formazione presso l\'Accademia di Balletto di Basilea prima di entrare nel Balletto Nazionale della Turingia, in Germania. In seguito ha danzato in diverse produzioni in Francia e attualmente vive a Parigi. Codirettore ed editore di Walcord, sta preparando diversi progetti coreografici indipendenti per questa stagione.',
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