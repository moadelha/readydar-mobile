import { useLanguage } from './language-context';

/**
 * Plans v2 copy for the mobile app (EN/FR/AR). Kept apart from the main
 * dictionary; mirrors the web app's `plans` / `billing.v2` wording.
 * No purchases happen in the app — billing stays on the website.
 */
const en = {
  title: 'Plan & billing',
  menuDesc: 'Your plan, usage and what it includes',
  light: 'Light',
  pro: 'Pro',
  trialUntil: (date: string) => `Free trial until ${date}`,
  renewsOn: (date: string) => `Renews on ${date}`,
  freePlan: 'Free plan',
  properties: 'Active properties',
  team: 'Team members',
  usedOf: (used: number, limit: number) => `${used} of ${limit}`,
  usedUnlimited: (used: number) => `${used} · unlimited`,
  extraProperties: (n: number) => `Includes ${n} extra propert${n === 1 ? 'y' : 'ies'}`,
  included: 'Included in your plan',
  comingSoon: 'Coming soon',
  manageOnWeb: 'Manage your plan on the website',
  webNote: 'Plans, add-ons and extra properties are managed on readydar.com — the app follows your plan automatically.',
  loadError: "Couldn't load your plan.",
  features: {
    cleaningReports: 'Cleaning reports',
    ttlock: 'Smart locks (TTLock)',
    inbox: 'Unified guest inbox',
    priceEditor: 'Prices sent to every channel',
    aiReplies: 'AI translation & suggested replies',
    aiReviewAnalysis: 'AI review analysis',
    dynamicPricing: 'Dynamic pricing',
    ownerPortal: 'Owner portal',
  },
  seePlans: 'See plans',
};

type PlanStrings = typeof en;

const fr: PlanStrings = {
  title: 'Formule et facturation',
  menuDesc: 'Votre formule, votre utilisation et ce qui est inclus',
  light: 'Light',
  pro: 'Pro',
  trialUntil: (date) => `Essai gratuit jusqu'au ${date}`,
  renewsOn: (date) => `Renouvellement le ${date}`,
  freePlan: 'Formule Gratuite',
  properties: 'Logements actifs',
  team: "Membres d'équipe",
  usedOf: (used, limit) => `${used} sur ${limit}`,
  usedUnlimited: (used) => `${used} · illimité`,
  extraProperties: (n) => `Dont ${n} logement${n === 1 ? '' : 's'} supplémentaire${n === 1 ? '' : 's'}`,
  included: 'Inclus dans votre formule',
  comingSoon: 'Bientôt',
  manageOnWeb: 'Gérer votre formule sur le site',
  webNote: "Les formules, options et logements supplémentaires se gèrent sur readydar.com — l'application suit votre formule automatiquement.",
  loadError: 'Impossible de charger votre formule.',
  features: {
    cleaningReports: 'Rapports de ménage',
    ttlock: 'Serrures connectées (TTLock)',
    inbox: 'Messagerie voyageurs unifiée',
    priceEditor: 'Prix envoyés à tous les canaux',
    aiReplies: 'Traduction et réponses suggérées par IA',
    aiReviewAnalysis: 'Analyse des avis par IA',
    dynamicPricing: 'Tarification dynamique',
    ownerPortal: 'Portail propriétaires',
  },
  seePlans: 'Voir les formules',
};

const ar: PlanStrings = {
  title: 'الباقة والفوترة',
  menuDesc: 'باقتك واستخدامك وما تتضمنه',
  light: 'Light',
  pro: 'Pro',
  trialUntil: (date) => `تجربة مجانية حتى ${date}`,
  renewsOn: (date) => `التجديد في ${date}`,
  freePlan: 'الباقة المجانية',
  properties: 'العقارات النشطة',
  team: 'أعضاء الفريق',
  usedOf: (used, limit) => `${used} من ${limit}`,
  usedUnlimited: (used) => `${used} · غير محدود`,
  extraProperties: (n) => `منها ${n} ${n === 1 ? 'عقار إضافي' : 'عقارات إضافية'}`,
  included: 'مضمّن في باقتك',
  comingSoon: 'قريباً',
  manageOnWeb: 'إدارة باقتك على الموقع',
  webNote: 'تُدار الباقات والإضافات والعقارات الإضافية على readydar.com — ويتبع التطبيق باقتك تلقائياً.',
  loadError: 'تعذّر تحميل باقتك.',
  features: {
    cleaningReports: 'تقارير التنظيف',
    ttlock: 'الأقفال الذكية (TTLock)',
    inbox: 'صندوق رسائل موحّد للضيوف',
    priceEditor: 'أسعار تُرسل لكل القنوات',
    aiReplies: 'ترجمة وردود مقترحة بالذكاء الاصطناعي',
    aiReviewAnalysis: 'تحليل التقييمات بالذكاء الاصطناعي',
    dynamicPricing: 'تسعير ديناميكي',
    ownerPortal: 'بوابة الملّاك',
  },
  seePlans: 'عرض الباقات',
};

const STRINGS = { EN: en, FR: fr, AR: ar };

export function usePlanStrings(): PlanStrings {
  const { lang } = useLanguage();
  return STRINGS[lang] ?? en;
}
