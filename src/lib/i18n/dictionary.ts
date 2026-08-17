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
  tabsHost: { dashboard: string; calendar: string; properties: string; bookings: string; more: string };
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
  tabsHost: { dashboard: 'Dashboard', calendar: 'Calendar', properties: 'Properties', bookings: 'Bookings', more: 'More' },
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
      "Team members, billing/subscription, iCal sync, and reports aren't in the mobile app yet — manage those from the DarClean web dashboard.",
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
  tabsHost: { dashboard: 'Tableau de bord', calendar: 'Calendrier', properties: 'Propriétés', bookings: 'Réservations', more: 'Plus' },
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
      "Les membres d'équipe, l'abonnement, la synchro iCal et les rapports ne sont pas encore disponibles sur mobile — gérez-les depuis le tableau de bord web DarClean.",
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
  tabsHost: { dashboard: 'الرئيسية', calendar: 'التقويم', properties: 'العقارات', bookings: 'الحجوزات', more: 'المزيد' },
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
      'أعضاء الفريق، الاشتراك، مزامنة iCal، والتقارير غير متوفرة بعد في التطبيق — أدرها من لوحة تحكم DarClean على الويب.',
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
};
