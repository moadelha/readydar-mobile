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
    privacyPolicy: string;
    terms: string;
    save: string;
    saving: string;
    cancel: string;
    language: string;
    appearance: string;
    appearanceSystem: string;
    appearanceLight: string;
    appearanceDark: string;
    logOut: string;
    error: string;
    profile: string;
    back: string;
    date: string;
    done: string;
    previousMonth: string;
    nextMonth: string;
    /** Range picker prompt after the check-in day is tapped. */
    pickCheckOut: string;
    /** "1 guest" / "3 guests" — simple two-way plural, same convention the web dictionary uses (no Arabic dual/plural grammar). */
    guestsCount: (n: number) => string;
  };
  /** Sun..Sat, matching the backend's dayOfWeek convention (0 = Sunday). */
  days: [string, string, string, string, string, string, string];
  /**
   * Shared relative-date phrasing — used by any host screen that shows "when
   * is this happening" (dashboard, calendar, guests, property detail). The
   * `*At` variants attach the real date after the relative word, matching
   * dashboard.tsx's `arrivalPhrase` helper.
   */
  relativeDate: {
    overdue: string;
    today: string;
    tomorrow: string;
    todayAt: (date: string) => string;
    tomorrowAt: (date: string) => string;
    yesterdayAt: (date: string) => string;
    daysAgoAt: (n: number, date: string) => string;
    inDaysAt: (n: number, date: string) => string;
    thisMonth: string;
    nextMonth: string;
    lastMonth: string;
  };
  /** Translated equivalent of status.ts's PROPERTY_STATUS_LABELS — used by every host screen that shows a property's cleaning status (dashboard, calendar, properties, property detail). */
  propertyStatus: {
    READY: string;
    NEEDS_CLEANING: string;
    IN_PROGRESS: string;
    OCCUPIED: string;
  };
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
    /** Opens the website's reset page; also how someone who signed up with Google sets a password for the app. */
    forgotPassword: string;
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
    privacyLink: string;
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
  cleanerComingSoon: {
    title: string;
    body: string;
    editProfile: string;
    logOut: string;
  };
  marketplaceComingSoon: {
    title: string;
    body: string;
    back: string;
  };
  more: {
    sectionOperations: string;
    sectionGuests: string;
    sectionAccount: string;
    title: string;
    subtitle: string;
    guests: string;
    guestsDesc: string;
    bookings: string;
    bookingsDesc: string;
    turnovers: string;
    turnoversDesc: string;
    cleaningContacts: string;
    cleaningContactsDesc: string;
    connectAirbnb: string;
    connectAirbnbDesc: string;
    contract: string;
    contractDesc: string;
    profile: string;
    profileDesc: string;
  };
  noAccess: {
    title: string;
    body: string;
    back: string;
  };
  propertySettings: {
    headerTitle: string;
    subtitle: string;
    loadError: string;
    saveError: string;
    saved: string;
    save: string;
    saving: string;
    pricingTitle: string;
    pricingBody: string;
    /** A property's own price is in its own currency (Property.currency). */
    nightlyRate: (currency: string) => string;
    nightlyRatePlaceholder: string;
    invalidRate: string;
    welcomeTitle: string;
    welcomeBody: string;
    welcomeModeLabel: string;
    accessTitle: string;
    accessBody: string;
    gateCode: string;
    doorCode: string;
    apartmentNumber: string;
    floor: string;
    mapsLink: string;
    checkInTime: string;
    checkOutTime: string;
    houseRules: string;
    templateTitle: string;
    templateBody: string;
    templateLabel: string;
    resetTemplate: string;
    variablesHint: string;
    turnoverTitle: string;
    turnoverBody: string;
    defaultContact: string;
    noContacts: string;
    defaultService: string;
    modeOff: string;
    modeReview: string;
    modeAuto: string;
  };
  cleaningReports: {
    // Plan gate (shown when the host's plan doesn't include the feature)
    upgradeTitle: string;
    upgradeBody: string;
    // List screen
    title: string;
    back: string;
    loadError: string;
    startError: string;
    emptyMessage: string;
    startAction: string;
    startedOn: (date: string) => string;
    // Capture screen
    titleFallback: string;
    statusInProgress: string;
    statusCompleted: string;
    photoCount: (n: number) => string;
    nextGuest: string;
    guestStay: string;
    checkInAt: (time: string) => string;
    areaLabel: string;
    areaPlaceholder: string;
    uploading: string;
    uploadingCount: (n: number) => string;
    takePhoto: string;
    burstHint: string;
    noPhotosYet: string;
    nameAreaTitle: string;
    nameAreaBody: string;
    locationNeededTitle: string;
    locationNeededBody: string;
    clockDriftWarning: string;
    uploadError: string;
    removeTitle: string;
    removeBody: string;
    cancel: string;
    remove: string;
    removeError: string;
    completing: string;
    markComplete: string;
    completeSuccess: string;
    completeError: string;
    verification: string;
    verificationBody: string;
    copied: string;
    copyLink: string;
    linkCopied: string;
    share: string;
    preparingPdf: string;
    exportPdf: string;
    pdfError: string;
  };
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
  dashboardHost: {
    statArrivingToday: string;
    statLeavingTomorrow: string;
    statToClean: string;
    greeting: (name: string) => string;
    /** The apartment/unit number on a location line — "Apt 13". */
    unitShort: (unit: string) => string;
    greetingFallback: string;
    subtitle: string;
    emptyTitle: string;
    emptySubtitle: string;
    addProperty: string;
    quickRequestCleaning: string;
    quickGuestCheckIn: string;
    nextCheckIns: string;
    nextCheckInsSubtitle: string;
    viewAll: string;
    noArrivalsSoon: string;
    noGuestsWaiting: string;
    guestFallback: string;
    checkInAt: (time: string) => string;
    checkInLinkReady: string;
    copied: string;
    copyLink: string;
    moreArrivingSoon: (n: number) => string;
    hiddenCheckIns: (n: number) => string;
    hiddenFromHome: string;
    hiddenRestored: string;
    tomorrowCheckouts: string;
    tomorrowCheckoutsSubtitle: string;
    noCheckoutsTomorrow: string;
    sameDayTurnover: string;
    checkoutTag: string;
    moreCheckingOut: (n: number) => string;
    allApartments: string;
    allApartmentsSubtitle: string;
    allStatuses: (n: number) => string;
    noPropertiesWithStatus: string;
    markReadyHint: string;
    markedReady: (name: string) => string;
    errorLoad: string;
    errorUpdateProperty: string;
    errorTiming: string;
    errorGuestCount: string;
    checkInLinkCopied: string;
    notifications: string;
    markAllRead: string;
    notificationsEmpty: string;
    sheetPropertyStatus: string;
    sheetArrives: string;
    sheetLeaves: string;
    notifyCleaner: (name: string) => string;
    cleanerNotified: string;
    noCleaningContact: string;
    notifyCleanerError: string;
    sheetLengthOfStay: string;
    sheetGuests: string;
    timingRequestsTitle: string;
    timingRequestsSubtitle: string;
    earlyCheckIn: string;
    arrivingBefore: (time: string) => string;
    arrivingBeforeUsual: string;
    lateCheckout: string;
    leavingAfterUsual: string;
    note: (text: string) => string;
    messageGuestWhatsApp: string;
    copiedExclaim: string;
    copyCheckInLink: string;
    opening: string;
    shareViaWhatsApp: string;
    openProperty: string;
    turnaround: string;
    departingGuests: string;
    lateCheckoutRequested: string;
    yes: string;
    nextGuestSameDay: string;
    arrivingGuests: string;
    earlyCheckInRequested: string;
    afterThisCheckout: string;
    checkingWhatsNext: string;
    nextGuestArrives: string;
    blockedAfterCheckout: string;
    nothingBookedYet: string;
    requestCleaningForTurnover: string;
    openPropertyCalendar: string;
    /** WhatsApp share-link text: "Hi! Please complete your online check-in for {property}, arriving {date}: {url}" */
    checkInShareMessage: (propertyName: string, arriving: string, url: string) => string;
  };
  /** Translated equivalent of calendar-visuals.ts's SOURCE_LABEL. */
  sourceLabel: {
    AIRBNB: string;
    BOOKING_COM: string;
    DIRECT: string;
    MANUAL: string;
  };
  /** Translated equivalent of calendar-visuals.ts's GUEST_STAY_STATUS_LABEL. */
  guestStayStatus: {
    PENDING: string;
    SUBMITTED: string;
    EXPIRED: string;
  };
  calendarHost: {
    /** Caption under a property's two-week strip in the Listings view. */
    nextTwoWeeks: (bookedNights: number) => string;
    title: string;
    allProperties: string;
    viewListings: string;
    viewCalendar: string;
    legendCleaning: string;
    legendGuestStay: string;
    legendBlocked: string;
    tapForDetails: string;
    dayEmpty: string;
    noPropertiesToShow: string;
    airbnbBadge: string;
    nightsCount: (n: number) => string;
    errorLoad: string;
    errorCreateCheckIn: string;
    errorUpdateReservation: string;
    errorSaveRate: string;
    bookingCreatedLinkCopied: string;
    checkInLinkCreatedCopied: string;
    checkInLinkCopied: string;
    bookedAtRate: (rate: number) => string;
    markedRealBooking: string;
    savedRate: (rate: number) => string;
    rateCleared: string;
    copiedExclaim: string;
    copyCheckInLink: string;
    shareViaWhatsApp: string;
    blockedOnPrefix: string;
    platformPrefix: string;
    confirmedStatus: string;
    ratePerNightLabel: string;
    ratePerNightHint: string;
    savingEllipsis: string;
    savePrice: string;
    guestsOptionalLabel: string;
    guestsOptionalHint: string;
    workingEllipsis: string;
    confirmRealBookingCreateLink: string;
    createCheckInLink: string;
    markBookedNoLink: string;
    viewBooking: string;
    viewProperty: string;
    close: string;
    addSheetTitle: string;
    addCleaning: string;
    addCleaningSubtitle: string;
    guestOnlineCheckIn: string;
    guestOnlineCheckInSubtitle: string;
    checkInShareMessage: (propertyName: string, url: string) => string;
  };
  propertiesList: {
    title: string;
    listedCount: (n: number) => string;
    airbnbButton: string;
    errorLoad: string;
    emptyMessage: string;
    addFirstProperty: string;
    airbnbBadge: string;
    bedBathGuests: (bed: number, bath: number, guests: number) => string;
    ratePerNight: (rate: number, currency: string) => string;
  };
  propertyDetail: {
    addCoverPhoto: string;
    changeCoverPhoto: string;
    uploadingPhoto: string;
    addPhoto: string;
    doorPhotosEmpty: string;
    doorPhotosHint: string;
    deleteDoorPhotoTitle: string;
    deleteDoorPhotoMessage: string;
    deleteDoorPhotoConfirm: string;
    errorPhotoAccess: string;
    errorUploadPhoto: string;
    headerBack: string;
    errorLoad: string;
    errorSetStatus: string;
    errorMarkReady: string;
    errorPreview: string;
    errorSendWelcome: string;
    errorOpenWhatsApp: string;
    errorOpenIdPhoto: string;
    errorDeleteCheckIn: string;
    errorDownloadPdf: string;
    errorDownloadContract: string;
    syncNotice: string;
    statusLabel: string;
    statusAuto: string;
    statusWorkingItOut: string;
    requestCleaning: string;
    markReady: string;
    logExpense: string;
    cleaningReports: string;
    guestCheckIns: string;
    noCheckInsYet: string;
    guestFallback: string;
    createdFromAirbnb: string;
    phoneLabel: (phone: string) => string;
    nationalityIdLine: (nationality: string, idType: string, idNumber: string) => string;
    passport: string;
    nationalId: string;
    idPhoto: string;
    idPhotos: string;
    viewId: string;
    openingEllipsis: string;
    downloadCheckInPdf: string;
    preparingPdf: string;
    downloadContract: string;
    preparingContract: string;
    welcomeMessageSent: string;
    openWhatsAppWelcomeReady: string;
    hideWelcomeMessage: string;
    sendWelcomeMessage: string;
    loadingPreview: string;
    messageEditLabel: string;
    sendingEllipsis: string;
    sendViaWhatsApp: string;
    messageGuestWhatsApp: string;
    shareViaWhatsApp: string;
    deletingEllipsis: string;
    deleteThisLink: string;
    /** Short labels for the compact check-in rows; the long ones are in guestStayStatus. */
    checkInStatusShort: { PENDING: string; SUBMITTED: string; EXPIRED: string };
    newCheckInLink: string;
    shareLink: string;
    whatsappGuest: string;
    contractPdf: string;
    checkInPdf: string;
    deleteCheckInTitle: string;
    deleteCheckInMessage: (label: string) => string;
    checkInOutTitle: string;
    checkInOutLine: (checkIn: string, checkOut: string) => string;
    accessDetailsTitle: string;
    unitApartment: (value: string) => string;
    gateCode: (value: string) => string;
    doorCode: (value: string) => string;
    wifiTitle: string;
    houseRulesTitle: string;
    doorPhotosTitle: string;
    automationSettings: string;
    icalNotice: string;
    checkInShareMessage: (propertyName: string | null, arriving: string, url: string) => string;
  };
  bookingsList: {
    headerBack: string;
    pageTitle: string;
    title: string;
    subtitle: string;
    errorLoad: string;
    emptyMessage: string;
    actionLabel: string;
    urgent: string;
  };
  guestsList: {
    headerBack: string;
    title: string;
    subtitle: string;
    errorLoad: string;
    emptyMessage: string;
    emptyAction: string;
    sectionUpcomingTitle: string;
    sectionUpcomingSubtitle: string;
    sectionSubmittedTitle: string;
    sectionSubmittedSubtitle: string;
    sectionExpiredTitle: string;
    sectionExpiredSubtitle: string;
    nothingHere: string;
    copyLink: string;
    copiedExclaim: string;
    checkInLinkCopiedToast: string;
    checkInLinkDeletedToast: string;
    deleteCheckInMessage: (label: string, propertyName: string) => string;
    viewPropertyLink: string;
  };
  connectAirbnb: {
    title: string;
    intro: string;
    oneWayNote: string;
    step1Title: string;
    step1Body: string;
    connectButton: string;
    opening: string;
    step2Title: string;
    step2Body: string;
    syncNow: string;
    syncing: string;
    foundOnAirbnb: (n: number) => string;
    hide: string;
    noListings: string;
    listingFallback: string;
    footer: string;
    synced: (properties: number, stays: number, blocks: number) => string;
    upToDate: string;
    errorConnect: string;
    errorSync: string;
  };
  notifications: {
    checkinTitle: (guest: string) => string;
    checkinBody: (property: string, stay: string) => string;
    jobTitle: string;
    jobBody: (property: string) => string;
    turnoverTitle: string;
    turnoverBody: (property: string) => string;
    aProperty: string;
    guestFallback: string;
    justNow: string;
    minutesAgo: (n: number) => string;
    hoursAgo: (n: number) => string;
    yesterday: string;
    daysAgo: (n: number) => string;
  };
}

