/**
 * Lightweight, dependency-free translations — a plain object per language,
 * matched by a shared `Dict` shape so TypeScript catches missing keys.
 * No i18n library (no ICU/pluralization engine, no locale-detection native
 * module) — this keeps the app's bundle size and startup cost unchanged.
 *
 * Scope: this covers the screens most people see before they've settled
 * in — login, register, cleaner onboarding, both tab bars, and both
 * profile screens (where the language switcher lives). Everything else
 * in the app still reads in English; extend a screen by adding its keys
 * here and swapping its hardcoded strings for `t.xxx` lookups.
 */

export interface Dict {
  common: {
    retry: string;
    save: string;
    saving: string;
    cancel: string;
    language: string;
    logOut: string;
    error: string;
    profile: string;
    back: string;
  };
  /** Sun..Sat, matching the backend's dayOfWeek convention (0 = Sunday). */
  days: [string, string, string, string, string, string, string];
  login: {
    title: string;
    subtitle: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    logIn: string;
    loggingIn: string;
    noAccount: string;
    signUp: string;
    genericError: string;
  };
  register: {
    title: string;
    subtitleHost: string;
    subtitleCleaner: string;
    imHost: string;
    imCleaner: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    phonePlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    createAccount: string;
    creatingAccount: string;
    haveAccount: string;
    logIn: string;
    termsPrefix: string;
    termsLink: string;
    termsSuffix: string;
    termsRequired: string;
    genericError: string;
  };
  onboarding: {
    title: string;
    subtitle: string;
    aboutYou: string;
    aboutYouPlaceholder: string;
    yearsExperience: string;
    citiesYouCover: string;
    weeklyAvailability: string;
    documents: string;
    photoSelected: string;
    profilePicture: string;
    idCard: string;
    saveProfile: string;
    savingProfile: string;
    genericError: string;
  };
  tabsCleaner: { jobFeed: string; myJobs: string; earnings: string; profile: string };
  tabsHost: { home: string; calendar: string; properties: string; expenses: string; more: string };
  profileCleaner: {
    jobsCompleted: string;
    verified: string;
    verificationPending: string;
    citiesCovered: string;
    noneSetYet: string;
    availability: string;
    currentLocation: string;
    locationNotSet: string;
    updateLocation: string;
    updatingLocation: string;
    editProfile: string;
    logOut: string;
    locationPermissionTitle: string;
    locationPermissionMessage: string;
    locationErrorTitle: string;
    locationErrorMessage: string;
  };
  profileHost: {
    manage: string;
    cleaningContacts: string;
    turnoverAlerts: string;
    notOnMobileYet: string;
    saveChanges: string;
    savingChanges: string;
    saved: string;
    loadError: string;
    saveError: string;
    language: string;
    ownerRole: string;
    managerRole: string;
    staffRole: string;
  };
  checkinNew: {
    headerTitle: string;
    subtitle: string;
    readyTitle: string;
    readySubtitle: string;
    guestLink: string;
    shareWhatsApp: string;
    shareOther: string;
    done: string;
    property: string;
    checkInDate: string;
    checkOutDate: string;
    guestName: string;
    guestNamePlaceholder: string;
    guestCount: string;
    nightlyRate: string;
    nightlyRatePlaceholder: string;
    formLanguage: string;
    createLink: string;
    creating: string;
    errorChooseProperty: string;
    errorCheckInFormat: string;
    errorCheckOutFormat: string;
    errorInvalidRate: string;
    errorCreate: string;
    shareMessage: (propertyName: string | null, url: string) => string;
  };
  expenses: {
    title: string;
    rangeMonth: string;
    rangeLastMonth: string;
    rangeAll: string;
    totalExpenses: string;
    deltaVsLastMonth: (pct: number) => string;
    filterAll: string;
    emptyNoneYet: string;
    emptyNoneInCategory: string;
    logExpenseAction: string;
    sharedBusinessFallback: string;
    autoAdded: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    delete: string;
    deleteError: string;
    loadError: string;
    allProperties: string;
    general: string;
    addExpense: string;
    /** Header + empty text for the "by property" breakdown block on the Expenses tab. */
    byPropertyTitle: string;
    byPropertyEmpty: string;
    /** Translated equivalents of status.ts's EXPENSE_CATEGORY_LABELS / EXPENSE_CATEGORY_GROUP_LABELS — safe to
     * fully translate since both are used only by the Expenses and Add Expense screens. */
    categoryLabels: {
      ELECTRICITY: string;
      WATER: string;
      CLEANING_PRODUCTS: string;
      CLEANING_SERVICE: string;
      MAINTENANCE: string;
      OTHER: string;
    };
    categoryGroupLabels: {
      CLEANING: string;
      MAINTENANCE: string;
      UTILITIES: string;
      OTHER: string;
    };
  };
  expenseNew: {
    headerTitle: string;
    scopeSingle: string;
    scopeMultiple: string;
    scopeBusiness: string;
    splitEqual: string;
    splitCustom: string;
    businessNote: string;
    propertyLabel: string;
    amountLabel: string;
    amountPlaceholder: string;
    categoryLabel: string;
    dateLabel: string;
    dateFormatLabel: string;
    dateToday: string;
    dateYesterday: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    splitAllocated: (sum: number, total: number) => string;
    splitMatches: string;
    errorInvalidAmount: string;
    errorDateFormat: string;
    errorSelectProperty: string;
    errorSplitMismatch: string;
    errorCreate: string;
    save: string;
    saving: string;
  };
  jobFeed: {
    title: string;
    subtitle: string;
    accountOnHold: string;
    overdueMessage: (amount: string) => string;
    emptyMessage: string;
    urgent: string;
    budgetSuffix: string;
    yourPrice: string;
    offerPlaceholder: string;
    sendOffer: string;
    sending: string;
    accept: string;
    accepting: string;
    offerDifferentPrice: string;
    acceptError: string;
  };
  earnings: {
    title: string;
    thisMonth: string;
    allTime: string;
    commissionOwed: string;
    commissionNoteBase: string;
    commissionOverdue: (amount: string) => string;
    commissionPaySoon: string;
    commissionContact: string;
    history: string;
    emptyNoJobs: string;
  };
  jobDetail: {
    navigate: string;
    hostLabel: string;
    call: string;
    whatsapp: string;
    noPhoneOnFile: string;
    checkInButton: string;
    startCleaning: string;
    markComplete: string;
    checklist: string;
    beforePhotos: string;
    afterPhotos: string;
    takePhoto: string;
    photoDisclaimer: string;
    locationNeededTitle: string;
    locationNeededMessage: string;
    genericError: string;
    checkedInSuccess: string;
    startedSuccess: string;
    completedSuccess: string;
    /** Shown on the job feed card and the job detail header when the host marked this one urgency: URGENT — see Booking.urgency. */
    urgentBadge: string;
  };
  myJobs: {
    title: string;
    emptyMessage: string;
  };
  /**
   * A translated equivalent of `STATUS_LABELS` (src/lib/status.ts), used
   * only by the cleaner-side screens (job list, job detail) — the host-side
   * screens (bookings, calendar, dashboard) still use the static English
   * `STATUS_LABELS` export and are not in scope here.
   */
  bookingStatus: {
    PENDING_MATCH: string;
    MATCHED: string;
    CONFIRMED: string;
    CLEANER_EN_ROUTE: string;
    CHECKED_IN: string;
    IN_PROGRESS: string;
    AWAITING_APPROVAL: string;
    COMPLETED: string;
    DISPUTED: string;
    CANCELLED: string;
  };
}

