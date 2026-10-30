import { useLanguage } from './language-context';

/**
 * Guest reviews copy (EN/FR/AR), kept apart from the main dictionary like
 * messages-strings.ts. Wording mirrors the web app's `reviewsPage` section.
 */
const en = {
  title: 'Reviews',
  menuDesc: 'What guests say about each property',
  subtitle: 'Guest reviews from Airbnb and Booking.com — see what guests say about each property, and reply.',
  subtitleLight: 'Guest reviews from Airbnb — see what guests say about each property.',
  allProperties: 'All properties',
  noProperties: "You don't have any properties yet.",
  noReviews: 'No reviews to show here yet.',
  reviewsCount: (n: number) => (n === 1 ? '1 review' : `${n} reviews`),
  noRating: 'No rating yet',
  guestFallback: 'A guest',
  hostReply: 'Your reply',
  privateFeedback: 'Private feedback — only you see this',
  hidden: 'Not public yet',
  loadError: 'Could not load reviews',
  replyButton: 'Reply',
  replyPlaceholder: 'Write your public reply…',
  replyPost: 'Post reply',
  cancel: 'Cancel',
  replyConfirm: (channel: string) => `This reply will be public on ${channel} and can't be edited afterwards. Post it?`,
  replyPosted: 'Reply posted.',
  replyError: "Couldn't post the reply.",
  guestReviewed: 'You reviewed this guest on Airbnb',
  outOf10: (score: string) => `${score}/10`,
  guestReview: {
    button: 'Review the guest',
    intro: 'Your review of the guest on Airbnb — one per stay, within 14 days of checkout. It can’t be changed afterwards.',
    categories: { cleanliness: 'Cleanliness', communication: 'Communication', houseRules: 'Respected house rules' },
    publicPlaceholder: 'Public review (shown on the guest’s Airbnb profile)',
    privatePlaceholder: 'Private note to the guest (optional)',
    recommend: 'I would host this guest again',
    submit: 'Send review',
    confirm: (name: string) => `Send your review of ${name} to Airbnb? It can’t be edited afterwards.`,
    done: 'Guest review sent to Airbnb.',
    error: "Couldn't send the guest review.",
  },
};

type ReviewsStrings = typeof en;

const fr: ReviewsStrings = {
  title: 'Avis',
  menuDesc: 'Ce que disent les voyageurs de chaque logement',
  subtitle: 'Avis des voyageurs Airbnb et Booking.com — découvrez ce que disent les voyageurs de chaque logement, et répondez-y.',
  subtitleLight: 'Avis des voyageurs Airbnb — découvrez ce que disent les voyageurs de chaque logement.',
  allProperties: 'Tous les logements',
  noProperties: "Vous n'avez pas encore de logement.",
  noReviews: 'Aucun avis à afficher pour le moment.',
  reviewsCount: (n) => (n === 1 ? '1 avis' : `${n} avis`),
  noRating: 'Pas encore de note',
  guestFallback: 'Un voyageur',
  hostReply: 'Votre réponse',
  privateFeedback: 'Commentaire privé — visible par vous seul',
  hidden: 'Pas encore public',
  loadError: 'Impossible de charger les avis',
  replyButton: 'Répondre',
  replyPlaceholder: 'Écrivez votre réponse publique…',
  replyPost: 'Publier la réponse',
  cancel: 'Annuler',
  replyConfirm: (channel) => `Cette réponse sera publique sur ${channel} et ne pourra plus être modifiée. La publier ?`,
  replyPosted: 'Réponse publiée.',
  replyError: 'Impossible de publier la réponse.',
  guestReviewed: 'Vous avez évalué ce voyageur sur Airbnb',
  outOf10: (score) => `${score}/10`,
  guestReview: {
    button: 'Évaluer le voyageur',
    intro: "Votre évaluation du voyageur sur Airbnb — une par séjour, dans les 14 jours après le départ. Elle ne peut plus être modifiée ensuite.",
    categories: { cleanliness: 'Propreté', communication: 'Communication', houseRules: 'Respect du règlement' },
    publicPlaceholder: 'Commentaire public (visible sur le profil Airbnb du voyageur)',
    privatePlaceholder: 'Note privée au voyageur (facultatif)',
    recommend: "J'accueillerais à nouveau ce voyageur",
    submit: "Envoyer l'évaluation",
    confirm: (name) => `Envoyer votre évaluation de ${name} à Airbnb ? Elle ne pourra plus être modifiée.`,
    done: 'Évaluation du voyageur envoyée à Airbnb.',
    error: "Impossible d'envoyer l'évaluation du voyageur.",
  },
};

/** 1 → singular, 2 → dual, 3–10 → plural, 11+ → singular accusative — same rule as the dictionary's arPlural. */
function arReviews(n: number) {
  if (n === 1) return 'تقييم واحد';
  if (n === 2) return 'تقييمان';
  if (n >= 3 && n <= 10) return `${n} تقييمات`;
  return `${n} تقييمًا`;
}

const ar: ReviewsStrings = {
  title: 'التقييمات',
  menuDesc: 'آراء الضيوف حول كل عقار',
  subtitle: 'تقييمات الضيوف من Airbnb وBooking.com — اطّلع على آراء الضيوف حول كل عقار وردّ عليها.',
  subtitleLight: 'تقييمات الضيوف من Airbnb — اطّلع على آراء الضيوف حول كل عقار.',
  allProperties: 'كل العقارات',
  noProperties: 'ليس لديك أي عقار بعد.',
  noReviews: 'لا توجد تقييمات لعرضها هنا بعد.',
  reviewsCount: arReviews,
  noRating: 'لا يوجد تقييم بعد',
  guestFallback: 'أحد الضيوف',
  hostReply: 'ردّك',
  privateFeedback: 'ملاحظة خاصة — لا يراها غيرك',
  hidden: 'غير منشور بعد',
  loadError: 'تعذّر تحميل التقييمات',
  replyButton: 'رد',
  replyPlaceholder: 'اكتب ردك العلني…',
  replyPost: 'نشر الرد',
  cancel: 'إلغاء',
  replyConfirm: (channel) => `سيكون هذا الرد علنياً على ${channel} ولا يمكن تعديله بعد ذلك. هل تريد نشره؟`,
  replyPosted: 'تم نشر الرد.',
  replyError: 'تعذّر نشر الرد.',
  guestReviewed: 'قيّمت هذا الضيف على Airbnb',
  outOf10: (score) => `${score}/10`,
  guestReview: {
    button: 'تقييم الضيف',
    intro: 'تقييمك للضيف على Airbnb — تقييم واحد لكل إقامة، خلال 14 يوماً من المغادرة. لا يمكن تعديله بعد الإرسال.',
    categories: { cleanliness: 'النظافة', communication: 'التواصل', houseRules: 'احترام قواعد المنزل' },
    publicPlaceholder: 'تقييم علني (يظهر في ملف الضيف على Airbnb)',
    privatePlaceholder: 'ملاحظة خاصة للضيف (اختياري)',
    recommend: 'أرحّب باستضافة هذا الضيف مجدداً',
    submit: 'إرسال التقييم',
    confirm: (name) => `إرسال تقييمك لـ ${name} إلى Airbnb؟ لا يمكن تعديله بعد ذلك.`,
    done: 'تم إرسال تقييم الضيف إلى Airbnb.',
    error: 'تعذّر إرسال تقييم الضيف.',
  },
};

const STRINGS = { EN: en, FR: fr, AR: ar };

export function useReviewsStrings(): ReviewsStrings {
  const { lang } = useLanguage();
  return STRINGS[lang] ?? en;
}