export const en: Dict = {
  common: {
    privacyPolicy: 'Privacy Policy',
    terms: 'Terms and Conditions',
    retry: 'Retry',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    language: 'Language',
    appearance: 'Appearance',
    appearanceSystem: 'System',
    appearanceLight: 'Light',
    appearanceDark: 'Dark',
    logOut: 'Log out',
    error: 'Error',
    profile: 'Profile',
    back: 'Back',
    guestsCount: (n) => `${n} guest${n === 1 ? '' : 's'}`,
    date: 'Date',
    done: 'Done',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    pickCheckOut: 'Now tap the check-out day',
  },
  days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  relativeDate: {
    overdue: 'Overdue',
    today: 'Today',
    tomorrow: 'Tomorrow',
    todayAt: (date) => `Today · ${date}`,
    tomorrowAt: (date) => `Tomorrow · ${date}`,
    yesterdayAt: (date) => `Yesterday · ${date}`,
    daysAgoAt: (n, date) => `${n} days ago · ${date}`,
    inDaysAt: (n, date) => `In ${n} days · ${date}`,
    thisMonth: 'This month',
    nextMonth: 'Next month',
    lastMonth: 'Last month',
  },
  propertyStatus: {
    READY: 'Ready for guests',
    NEEDS_CLEANING: 'Needs cleaning',
    IN_PROGRESS: 'Cleaning in progress',
    OCCUPIED: 'Guest staying',
  },
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
    forgotPassword: 'Forgot password?',
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
    termsSuffix: ' and ',
    privacyLink: 'Privacy Policy',
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
  cleanerComingSoon: {
    title: "We're not in your area yet",
    body: "ReadyDar's cleaner marketplace isn't live in your location yet — we're rolling it out city by city. We'll let you know as soon as it launches near you.",
    editProfile: 'Edit profile',
    logOut: 'Log out',
  },
  marketplaceComingSoon: {
    title: 'Booking a cleaner is coming soon',
    body: "We're still building out our network of vetted cleaners. Everything else in ReadyDar works as normal — we'll let you know the moment you can book one here.",
    back: 'Go back',
  },
  more: {
    sectionOperations: 'Operations',
    sectionGuests: 'Guests',
    sectionAccount: 'Account',
    title: 'More',
    subtitle: 'Everything else, in one place.',
    guests: 'Guests',
    guestsDesc: 'Send WhatsApp welcome messages to checked-in guests',
    bookings: 'All bookings',
    bookingsDesc: 'Every cleaning and maintenance job, across all properties',
    turnovers: 'Turnovers',
    turnoversDesc: 'Notify your cleaning contact after guest checkout',
    cleaningContacts: 'Cleaning contacts',
    cleaningContactsDesc: 'Your staff and enrolled cleaning company accounts',
    connectAirbnb: 'Connect Airbnb',
    connectAirbnbDesc: 'Import your listings and reservations automatically',
    contract: 'Rental contract',
    contractDesc: 'Require guests to sign a contract during online check-in',
    profile: 'Profile',
    profileDesc: 'Your account, phone, and log out',
  },
  noAccess: {
    title: "You don't have access to this",
    body: 'Ask the account owner or a manager if you need it.',
    back: 'Go back',
  },
  propertySettings: {
    headerTitle: 'Property settings',
    subtitle: "Access details, the guest welcome message, and what happens automatically around a stay.",
    loadError: 'Could not load this property.',
    saveError: 'Could not save these settings.',
    saved: 'Saved.',
    save: 'Save settings',
    saving: 'Saving…',
    pricingTitle: 'Pricing',
    pricingBody: 'The default nightly rate for this property — used for future reservations and check-in links.',
    nightlyRate: (currency) => `Nightly rate (${currency})`,
    nightlyRatePlaceholder: 'e.g. 450',
    invalidRate: 'Enter a valid nightly rate.',
    welcomeTitle: 'Guest welcome message',
    welcomeBody: 'Sent to the guest on WhatsApp once they complete online check-in.',
    welcomeModeLabel: 'Send automatically',
    accessTitle: 'Access details',
    accessBody: "Filled into the welcome message — and the cleaner's turnover message — wherever the matching placeholder appears. Change the gate code here and every future message uses the new one.",
    gateCode: 'Gate code',
    doorCode: 'Door code',
    apartmentNumber: 'Apartment number',
    floor: 'Floor',
    mapsLink: 'Google Maps link',
    checkInTime: 'Check-in time',
    checkOutTime: 'Check-out time',
    houseRules: 'House rules',
    templateTitle: 'Message wording',
    templateBody: 'Edit the text itself. Lines whose details are empty are left out automatically.',
    templateLabel: 'Message',
    resetTemplate: 'Reset to default wording',
    variablesHint: 'Placeholders you can use:',
    turnoverTitle: 'Cleaning turnover alerts',
    turnoverBody: 'Notify a cleaning contact on WhatsApp after the guest checks out.',
    defaultContact: 'Default cleaning contact',
    noContacts: 'No cleaning contacts yet — add one from More › Cleaning contacts.',
    defaultService: 'Default service (for company-account contacts)',
    modeOff: 'Off',
    modeReview: 'Review first',
    modeAuto: 'Automatic',
  },
  cleaningReports: {
    upgradeTitle: 'Cleaning Reports is a paid feature',
    upgradeBody: "Camera-verified cleaning proof isn't included on the Free plan. Upgrade to unlock it.",
    title: 'Cleaning Reports',
    back: 'Back',
    loadError: 'Could not load cleaning reports.',
    startError: 'Could not start a new report.',
    emptyMessage: 'No cleaning reports yet.',
    startAction: 'Start a report',
    startedOn: (date: string) => `Started ${date}`,
    titleFallback: 'Cleaning Report',
    statusInProgress: 'In progress',
    statusCompleted: 'Completed',
    photoCount: (n: number) => `${n} photo${n === 1 ? '' : 's'}`,
    nextGuest: 'Next guest',
    guestStay: 'Guest stay',
    checkInAt: (time: string) => `check-in ${time}`,
    areaLabel: 'Area',
    areaPlaceholder: 'e.g. Kitchen, Bathroom 1, Bedroom 2',
    uploading: 'Uploading…',
    uploadingCount: (n: number) => `Uploading ${n} photo${n === 1 ? '' : 's'}…`,
    takePhoto: 'Take photo',
    burstHint: 'The camera reopens after each shot so you can take several of this area. Press back when you are done.',
    noPhotosYet: 'No photos yet — tap “Take photo” above to start.',
    nameAreaTitle: 'Name this area',
    nameAreaBody: 'Enter what area this photo is of (e.g. Kitchen) before taking the photo.',
    locationNeededTitle: 'Location needed',
    locationNeededBody:
      'This report needs your location to verify the photo was taken at the property. Enable location access and try again.',
    clockDriftWarning: "This photo's device clock looks off — you may want to retake it.",
    uploadError: 'Could not upload this photo.',
    removeTitle: 'Remove this photo?',
    removeBody: 'This cannot be undone.',
    cancel: 'Cancel',
    remove: 'Remove',
    removeError: 'Could not remove this photo.',
    completing: 'Completing…',
    markComplete: 'Mark report complete',
    completeSuccess: 'Report completed',
    completeError: 'Could not complete this report.',
    verification: 'Verification',
    verificationBody:
      'Share this link with Airbnb or the guest to independently confirm this report is authentic.',
    copied: 'Copied',
    copyLink: 'Copy link',
    linkCopied: 'Verification link copied',
    share: 'Share',
    preparingPdf: 'Preparing PDF…',
    exportPdf: 'Export PDF',
    pdfError: 'Could not generate the PDF. Please try again.',
  },
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
    checkInDate: 'Check-in',
    checkOutDate: 'Check-out',
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
    dateFormatLabel: 'Another date',
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
  dashboardHost: {
    statArrivingToday: 'Arriving today',
    statLeavingTomorrow: 'Leaving tomorrow',
    statToClean: 'To clean',
    unitShort: (unit) => `Apt ${unit}`,
    greeting: (name) => `Hi ${name}`,
    greetingFallback: 'Your properties',
    subtitle: "Here's what's happening across your properties.",
    emptyTitle: 'Add your first property',
    emptySubtitle: "Once it's added you can send check-in links and track turnovers here.",
    addProperty: 'Add property',
    quickRequestCleaning: 'Request cleaning',
    quickGuestCheckIn: 'Guest check-in',
    nextCheckIns: 'Next check-ins',
    nextCheckInsSubtitle: 'Guests arriving soon · check-in links ready',
    viewAll: 'View all',
    noArrivalsSoon: 'No arrivals in the next few days.',
    noGuestsWaiting: 'No guests waiting to check in.',
    guestFallback: 'Guest',
    checkInAt: (time) => `Check-in ${time}`,
    checkInLinkReady: 'Check-in link ready',
    copied: 'Copied',
    copyLink: 'Copy link',
    moreArrivingSoon: (n) => `${n} more arriving soon`,
    hiddenCheckIns: (n) => `${n} hidden check-in${n === 1 ? '' : 's'} · show`,
    hiddenFromHome: 'Hidden from Home',
    hiddenRestored: 'Hidden check-ins restored',
    tomorrowCheckouts: "Tomorrow's checkouts",
    tomorrowCheckoutsSubtitle: 'Guests leaving tomorrow — same-day turnovers are flagged',
    noCheckoutsTomorrow: 'No checkouts scheduled for tomorrow.',
    sameDayTurnover: 'Same-day turnover',
    checkoutTag: 'Checkout',
    moreCheckingOut: (n) => `${n} more checking out`,
    allApartments: 'All apartments',
    allApartmentsSubtitle: 'The status of every property',
    allStatuses: (n) => `All statuses · ${n}`,
    noPropertiesWithStatus: 'No properties with this status.',
    markReadyHint: 'Cleaned one yourself? Mark it ready:',
    markedReady: (name) => `${name} marked ready`,
    errorLoad: 'Could not load your dashboard.',
    errorUpdateProperty: 'Could not update the property.',
    errorTiming: 'Could not save that timing request.',
    errorGuestCount: 'Could not update the number of guests.',
    checkInLinkCopied: 'Check-in link copied',
    notifications: 'Notifications',
    markAllRead: 'Mark all read',
    notificationsEmpty: "Nothing new. You'll see it here when a guest completes their check-in.",
    sheetPropertyStatus: 'Property status',
    sheetArrives: 'Arrives',
    sheetLeaves: 'Leaves',
    notifyCleaner: (name) => `Notify ${name} on WhatsApp`,
    cleanerNotified: 'Cleaner notified',
    noCleaningContact: "No cleaning contact for this property yet — add one in the property's settings (gear icon) to notify them from here.",
    notifyCleanerError: 'Could not notify the cleaner.',
    sheetLengthOfStay: 'Length of stay',
    sheetGuests: 'Guests',
    timingRequestsTitle: 'Timing requests',
    timingRequestsSubtitle: 'Flag an early arrival or a late departure so cleaning is scheduled around it.',
    earlyCheckIn: 'Early check-in',
    arrivingBefore: (time) => `Arriving before ${time}`,
    arrivingBeforeUsual: 'Arriving before the usual time',
    lateCheckout: 'Late checkout',
    leavingAfterUsual: 'Leaving after the usual checkout time',
    note: (text) => `Note: ${text}`,
    messageGuestWhatsApp: 'Message guest on WhatsApp',
    copiedExclaim: 'Copied!',
    copyCheckInLink: 'Copy check-in link',
    opening: 'Opening…',
    shareViaWhatsApp: 'Share via WhatsApp',
    openProperty: 'Open property',
    turnaround: 'Turnaround',
    departingGuests: 'Departing guests',
    lateCheckoutRequested: 'Late checkout requested',
    yes: 'Yes',
    nextGuestSameDay: 'Next guest — same day',
    arrivingGuests: 'Arriving guests',
    earlyCheckInRequested: 'Early check-in requested',
    afterThisCheckout: 'After this checkout',
    checkingWhatsNext: "Checking what's next…",
    nextGuestArrives: 'Next guest arrives',
    blockedAfterCheckout: 'Blocked after checkout',
    nothingBookedYet: 'Nothing booked yet — stays Ready once cleaned.',
    requestCleaningForTurnover: 'Request cleaning for this turnover',
    openPropertyCalendar: "Open this property's calendar",
    checkInShareMessage: (propertyName, arriving, url) =>
      `Hi! Please complete your online check-in for ${propertyName}, arriving ${arriving}: ${url}`,
  },
  sourceLabel: {
    AIRBNB: 'Airbnb',
    BOOKING_COM: 'Booking.com',
    DIRECT: 'Direct',
    MANUAL: 'Offline',
  },
  guestStayStatus: {
    PENDING: 'Awaiting online check-in',
    SUBMITTED: 'Check-in complete',
    EXPIRED: 'Check-in link expired',
  },
  calendarHost: {
    nextTwoWeeks: (n) => (n === 0 ? 'Next 2 weeks · nothing booked' : `Next 2 weeks · ${n} night${n === 1 ? '' : 's'} booked`),
    title: 'Calendar',
    allProperties: 'All properties',
    viewListings: 'Listings',
    viewCalendar: 'Calendar',
    legendCleaning: 'Cleaning',
    legendGuestStay: 'Guest stay',
    legendBlocked: 'Blocked',
    tapForDetails: 'Tap a booking for details',
    dayEmpty: 'Nothing booked or planned on this day.',
    noPropertiesToShow: 'No properties to show.',
    airbnbBadge: 'Airbnb',
    nightsCount: (n) => `${n} night${n === 1 ? '' : 's'}`,
    errorLoad: 'Could not load the calendar.',
    errorCreateCheckIn: 'Could not create a check-in link for this reservation.',
    errorUpdateReservation: 'Could not update this reservation.',
    errorSaveRate: 'Could not save this rate.',
    bookingCreatedLinkCopied: 'Booking created — link copied',
    checkInLinkCreatedCopied: 'Check-in link created and copied',
    checkInLinkCopied: 'Check-in link copied',
    bookedAtRate: (rate) => `Booked at ${rate} MAD/night`,
    markedRealBooking: 'Marked as a real booking',
    savedRate: (rate) => `Saved — ${rate} MAD/night`,
    rateCleared: 'Rate cleared — using the property default',
    copiedExclaim: 'Copied!',
    copyCheckInLink: 'Copy check-in link',
    shareViaWhatsApp: 'Share via WhatsApp',
    blockedOnPrefix: 'Blocked on',
    platformPrefix: 'Platform:',
    confirmedStatus: 'Confirmed',
    ratePerNightLabel: 'Rate per night (MAD) — optional',
    ratePerNightHint: "Sets what this night earns in your reports. Leave blank and save to fall back to the property's default rate.",
    savingEllipsis: 'Saving…',
    savePrice: 'Save price',
    guestsOptionalLabel: 'Number of guests — optional',
    guestsOptionalHint: 'How many people the guest can register on the check-in form. Defaults to 1.',
    workingEllipsis: 'Working…',
    confirmRealBookingCreateLink: 'This is a real booking — create check-in link',
    createCheckInLink: 'Create check-in link',
    markBookedNoLink: 'Mark as booked (no guest link)',
    viewBooking: 'View booking',
    viewProperty: 'View property',
    close: 'Close',
    addSheetTitle: 'Add',
    addCleaning: 'Add cleaning',
    addCleaningSubtitle: 'Request a cleaning or maintenance visit',
    guestOnlineCheckIn: 'Guest online check-in',
    guestOnlineCheckInSubtitle: 'Generate a check-in link for a guest stay',
    checkInShareMessage: (propertyName, url) => `Hi! Please complete your online check-in for ${propertyName} here: ${url}`,
  },
  propertiesList: {
    title: 'Properties',
    listedCount: (n) => `${n} listed`,
    airbnbButton: 'Airbnb',
    errorLoad: 'Could not load your properties.',
    emptyMessage: 'No properties yet.',
    addFirstProperty: 'Add your first property',
    airbnbBadge: 'Airbnb',
    bedBathGuests: (bed, bath, guests) => `${bed} bed · ${bath} bath · up to ${guests} guests`,
    ratePerNight: (rate, currency) => `${rate} ${currency} / night`,
  },
  propertyDetail: {
    addCoverPhoto: 'Add a cover photo',
    changeCoverPhoto: 'Change photo',
    uploadingPhoto: 'Uploading…',
    addPhoto: 'Add',
    doorPhotosEmpty: 'Photos of the door or entrance. Guests get them with their access details.',
    doorPhotosHint: 'Press and hold a photo to remove it.',
    deleteDoorPhotoTitle: 'Remove this photo?',
    deleteDoorPhotoMessage: 'Guests will no longer get it with their access details.',
    deleteDoorPhotoConfirm: 'Remove',
    errorPhotoAccess: 'ReadyDar needs access to your photos. You can allow it in your phone settings.',
    errorUploadPhoto: 'Could not save the photo. Please try again.',
    headerBack: 'Back',
    errorLoad: 'Could not load this property.',
    errorSetStatus: 'Could not change the status.',
    errorMarkReady: 'Could not update the property.',
    errorPreview: 'Could not load the message preview.',
    errorSendWelcome: 'Could not send the welcome message.',
    errorOpenWhatsApp: 'Could not open WhatsApp.',
    errorOpenIdPhoto: 'Could not open that ID photo.',
    errorDeleteCheckIn: 'Could not delete that check-in link.',
    errorDownloadPdf: 'Could not download the PDF. Please try again.',
    errorDownloadContract: 'Could not download the contract. Please try again.',
    syncNotice: 'Imported from Airbnb — name, address, and room counts sync automatically. Edit those on Airbnb, not here.',
    statusLabel: 'Status',
    statusAuto: "Set by you — it won't change on its own. Tap to go back to automatic.",
    statusWorkingItOut: 'Working itself out from bookings and cleanings.',
    requestCleaning: 'Request a cleaning',
    markReady: 'Mark ready',
    logExpense: 'Log an expense for this property',
    cleaningReports: 'Cleaning reports',
    guestCheckIns: 'Guest check-ins',
    noCheckInsYet: "No check-in links yet. Add one to collect the guest's arrival details and ID before you meet them.",
    guestFallback: 'Guest',
    createdFromAirbnb: "Created automatically from an Airbnb booking — share the link below to collect the guest's details.",
    phoneLabel: (phone) => `Phone: ${phone}`,
    nationalityIdLine: (nationality, idType, idNumber) => `${nationality} · ${idType} ${idNumber}`,
    passport: 'Passport',
    nationalId: 'National ID',
    idPhoto: 'ID photo',
    idPhotos: 'ID photos',
    viewId: 'View ID',
    openingEllipsis: 'Opening…',
    downloadCheckInPdf: 'Download check-in PDF',
    preparingPdf: 'Preparing PDF…',
    downloadContract: 'Download signed contract',
    preparingContract: 'Preparing contract…',
    welcomeMessageSent: 'Welcome message sent',
    openWhatsAppWelcomeReady: 'Open WhatsApp — welcome message ready',
    hideWelcomeMessage: 'Hide welcome message',
    sendWelcomeMessage: 'Send welcome message',
    loadingPreview: 'Loading preview…',
    messageEditLabel: 'Message (edit if needed)',
    sendingEllipsis: 'Sending…',
    sendViaWhatsApp: 'Send via WhatsApp',
    messageGuestWhatsApp: 'Message guest on WhatsApp',
    shareViaWhatsApp: 'Share via WhatsApp',
    deletingEllipsis: 'Deleting…',
    deleteThisLink: 'Delete this link',
    checkInStatusShort: { PENDING: 'Waiting', SUBMITTED: 'Checked in', EXPIRED: 'Expired' },
    newCheckInLink: 'New link',
    shareLink: 'Share link',
    whatsappGuest: 'WhatsApp guest',
    contractPdf: 'Signed contract',
    checkInPdf: 'Check-in PDF',
    deleteCheckInTitle: 'Delete check-in link?',
    deleteCheckInMessage: (label) => `The link for ${label} will stop working and can't be recovered. The guest hasn't submitted anything yet, so no guest details are lost.`,
    checkInOutTitle: 'Check-in / check-out',
    checkInOutLine: (checkIn, checkOut) => `Check-in ${checkIn} · Check-out ${checkOut}`,
    accessDetailsTitle: 'Access details',
    unitApartment: (value) => `Unit / apartment: ${value}`,
    gateCode: (value) => `Gate code: ${value}`,
    doorCode: (value) => `Door code: ${value}`,
    wifiTitle: 'Wifi',
    houseRulesTitle: 'House rules',
    doorPhotosTitle: 'Door / access photos',
    automationSettings: 'Automation settings',
    icalNotice: 'Calendar (iCal) links are managed from the ReadyDar website for now.',
    checkInShareMessage: (propertyName, arriving, url) => `Hi! Please complete your online check-in${propertyName ? ` for ${propertyName}` : ''}, arriving ${arriving}: ${url}`,
  },
  bookingsList: {
    headerBack: 'More',
    pageTitle: 'All bookings',
    title: 'Bookings',
    subtitle: 'Across all your properties',
    errorLoad: 'Could not load your bookings.',
    emptyMessage: 'No bookings yet.',
    actionLabel: 'Request a cleaning or service',
    urgent: 'Urgent',
  },
  guestsList: {
    headerBack: 'Back',
    title: 'Guests',
    subtitle: 'Every guest check-in, grouped by what still needs doing and then by month.',
    errorLoad: 'Could not load guest check-ins.',
    emptyMessage: "No guest check-ins yet. They'll show up here as soon as you create a check-in link for a property.",
    emptyAction: "Start a guest's online check-in from a property",
    sectionUpcomingTitle: 'Upcoming',
    sectionUpcomingSubtitle: 'Links still waiting on the guest',
    sectionSubmittedTitle: 'Submitted by guest',
    sectionSubmittedSubtitle: 'Details received — ID, contract and PDF on the property page',
    sectionExpiredTitle: 'Expired',
    sectionExpiredSubtitle: 'The stay has passed and the link no longer works',
    nothingHere: 'Nothing here.',
    copyLink: 'Copy link',
    copiedExclaim: 'Copied!',
    checkInLinkCopiedToast: 'Check-in link copied',
    checkInLinkDeletedToast: 'Check-in link deleted',
    deleteCheckInMessage: (label, propertyName) => `The link for ${label} at ${propertyName} will stop working and can't be recovered. The guest hasn't submitted anything yet, so no guest details are lost.`,
    viewPropertyLink: 'View ID photo, contract & PDF in property →',
  },
  connectAirbnb: {
    title: 'Connect Airbnb',
    intro: 'Link your Airbnb account once and your listings and reservations come in on their own, instead of being typed in by hand.',
    oneWayNote: 'This goes one way for now, from Airbnb to ReadyDar. Dates you block or stays you add in ReadyDar are not sent to Airbnb.',
    step1Title: 'Connect your Airbnb account',
    step1Body: 'Opens a secure partner page in your browser. Once you have approved access there, come back here and tap "Sync now".',
    connectButton: 'Connect Airbnb account',
    opening: 'Opening…',
    step2Title: 'Import your listings',
    step2Body: 'Brings in each connected Airbnb listing as a property, with its upcoming reservations and the dates you blocked on Airbnb. New bookings also arrive by themselves; tap this when you want them now.',
    syncNow: 'Sync now',
    syncing: 'Syncing…',
    foundOnAirbnb: (n) => `Found on Airbnb (${n})`,
    hide: 'Hide',
    noListings: 'No listings yet. Connect your Airbnb account above first.',
    listingFallback: 'Airbnb listing',
    footer: 'Imported properties carry an "Airbnb" tag on the Properties tab. Their name, address and room counts follow Airbnb, so change those on Airbnb. Each new Airbnb reservation gets its own check-in link, ready to send from the property page.',
    synced: (properties, stays, blocks) => {
      const parts = [
        `${properties} new propert${properties === 1 ? 'y' : 'ies'}`,
        `${stays} new stay${stays === 1 ? '' : 's'}`,
      ];
      if (blocks > 0) parts.push(`${blocks} blocked date range${blocks === 1 ? '' : 's'}`);
      return `Airbnb synced: ${parts.join(', ')}`;
    },
    upToDate: 'Everything is already up to date.',
    errorConnect: 'Could not start the Airbnb connection.',
    errorSync: 'Could not sync with Airbnb. Connect your Airbnb account first.',
  },
  notifications: {
    checkinTitle: (guest) => `${guest} completed their check-in`,
    checkinBody: (property, stay) => `${property} · ${stay}`,
    jobTitle: 'Cleaning still has no cleaner',
    jobBody: (property) => `${property} · scheduled today`,
    turnoverTitle: 'Same-day turnover today',
    turnoverBody: (property) => `${property} · a guest leaves and another arrives`,
    aProperty: 'A property',
    guestFallback: 'Your guest',
    justNow: 'Just now',
    minutesAgo: (n) => `${n}m ago`,
    hoursAgo: (n) => `${n}h ago`,
    yesterday: 'Yesterday',
    daysAgo: (n) => `${n} days ago`,
  },
};

