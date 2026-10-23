// Student survey run by the team with Google Forms, 19-21 October 2026.
// Convenience sample: 16 responses from 12 institutions. Counts below are copied
// from the exported sheet; nothing is weighted or extrapolated here.

export type SurveyOption = { key: string; en: string; bn: string; count: number };
export type SurveyQuestion = { id: string; en: string; bn: string; multi?: boolean; options: SurveyOption[] };

export const SURVEY_N = 16;
export const SURVEY_WINDOW = '19-21 Oct 2026';
export const SURVEY_INSTITUTIONS = [
  'BUET', 'DU', 'JU', 'KUET', 'BAU', 'GAU', 'SAU', 'BUTEX', 'SSTU', 'UIU',
  'AFMC', 'Shaheed Ziaur Rahman Medical College',
];

export const SURVEY: SurveyQuestion[] = [
  {
    id: 'hallType',
    en: 'Building layout of your hall',
    bn: 'আপনার আবাসিক হলের ভবনের ধরন বা কাঠামো কেমন?',
    options: [
      { key: 'corridor', en: 'Long corridor / block', bn: 'লম্বা করিডোর বা ব্লক ভিত্তিক হল', count: 14 },
      { key: 'unit', en: 'Unit / flat', bn: 'ইউনিট বা ফ্ল্যাট ভিত্তিক হল', count: 2 },
    ],
  },
  {
    id: 'roomSize',
    en: 'Students per room',
    bn: 'আপনার রুমে সাধারণত কতজন শিক্ষার্থী থাকেন?',
    options: [
      { key: '3-4', en: '3-4 students (1-2 fans, 2-3 lights)', bn: '৩–৪ জন', count: 12 },
      { key: '1-2', en: '1-2 students (1 fan, 1-2 lights)', bn: '১–২ জন', count: 3 },
      { key: '4+', en: 'More than 4', bn: '৪ জনের বেশি', count: 1 },
    ],
  },
  {
    id: 'devices',
    en: 'Personal devices used regularly in the room (multiple answers)',
    bn: 'রুমে নিয়মিত ব্যবহৃত ব্যক্তিগত ইলেকট্রনিক ডিভাইস',
    multi: true,
    options: [
      { key: 'charger', en: 'Mobile charger', bn: 'মোবাইল চার্জার', count: 14 },
      { key: 'gadgets', en: 'Power bank, router, other gadgets', bn: 'পাওয়ার ব্যাংক ও রাউটার/অন্যান্য গ্যাজেট', count: 14 },
      { key: 'lamp', en: 'Extra study lamp or tube light', bn: 'অতিরিক্ত স্টাডি ল্যাম্প বা টিউব লাইট', count: 13 },
      { key: 'tableFan', en: 'Personal table fan', bn: 'ব্যক্তিগত টেবিল ফ্যান / মিনি ফ্যান', count: 11 },
      { key: 'laptop', en: 'Laptop', bn: 'ল্যাপটপ', count: 7 },
      { key: 'desktop', en: 'Desktop computer and monitor', bn: 'ডেস্কটপ কম্পিউটার ও মনিটর', count: 3 },
    ],
  },
  {
    id: 'tank',
    en: 'How often does the roof tank overflow?',
    bn: 'ছাদের পানির ট্যাংক ওভারফ্লো কত ঘন ঘন ঘটে?',
    options: [
      { key: 'daily', en: 'Almost every day', bn: 'প্রায় প্রতিদিনই ঘটে', count: 1 },
      { key: 'weekly', en: '2-3 days a week', bn: 'মাঝে মাঝে সপ্তাহে ২–৩ দিন ঘটে', count: 5 },
      { key: 'rare', en: 'Rarely', bn: 'খুব কম বা কদাচিৎ ঘটে', count: 5 },
      { key: 'auto', en: 'Already has a float switch, no overflow', bn: 'অটোমেশন বা ফ্লোট সুইচ আছে', count: 5 },
    ],
  },
  {
    id: 'commonLights',
    en: 'Common-area lights left on with nobody around',
    bn: 'কমন স্পেসে অপ্রয়োজনে লাইট জ্বলে থাকতে দেখেন কি?',
    options: [
      { key: 'daily', en: 'Almost daily, 4-8 h in daytime', bn: 'প্রায় প্রতিদিনই দিনের বেলা ৪–৮ ঘণ্টা', count: 6 },
      { key: 'sometimes', en: 'Sometimes, 2-4 h', bn: 'মাঝে মাঝে ২–৪ ঘণ্টা', count: 6 },
      { key: 'night', en: 'Only at night (washroom/corridor)', bn: 'শুধু রাতে ওয়াশরুম বা করিডোরে', count: 3 },
      { key: 'no', en: 'No, switched off on time', bn: 'না, সময়মতো বন্ধ করা হয়', count: 1 },
    ],
  },
  {
    id: 'roomLeftOn',
    en: 'Fans or lights left on when leaving for class',
    bn: 'ক্লাসে যাওয়ার সময় ফ্যান বা লাইট ভুলবশত চালু রেখে যাওয়া',
    options: [
      { key: 'often', en: 'Often', bn: 'হ্যাঁ, প্রায়ই', count: 5 },
      { key: 'sometimes', en: 'Sometimes (1-3 times a week)', bn: 'মাঝে মাঝে (সপ্তাহে ১–৩ বার)', count: 6 },
      { key: 'rarely', en: 'Rarely or never', bn: 'খুবই কম বা কখনোই না', count: 5 },
    ],
  },
  {
    id: 'heating',
    en: 'Kettles, rice cookers, heaters or irons in rooms',
    bn: 'রুমে কেটলি, রাইস কুকার, হিটার বা ইস্ত্রি ব্যবহার',
    options: [
      { key: 'limited', en: 'Limited: kettle or iron only', bn: 'সীমিত পরিসরে (শুধু কেটলি বা আয়রন)', count: 10 },
      { key: 'regular', en: 'Many use rice cookers / heaters regularly', bn: 'অনেকেই নিয়মিত রাইস কুকার / কেটলি / হিটার ব্যবহার করেন', count: 5 },
      { key: 'none', en: 'Not used at all', bn: 'একদমই ব্যবহৃত হয় না', count: 1 },
    ],
  },
  {
    id: 'pantry',
    en: 'Would students use a shared induction cooker on each floor?',
    bn: 'প্রতি ফ্লোরে শেয়ারড ইনডাকশন কুকার জোন থাকলে শিক্ষার্থীরা ব্যবহার করবে?',
    options: [
      { key: 'yes', en: 'Yes', bn: 'হ্যাঁ, অবশ্যই ব্যবহার করবে', count: 9 },
      { key: 'partly', en: 'Partly', bn: 'হয়তো আংশিক ব্যবহার করবে', count: 3 },
      { key: 'no', en: 'No, prefer in the room', bn: 'না, রুমের ভেতরেই চালাতে পছন্দ করবে', count: 4 },
    ],
  },
  {
    id: 'reminder',
    en: 'Would a class-time reminder plus sensor lights in common areas reduce waste?',
    bn: 'ক্লাসের সময় রিমাইন্ডার ও কমন স্পেসে সেন্সর লাইট বিদ্যুৎ অপচয় কমাবে?',
    options: [
      { key: 'yes', en: 'Yes, a lot', bn: 'হ্যাঁ, অত্যন্ত বাস্তবসম্মত', count: 10 },
      { key: 'some', en: 'Somewhat', bn: 'কিছুটা কমবে', count: 5 },
      { key: 'no', en: 'Little effect', bn: 'তেমন প্রভাব পড়বে না', count: 1 },
    ],
  },
  {
    id: 'reward',
    en: 'Would a dining-coupon reward for the best floor change behaviour?',
    bn: 'সেরা ফ্লোরকে ডাইনিং কুপন দিলে রুমমেটরা সচেতন হবে?',
    options: [
      { key: 'yes', en: 'Yes, everyone would join in', bn: 'হ্যাঁ, সবাই মিলে সচেতন হবে', count: 8 },
      { key: 'some', en: 'Some more awareness', bn: 'কিছুটা সচেতনতা বাড়বে', count: 6 },
      { key: 'no', en: 'No change', bn: 'কোনো পরিবর্তন হবে না', count: 2 },
    ],
  },
];

export const SURVEY_LIMITS = [
  'Convenience sample shared through personal networks; not representative of all halls.',
  'Answers describe what students notice, not metered consumption.',
  'The reminder question combines two ideas (reminder and sensor lights), so its result cannot be split between them.',
  'Multiple respondents can be from the same hall.',
];

export function count(questionId: string, key: string): number {
  const q = SURVEY.find((x) => x.id === questionId);
  return q?.options.find((o) => o.key === key)?.count ?? 0;
}

export function share(questionId: string, key: string): number {
  return count(questionId, key) / SURVEY_N;
}