export const en: Dict = {
  common: {
    retry: 'Retry',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    language: 'Language',
    logOut: 'Log out',
    error: 'Error',
    profile: 'Profile',
    back: 'Back',
  },
  days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  login: {
    title: 'Welcome back',
    subtitle: 'Log in to manage your properties or your jobs.',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    passwordPlaceholder: '••••••••',
    logIn: 'Log in',
    loggingIn: 'Logging in…',
    noAccount: "Don't have an account? ",
    signUp: 'Sign up',
    genericError: 'Unable to log in. Please try again.',
  },
  register: {
    title: 'Create your account',
    subtitleHost: 'Book trusted cleaning crews for your Airbnb & Booking.com properties.',
    subtitleCleaner: 'Get matched with cleaning jobs near you.',
    imHost: "I'm a host",
    imCleaner: "I'm a cleaner",
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone',
    phonePlaceholder: '+212 6XX XXX XXX',
    password: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    createAccount: 'Create account',
    creatingAccount: 'Creating account…',
    haveAccount: 'Already have an account? ',
    logIn: 'Log in',
    termsPrefix: 'I have read and agree to the ',
    termsLink: 'Terms and Conditions',
    termsSuffix: ' and Privacy Policy.',
    termsRequired: 'You must accept the Terms and Conditions to create an account.',
    genericError: 'Unable to create your account.',
  },
  onboarding: {
    title: 'Complete your profile',
    subtitle: 'This helps hosts trust you and matches you with nearby jobs.',
    aboutYou: 'About you',
    aboutYouPlaceholder: 'A few words about your experience…',
    yearsExperience: 'Years of experience',
    citiesYouCover: 'Cities you cover',
    weeklyAvailability: 'Weekly availability',
    documents: 'Documents',
    photoSelected: 'Photo selected ✓',
    profilePicture: 'Profile picture',
    idCard: 'ID card',
    saveProfile: 'Save profile',
    savingProfile: 'Saving…',
    genericError: 'Could not save your profile',
  },
  tabsCleaner: { jobFeed: 'Job Feed', myJobs: 'My Jobs', earnings: 'Earnings', profile: 'Profile' },
  tabsHost: { home: 'Home', calendar: 'Calendar', properties: 'Properties', expenses: 'Expenses', more: 'More' },
  profileCleaner: {
    jobsCompleted: 'jobs completed',
    verified: 'Verified',
    verificationPending: 'Verification pending',
    citiesCovered: 'Cities covered',
    noneSetYet: 'None set yet.',
    availability: 'Availability',
    currentLocation: 'Current location',
    locationNotSet: 'Not set — job matching needs this.',
    updateLocation: 'Update to my current location',
    updatingLocation: 'Updating…',
    editProfile: 'Edit profile',
    logOut: 'Log out',
    locationPermissionTitle: 'Location permission needed',
    locationPermissionMessage: 'Enable location access in settings to update your position.',
    locationErrorTitle: 'Error',
    locationErrorMessage: 'Could not get your location.',
  },
  profileHost: {
    manage: 'Manage',
    cleaningContacts: 'Cleaning contacts',
    turnoverAlerts: 'Turnover alerts',
    notOnMobileYet:
      "Team members, billing/subscription, iCal sync, and reports aren't in the mobile app yet — manage those from the ReadyDar web dashboard.",
    saveChanges: 'Save changes',
    savingChanges: 'Saving…',
    saved: 'Saved.',
    loadError: 'Could not load your profile.',
    saveError: 'Could not save your profile.',
    language: 'Language',
    ownerRole: 'Owner',
    managerRole: 'Manager',
    staffRole: 'Staff',
  },
  checkinNew: {
    headerTitle: 'Guest online check-in',
    subtitle:
      "Generate a link so your guest can submit their arrival details and ID before you meet them — and get access-info sent to them automatically once they do.",
    readyTitle: 'Check-in link ready',
    readySubtitle: "Send this to your guest — they'll fill in their details and ID before arrival.",
    guestLink: 'Guest link',
    shareWhatsApp: 'Share via WhatsApp',
    shareOther: 'Share another way',
    done: 'Done',
    property: 'Property',
    checkInDate: 'Check-in (YYYY-MM-DD)',
    checkOutDate: 'Check-out (YYYY-MM-DD)',
    guestName: 'Guest name (optional)',
    guestNamePlaceholder: 'e.g. Ahmed B.',
    guestCount: 'Number of guests',
    nightlyRate: 'Nightly rate (MAD)',
    nightlyRatePlaceholder: 'e.g. 450',
    formLanguage: 'Check-in form language',
    createLink: 'Create check-in link',
    creating: 'Creating…',
    errorChooseProperty: 'Choose a property.',
    errorCheckInFormat: 'Check-in date must be in YYYY-MM-DD format.',
    errorCheckOutFormat: 'Check-out date must be in YYYY-MM-DD format.',
    errorInvalidRate: 'Enter a valid nightly rate.',
    errorCreate: 'Could not create the check-in link.',
    shareMessage: (propertyName, url) =>
      `Hi! Please complete your online check-in${propertyName ? ` for ${propertyName}` : ''} here: ${url}`,
  },
  expenses: {
    title: 'Expenses',
    rangeMonth: 'This month',
    rangeLastMonth: 'Last month',
    rangeAll: 'All time',
    totalExpenses: 'Total expenses',
    deltaVsLastMonth: (pct) => `${pct}% vs last month`,
    filterAll: 'All',
    emptyNoneYet: 'No expenses logged for this view yet.',
    emptyNoneInCategory: 'No expenses in this category for this view.',
    logExpenseAction: 'Log an expense',
    sharedBusinessFallback: 'Shared / Business',
    autoAdded: 'Auto-added from a completed cleaning',
    deleteConfirmTitle: 'Delete expense?',
    deleteConfirmMessage: "This can't be undone.",
    delete: 'Delete',
    deleteError: 'Could not delete this expense.',
    loadError: 'Could not load your expenses.',
    allProperties: 'All properties',
    general: 'General',
    addExpense: 'Add Expense',
    byPropertyTitle: 'By property',
    byPropertyEmpty: 'Nothing to break down for this view yet.',
    categoryLabels: {
      ELECTRICITY: 'Electricity',
      WATER: 'Water',
      CLEANING_PRODUCTS: 'Cleaning products',
      CLEANING_SERVICE: 'Cleaning service',
      MAINTENANCE: 'Maintenance',
      OTHER: 'Other',
    },
    categoryGroupLabels: {
      CLEANING: 'Cleaning',
      MAINTENANCE: 'Maintenance',
      UTILITIES: 'Utilities',
      OTHER: 'Other',
    },
  },
  expenseNew: {
    headerTitle: 'Add Expense',
    scopeSingle: 'This property',
    scopeMultiple: 'Multiple',
    scopeBusiness: 'Business',
    splitEqual: 'Split equally',
    splitCustom: 'Custom split',
    businessNote:
      'Logged as a shared business expense — not tied to any one property. Use this for software, marketing, insurance, or equipment.',
    propertyLabel: 'Property',
    amountLabel: 'Amount in MAD',
    amountPlaceholder: 'e.g. 150',
    categoryLabel: 'Category',
    dateLabel: 'Date',
    dateFormatLabel: 'Date (YYYY-MM-DD)',
    dateToday: 'Today',
    dateYesterday: 'Yesterday',
    descriptionLabel: 'Description (optional)',
    descriptionPlaceholder: 'What was it for?',
    splitAllocated: (sum, total) => `${sum} / ${total} MAD allocated`,
    splitMatches: ' — matches the total',
    errorInvalidAmount: 'Enter a valid amount.',
    errorDateFormat: 'Date must be in YYYY-MM-DD format.',
    errorSelectProperty: 'Select at least one property.',
    errorSplitMismatch: 'The split amounts must add up to the total.',
    errorCreate: 'Could not log this expense.',
    save: 'Save Expense',
    saving: 'Saving…',
  },
  jobFeed: {
    title: 'Job feed',
    subtitle: 'Nearby jobs, closest first.',
    accountOnHold: 'Account on hold',
    overdueMessage: (amount) =>
      `You have ${amount} MAD in overdue platform commission from cash-on-delivery jobs. Settle it with the ReadyDar team to accept new jobs again.`,
    emptyMessage: "No jobs available right now. Make sure you've set your covered cities in your profile.",
    urgent: 'Urgent',
    budgetSuffix: 'MAD budget',
    yourPrice: 'Your price (MAD)',
    offerPlaceholder: 'e.g. 250',
    sendOffer: 'Send offer',
    sending: 'Sending…',
    accept: 'Accept',
    accepting: 'Accepting…',
    offerDifferentPrice: 'Offer a different price',
    acceptError: 'Could not accept — it may already be taken.',
  },
  earnings: {
    title: 'Earnings',
    thisMonth: 'This month',
    allTime: 'All time',
    commissionOwed: 'Platform commission owed',
    commissionNoteBase: '10% platform fee on your cash-on-delivery jobs — not yet settled.',
    commissionOverdue: (amount) =>
      ` ${amount} MAD of this is overdue, and your account can't accept new jobs until it's paid.`,
    commissionPaySoon: ' Pay soon to avoid your account being put on hold.',
    commissionContact: ' Contact the ReadyDar team to settle up.',
    history: 'History',
    emptyNoJobs: 'No completed jobs yet.',
  },
  jobDetail: {
    navigate: 'Navigate',
    hostLabel: 'Property host',
    call: 'Call',
    whatsapp: 'WhatsApp',
    noPhoneOnFile: 'No phone number on file for this host.',
    checkInButton: 'Check in (uses your location)',
    startCleaning: 'Start cleaning',
    markComplete: 'Mark job complete',
    checklist: 'Checklist',
    beforePhotos: 'Before photos',
    afterPhotos: 'After photos',
    takePhoto: 'Take photo',
    photoDisclaimer:
      "Also keep your own before/after photos on your phone for your records — the ones you upload here are what the host sees, but your own copies protect you if there's ever a dispute.",
    locationNeededTitle: 'Location needed',
    locationNeededMessage: 'Enable location access to check in.',
    genericError: 'Something went wrong',
    checkedInSuccess: 'Checked in',
    startedSuccess: 'Cleaning started',
    completedSuccess: 'Job marked complete',
    urgentBadge: 'Urgent',
  },
  myJobs: {
    title: 'My jobs',
    emptyMessage: 'No jobs yet. Check the Job Feed tab for nearby work.',
  },
  bookingStatus: {
    PENDING_MATCH: 'Finding a cleaner',
    MATCHED: 'Matched — confirm cleaner',
    CONFIRMED: 'Confirmed',
    CLEANER_EN_ROUTE: 'En route',
    CHECKED_IN: 'Checked in',
    IN_PROGRESS: 'In progress',
    AWAITING_APPROVAL: 'Awaiting your approval',
    COMPLETED: 'Completed',
    DISPUTED: 'Disputed',
    CANCELLED: 'Cancelled',
  },
};