export const fr: Dict = {
  common: {
    privacyPolicy: 'Politique de confidentialité',
    terms: 'Conditions générales',
    retry: 'Réessayer',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    cancel: 'Annuler',
    language: 'Langue',
    appearance: 'Apparence',
    appearanceSystem: 'Système',
    appearanceLight: 'Clair',
    appearanceDark: 'Sombre',
    logOut: 'Se déconnecter',
    error: 'Erreur',
    profile: 'Profil',
    back: 'Retour',
    guestsCount: (n) => `${n} invité${n === 1 ? '' : 's'}`,
    date: 'Date',
    done: 'Terminé',
    previousMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
    pickCheckOut: 'Touchez maintenant le jour du départ',
  },
  days: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  relativeDate: {
    overdue: 'En retard',
    today: "Aujourd'hui",
    tomorrow: 'Demain',
    todayAt: (date) => `Aujourd'hui · ${date}`,
    tomorrowAt: (date) => `Demain · ${date}`,
    yesterdayAt: (date) => `Hier · ${date}`,
    daysAgoAt: (n, date) => `Il y a ${n} jours · ${date}`,
    inDaysAt: (n, date) => `Dans ${n} jours · ${date}`,
    thisMonth: 'Ce mois-ci',
    nextMonth: 'Le mois prochain',
    lastMonth: 'Le mois dernier',
  },
  propertyStatus: {
    READY: 'Prêt pour les voyageurs',
    NEEDS_CLEANING: 'Ménage à faire',
    IN_PROGRESS: 'Ménage en cours',
    OCCUPIED: 'Voyageur sur place',
  },
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
    forgotPassword: 'Mot de passe oublié ?',
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
    termsSuffix: ' et la ',
    privacyLink: 'Politique de confidentialité',
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
  cleanerComingSoon: {
    title: 'Nous ne sommes pas encore disponibles dans votre région',
    body: "La marketplace de nettoyage de ReadyDar n'est pas encore active dans votre région — nous la déployons ville par ville. Nous vous préviendrons dès son lancement près de chez vous.",
    editProfile: 'Modifier le profil',
    logOut: 'Déconnexion',
  },
  marketplaceComingSoon: {
    title: 'La réservation d’un agent de nettoyage arrive bientôt',
    body: "Nous constituons encore notre réseau d'agents de nettoyage vérifiés. Tout le reste de ReadyDar fonctionne normalement — nous vous préviendrons dès que vous pourrez en réserver un ici.",
    back: 'Retour',
  },
  more: {
    sectionOperations: 'Opérations',
    sectionGuests: 'Voyageurs',
    sectionAccount: 'Compte',
    title: 'Plus',
    subtitle: 'Tout le reste, au même endroit.',
    guests: 'Voyageurs',
    guestsDesc: 'Envoyer les messages de bienvenue WhatsApp aux voyageurs enregistrés',
    bookings: 'Toutes les réservations',
    bookingsDesc: 'Toutes les missions de ménage et de maintenance, pour tous les logements',
    turnovers: 'Rotations',
    turnoversDesc: 'Prévenir votre contact ménage après le départ du voyageur',
    cleaningContacts: 'Contacts ménage',
    cleaningContactsDesc: "Votre équipe et les comptes des sociétés de ménage inscrites",
    connectAirbnb: 'Connecter Airbnb',
    connectAirbnbDesc: 'Importer automatiquement vos annonces et réservations',
    contract: 'Contrat de location',
    contractDesc: "Faire signer un contrat aux voyageurs lors de l'enregistrement en ligne",
    profile: 'Profil',
    profileDesc: 'Votre compte, votre téléphone et la déconnexion',
  },
  noAccess: {
    title: "Vous n'avez pas accès à cette page",
    body: "Demandez au propriétaire du compte ou à un gestionnaire si vous en avez besoin.",
    back: 'Retour',
  },
  propertySettings: {
    headerTitle: 'Paramètres du logement',
    subtitle: "Informations d'accès, message de bienvenue et automatisations autour d'un séjour.",
    loadError: 'Impossible de charger ce logement.',
    saveError: "Impossible d'enregistrer ces paramètres.",
    saved: 'Enregistré.',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    pricingTitle: 'Tarif',
    pricingBody: "Le tarif par nuit par défaut de ce logement — utilisé pour les futures réservations et les liens d'enregistrement.",
    nightlyRate: (currency) => `Tarif par nuit (${currency})`,
    nightlyRatePlaceholder: 'ex. 450',
    invalidRate: 'Saisissez un tarif par nuit valide.',
    welcomeTitle: 'Message de bienvenue',
    welcomeBody: "Envoyé au voyageur sur WhatsApp une fois son enregistrement en ligne terminé.",
    welcomeModeLabel: 'Envoi automatique',
    accessTitle: "Informations d'accès",
    accessBody: "Insérées dans le message de bienvenue — et dans le message de rotation envoyé à l'agent de ménage — là où le champ correspondant apparaît. Modifiez le code du portail ici et tous les prochains messages utiliseront le nouveau.",
    gateCode: 'Code du portail',
    doorCode: 'Code de la porte',
    apartmentNumber: "Numéro d'appartement",
    floor: 'Étage',
    mapsLink: 'Lien Google Maps',
    checkInTime: "Heure d'arrivée",
    checkOutTime: 'Heure de départ',
    houseRules: 'Règlement intérieur',
    templateTitle: 'Texte du message',
    templateBody: 'Modifiez le texte lui-même. Les lignes dont les informations sont vides sont retirées automatiquement.',
    templateLabel: 'Message',
    resetTemplate: 'Revenir au texte par défaut',
    variablesHint: 'Champs disponibles :',
    turnoverTitle: 'Alertes de rotation',
    turnoverBody: "Prévenir un contact ménage sur WhatsApp après le départ du voyageur.",
    defaultContact: 'Contact ménage par défaut',
    noContacts: 'Aucun contact ménage pour le moment — ajoutez-en un depuis Plus › Contacts ménage.',
    defaultService: 'Service par défaut (pour les comptes société)',
    modeOff: 'Désactivé',
    modeReview: 'Vérifier avant',
    modeAuto: 'Automatique',
  },
  cleaningReports: {
    upgradeTitle: 'Les rapports de ménage sont une fonctionnalité payante',
    upgradeBody: "La preuve de ménage vérifiée par photo n'est pas incluse dans le plan gratuit. Passez à un plan supérieur pour la débloquer.",
    title: 'Rapports de ménage',
    back: 'Retour',
    loadError: 'Impossible de charger les rapports de ménage.',
    startError: 'Impossible de démarrer un nouveau rapport.',
    emptyMessage: 'Aucun rapport de ménage pour le moment.',
    startAction: 'Démarrer un rapport',
    startedOn: (date: string) => `Démarré le ${date}`,
    titleFallback: 'Rapport de ménage',
    statusInProgress: 'En cours',
    statusCompleted: 'Terminé',
    photoCount: (n: number) => `${n} photo${n === 1 ? '' : 's'}`,
    nextGuest: 'Prochain voyageur',
    guestStay: 'Séjour voyageur',
    checkInAt: (time: string) => `arrivée ${time}`,
    areaLabel: 'Zone',
    areaPlaceholder: 'ex. Cuisine, Salle de bain 1, Chambre 2',
    uploading: 'Envoi…',
    uploadingCount: (n: number) => `Envoi de ${n} photo${n === 1 ? '' : 's'}…`,
    takePhoto: 'Prendre une photo',
    burstHint: "L'appareil photo se rouvre après chaque photo pour en prendre plusieurs de cette zone. Appuyez sur retour quand vous avez terminé.",
    noPhotosYet: 'Aucune photo pour le moment — appuyez sur « Prendre une photo » ci-dessus pour commencer.',
    nameAreaTitle: 'Nommez cette zone',
    nameAreaBody: 'Indiquez de quelle zone il s’agit (ex. Cuisine) avant de prendre la photo.',
    locationNeededTitle: 'Localisation requise',
    locationNeededBody:
      'Ce rapport a besoin de votre position pour vérifier que la photo a été prise dans le logement. Activez la localisation et réessayez.',
    clockDriftWarning: "L'horloge de l'appareil semble décalée sur cette photo — vous devriez peut-être la reprendre.",
    uploadError: "Impossible d'envoyer cette photo.",
    removeTitle: 'Supprimer cette photo ?',
    removeBody: 'Cette action est irréversible.',
    cancel: 'Annuler',
    remove: 'Supprimer',
    removeError: 'Impossible de supprimer cette photo.',
    completing: 'Finalisation…',
    markComplete: 'Marquer le rapport comme terminé',
    completeSuccess: 'Rapport terminé',
    completeError: 'Impossible de finaliser ce rapport.',
    verification: 'Vérification',
    verificationBody:
      "Partagez ce lien avec Airbnb ou le voyageur pour confirmer de façon indépendante l'authenticité de ce rapport.",
    copied: 'Copié',
    copyLink: 'Copier le lien',
    linkCopied: 'Lien de vérification copié',
    share: 'Partager',
    preparingPdf: 'Préparation du PDF…',
    exportPdf: 'Exporter en PDF',
    pdfError: 'Impossible de générer le PDF. Veuillez réessayer.',
  },
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
    checkInDate: 'Arrivée',
    checkOutDate: 'Départ',
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
    dateFormatLabel: 'Autre date',
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
  dashboardHost: {
    statArrivingToday: "Arrivées aujourd'hui",
    statLeavingTomorrow: 'Départs demain',
    statToClean: 'À nettoyer',
    unitShort: (unit) => `Appt ${unit}`,
    greeting: (name) => `Bonjour ${name}`,
    greetingFallback: 'Vos logements',
    subtitle: 'Voici ce qui se passe sur vos logements.',
    emptyTitle: 'Ajoutez votre premier logement',
    emptySubtitle: 'Une fois ajouté, vous pourrez envoyer des liens de check-in et suivre les rotations ici.',
    addProperty: 'Ajouter un logement',
    quickRequestCleaning: 'Demander un ménage',
    quickGuestCheckIn: 'Check-in voyageur',
    nextCheckIns: 'Prochaines arrivées',
    nextCheckInsSubtitle: 'Voyageurs arrivant bientôt · liens de check-in prêts',
    viewAll: 'Tout voir',
    noArrivalsSoon: 'Aucune arrivée dans les prochains jours.',
    noGuestsWaiting: "Aucun voyageur en attente de check-in.",
    guestFallback: 'Voyageur',
    checkInAt: (time) => `Arrivée ${time}`,
    checkInLinkReady: 'Lien de check-in prêt',
    copied: 'Copié',
    copyLink: 'Copier le lien',
    moreArrivingSoon: (n) => `${n} de plus bientôt`,
    hiddenCheckIns: (n) => `${n} check-in masqué${n === 1 ? '' : 's'} · afficher`,
    hiddenFromHome: "Masqué de l'accueil",
    hiddenRestored: 'Check-ins masqués restaurés',
    tomorrowCheckouts: 'Départs de demain',
    tomorrowCheckoutsSubtitle: 'Voyageurs partant demain — les rotations le jour même sont signalées',
    noCheckoutsTomorrow: 'Aucun départ prévu demain.',
    sameDayTurnover: 'Rotation le jour même',
    checkoutTag: 'Départ',
    moreCheckingOut: (n) => `${n} départs de plus`,
    allApartments: 'Tous les logements',
    allApartmentsSubtitle: 'Le statut de chaque logement',
    allStatuses: (n) => `Tous les statuts · ${n}`,
    noPropertiesWithStatus: 'Aucun logement avec ce statut.',
    markReadyHint: 'Ménage fait vous-même ? Marquez-le prêt :',
    markedReady: (name) => `${name} marqué prêt`,
    errorLoad: 'Impossible de charger votre tableau de bord.',
    errorUpdateProperty: 'Impossible de mettre à jour le logement.',
    errorTiming: 'Impossible d\'enregistrer cette demande d\'horaire.',
    errorGuestCount: 'Impossible de mettre à jour le nombre de voyageurs.',
    checkInLinkCopied: 'Lien de check-in copié',
    notifications: 'Notifications',
    markAllRead: 'Tout marquer comme lu',
    notificationsEmpty: 'Rien de nouveau. Vous le verrez ici quand un voyageur termine son check-in.',
    sheetPropertyStatus: 'Statut du logement',
    sheetArrives: 'Arrivée',
    sheetLeaves: 'Départ',
    notifyCleaner: (name) => `Prévenir ${name} sur WhatsApp`,
    cleanerNotified: 'Agent de ménage prévenu',
    noCleaningContact: "Aucun contact de ménage pour ce logement — ajoutez-en un dans les paramètres du logement (icône engrenage) pour le prévenir d'ici.",
    notifyCleanerError: "Impossible de prévenir l'agent de ménage.",
    sheetLengthOfStay: 'Durée du séjour',
    sheetGuests: 'Voyageurs',
    timingRequestsTitle: "Demandes d'horaire",
    timingRequestsSubtitle: 'Signalez une arrivée anticipée ou un départ tardif pour organiser le ménage en conséquence.',
    earlyCheckIn: 'Arrivée anticipée',
    arrivingBefore: (time) => `Arrivée avant ${time}`,
    arrivingBeforeUsual: "Arrivée avant l'heure habituelle",
    lateCheckout: 'Départ tardif',
    leavingAfterUsual: "Départ après l'heure habituelle",
    note: (text) => `Note : ${text}`,
    messageGuestWhatsApp: 'Message au voyageur sur WhatsApp',
    copiedExclaim: 'Copié !',
    copyCheckInLink: 'Copier le lien de check-in',
    opening: 'Ouverture…',
    shareViaWhatsApp: 'Partager via WhatsApp',
    openProperty: 'Ouvrir le logement',
    turnaround: 'Rotation',
    departingGuests: 'Voyageurs en départ',
    lateCheckoutRequested: 'Départ tardif demandé',
    yes: 'Oui',
    nextGuestSameDay: 'Prochain voyageur — même jour',
    arrivingGuests: 'Voyageurs arrivants',
    earlyCheckInRequested: 'Arrivée anticipée demandée',
    afterThisCheckout: 'Après ce départ',
    checkingWhatsNext: 'Vérification de la suite…',
    nextGuestArrives: 'Prochain voyageur arrive',
    blockedAfterCheckout: 'Bloqué après le départ',
    nothingBookedYet: "Rien de réservé pour l'instant — reste prêt une fois nettoyé.",
    requestCleaningForTurnover: 'Demander un ménage pour cette rotation',
    openPropertyCalendar: 'Ouvrir le calendrier de ce logement',
    checkInShareMessage: (propertyName, arriving, url) =>
      `Bonjour ! Merci de compléter votre check-in en ligne pour ${propertyName}, arrivée ${arriving} : ${url}`,
  },
  sourceLabel: {
    AIRBNB: 'Airbnb',
    BOOKING_COM: 'Booking.com',
    DIRECT: 'Direct',
    MANUAL: 'Hors ligne',
  },
  guestStayStatus: {
    PENDING: 'En attente de check-in en ligne',
    SUBMITTED: 'Check-in terminé',
    EXPIRED: 'Lien de check-in expiré',
  },
  calendarHost: {
    nextTwoWeeks: (n) => (n === 0 ? '2 prochaines semaines · rien de réservé' : `2 prochaines semaines · ${n} nuit${n === 1 ? '' : 's'} réservée${n === 1 ? '' : 's'}`),
    title: 'Calendrier',
    allProperties: 'Tous les logements',
    viewListings: 'Logements',
    viewCalendar: 'Calendrier',
    legendCleaning: 'Ménage',
    legendGuestStay: 'Séjour',
    legendBlocked: 'Bloqué',
    tapForDetails: 'Touchez une réservation pour les détails',
    dayEmpty: 'Aucune réservation ni intervention ce jour-là.',
    noPropertiesToShow: 'Aucun logement à afficher.',
    airbnbBadge: 'Airbnb',
    nightsCount: (n) => `${n} nuit${n === 1 ? '' : 's'}`,
    errorLoad: 'Impossible de charger le calendrier.',
    errorCreateCheckIn: 'Impossible de créer un lien de check-in pour cette réservation.',
    errorUpdateReservation: 'Impossible de mettre à jour cette réservation.',
    errorSaveRate: 'Impossible d\'enregistrer ce tarif.',
    bookingCreatedLinkCopied: 'Réservation créée — lien copié',
    checkInLinkCreatedCopied: 'Lien de check-in créé et copié',
    checkInLinkCopied: 'Lien de check-in copié',
    bookedAtRate: (rate) => `Réservé à ${rate} MAD/nuit`,
    markedRealBooking: 'Marqué comme réservation réelle',
    savedRate: (rate) => `Enregistré — ${rate} MAD/nuit`,
    rateCleared: 'Tarif effacé — utilisation du tarif par défaut du logement',
    copiedExclaim: 'Copié !',
    copyCheckInLink: 'Copier le lien de check-in',
    shareViaWhatsApp: 'Partager via WhatsApp',
    blockedOnPrefix: 'Bloqué sur',
    platformPrefix: 'Plateforme :',
    confirmedStatus: 'Confirmé',
    ratePerNightLabel: 'Tarif par nuit (MAD) — optionnel',
    ratePerNightHint: 'Définit ce que cette nuit rapporte dans vos rapports. Laissez vide et enregistrez pour revenir au tarif par défaut du logement.',
    savingEllipsis: 'Enregistrement…',
    savePrice: 'Enregistrer le prix',
    guestsOptionalLabel: 'Nombre de voyageurs — optionnel',
    guestsOptionalHint: 'Combien de personnes le voyageur peut inscrire sur le formulaire de check-in. Par défaut : 1.',
    workingEllipsis: 'En cours…',
    confirmRealBookingCreateLink: 'Ceci est une vraie réservation — créer le lien de check-in',
    createCheckInLink: 'Créer le lien de check-in',
    markBookedNoLink: 'Marquer comme réservé (sans lien voyageur)',
    viewBooking: 'Voir la réservation',
    viewProperty: 'Voir le logement',
    close: 'Fermer',
    addSheetTitle: 'Ajouter',
    addCleaning: 'Ajouter un ménage',
    addCleaningSubtitle: 'Demander un ménage ou une visite de maintenance',
    guestOnlineCheckIn: 'Check-in voyageur en ligne',
    guestOnlineCheckInSubtitle: 'Générer un lien de check-in pour un séjour',
    checkInShareMessage: (propertyName, url) => `Bonjour ! Merci de compléter votre check-in en ligne pour ${propertyName} ici : ${url}`,
  },
  propertiesList: {
    title: 'Logements',
    listedCount: (n) => `${n} publié${n === 1 ? '' : 's'}`,
    airbnbButton: 'Airbnb',
    errorLoad: 'Impossible de charger vos logements.',
    emptyMessage: 'Aucun logement pour le moment.',
    addFirstProperty: 'Ajoutez votre premier logement',
    airbnbBadge: 'Airbnb',
    bedBathGuests: (bed, bath, guests) => `${bed} chambre(s) · ${bath} sdb · jusqu'à ${guests} voyageurs`,
    ratePerNight: (rate, currency) => `${rate} ${currency} / nuit`,
  },
  propertyDetail: {
    addCoverPhoto: 'Ajouter une photo de couverture',
    changeCoverPhoto: 'Changer la photo',
    uploadingPhoto: 'Envoi…',
    addPhoto: 'Ajouter',
    doorPhotosEmpty: "Photos de la porte ou de l'entrée. Les voyageurs les reçoivent avec leurs informations d'accès.",
    doorPhotosHint: 'Appuyez longuement sur une photo pour la retirer.',
    deleteDoorPhotoTitle: 'Retirer cette photo ?',
    deleteDoorPhotoMessage: "Les voyageurs ne la recevront plus avec leurs informations d'accès.",
    deleteDoorPhotoConfirm: 'Retirer',
    errorPhotoAccess: "ReadyDar a besoin d'accéder à vos photos. Vous pouvez l'autoriser dans les réglages du téléphone.",
    errorUploadPhoto: "Impossible d'enregistrer la photo. Réessayez.",
    headerBack: 'Retour',
    errorLoad: 'Impossible de charger ce logement.',
    errorSetStatus: 'Impossible de modifier le statut.',
    errorMarkReady: 'Impossible de mettre à jour le logement.',
    errorPreview: "Impossible de charger l'aperçu du message.",
    errorSendWelcome: "Impossible d'envoyer le message de bienvenue.",
    errorOpenWhatsApp: "Impossible d'ouvrir WhatsApp.",
    errorOpenIdPhoto: "Impossible d'ouvrir cette photo d'identité.",
    errorDeleteCheckIn: 'Impossible de supprimer ce lien de check-in.',
    errorDownloadPdf: 'Impossible de télécharger le PDF. Veuillez réessayer.',
    errorDownloadContract: 'Impossible de télécharger le contrat. Veuillez réessayer.',
    syncNotice: "Importé depuis Airbnb — le nom, l'adresse et le nombre de pièces se synchronisent automatiquement. Modifiez-les sur Airbnb, pas ici.",
    statusLabel: 'Statut',
    statusAuto: "Défini par vous — il ne changera pas tout seul. Touchez pour revenir en automatique.",
    statusWorkingItOut: 'Déterminé automatiquement à partir des réservations et des ménages.',
    requestCleaning: 'Demander un ménage',
    markReady: 'Marquer comme prêt',
    logExpense: 'Enregistrer une dépense pour ce logement',
    cleaningReports: 'Rapports de ménage',
    guestCheckIns: 'Check-ins des voyageurs',
    noCheckInsYet: "Aucun lien de check-in pour le moment. Ajoutez-en un pour recueillir les détails d'arrivée et la pièce d'identité du voyageur avant de le rencontrer.",
    guestFallback: 'Voyageur',
    createdFromAirbnb: 'Créé automatiquement à partir d\'une réservation Airbnb — partagez le lien ci-dessous pour recueillir les détails du voyageur.',
    phoneLabel: (phone) => `Téléphone : ${phone}`,
    nationalityIdLine: (nationality, idType, idNumber) => `${nationality} · ${idType} ${idNumber}`,
    passport: 'Passeport',
    nationalId: "Carte d'identité",
    idPhoto: "Photo d'identité",
    idPhotos: "Photos d'identité",
    viewId: "Voir la pièce d'identité",
    openingEllipsis: 'Ouverture…',
    downloadCheckInPdf: 'Télécharger le PDF de check-in',
    preparingPdf: 'Préparation du PDF…',
    downloadContract: 'Télécharger le contrat signé',
    preparingContract: 'Préparation du contrat…',
    welcomeMessageSent: 'Message de bienvenue envoyé',
    openWhatsAppWelcomeReady: 'Ouvrir WhatsApp — message de bienvenue prêt',
    hideWelcomeMessage: 'Masquer le message de bienvenue',
    sendWelcomeMessage: 'Envoyer un message de bienvenue',
    loadingPreview: "Chargement de l'aperçu…",
    messageEditLabel: 'Message (modifiez si besoin)',
    sendingEllipsis: 'Envoi…',
    sendViaWhatsApp: 'Envoyer via WhatsApp',
    messageGuestWhatsApp: 'Envoyer un message au voyageur sur WhatsApp',
    shareViaWhatsApp: 'Partager via WhatsApp',
    deletingEllipsis: 'Suppression…',
    deleteThisLink: 'Supprimer ce lien',
    checkInStatusShort: { PENDING: 'En attente', SUBMITTED: 'Enregistré', EXPIRED: 'Expiré' },
    newCheckInLink: 'Nouveau lien',
    shareLink: 'Partager le lien',
    whatsappGuest: 'WhatsApp au voyageur',
    contractPdf: 'Contrat signé',
    checkInPdf: 'PDF du check-in',
    deleteCheckInTitle: 'Supprimer le lien de check-in ?',
    deleteCheckInMessage: (label) => `Le lien de ${label} cessera de fonctionner et ne pourra pas être récupéré. Le voyageur n'a encore rien soumis, aucune donnée n'est donc perdue.`,
    checkInOutTitle: 'Arrivée / départ',
    checkInOutLine: (checkIn, checkOut) => `Arrivée ${checkIn} · Départ ${checkOut}`,
    accessDetailsTitle: "Détails d'accès",
    unitApartment: (value) => `Unité / appartement : ${value}`,
    gateCode: (value) => `Code du portail : ${value}`,
    doorCode: (value) => `Code de la porte : ${value}`,
    wifiTitle: 'Wifi',
    houseRulesTitle: 'Règlement intérieur',
    doorPhotosTitle: "Photos d'accès / porte",
    automationSettings: "Paramètres d'automatisation",
    icalNotice: 'Les liens de calendrier (iCal) se gèrent depuis le site ReadyDar pour le moment.',
    checkInShareMessage: (propertyName, arriving, url) => `Bonjour ! Merci de compléter votre check-in en ligne${propertyName ? ` pour ${propertyName}` : ''}, arrivée ${arriving} : ${url}`,
  },
  bookingsList: {
    headerBack: 'Plus',
    pageTitle: 'Toutes les réservations',
    title: 'Réservations',
    subtitle: 'Sur tous vos logements',
    errorLoad: 'Impossible de charger vos réservations.',
    emptyMessage: 'Aucune réservation pour le moment.',
    actionLabel: 'Demander un ménage ou un service',
    urgent: 'Urgent',
  },
  guestsList: {
    headerBack: 'Retour',
    title: 'Voyageurs',
    subtitle: 'Chaque check-in de voyageur, regroupé par ce qui reste à faire puis par mois.',
    errorLoad: 'Impossible de charger les check-ins des voyageurs.',
    emptyMessage: "Aucun check-in de voyageur pour le moment. Ils apparaîtront ici dès que vous créerez un lien de check-in pour un logement.",
    emptyAction: "Démarrer le check-in en ligne d'un voyageur depuis un logement",
    sectionUpcomingTitle: 'À venir',
    sectionUpcomingSubtitle: 'Liens encore en attente du voyageur',
    sectionSubmittedTitle: 'Soumis par le voyageur',
    sectionSubmittedSubtitle: 'Détails reçus — pièce d\'identité, contrat et PDF sur la page du logement',
    sectionExpiredTitle: 'Expiré',
    sectionExpiredSubtitle: 'Le séjour est passé et le lien ne fonctionne plus',
    nothingHere: 'Rien ici.',
    copyLink: 'Copier le lien',
    copiedExclaim: 'Copié !',
    checkInLinkCopiedToast: 'Lien de check-in copié',
    checkInLinkDeletedToast: 'Lien de check-in supprimé',
    deleteCheckInMessage: (label, propertyName) => `Le lien de ${label} à ${propertyName} cessera de fonctionner et ne pourra pas être récupéré. Le voyageur n'a encore rien soumis, aucune donnée n'est donc perdue.`,
    viewPropertyLink: "Voir la pièce d'identité, le contrat et le PDF dans le logement →",
  },
  connectAirbnb: {
    title: 'Connecter Airbnb',
    intro: 'Reliez votre compte Airbnb une fois : vos annonces et réservations arrivent toutes seules, sans saisie à la main.',
    oneWayNote: "Pour l'instant, cela va dans un seul sens, d'Airbnb vers ReadyDar. Les dates bloquées ou les séjours ajoutés dans ReadyDar ne sont pas envoyés à Airbnb.",
    step1Title: 'Connectez votre compte Airbnb',
    step1Body: "Ouvre une page partenaire sécurisée dans votre navigateur. Une fois l'accès autorisé, revenez ici et touchez « Synchroniser ».",
    connectButton: 'Connecter le compte Airbnb',
    opening: 'Ouverture…',
    step2Title: 'Importez vos annonces',
    step2Body: "Importe chaque annonce Airbnb connectée comme propriété, avec ses réservations à venir et les dates bloquées sur Airbnb. Les nouvelles réservations arrivent aussi d'elles-mêmes ; touchez ici pour les avoir tout de suite.",
    syncNow: 'Synchroniser',
    syncing: 'Synchronisation…',
    foundOnAirbnb: (n) => `Trouvé sur Airbnb (${n})`,
    hide: 'Masquer',
    noListings: "Aucune annonce pour l'instant. Connectez d'abord votre compte Airbnb ci-dessus.",
    listingFallback: 'Annonce Airbnb',
    footer: "Les propriétés importées portent l'étiquette « Airbnb » dans l'onglet Propriétés. Leur nom, adresse et nombre de pièces suivent Airbnb : modifiez-les sur Airbnb. Chaque nouvelle réservation Airbnb reçoit son lien de check-in, prêt à envoyer depuis la page de la propriété.",
    synced: (properties, stays, blocks) => {
      const parts = [
        `${properties} nouvelle${properties === 1 ? '' : 's'} propriété${properties === 1 ? '' : 's'}`,
        `${stays} nouveau${stays === 1 ? '' : 'x'} séjour${stays === 1 ? '' : 's'}`,
      ];
      if (blocks > 0) parts.push(`${blocks} période${blocks === 1 ? '' : 's'} bloquée${blocks === 1 ? '' : 's'}`);
      return `Airbnb synchronisé : ${parts.join(', ')}`;
    },
    upToDate: 'Tout est déjà à jour.',
    errorConnect: 'Impossible de lancer la connexion Airbnb.',
    errorSync: "Impossible de synchroniser avec Airbnb. Connectez d'abord votre compte Airbnb.",
  },
  notifications: {
    checkinTitle: (guest) => `${guest} a terminé son check-in`,
    checkinBody: (property, stay) => `${property} · ${stay}`,
    jobTitle: 'Un ménage n\'a toujours pas de personnel affecté',
    jobBody: (property) => `${property} · prévu aujourd'hui`,
    turnoverTitle: 'Rotation le jour même aujourd\'hui',
    turnoverBody: (property) => `${property} · un voyageur part et un autre arrive`,
    aProperty: 'Un logement',
    guestFallback: 'Votre voyageur',
    justNow: 'À l\'instant',
    minutesAgo: (n) => `il y a ${n} min`,
    hoursAgo: (n) => `il y a ${n} h`,
    yesterday: 'Hier',
    daysAgo: (n) => `il y a ${n} jours`,
  },
};

