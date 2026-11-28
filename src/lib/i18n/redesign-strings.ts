import { arPlural } from './dictionary';
import { useLanguage } from './language-context';

/**
 * Copy (EN/FR/AR) for the November 2026 design review: the property list,
 * the property's status card and sheet, the calendar planning, reviews.
 */
const en = {
  props: {
    count: (n: number) => (n === 1 ? '1 property' : `${n} properties`),
    add: 'Add',
    addWhat: 'Add a property',
    newProperty: 'New property',
    importAirbnb: 'Import from Airbnb',
    cancel: 'Cancel',
    next: (name: string, day: string) => `Next: ${name}, ${day}`,
    leaves: (name: string, day: string) => `${name} leaves ${day}`,
    nothingBooked: 'Nothing booked in the next 30 days',
    aGuest: 'a guest',
  },
  status: {
    now: 'Now',
    change: 'Change',
    sheetTitle: 'Property status',
    sheetHint: 'It updates by itself from bookings and cleanings. Pick one if it is wrong: it then stays until you put it back on automatic.',
    setByHand: 'Set by hand',
    nextArrival: (name: string, day: string) => `Next arrival: ${name}, ${day}`,
    noNextArrival: 'No arrival planned yet.',
    close: 'Close',
  },
  planning: {
    addLink: 'Link',
    cleaningDue: (names: string) => `Cleaning to do: ${names}`,
  },
  reviews: {
    byPropertySub: 'Most slipping first',
  },
  desk: {
    arrivals: 'Arrivals',
    departures: 'Departures',
    bedsTonight: 'Taken tonight',
    toClean: 'To clean',
  },
  stay: {
    where: 'Room',
    arrival: 'Arrival',
    departure: 'Departure',
    close: 'Close',
  },
};

export type RedesignStrings = typeof en;

const fr: RedesignStrings = {
  props: {
    count: (n: number) => (n <= 1 ? `${n} logement` : `${n} logements`),
    add: 'Ajouter',
    addWhat: 'Ajouter un logement',
    newProperty: 'Nouveau logement',
    importAirbnb: 'Importer depuis Airbnb',
    cancel: 'Annuler',
    next: (name: string, day: string) => `Prochain : ${name}, ${day}`,
    leaves: (name: string, day: string) => `${name} part ${day}`,
    nothingBooked: 'Rien de réservé dans les 30 jours',
    aGuest: 'un voyageur',
  },
  status: {
    now: 'Maintenant',
    change: 'Changer',
    sheetTitle: 'Statut du logement',
    sheetHint: 'Il se met à jour tout seul avec les réservations et les ménages. Choisissez-en un s’il n’est pas juste : il reste alors jusqu’à ce que vous repassiez en automatique.',
    setByHand: 'Réglé à la main',
    nextArrival: (name: string, day: string) => `Prochaine arrivée : ${name}, ${day}`,
    noNextArrival: 'Aucune arrivée prévue pour l’instant.',
    close: 'Fermer',
  },
  planning: {
    addLink: 'Lien',
    cleaningDue: (names: string) => `Ménage à faire : ${names}`,
  },
  reviews: {
    byPropertySub: 'Le plus en baisse d’abord',
  },
  desk: {
    arrivals: 'Arrivées',
    departures: 'Départs',
    bedsTonight: 'Occupés ce soir',
    toClean: 'À nettoyer',
  },
  stay: {
    where: 'Chambre',
    arrival: 'Arrivée',
    departure: 'Départ',
    close: 'Fermer',
  },
};

const ar: RedesignStrings = {
  props: {
    count: (n: number) => arPlural(n, { one: 'عقار واحد', two: 'عقاران', few: 'عقارات', many: 'عقارًا' }),
    add: 'إضافة',
    addWhat: 'إضافة عقار',
    newProperty: 'عقار جديد',
    importAirbnb: 'استيراد من Airbnb',
    cancel: 'إلغاء',
    next: (name: string, day: string) => `التالي: ${name}، ${day}`,
    leaves: (name: string, day: string) => `${name} يغادر ${day}`,
    nothingBooked: 'لا حجز في الثلاثين يومًا القادمة',
    aGuest: 'ضيف',
  },
  status: {
    now: 'الآن',
    change: 'تغيير',
    sheetTitle: 'حالة العقار',
    sheetHint: 'تتحدث تلقائيًا مع الحجوزات والتنظيف. اختر حالة إن لم تكن صحيحة: تبقى كذلك حتى تعيدها إلى الوضع التلقائي.',
    setByHand: 'مضبوطة يدويًا',
    nextArrival: (name: string, day: string) => `الوصول القادم: ${name}، ${day}`,
    noNextArrival: 'لا وصول مبرمج بعد.',
    close: 'إغلاق',
  },
  planning: {
    addLink: 'رابط',
    cleaningDue: (names: string) => `تنظيف مطلوب: ${names}`,
  },
  reviews: {
    byPropertySub: 'الأكثر تراجعًا أولًا',
  },
  desk: {
    arrivals: 'الوصول',
    departures: 'المغادرة',
    bedsTonight: 'مشغولة الليلة',
    toClean: 'للتنظيف',
  },
  stay: {
    where: 'الغرفة',
    arrival: 'الوصول',
    departure: 'المغادرة',
    close: 'إغلاق',
  },
};

const all = { EN: en, FR: fr, AR: ar };

export function useRedesignStrings(): RedesignStrings {
  const { lang } = useLanguage();
  return all[lang as keyof typeof all] ?? en;
}