export const fr: Dict = {
  common: {
    retry: 'Réessayer',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    cancel: 'Annuler',
    language: 'Langue',
    logOut: 'Se déconnecter',
    error: 'Erreur',
    profile: 'Profil',
    back: 'Retour',
  },
  days: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  login: {
    title: 'Content de vous revoir',
    subtitle: 'Connectez-vous pour gérer vos propriétés ou vos missions.',
    email: 'E-mail',
    emailPlaceholder: 'vous@exemple.com',
    password: 'Mot de passe',
    passwordPlaceholder: '••••••••',
    logIn: 'Se connecter',
    loggingIn: 'Connexion…',
    noAccount: 'Pas encore de compte ? ',
    signUp: 'Créer un compte',
    genericError: 'Connexion impossible. Veuillez réessayer.',
  },
  register: {
    title: 'Créez votre compte',
    subtitleHost: 'Réservez des équipes de ménage de confiance pour vos logements Airbnb et Booking.com.',
    subtitleCleaner: 'Recevez des missions de ménage près de chez vous.',
    imHost: 'Je suis hôte',
    imCleaner: 'Je suis agent de ménage',
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'E-mail',
    phone: 'Téléphone',
    phonePlaceholder: '+212 6XX XXX XXX',
    password: 'Mot de passe',
    passwordPlaceholder: 'Au moins 8 caractères',
    createAccount: 'Créer le compte',
    creatingAccount: 'Création du compte…',
    haveAccount: 'Vous avez déjà un compte ? ',
    logIn: 'Se connecter',
    termsPrefix: "J'ai lu et j'accepte les ",
    termsLink: 'Conditions générales',
    termsSuffix: ' et la Politique de confidentialité.',
    termsRequired: 'Vous devez accepter les conditions générales pour créer un compte.',
    genericError: 'Impossible de créer votre compte.',
  },
  onboarding: {
    title: 'Complétez votre profil',
    subtitle: 'Cela aide les hôtes à vous faire confiance et vous associe aux missions proches de vous.',
    aboutYou: 'À propos de vous',
    aboutYouPlaceholder: 'Quelques mots sur votre expérience…',
    yearsExperience: "Années d'expérience",
    citiesYouCover: 'Villes que vous couvrez',
    weeklyAvailability: 'Disponibilités hebdomadaires',
    documents: 'Documents',
    photoSelected: 'Photo sélectionnée ✓',
    profilePicture: 'Photo de profil',
    idCard: "Carte d'identité",
    saveProfile: 'Enregistrer le profil',
    savingProfile: 'Enregistrement…',
    genericError: "Impossible d'enregistrer votre profil",
  },
  tabsCleaner: { jobFeed: 'Missions', myJobs: 'Mes missions', earnings: 'Revenus', profile: 'Profil' },
  tabsHost: { home: 'Accueil', calendar: 'Calendrier', properties: 'Propriétés', expenses: 'Dépenses', more: 'Plus' },
  profileCleaner: {
    jobsCompleted: 'missions terminées',
    verified: 'Vérifié',
    verificationPending: 'Vérification en attente',
    citiesCovered: 'Villes couvertes',
    noneSetYet: 'Aucune pour le moment.',
    availability: 'Disponibilités',
    currentLocation: 'Position actuelle',
    locationNotSet: 'Non définie — nécessaire pour trouver des missions.',
    updateLocation: 'Mettre à jour ma position actuelle',
    updatingLocation: 'Mise à jour…',
    editProfile: 'Modifier le profil',
    logOut: 'Se déconnecter',
    locationPermissionTitle: 'Autorisation de localisation requise',
    locationPermissionMessage: "Activez l'accès à la position dans les réglages pour mettre à jour votre position.",
    locationErrorTitle: 'Erreur',
    locationErrorMessage: "Impossible d'obtenir votre position.",
  },
  profileHost: {
    manage: 'Gérer',
    cleaningContacts: 'Contacts ménage',
    turnoverAlerts: 'Alertes de rotation',
    notOnMobileYet:
      "Les membres d'équipe, l'abonnement, la synchro iCal et les rapports ne sont pas encore disponibles sur mobile — gérez-les depuis le tableau de bord web ReadyDar.",
    saveChanges: 'Enregistrer',
    savingChanges: 'Enregistrement…',
    saved: 'Enregistré.',
    loadError: 'Impossible de charger votre profil.',
    saveError: "Impossible d'enregistrer votre profil.",
    language: 'Langue',
    ownerRole: 'Propriétaire',
    managerRole: 'Gestionnaire',
    staffRole: 'Employé',
  },
  checkinNew: {
    headerTitle: "Enregistrement en ligne du client",
    subtitle:
      "Générez un lien pour que votre client puisse envoyer ses informations d'arrivée et sa pièce d'identité avant votre rencontre — et recevoir automatiquement les informations d'accès une fois cela fait.",
    readyTitle: "Lien d'enregistrement prêt",
    readySubtitle: "Envoyez ceci à votre client — il renseignera ses informations et sa pièce d'identité avant son arrivée.",
    guestLink: 'Lien client',
    shareWhatsApp: 'Partager via WhatsApp',
    shareOther: 'Partager autrement',
    done: 'Terminé',
    property: 'Propriété',
    checkInDate: 'Arrivée (AAAA-MM-JJ)',
    checkOutDate: 'Départ (AAAA-MM-JJ)',
    guestName: 'Nom du client (optionnel)',
    guestNamePlaceholder: 'ex. Ahmed B.',
    guestCount: 'Nombre de personnes',
    nightlyRate: 'Tarif par nuit (MAD)',
    nightlyRatePlaceholder: 'ex. 450',
    formLanguage: "Langue du formulaire d'enregistrement",
    createLink: "Créer le lien d'enregistrement",
    creating: 'Création…',
    errorChooseProperty: 'Choisissez une propriété.',
    errorCheckInFormat: "La date d'arrivée doit être au format AAAA-MM-JJ.",
    errorCheckOutFormat: 'La date de départ doit être au format AAAA-MM-JJ.',
    errorInvalidRate: 'Entrez un tarif valide.',
    errorCreate: "Impossible de créer le lien d'enregistrement.",
    shareMessage: (propertyName, url) =>
      `Bonjour ! Merci de compléter votre enregistrement en ligne${propertyName ? ` pour ${propertyName}` : ''} ici : ${url}`,
  },
  expenses: {
    title: 'Dépenses',
    rangeMonth: 'Ce mois-ci',
    rangeLastMonth: 'Le mois dernier',
    rangeAll: 'Toute la période',
    totalExpenses: 'Total des dépenses',
    deltaVsLastMonth: (pct) => `${pct}% vs le mois dernier`,
    filterAll: 'Tout',
    emptyNoneYet: 'Aucune dépense enregistrée pour cette période.',
    emptyNoneInCategory: 'Aucune dépense dans cette catégorie pour cette période.',
    logExpenseAction: 'Ajouter une dépense',
    sharedBusinessFallback: 'Partagé / Entreprise',
    autoAdded: 'Ajouté automatiquement après un ménage terminé',
    deleteConfirmTitle: 'Supprimer la dépense ?',
    deleteConfirmMessage: 'Cette action est irréversible.',
    delete: 'Supprimer',
    deleteError: 'Impossible de supprimer cette dépense.',
    loadError: 'Impossible de charger vos dépenses.',
    allProperties: 'Toutes les propriétés',
    general: 'Général',
    addExpense: 'Ajouter une dépense',
    byPropertyTitle: 'Par propriété',
    byPropertyEmpty: "Rien à détailler pour cette période pour l'instant.",
    categoryLabels: {
      ELECTRICITY: 'Électricité',
      WATER: 'Eau',
      CLEANING_PRODUCTS: 'Produits de nettoyage',
      CLEANING_SERVICE: 'Service de ménage',
      MAINTENANCE: 'Entretien',
      OTHER: 'Autre',
    },
    categoryGroupLabels: {
      CLEANING: 'Ménage',
      MAINTENANCE: 'Entretien',
      UTILITIES: 'Charges',
      OTHER: 'Autre',
    },
  },
  expenseNew: {
    headerTitle: 'Ajouter une dépense',
    scopeSingle: 'Cette propriété',
    scopeMultiple: 'Plusieurs',
    scopeBusiness: 'Entreprise',
    splitEqual: 'Répartir également',
    splitCustom: 'Répartition personnalisée',
    businessNote:
      "Enregistrée comme dépense d'entreprise partagée — non liée à une propriété précise. Utilisez ceci pour les logiciels, le marketing, l'assurance ou l'équipement.",
    propertyLabel: 'Propriété',
    amountLabel: 'Montant en MAD',
    amountPlaceholder: 'ex. 150',
    categoryLabel: 'Catégorie',
    dateLabel: 'Date',
    dateFormatLabel: 'Date (AAAA-MM-JJ)',
    dateToday: "Aujourd'hui",
    dateYesterday: 'Hier',
    descriptionLabel: 'Description (optionnel)',
    descriptionPlaceholder: "De quoi s'agissait-il ?",
    splitAllocated: (sum, total) => `${sum} / ${total} MAD répartis`,
    splitMatches: ' — correspond au total',
    errorInvalidAmount: 'Entrez un montant valide.',
    errorDateFormat: 'La date doit être au format AAAA-MM-JJ.',
    errorSelectProperty: 'Sélectionnez au moins une propriété.',
    errorSplitMismatch: 'La répartition doit correspondre au total.',
    errorCreate: "Impossible d'enregistrer cette dépense.",
    save: 'Enregistrer la dépense',
    saving: 'Enregistrement…',
  },
  jobFeed: {
    title: 'Missions disponibles',
    subtitle: 'Missions à proximité, les plus proches en premier.',
    accountOnHold: 'Compte suspendu',
    overdueMessage: (amount) =>
      `Vous avez ${amount} MAD de commission de plateforme en retard sur des missions payées en espèces. Réglez-la auprès de l'équipe ReadyDar pour accepter de nouvelles missions.`,
    emptyMessage:
      'Aucune mission disponible pour le moment. Vérifiez que vous avez bien défini vos villes couvertes dans votre profil.',
    urgent: 'Urgent',
    budgetSuffix: 'MAD de budget',
    yourPrice: 'Votre prix (MAD)',
    offerPlaceholder: 'ex. 250',
    sendOffer: "Envoyer l'offre",
    sending: 'Envoi…',
    accept: 'Accepter',
    accepting: 'Acceptation…',
    offerDifferentPrice: 'Proposer un autre prix',
    acceptError: "Impossible d'accepter — la mission est peut-être déjà prise.",
  },
  earnings: {
    title: 'Revenus',
    thisMonth: 'Ce mois-ci',
    allTime: 'Toute la période',
    commissionOwed: 'Commission de plateforme due',
    commissionNoteBase: 'Frais de plateforme de 10% sur vos missions payées en espèces — non encore réglés.',
    commissionOverdue: (amount) =>
      ` ${amount} MAD sont en retard, et votre compte ne peut plus accepter de nouvelles missions tant que ce n'est pas payé.`,
    commissionPaySoon: ' Réglez rapidement pour éviter la suspension de votre compte.',
    commissionContact: " Contactez l'équipe ReadyDar pour régler cela.",
    history: 'Historique',
    emptyNoJobs: 'Aucune mission terminée pour le moment.',
  },
  jobDetail: {
    navigate: 'Itinéraire',
    hostLabel: 'Hôte de la propriété',
    call: 'Appeler',
    whatsapp: 'WhatsApp',
    noPhoneOnFile: 'Aucun numéro de téléphone enregistré pour cet hôte.',
    checkInButton: 'Arriver (utilise votre position)',
    startCleaning: 'Démarrer le ménage',
    markComplete: 'Marquer comme terminé',
    checklist: 'Liste de vérification',
    beforePhotos: 'Photos avant',
    afterPhotos: 'Photos après',
    takePhoto: 'Prendre une photo',
    photoDisclaimer:
      "Gardez aussi vos propres photos avant/après sur votre téléphone pour vos dossiers — celles que vous téléversez ici sont ce que voit l'hôte, mais vos propres copies vous protègent en cas de litige.",
    locationNeededTitle: 'Localisation requise',
    locationNeededMessage: "Activez l'accès à la localisation pour pointer votre arrivée.",
    genericError: "Une erreur s'est produite",
    checkedInSuccess: 'Arrivée enregistrée',
    startedSuccess: 'Ménage démarré',
    completedSuccess: 'Mission marquée comme terminée',
    urgentBadge: 'Urgent',
  },
  myJobs: {
    title: 'Mes missions',
    emptyMessage: "Aucune mission pour l'instant. Consultez l'onglet Missions disponibles pour du travail à proximité.",
  },
  bookingStatus: {
    PENDING_MATCH: "Recherche d'un agent",
    MATCHED: 'Trouvé — à confirmer',
    CONFIRMED: 'Confirmé',
    CLEANER_EN_ROUTE: 'En route',
    CHECKED_IN: 'Arrivé',
    IN_PROGRESS: 'En cours',
    AWAITING_APPROVAL: 'En attente de votre validation',
    COMPLETED: 'Terminé',
    DISPUTED: 'Litige',
    CANCELLED: 'Annulé',
  },
};