/**
 * Arabic pluralises across four bands, not the singular/plural pair English
 * and French use: 1, 2 (a distinct dual form), 3–10 (the "plural of
 * paucity"), and 11+ (which takes the singular noun again). The two-branch
 * `n === 1 ? x : y` pattern the en/fr blocks use therefore produces visibly
 * wrong Arabic for every count from 2 to 10 — which is most of the counts
 * this app actually displays. Callers that need a prefix ("قبل…", "خلال…")
 * spell the bands out inline instead, since the prefix has to agree too.
 */
function arPlural(n: number, forms: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return `${n} ${forms.few}`;
  return `${n} ${forms.many}`;
}

export const ar: Dict = {
  common: {
    privacyPolicy: 'سياسة الخصوصية',
    terms: 'الشروط والأحكام',
    retry: 'إعادة المحاولة',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    language: 'اللغة',
    appearance: 'المظهر',
    appearanceSystem: 'النظام',
    appearanceLight: 'فاتح',
    appearanceDark: 'داكن',
    logOut: 'تسجيل الخروج',
    error: 'خطأ',
    profile: 'الملف الشخصي',
    back: 'رجوع',
    guestsCount: (n) => arPlural(n, { one: 'ضيف واحد', two: 'ضيفان', few: 'ضيوف', many: 'ضيفًا' }),
    date: 'التاريخ',
    done: 'تم',
    previousMonth: 'الشهر السابق',
    nextMonth: 'الشهر التالي',
    pickCheckOut: 'اختر الآن يوم المغادرة',
  },
  // Arabic weekday names carry the definite article — bare «أحد» isn't the
  // day at all, it's the word for "someone", and the rest read like loose
  // nouns rather than days.
  days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  relativeDate: {
    overdue: 'متأخر',
    today: 'اليوم',
    tomorrow: 'غدًا',
    todayAt: (date) => `اليوم · ${date}`,
    tomorrowAt: (date) => `غدًا · ${date}`,
    yesterdayAt: (date) => `أمس · ${date}`,
    daysAgoAt: (n, date) =>
      `${n === 1 ? 'قبل يوم' : n === 2 ? 'قبل يومين' : n <= 10 ? `قبل ${n} أيام` : `قبل ${n} يومًا`} · ${date}`,
    inDaysAt: (n, date) =>
      `${n === 1 ? 'خلال يوم' : n === 2 ? 'خلال يومين' : n <= 10 ? `خلال ${n} أيام` : `خلال ${n} يومًا`} · ${date}`,
    thisMonth: 'هذا الشهر',
    nextMonth: 'الشهر القادم',
    lastMonth: 'الشهر الماضي',
  },
  propertyStatus: {
    READY: 'جاهز للضيوف',
    NEEDS_CLEANING: 'يحتاج تنظيف',
    IN_PROGRESS: 'جارٍ التنظيف',
    OCCUPIED: 'ضيف مقيم',
  },
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
    forgotPassword: 'نسيت كلمة المرور؟',
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
    termsSuffix: ' و',
    privacyLink: 'سياسة الخصوصية',
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
  cleanerComingSoon: {
    title: 'لسنا متاحين في منطقتك بعد',
    body: 'سوق التنظيف الخاص بـ ReadyDar غير متاح بعد في منطقتك — نقوم بإطلاقه مدينة تلو الأخرى. سنعلمك فور انطلاقه بالقرب منك.',
    editProfile: 'تعديل الملف الشخصي',
    logOut: 'تسجيل الخروج',
  },
  marketplaceComingSoon: {
    title: 'حجز عامل تنظيف قريبًا',
    body: 'ما زلنا نبني شبكتنا من عمال التنظيف الموثّقين. تعمل بقية خدمات ReadyDar بشكل طبيعي — وسنعلمك فور إتاحة الحجز من هنا.',
    back: 'رجوع',
  },
  more: {
    sectionOperations: 'العمليات',
    sectionGuests: 'الضيوف',
    sectionAccount: 'الحساب',
    title: 'المزيد',
    subtitle: 'كل ما تبقّى، في مكان واحد.',
    guests: 'الضيوف',
    guestsDesc: 'إرسال رسائل الترحيب عبر واتساب للضيوف الذين أتمّوا تسجيل الوصول',
    bookings: 'كل الحجوزات',
    bookingsDesc: 'جميع مهام التنظيف والصيانة في كل العقارات',
    turnovers: 'التسليم',
    turnoversDesc: 'إبلاغ جهة التنظيف بعد مغادرة الضيف',
    cleaningContacts: 'جهات التنظيف',
    cleaningContactsDesc: 'فريقك وحسابات شركات التنظيف المسجّلة',
    connectAirbnb: 'ربط Airbnb',
    connectAirbnbDesc: 'استيراد إعلاناتك وحجوزاتك تلقائيًا',
    contract: 'عقد الإيجار',
    contractDesc: 'إلزام الضيوف بتوقيع عقد أثناء تسجيل الوصول عبر الإنترنت',
    profile: 'الملف الشخصي',
    profileDesc: 'حسابك ورقم هاتفك وتسجيل الخروج',
  },
  noAccess: {
    title: 'ليس لديك صلاحية الوصول إلى هذه الصفحة',
    body: 'اطلب ذلك من صاحب الحساب أو من مدير إذا كنت بحاجة إليها.',
    back: 'رجوع',
  },
  propertySettings: {
    headerTitle: 'إعدادات العقار',
    subtitle: 'معلومات الدخول، ورسالة الترحيب، وما يحدث تلقائيًا حول كل إقامة.',
    loadError: 'تعذّر تحميل هذا العقار.',
    saveError: 'تعذّر حفظ هذه الإعدادات.',
    saved: 'تم الحفظ.',
    save: 'حفظ الإعدادات',
    saving: 'جارٍ الحفظ…',
    pricingTitle: 'السعر',
    pricingBody: 'سعر الليلة الافتراضي لهذا العقار — يُستخدم للحجوزات القادمة وروابط تسجيل الوصول.',
    nightlyRate: (currency) => `سعر الليلة (${currency === 'MAD' ? 'درهم' : currency})`,
    nightlyRatePlaceholder: 'مثل: 450',
    invalidRate: 'أدخل سعر ليلة صالحًا.',
    welcomeTitle: 'رسالة الترحيب بالضيف',
    welcomeBody: 'تُرسل إلى الضيف عبر واتساب بعد إتمام تسجيل الوصول عبر الإنترنت.',
    welcomeModeLabel: 'الإرسال التلقائي',
    accessTitle: 'معلومات الدخول',
    accessBody: 'تُدرج في رسالة الترحيب — وفي رسالة التسليم المرسلة لعامل التنظيف — أينما ظهر الحقل المقابل. غيّر رمز البوابة هنا وستستخدم كل الرسائل القادمة الرمز الجديد.',
    gateCode: 'رمز البوابة',
    doorCode: 'رمز الباب',
    apartmentNumber: 'رقم الشقة',
    floor: 'الطابق',
    mapsLink: 'رابط خرائط Google',
    checkInTime: 'وقت الوصول',
    checkOutTime: 'وقت المغادرة',
    houseRules: 'قواعد المنزل',
    templateTitle: 'نص الرسالة',
    templateBody: 'عدّل النص نفسه. تُحذف تلقائيًا الأسطر التي تكون معلوماتها فارغة.',
    templateLabel: 'الرسالة',
    resetTemplate: 'استعادة النص الافتراضي',
    variablesHint: 'الحقول المتاحة:',
    turnoverTitle: 'تنبيهات التسليم',
    turnoverBody: 'إبلاغ جهة التنظيف عبر واتساب بعد مغادرة الضيف.',
    defaultContact: 'جهة التنظيف الافتراضية',
    noContacts: 'لا توجد جهات تنظيف بعد — أضف واحدة من المزيد › جهات التنظيف.',
    defaultService: 'الخدمة الافتراضية (لحسابات الشركات)',
    modeOff: 'متوقف',
    modeReview: 'مراجعة أولًا',
    modeAuto: 'تلقائي',
  },
  cleaningReports: {
    upgradeTitle: 'تقارير التنظيف ميزة مدفوعة',
    upgradeBody: 'إثبات التنظيف الموثّق بالصور غير متوفر في الخطة المجانية. قم بالترقية لتفعيله.',
    title: 'تقارير التنظيف',
    back: 'رجوع',
    loadError: 'تعذّر تحميل تقارير التنظيف.',
    startError: 'تعذّر بدء تقرير جديد.',
    emptyMessage: 'لا توجد تقارير تنظيف بعد.',
    startAction: 'ابدأ تقريرًا',
    startedOn: (date: string) => `بدأ في ${date}`,
    titleFallback: 'تقرير التنظيف',
    statusInProgress: 'قيد التنفيذ',
    statusCompleted: 'مكتمل',
    photoCount: (n: number) => arPlural(n, { one: 'صورة واحدة', two: 'صورتان', few: 'صور', many: 'صورة' }),
    nextGuest: 'الضيف القادم',
    guestStay: 'إقامة ضيف',
    checkInAt: (time: string) => `تسجيل الوصول ${time}`,
    areaLabel: 'المنطقة',
    areaPlaceholder: 'مثل: المطبخ، الحمام 1، غرفة النوم 2',
    uploading: 'جارٍ الرفع…',
    uploadingCount: (n: number) => `جارٍ رفع ${arPlural(n, { one: 'صورة واحدة', two: 'صورتين', few: 'صور', many: 'صورة' })}…`,
    takePhoto: 'التقاط صورة',
    burstHint: 'تُفتح الكاميرا من جديد بعد كل صورة لتلتقط عدة صور لهذه المنطقة. اضغط رجوع عند الانتهاء.',
    noPhotosYet: 'لا توجد صور بعد — اضغط على «التقاط صورة» أعلاه للبدء.',
    nameAreaTitle: 'سمِّ هذه المنطقة',
    nameAreaBody: 'أدخل اسم المنطقة التي تصوّرها (مثل المطبخ) قبل التقاط الصورة.',
    locationNeededTitle: 'مطلوب تحديد الموقع',
    locationNeededBody:
      'يحتاج هذا التقرير إلى موقعك للتأكد من أن الصورة التُقطت داخل العقار. فعّل الوصول إلى الموقع وحاول مرة أخرى.',
    clockDriftWarning: 'يبدو أن ساعة الجهاز غير مضبوطة في هذه الصورة — قد ترغب في إعادة التقاطها.',
    uploadError: 'تعذّر رفع هذه الصورة.',
    removeTitle: 'حذف هذه الصورة؟',
    removeBody: 'لا يمكن التراجع عن هذا الإجراء.',
    cancel: 'إلغاء',
    remove: 'حذف',
    removeError: 'تعذّر حذف هذه الصورة.',
    completing: 'جارٍ الإنهاء…',
    markComplete: 'إنهاء التقرير',
    completeSuccess: 'تم إنهاء التقرير',
    completeError: 'تعذّر إنهاء هذا التقرير.',
    verification: 'التحقق',
    verificationBody: 'شارك هذا الرابط مع Airbnb أو الضيف للتأكد بشكل مستقل من صحة هذا التقرير.',
    copied: 'تم النسخ',
    copyLink: 'نسخ الرابط',
    linkCopied: 'تم نسخ رابط التحقق',
    share: 'مشاركة',
    preparingPdf: 'جارٍ تجهيز ملف PDF…',
    exportPdf: 'تصدير PDF',
    pdfError: 'تعذّر إنشاء ملف PDF. يرجى المحاولة مرة أخرى.',
  },
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
    checkInDate: 'تاريخ الوصول',
    checkOutDate: 'تاريخ المغادرة',
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
    dateFormatLabel: 'تاريخ آخر',
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
    MATCHED: 'تمت المطابقة — أكّد العامل',
    CONFIRMED: 'مؤكد',
    CLEANER_EN_ROUTE: 'في الطريق',
    CHECKED_IN: 'تم تسجيل الوصول',
    IN_PROGRESS: 'قيد التنفيذ',
    AWAITING_APPROVAL: 'بانتظار موافقتك',
    COMPLETED: 'مكتمل',
    DISPUTED: 'نزاع',
    CANCELLED: 'ملغى',
  },
  dashboardHost: {
    statArrivingToday: 'وصول اليوم',
    statLeavingTomorrow: 'مغادرة غدًا',
    statToClean: 'للتنظيف',
    unitShort: (unit) => `شقة ${unit}`,
    greeting: (name) => `مرحبًا ${name}`,
    greetingFallback: 'عقاراتك',
    subtitle: 'إليك آخر مستجدات عقاراتك.',
    emptyTitle: 'أضف عقارك الأول',
    emptySubtitle: 'بمجرد إضافته يمكنك إرسال روابط تسجيل الوصول ومتابعة التسليم والاستلام هنا.',
    addProperty: 'إضافة عقار',
    quickRequestCleaning: 'طلب تنظيف',
    quickGuestCheckIn: 'تسجيل وصول ضيف',
    nextCheckIns: 'الوصول القادم',
    nextCheckInsSubtitle: 'ضيوف يصلون قريبًا · روابط تسجيل الوصول جاهزة',
    viewAll: 'عرض الكل',
    noArrivalsSoon: 'لا توجد وصولات في الأيام القادمة.',
    noGuestsWaiting: 'لا يوجد ضيوف بانتظار تسجيل الوصول.',
    guestFallback: 'ضيف',
    checkInAt: (time) => `تسجيل الوصول ${time}`,
    checkInLinkReady: 'رابط تسجيل الوصول جاهز',
    copied: 'تم النسخ',
    copyLink: 'نسخ الرابط',
    moreArrivingSoon: (n) =>
      n === 1
        ? 'ضيف إضافي قريبًا'
        : n === 2
          ? 'ضيفان إضافيان قريبًا'
          : n <= 10
            ? `${n} ضيوف إضافيون قريبًا`
            : `${n} ضيفًا إضافيًا قريبًا`,
    hiddenCheckIns: (n) =>
      n === 1
        ? 'تسجيل وصول مخفي · عرض'
        : n === 2
          ? 'تسجيلا وصول مخفيان · عرض'
          : n <= 10
            ? `${n} تسجيلات وصول مخفية · عرض`
            : `${n} تسجيل وصول مخفي · عرض`,
    hiddenFromHome: 'تم الإخفاء من الرئيسية',
    hiddenRestored: 'تمت استعادة تسجيلات الوصول المخفية',
    tomorrowCheckouts: 'مغادرات الغد',
    tomorrowCheckoutsSubtitle: 'ضيوف يغادرون غدًا — يتم تمييز التسليم في نفس اليوم',
    noCheckoutsTomorrow: 'لا توجد مغادرات مجدولة غدًا.',
    sameDayTurnover: 'تسليم في نفس اليوم',
    checkoutTag: 'مغادرة',
    moreCheckingOut: (n) =>
      n === 1
        ? 'مغادرة إضافية'
        : n === 2
          ? 'مغادرتان إضافيتان'
          : n <= 10
            ? `${n} مغادرات إضافية`
            : `${n} مغادرة إضافية`,
    allApartments: 'جميع العقارات',
    allApartmentsSubtitle: 'حالة كل عقار',
    allStatuses: (n) => `كل الحالات · ${n}`,
    noPropertiesWithStatus: 'لا توجد عقارات بهذه الحالة.',
    markReadyHint: 'نظّفت واحدًا بنفسك؟ ضعه كجاهز:',
    markedReady: (name) => `تم وضع ${name} كجاهز`,
    errorLoad: 'تعذّر تحميل لوحة التحكم.',
    errorUpdateProperty: 'تعذّر تحديث العقار.',
    errorTiming: 'تعذّر حفظ طلب التوقيت.',
    errorGuestCount: 'تعذّر تحديث عدد الضيوف.',
    checkInLinkCopied: 'تم نسخ رابط تسجيل الوصول',
    notifications: 'الإشعارات',
    markAllRead: 'تعليم الكل كمقروء',
    notificationsEmpty: 'لا جديد. سيظهر هنا عند إتمام أحد الضيوف تسجيل وصوله.',
    sheetPropertyStatus: 'حالة العقار',
    sheetArrives: 'الوصول',
    sheetLeaves: 'المغادرة',
    notifyCleaner: (name) => `إبلاغ ${name} عبر واتساب`,
    cleanerNotified: 'تم إبلاغ عامل التنظيف',
    noCleaningContact: 'لا توجد جهة تنظيف لهذا العقار بعد — أضف واحدة من إعدادات العقار (أيقونة الترس) لإبلاغها من هنا.',
    notifyCleanerError: 'تعذّر إبلاغ عامل التنظيف.',
    sheetLengthOfStay: 'مدة الإقامة',
    sheetGuests: 'الضيوف',
    timingRequestsTitle: 'طلبات التوقيت',
    timingRequestsSubtitle: 'حدّد وصولاً مبكرًا أو مغادرة متأخرة لجدولة التنظيف وفقًا لذلك.',
    earlyCheckIn: 'وصول مبكر',
    arrivingBefore: (time) => `الوصول قبل ${time}`,
    arrivingBeforeUsual: 'الوصول قبل الوقت المعتاد',
    lateCheckout: 'مغادرة متأخرة',
    leavingAfterUsual: 'المغادرة بعد وقت تسجيل المغادرة المعتاد',
    note: (text) => `ملاحظة: ${text}`,
    messageGuestWhatsApp: 'مراسلة الضيف عبر واتساب',
    copiedExclaim: 'تم النسخ!',
    copyCheckInLink: 'نسخ رابط تسجيل الوصول',
    opening: 'جارٍ الفتح…',
    shareViaWhatsApp: 'مشاركة عبر واتساب',
    openProperty: 'فتح العقار',
    turnaround: 'التسليم',
    departingGuests: 'الضيوف المغادرون',
    lateCheckoutRequested: 'تم طلب مغادرة متأخرة',
    yes: 'نعم',
    nextGuestSameDay: 'الضيف التالي — نفس اليوم',
    arrivingGuests: 'الضيوف القادمون',
    earlyCheckInRequested: 'تم طلب وصول مبكر',
    afterThisCheckout: 'بعد هذه المغادرة',
    checkingWhatsNext: 'جارٍ التحقق مما هو قادم…',
    nextGuestArrives: 'وصول الضيف التالي',
    blockedAfterCheckout: 'محجوز بعد المغادرة',
    nothingBookedYet: 'لا حجوزات بعد — يبقى جاهزًا بعد التنظيف.',
    requestCleaningForTurnover: 'طلب تنظيف لهذا التسليم',
    openPropertyCalendar: 'فتح تقويم هذا العقار',
    checkInShareMessage: (propertyName, arriving, url) =>
      `مرحبًا! يرجى إكمال تسجيل الوصول عبر الإنترنت لـ ${propertyName}، الوصول ${arriving}: ${url}`,
  },
  sourceLabel: {
    AIRBNB: 'Airbnb',
    BOOKING_COM: 'Booking.com',
    DIRECT: 'مباشر',
    MANUAL: 'غير متصل',
  },
  guestStayStatus: {
    PENDING: 'بانتظار تسجيل الوصول عبر الإنترنت',
    SUBMITTED: 'تم تسجيل الوصول',
    EXPIRED: 'انتهت صلاحية رابط تسجيل الوصول',
  },
  calendarHost: {
    nextTwoWeeks: (n) => (n === 0 ? 'الأسبوعان القادمان · لا حجوزات' : `الأسبوعان القادمان · ليالٍ محجوزة: ${n}`),
    title: 'التقويم',
    allProperties: 'جميع العقارات',
    viewListings: 'القائمة',
    viewCalendar: 'التقويم',
    legendCleaning: 'تنظيف',
    legendGuestStay: 'إقامة ضيف',
    legendBlocked: 'محجوز',
    tapForDetails: 'اضغط على حجز لعرض التفاصيل',
    dayEmpty: 'لا حجوزات ولا مهام في هذا اليوم.',
    noPropertiesToShow: 'لا توجد عقارات لعرضها.',
    airbnbBadge: 'Airbnb',
    nightsCount: (n) => arPlural(n, { one: 'ليلة واحدة', two: 'ليلتان', few: 'ليالٍ', many: 'ليلة' }),
    errorLoad: 'تعذّر تحميل التقويم.',
    errorCreateCheckIn: 'تعذّر إنشاء رابط تسجيل وصول لهذا الحجز.',
    errorUpdateReservation: 'تعذّر تحديث هذا الحجز.',
    errorSaveRate: 'تعذّر حفظ هذا السعر.',
    bookingCreatedLinkCopied: 'تم إنشاء الحجز — تم نسخ الرابط',
    checkInLinkCreatedCopied: 'تم إنشاء رابط تسجيل الوصول ونسخه',
    checkInLinkCopied: 'تم نسخ رابط تسجيل الوصول',
    bookedAtRate: (rate) => `محجوز بسعر ${rate} درهم/الليلة`,
    markedRealBooking: 'تم وضعه كحجز حقيقي',
    savedRate: (rate) => `تم الحفظ — ${rate} درهم/الليلة`,
    rateCleared: 'تم مسح السعر — سيُستخدم السعر الافتراضي للعقار',
    copiedExclaim: 'تم النسخ!',
    copyCheckInLink: 'نسخ رابط تسجيل الوصول',
    shareViaWhatsApp: 'مشاركة عبر واتساب',
    blockedOnPrefix: 'محجوز في',
    platformPrefix: 'المنصة:',
    confirmedStatus: 'مؤكد',
    ratePerNightLabel: 'السعر لليلة الواحدة (درهم) — اختياري',
    ratePerNightHint: 'يحدد ما تكسبه هذه الليلة في تقاريرك. اتركه فارغًا واحفظ للعودة إلى السعر الافتراضي للعقار.',
    savingEllipsis: 'جارٍ الحفظ…',
    savePrice: 'حفظ السعر',
    guestsOptionalLabel: 'عدد الضيوف — اختياري',
    guestsOptionalHint: 'عدد الأشخاص الذين يمكن للضيف تسجيلهم في نموذج تسجيل الوصول. الافتراضي 1.',
    workingEllipsis: 'جارٍ التنفيذ…',
    confirmRealBookingCreateLink: 'هذا حجز حقيقي — إنشاء رابط تسجيل الوصول',
    createCheckInLink: 'إنشاء رابط تسجيل الوصول',
    markBookedNoLink: 'وضعه كمحجوز (بدون رابط للضيف)',
    viewBooking: 'عرض الحجز',
    viewProperty: 'عرض العقار',
    close: 'إغلاق',
    addSheetTitle: 'إضافة',
    addCleaning: 'إضافة تنظيف',
    addCleaningSubtitle: 'طلب زيارة تنظيف أو صيانة',
    guestOnlineCheckIn: 'تسجيل وصول ضيف عبر الإنترنت',
    guestOnlineCheckInSubtitle: 'إنشاء رابط تسجيل وصول لإقامة ضيف',
    checkInShareMessage: (propertyName, url) => `مرحبًا! يرجى إكمال تسجيل الوصول عبر الإنترنت لـ ${propertyName} هنا: ${url}`,
  },
  propertiesList: {
    title: 'العقارات',
    listedCount: (n) => `${n} منشور`,
    airbnbButton: 'Airbnb',
    errorLoad: 'تعذّر تحميل عقاراتك.',
    emptyMessage: 'لا توجد عقارات بعد.',
    addFirstProperty: 'أضف عقارك الأول',
    airbnbBadge: 'Airbnb',
    bedBathGuests: (bed, bath, guests) => `${bed} غرف · ${bath} حمامات · حتى ${guests} ضيوف`,
    ratePerNight: (rate, currency) => `${rate} ${currency === 'MAD' ? 'درهم' : currency} / الليلة`,
  },
  propertyDetail: {
    addCoverPhoto: 'أضف صورة غلاف',
    changeCoverPhoto: 'تغيير الصورة',
    uploadingPhoto: 'جارٍ الرفع…',
    addPhoto: 'إضافة',
    doorPhotosEmpty: 'صور الباب أو المدخل. يتلقاها الضيوف مع معلومات الدخول.',
    doorPhotosHint: 'اضغط مطولًا على صورة لإزالتها.',
    deleteDoorPhotoTitle: 'إزالة هذه الصورة؟',
    deleteDoorPhotoMessage: 'لن يتلقاها الضيوف بعد الآن مع معلومات الدخول.',
    deleteDoorPhotoConfirm: 'إزالة',
    errorPhotoAccess: 'يحتاج ReadyDar إلى الوصول إلى صورك. يمكنك السماح بذلك من إعدادات الهاتف.',
    errorUploadPhoto: 'تعذّر حفظ الصورة. حاول مرة أخرى.',
    headerBack: 'رجوع',
    errorLoad: 'تعذّر تحميل هذا العقار.',
    errorSetStatus: 'تعذّر تغيير الحالة.',
    errorMarkReady: 'تعذّر تحديث العقار.',
    errorPreview: 'تعذّر تحميل معاينة الرسالة.',
    errorSendWelcome: 'تعذّر إرسال رسالة الترحيب.',
    errorOpenWhatsApp: 'تعذّر فتح واتساب.',
    errorOpenIdPhoto: 'تعذّر فتح صورة الهوية.',
    errorDeleteCheckIn: 'تعذّر حذف رابط تسجيل الوصول.',
    errorDownloadPdf: 'تعذّر تنزيل ملف PDF. يرجى المحاولة مرة أخرى.',
    errorDownloadContract: 'تعذّر تنزيل العقد. يرجى المحاولة مرة أخرى.',
    syncNotice: 'مستورد من Airbnb — الاسم والعنوان وعدد الغرف تتزامن تلقائيًا. عدّلها على Airbnb، وليس هنا.',
    statusLabel: 'الحالة',
    statusAuto: 'حدّدتها أنت — لن تتغيّر من تلقاء نفسها. اضغط للعودة إلى الوضع التلقائي.',
    statusWorkingItOut: 'تُحدَّد تلقائيًا بناءً على الحجوزات وعمليات التنظيف.',
    requestCleaning: 'طلب تنظيف',
    markReady: 'وضع علامة جاهز',
    logExpense: 'تسجيل مصروف لهذا العقار',
    cleaningReports: 'تقارير التنظيف',
    guestCheckIns: 'تسجيلات وصول الضيوف',
    noCheckInsYet: 'لا توجد روابط تسجيل وصول بعد. أضف رابطًا لجمع تفاصيل وصول الضيف وهويته قبل مقابلته.',
    guestFallback: 'ضيف',
    createdFromAirbnb: 'تم الإنشاء تلقائيًا من حجز Airbnb — شارك الرابط أدناه لجمع تفاصيل الضيف.',
    phoneLabel: (phone) => `الهاتف: ${phone}`,
    nationalityIdLine: (nationality, idType, idNumber) => `${nationality} · ${idType} ${idNumber}`,
    passport: 'جواز سفر',
    nationalId: 'بطاقة هوية وطنية',
    idPhoto: 'صورة الهوية',
    idPhotos: 'صور الهوية',
    viewId: 'عرض الهوية',
    openingEllipsis: 'جارٍ الفتح…',
    downloadCheckInPdf: 'تنزيل PDF تسجيل الوصول',
    preparingPdf: 'جارٍ تحضير PDF…',
    downloadContract: 'تنزيل العقد الموقّع',
    preparingContract: 'جارٍ تحضير العقد…',
    welcomeMessageSent: 'تم إرسال رسالة الترحيب',
    openWhatsAppWelcomeReady: 'فتح واتساب — رسالة الترحيب جاهزة',
    hideWelcomeMessage: 'إخفاء رسالة الترحيب',
    sendWelcomeMessage: 'إرسال رسالة ترحيب',
    loadingPreview: 'جارٍ تحميل المعاينة…',
    messageEditLabel: 'الرسالة (عدّلها إذا لزم الأمر)',
    sendingEllipsis: 'جارٍ الإرسال…',
    sendViaWhatsApp: 'إرسال عبر واتساب',
    messageGuestWhatsApp: 'مراسلة الضيف عبر واتساب',
    shareViaWhatsApp: 'مشاركة عبر واتساب',
    deletingEllipsis: 'جارٍ الحذف…',
    deleteThisLink: 'حذف هذا الرابط',
    checkInStatusShort: { PENDING: 'بانتظار الضيف', SUBMITTED: 'مكتمل', EXPIRED: 'منتهي' },
    newCheckInLink: 'رابط جديد',
    shareLink: 'مشاركة الرابط',
    whatsappGuest: 'واتساب الضيف',
    contractPdf: 'العقد الموقّع',
    checkInPdf: 'ملف تسجيل الوصول PDF',
    deleteCheckInTitle: 'حذف رابط تسجيل الوصول؟',
    deleteCheckInMessage: (label) => `سيتوقف رابط ${label} عن العمل ولا يمكن استعادته. لم يقدّم الضيف أي شيء بعد، لذا لن تُفقد أي بيانات.`,
    checkInOutTitle: 'تسجيل الوصول / المغادرة',
    checkInOutLine: (checkIn, checkOut) => `الوصول ${checkIn} · المغادرة ${checkOut}`,
    accessDetailsTitle: 'تفاصيل الدخول',
    unitApartment: (value) => `الوحدة / الشقة: ${value}`,
    gateCode: (value) => `رمز البوابة: ${value}`,
    doorCode: (value) => `رمز الباب: ${value}`,
    wifiTitle: 'الواي فاي',
    houseRulesTitle: 'قواعد المنزل',
    doorPhotosTitle: 'صور الباب / الدخول',
    automationSettings: 'إعدادات الأتمتة',
    icalNotice: 'روابط التقويم (iCal) تُدار حاليًا من موقع ReadyDar على الويب.',
    checkInShareMessage: (propertyName, arriving, url) => `مرحبًا! يرجى إكمال تسجيل الوصول عبر الإنترنت${propertyName ? ` لـ ${propertyName}` : ''}، الوصول ${arriving}: ${url}`,
  },
  bookingsList: {
    headerBack: 'المزيد',
    pageTitle: 'كل الحجوزات',
    title: 'الحجوزات',
    subtitle: 'عبر جميع عقاراتك',
    errorLoad: 'تعذّر تحميل حجوزاتك.',
    emptyMessage: 'لا توجد حجوزات بعد.',
    actionLabel: 'اطلب تنظيفًا أو خدمة',
    urgent: 'عاجل',
  },
  guestsList: {
    headerBack: 'رجوع',
    title: 'الضيوف',
    subtitle: 'كل تسجيلات وصول الضيوف، مجمّعة حسب ما يحتاج إجراءً ثم حسب الشهر.',
    errorLoad: 'تعذّر تحميل تسجيلات وصول الضيوف.',
    emptyMessage: 'لا توجد تسجيلات وصول للضيوف بعد. ستظهر هنا بمجرد إنشاء رابط تسجيل وصول لعقار.',
    emptyAction: 'ابدأ تسجيل وصول ضيف عبر الإنترنت من عقار',
    sectionUpcomingTitle: 'القادمة',
    sectionUpcomingSubtitle: 'روابط لا تزال بانتظار الضيف',
    sectionSubmittedTitle: 'مُرسلة من الضيف',
    sectionSubmittedSubtitle: 'تم استلام التفاصيل — الهوية والعقد وملف PDF في صفحة العقار',
    sectionExpiredTitle: 'منتهية',
    sectionExpiredSubtitle: 'انتهت الإقامة ولم يعد الرابط يعمل',
    nothingHere: 'لا شيء هنا.',
    copyLink: 'نسخ الرابط',
    copiedExclaim: 'تم النسخ!',
    checkInLinkCopiedToast: 'تم نسخ رابط تسجيل الوصول',
    checkInLinkDeletedToast: 'تم حذف رابط تسجيل الوصول',
    deleteCheckInMessage: (label, propertyName) => `سيتوقف رابط ${label} في ${propertyName} عن العمل ولا يمكن استعادته. لم يقدّم الضيف أي شيء بعد، لذا لن تُفقد أي بيانات.`,
    viewPropertyLink: 'عرض صورة الهوية والعقد وملف PDF في العقار ←',
  },
  connectAirbnb: {
    title: 'ربط Airbnb',
    intro: 'اربط حسابك على Airbnb مرة واحدة، فتصلك إعلاناتك وحجوزاتك تلقائيًا بدل إدخالها يدويًا.',
    oneWayNote: 'الربط حاليًا في اتجاه واحد، من Airbnb إلى ReadyDar. التواريخ التي تحجبها أو الإقامات التي تضيفها في ReadyDar لا تُرسل إلى Airbnb.',
    step1Title: 'اربط حسابك على Airbnb',
    step1Body: 'تُفتح صفحة شريك آمنة في متصفحك. بعد الموافقة على الوصول هناك، عد إلى هنا واضغط «مزامنة الآن».',
    connectButton: 'ربط حساب Airbnb',
    opening: 'جارٍ الفتح…',
    step2Title: 'استورد إعلاناتك',
    step2Body: 'يستورد كل إعلان مربوط على Airbnb كعقار، مع حجوزاته القادمة والتواريخ المحجوبة على Airbnb. الحجوزات الجديدة تصل تلقائيًا أيضًا؛ اضغط هنا إن أردتها الآن.',
    syncNow: 'مزامنة الآن',
    syncing: 'جارٍ المزامنة…',
    foundOnAirbnb: (n) => `على Airbnb (${n})`,
    hide: 'إخفاء',
    noListings: 'لا توجد إعلانات بعد. اربط حسابك على Airbnb أعلاه أولًا.',
    listingFallback: 'إعلان Airbnb',
    footer: 'تحمل العقارات المستوردة وسم «Airbnb» في تبويب العقارات. اسمها وعنوانها وعدد غرفها تتبع Airbnb، فعدّلها هناك. كل حجز جديد على Airbnb يحصل على رابط تسجيل وصول خاص به، جاهز للإرسال من صفحة العقار.',
    synced: (properties, stays, blocks) => {
      const parts = [`عقارات جديدة: ${properties}`, `إقامات جديدة: ${stays}`];
      if (blocks > 0) parts.push(`فترات محجوبة: ${blocks}`);
      return `تمت مزامنة Airbnb — ${parts.join('، ')}`;
    },
    upToDate: 'كل شيء محدّث بالفعل.',
    errorConnect: 'تعذّر بدء الربط مع Airbnb.',
    errorSync: 'تعذّرت المزامنة مع Airbnb. اربط حسابك على Airbnb أولًا.',
  },
  notifications: {
    checkinTitle: (guest) => `أكمل ${guest} تسجيل الوصول`,
    checkinBody: (property, stay) => `${property} · ${stay}`,
    jobTitle: 'لا يزال التنظيف بلا عامل نظافة',
    jobBody: (property) => `${property} · مجدول اليوم`,
    turnoverTitle: 'تبديل في نفس اليوم اليوم',
    turnoverBody: (property) => `${property} · ضيف يغادر وآخر يصل`,
    aProperty: 'أحد العقارات',
    guestFallback: 'ضيفك',
    justNow: 'الآن',
    minutesAgo: (n) => `قبل ${n} د`,
    hoursAgo: (n) => `قبل ${n} س`,
    yesterday: 'أمس',
    daysAgo: (n) =>
      n === 1 ? 'قبل يوم' : n === 2 ? 'قبل يومين' : n <= 10 ? `قبل ${n} أيام` : `قبل ${n} يومًا`,
  },
};