export const ar: Dict = {
  common: {
    retry: 'إعادة المحاولة',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    language: 'اللغة',
    logOut: 'تسجيل الخروج',
    error: 'خطأ',
    profile: 'الملف الشخصي',
    back: 'رجوع',
  },
  days: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  login: {
    title: 'مرحبًا بعودتك',
    subtitle: 'سجّل الدخول لإدارة عقاراتك أو مهامك.',
    email: 'البريد الإلكتروني',
    emailPlaceholder: 'you@example.com',
    password: 'كلمة المرور',
    passwordPlaceholder: '••••••••',
    logIn: 'تسجيل الدخول',
    loggingIn: 'جارٍ تسجيل الدخول…',
    noAccount: 'ليس لديك حساب؟ ',
    signUp: 'إنشاء حساب',
    genericError: 'تعذّر تسجيل الدخول. حاول مرة أخرى.',
  },
  register: {
    title: 'أنشئ حسابك',
    subtitleHost: 'احجز فرق تنظيف موثوقة لعقاراتك على Airbnb وBooking.com.',
    subtitleCleaner: 'احصل على مهام تنظيف قريبة منك.',
    imHost: 'أنا مضيف',
    imCleaner: 'أنا عامل نظافة',
    firstName: 'الاسم الأول',
    lastName: 'الاسم الأخير',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    phonePlaceholder: '+212 6XX XXX XXX',
    password: 'كلمة المرور',
    passwordPlaceholder: '8 أحرف على الأقل',
    createAccount: 'إنشاء الحساب',
    creatingAccount: 'جارٍ إنشاء الحساب…',
    haveAccount: 'لديك حساب بالفعل؟ ',
    logIn: 'تسجيل الدخول',
    termsPrefix: 'لقد قرأت وأوافق على ',
    termsLink: 'الشروط والأحكام',
    termsSuffix: ' وسياسة الخصوصية.',
    termsRequired: 'يجب أن توافق على الشروط والأحكام لإنشاء حساب.',
    genericError: 'تعذّر إنشاء حسابك.',
  },
  onboarding: {
    title: 'أكمل ملفك الشخصي',
    subtitle: 'هذا يساعد المضيفين على الوثوق بك ويربطك بمهام قريبة منك.',
    aboutYou: 'نبذة عنك',
    aboutYouPlaceholder: 'بضع كلمات عن خبرتك…',
    yearsExperience: 'سنوات الخبرة',
    citiesYouCover: 'المدن التي تغطيها',
    weeklyAvailability: 'التوفر الأسبوعي',
    documents: 'المستندات',
    photoSelected: 'تم اختيار الصورة ✓',
    profilePicture: 'صورة الملف الشخصي',
    idCard: 'بطاقة الهوية',
    saveProfile: 'حفظ الملف الشخصي',
    savingProfile: 'جارٍ الحفظ…',
    genericError: 'تعذّر حفظ ملفك الشخصي',
  },
  tabsCleaner: { jobFeed: 'المهام', myJobs: 'مهامي', earnings: 'الأرباح', profile: 'الملف الشخصي' },
  tabsHost: { home: 'الرئيسية', calendar: 'التقويم', properties: 'العقارات', expenses: 'المصاريف', more: 'المزيد' },
  profileCleaner: {
    jobsCompleted: 'مهمة منجزة',
    verified: 'موثّق',
    verificationPending: 'التوثيق قيد الانتظار',
    citiesCovered: 'المدن المغطاة',
    noneSetYet: 'لا يوجد بعد.',
    availability: 'التوفر',
    currentLocation: 'الموقع الحالي',
    locationNotSet: 'غير محدد — مطلوب لمطابقة المهام.',
    updateLocation: 'تحديث موقعي الحالي',
    updatingLocation: 'جارٍ التحديث…',
    editProfile: 'تعديل الملف الشخصي',
    logOut: 'تسجيل الخروج',
    locationPermissionTitle: 'إذن الموقع مطلوب',
    locationPermissionMessage: 'فعّل الوصول إلى الموقع من الإعدادات لتحديث موقعك.',
    locationErrorTitle: 'خطأ',
    locationErrorMessage: 'تعذّر الحصول على موقعك.',
  },
  profileHost: {
    manage: 'الإدارة',
    cleaningContacts: 'جهات اتصال التنظيف',
    turnoverAlerts: 'تنبيهات التبديل',
    notOnMobileYet:
      'أعضاء الفريق، الاشتراك، مزامنة iCal، والتقارير غير متوفرة بعد في التطبيق — أدرها من لوحة تحكم ReadyDar على الويب.',
    saveChanges: 'حفظ التغييرات',
    savingChanges: 'جارٍ الحفظ…',
    saved: 'تم الحفظ.',
    loadError: 'تعذّر تحميل ملفك الشخصي.',
    saveError: 'تعذّر حفظ ملفك الشخصي.',
    language: 'اللغة',
    ownerRole: 'مالك',
    managerRole: 'مدير',
    staffRole: 'موظف',
  },
  checkinNew: {
    headerTitle: 'تسجيل وصول الضيف عبر الإنترنت',
    subtitle:
      'أنشئ رابطًا ليتمكن ضيفك من إرسال تفاصيل وصوله وهويته قبل لقائك — وستُرسل له معلومات الدخول تلقائيًا بمجرد إتمام ذلك.',
    readyTitle: 'رابط تسجيل الوصول جاهز',
    readySubtitle: 'أرسل هذا لضيفك — سيقوم بتعبئة بياناته وهويته قبل وصوله.',
    guestLink: 'رابط الضيف',
    shareWhatsApp: 'مشاركة عبر واتساب',
    shareOther: 'مشاركة بطريقة أخرى',
    done: 'تم',
    property: 'العقار',
    checkInDate: 'تاريخ الوصول (سنة-شهر-يوم)',
    checkOutDate: 'تاريخ المغادرة (سنة-شهر-يوم)',
    guestName: 'اسم الضيف (اختياري)',
    guestNamePlaceholder: 'مثال: أحمد ب.',
    guestCount: 'عدد الضيوف',
    nightlyRate: 'السعر لليلة (درهم)',
    nightlyRatePlaceholder: 'مثال: 450',
    formLanguage: 'لغة نموذج تسجيل الوصول',
    createLink: 'إنشاء رابط تسجيل الوصول',
    creating: 'جارٍ الإنشاء…',
    errorChooseProperty: 'اختر عقارًا.',
    errorCheckInFormat: 'يجب أن يكون تاريخ الوصول بصيغة سنة-شهر-يوم.',
    errorCheckOutFormat: 'يجب أن يكون تاريخ المغادرة بصيغة سنة-شهر-يوم.',
    errorInvalidRate: 'أدخل سعرًا صحيحًا لليلة.',
    errorCreate: 'تعذّر إنشاء رابط تسجيل الوصول.',
    shareMessage: (propertyName, url) =>
      `مرحبًا! يرجى إكمال تسجيل الوصول عبر الإنترنت${propertyName ? ` لـ${propertyName}` : ''} من هنا: ${url}`,
  },
  expenses: {
    title: 'المصاريف',
    rangeMonth: 'هذا الشهر',
    rangeLastMonth: 'الشهر الماضي',
    rangeAll: 'كل الفترة',
    totalExpenses: 'إجمالي المصاريف',
    deltaVsLastMonth: (pct) => `${pct}% مقارنة بالشهر الماضي`,
    filterAll: 'الكل',
    emptyNoneYet: 'لا توجد مصاريف مسجلة لهذه الفترة بعد.',
    emptyNoneInCategory: 'لا توجد مصاريف في هذه الفئة لهذه الفترة.',
    logExpenseAction: 'تسجيل مصروف',
    sharedBusinessFallback: 'مشترك / تجاري',
    autoAdded: 'أُضيف تلقائيًا من عملية تنظيف مكتملة',
    deleteConfirmTitle: 'حذف المصروف؟',
    deleteConfirmMessage: 'لا يمكن التراجع عن هذا.',
    delete: 'حذف',
    deleteError: 'تعذّر حذف هذا المصروف.',
    loadError: 'تعذّر تحميل مصاريفك.',
    allProperties: 'كل العقارات',
    general: 'عام',
    addExpense: 'إضافة مصروف',
    byPropertyTitle: 'حسب العقار',
    byPropertyEmpty: 'لا يوجد بعد ما يمكن تفصيله لهذه الفترة.',
    categoryLabels: {
      ELECTRICITY: 'الكهرباء',
      WATER: 'الماء',
      CLEANING_PRODUCTS: 'مواد التنظيف',
      CLEANING_SERVICE: 'خدمة التنظيف',
      MAINTENANCE: 'الصيانة',
      OTHER: 'أخرى',
    },
    categoryGroupLabels: {
      CLEANING: 'التنظيف',
      MAINTENANCE: 'الصيانة',
      UTILITIES: 'المرافق',
      OTHER: 'أخرى',
    },
  },
  expenseNew: {
    headerTitle: 'إضافة مصروف',
    scopeSingle: 'هذا العقار',
    scopeMultiple: 'عدة عقارات',
    scopeBusiness: 'تجاري',
    splitEqual: 'تقسيم بالتساوي',
    splitCustom: 'تقسيم مخصص',
    businessNote: 'يُسجَّل كمصروف تجاري مشترك — غير مرتبط بعقار معيّن. استخدم هذا للبرمجيات، التسويق، التأمين، أو المعدات.',
    propertyLabel: 'العقار',
    amountLabel: 'المبلغ بالدرهم',
    amountPlaceholder: 'مثال: 150',
    categoryLabel: 'الفئة',
    dateLabel: 'التاريخ',
    dateFormatLabel: 'التاريخ (سنة-شهر-يوم)',
    dateToday: 'اليوم',
    dateYesterday: 'الأمس',
    descriptionLabel: 'الوصف (اختياري)',
    descriptionPlaceholder: 'ما هو الغرض منه؟',
    splitAllocated: (sum, total) => `${sum} / ${total} درهم موزّعة`,
    splitMatches: ' — يطابق الإجمالي',
    errorInvalidAmount: 'أدخل مبلغًا صحيحًا.',
    errorDateFormat: 'يجب أن يكون التاريخ بصيغة سنة-شهر-يوم.',
    errorSelectProperty: 'اختر عقارًا واحدًا على الأقل.',
    errorSplitMismatch: 'يجب أن يكون مجموع التقسيم مساويًا للإجمالي.',
    errorCreate: 'تعذّر تسجيل هذا المصروف.',
    save: 'حفظ المصروف',
    saving: 'جارٍ الحفظ…',
  },
  jobFeed: {
    title: 'المهام المتاحة',
    subtitle: 'المهام القريبة، الأقرب أولاً.',
    accountOnHold: 'الحساب موقوف مؤقتًا',
    overdueMessage: (amount) =>
      `لديك ${amount} درهم من عمولة المنصة المتأخرة من مهام الدفع عند الاستلام. سوّها مع فريق ReadyDar لتتمكن من قبول مهام جديدة.`,
    emptyMessage: 'لا توجد مهام متاحة حاليًا. تأكد من تحديد المدن التي تغطيها في ملفك الشخصي.',
    urgent: 'عاجل',
    budgetSuffix: 'درهم ميزانية',
    yourPrice: 'سعرك (درهم)',
    offerPlaceholder: 'مثال: 250',
    sendOffer: 'إرسال العرض',
    sending: 'جارٍ الإرسال…',
    accept: 'قبول',
    accepting: 'جارٍ القبول…',
    offerDifferentPrice: 'عرض سعر مختلف',
    acceptError: 'تعذّر القبول — ربما تم أخذها بالفعل.',
  },
  earnings: {
    title: 'الأرباح',
    thisMonth: 'هذا الشهر',
    allTime: 'كل الفترة',
    commissionOwed: 'عمولة المنصة المستحقة',
    commissionNoteBase: 'رسوم المنصة 10% على مهام الدفع عند الاستلام — لم تُسوَّ بعد.',
    commissionOverdue: (amount) =>
      ` ${amount} درهم من هذا المبلغ متأخر، ولا يمكن لحسابك قبول مهام جديدة حتى تتم تسويته.`,
    commissionPaySoon: ' سوِّ المبلغ قريبًا لتجنّب إيقاف حسابك.',
    commissionContact: ' تواصل مع فريق ReadyDar لتسوية الأمر.',
    history: 'السجل',
    emptyNoJobs: 'لا توجد مهام مكتملة بعد.',
  },
  jobDetail: {
    navigate: 'الاتجاهات',
    hostLabel: 'مضيف العقار',
    call: 'اتصال',
    whatsapp: 'واتساب',
    noPhoneOnFile: 'لا يوجد رقم هاتف مسجل لهذا المضيف.',
    checkInButton: 'تسجيل الوصول (يستخدم موقعك)',
    startCleaning: 'بدء التنظيف',
    markComplete: 'تحديد المهمة كمكتملة',
    checklist: 'قائمة المهام',
    beforePhotos: 'صور قبل',
    afterPhotos: 'صور بعد',
    takePhoto: 'التقاط صورة',
    photoDisclaimer:
      'احتفظ أيضًا بصورك الخاصة قبل/بعد على هاتفك كسجل خاص بك — الصور التي ترفعها هنا هي ما يراه المضيف، لكن نسخك الخاصة تحميك في حال حدوث أي نزاع.',
    locationNeededTitle: 'الموقع مطلوب',
    locationNeededMessage: 'فعّل الوصول إلى الموقع لتسجيل وصولك.',
    genericError: 'حدث خطأ ما',
    checkedInSuccess: 'تم تسجيل الوصول',
    startedSuccess: 'بدأ التنظيف',
    completedSuccess: 'تم تحديد المهمة كمكتملة',
    urgentBadge: 'عاجل',
  },
  myJobs: {
    title: 'مهامي',
    emptyMessage: 'لا توجد مهام بعد. تحقق من تبويب المهام المتاحة للعثور على عمل قريب.',
  },
  bookingStatus: {
    PENDING_MATCH: 'جارٍ البحث عن عامل نظافة',
    MATCHED: 'تم الإيجاد — أكّد العامل',
    CONFIRMED: 'مؤكد',
    CLEANER_EN_ROUTE: 'في الطريق',
    CHECKED_IN: 'تم تسجيل الوصول',
    IN_PROGRESS: 'قيد التنفيذ',
    AWAITING_APPROVAL: 'بانتظار موافقتك',
    COMPLETED: 'مكتمل',
    DISPUTED: 'نزاع',
    CANCELLED: 'ملغى',
  },
};
