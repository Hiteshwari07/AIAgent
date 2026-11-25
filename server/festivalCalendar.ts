import type { OccasionType } from '../src/types';

export interface FestivalCatalogEntry {
  slug: OccasionType;
  name: string;
  type: 'indian_festival' | 'national_special_day';
  dates: string[]; // Sorted chronological YYYY-MM-DD dates across 2026-2027+
  visualTheme: string;
  suggestedGreeting: {
    english: string;
    hindi: string;
    gujarati: string;
  };
}

export const FESTIVAL_CATALOG: FestivalCatalogEntry[] = [
  // 16 Indian & International Festivals
  {
    slug: 'diwali',
    name: 'Diwali',
    type: 'indian_festival',
    dates: ['2026-11-08', '2027-10-29'],
    visualTheme: 'Deep maroon, obsidian and warm gold, glowing brass diyas, delicate warm string lights, subtle floral rangoli rim light',
    suggestedGreeting: {
      english: 'Wishing You a Radiant & Prosperous Diwali',
      hindi: 'दीपावली की हार्दिक शुभकामनाएँ',
      gujarati: 'દિવાળીની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'dhanteras',
    name: 'Dhanteras',
    type: 'indian_festival',
    dates: ['2026-11-06', '2027-10-27'],
    visualTheme: 'Luxurious dark emerald, antique gold lustre, brass kalash silhouette, warm temple lamp glow',
    suggestedGreeting: {
      english: 'May Dhanteras Bring Abundance & Lasting Prosperity',
      hindi: 'धनतेरस के पावन पर्व की मंगलमय शुभकामनाएँ',
      gujarati: 'ધનતેરસના પાવન પર્વની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'navratri',
    name: 'Navratri',
    type: 'indian_festival',
    dates: ['2026-10-11', '2027-10-01'],
    visualTheme: 'Royal indigo, crimson and saffron gold, ornate traditional lamps, festive dandiya silhouettes in warm bokeh',
    suggestedGreeting: {
      english: 'Celebrating Devotion, Energy & Grace This Navratri',
      hindi: 'शारदीय नवरात्रि की हार्दिक शुभकामनाएँ',
      gujarati: 'નવરાત્રિના પાવન પર્વની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'durga_puja',
    name: 'Durga Puja',
    type: 'indian_festival',
    dates: ['2026-10-17', '2027-10-07'],
    visualTheme: 'Rich vermilion red, ivory silk texture, warm dhunuchi incense mist and golden pandal chandelier glow',
    suggestedGreeting: {
      english: 'Warmest Greetings on the Auspicious Occasion of Durga Puja',
      hindi: 'दुर्गा पूजा के शुभ अवसर पर हार्दिक बधाई',
      gujarati: 'દુર્ગા પૂજાના શુભ અવસરે હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'dussehra',
    name: 'Dussehra (Vijayadashami)',
    type: 'indian_festival',
    dates: ['2026-10-20', '2027-10-10'],
    visualTheme: 'Saffron amber, royal bronze and midnight slate, ceremonial golden arch and warm celebratory sparkles',
    suggestedGreeting: {
      english: 'Celebrating the Triumph of Vision, Purpose & Truth',
      hindi: 'विजयादशमी एवं दशहरा की हार्दिक शुभकामनाएँ',
      gujarati: 'વિજયાદશમી અને દશેરાની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'ganesh_chaturthi',
    name: 'Ganesh Chaturthi',
    type: 'indian_festival',
    dates: ['2026-09-14', '2027-09-04'],
    visualTheme: 'Deep saffron maroon, marigold petals bokeh, warm brass diya reflections, serene temple architecture lighting',
    suggestedGreeting: {
      english: 'May Lord Ganesha Bless Your Endeavors With Wisdom & Success',
      hindi: 'गणेश चतुर्थी की मंगलमय शुभकामनाएँ',
      gujarati: 'ગણેશ ચતુર્થીની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'janmashtami',
    name: 'Janmashtami',
    type: 'indian_festival',
    dates: ['2026-09-04', '2027-08-25'],
    visualTheme: 'Midnight peacock blue, emerald teal and gold flute silhouette, delicate peacock feather iridescence',
    suggestedGreeting: {
      english: 'Joyous Janmashtami Wishes Filled With Harmony & Grace',
      hindi: 'श्री कृष्ण जन्माष्टमी की हार्दिक शुभकामनाएँ',
      gujarati: 'શ્રી કૃષ્ણ જન્માષ્ટમીની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'raksha_bandhan',
    name: 'Raksha Bandhan',
    type: 'indian_festival',
    dates: ['2026-08-28', '2027-08-17'],
    visualTheme: 'Warm rose gold, satin crimson and pearl highlights, delicate silk threads and soft studio bokeh',
    suggestedGreeting: {
      english: 'Celebrating Bonds of Trust, Care & Lifelong Support',
      hindi: 'रक्षाबंधन के पावन पर्व की हार्दिक शुभकामनाएँ',
      gujarati: 'રક્ષાબંધનના પાવન પર્વની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'holi',
    name: 'Holi',
    type: 'indian_festival',
    dates: ['2026-03-04', '2027-03-22'],
    visualTheme: 'Dark obsidian studio backdrop with refined clouds of magenta, saffron, cobalt and turquoise organic gulal pigment',
    suggestedGreeting: {
      english: 'Wishing Your Team a Vibrant & Joyous Holi',
      hindi: 'होली के रंगोत्सव की हार्दिक शुभकामनाएँ',
      gujarati: 'હોળી અને ધુળેટીની રંગીન શુભેચ્છાઓ',
    },
  },
  {
    slug: 'uttarayan',
    name: 'Uttarayan / Makar Sankranti',
    type: 'indian_festival',
    dates: ['2026-01-14', '2027-01-14'],
    visualTheme: 'Warm golden-hour twilight sky gradient, minimalist geometric paper kites soaring in distance, crisp modern clean horizon',
    suggestedGreeting: {
      english: 'Soaring Higher Together This Uttarayan & Makar Sankranti',
      hindi: 'मकर संक्रांति एवं उत्तरायण की हार्दिक शुभकामनाएँ',
      gujarati: 'ઉત્તરાયણ અને મકરસંક્રાંતિની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'pongal',
    name: 'Pongal',
    type: 'indian_festival',
    dates: ['2026-01-15', '2027-01-15'],
    visualTheme: 'Warm terracotta, golden harvest stalks, rising morning sunbeams and intricate subtle kolam floor geometry',
    suggestedGreeting: {
      english: 'Wishing You Abundant Harvest & Prosperity This Pongal',
      hindi: 'पोंगल के शुभ पर्व की हार्दिक शुभकामनाएँ',
      gujarati: 'પોંગલ પર્વની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'onam',
    name: 'Onam',
    type: 'indian_festival',
    dates: ['2026-08-26', '2027-09-14'],
    visualTheme: 'Ivory kasavu gold weave texture, deep forest green and subtle marigold floral pookalam rim',
    suggestedGreeting: {
      english: 'Warmest Wishes for Peace, Harvest & Prosperity This Onam',
      hindi: 'ओणम के पावन पर्व की हार्दिक शुभकामनाएँ',
      gujarati: 'ઓણમના પાવન પર્વની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'eid_ul_fitr',
    name: 'Eid-ul-Fitr',
    type: 'indian_festival',
    dates: ['2026-03-20', '2027-03-10'],
    visualTheme: 'Deep emerald and midnight navy, burnished brass fanoos lanterns, slender crescent moon light and geometric filigree',
    suggestedGreeting: {
      english: 'Eid Mubarak — Wishing You Peace, Joy & Shared Success',
      hindi: 'ईद-उल-फितर की दिली मुबारकबाद',
      gujarati: 'ઈદ-ઉલ-ફિત્રની હાર્દિક મુબારકબાદી',
    },
  },
  {
    slug: 'eid_ul_adha',
    name: 'Eid-ul-Adha',
    type: 'indian_festival',
    dates: ['2026-05-27', '2027-05-17'],
    visualTheme: 'Refined midnight teal, champagne gold arabesque arch silhouette and warm ambient lantern glow',
    suggestedGreeting: {
      english: 'Warmest Blessings on Eid-ul-Adha to You & Your Family',
      hindi: 'ईद-उल-अज़हा की हार्दिक मुबारकबाद',
      gujarati: 'ઈદ-ઉલ-અઝહાની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'christmas',
    name: 'Christmas',
    type: 'indian_festival',
    dates: ['2026-12-25', '2027-12-25'],
    visualTheme: 'Deep spruce emerald, cardinal crimson and champagne gold light bokeh, subtle winter pine silhouettes',
    suggestedGreeting: {
      english: 'Season’s Greetings & Merry Christmas From Our Team',
      hindi: 'क्रिसमस की हार्दिक शुभकामनाएँ',
      gujarati: 'નાતાલ (ક્રિસમસ) ની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'new_year',
    name: 'New Year',
    type: 'indian_festival',
    dates: ['2027-01-01', '2028-01-01'],
    visualTheme: 'Architectural obsidian slate, champagne gold starbursts bokeh, sleek modern metallic light rays',
    suggestedGreeting: {
      english: 'Wishing You Innovation, Growth & Success in the New Year',
      hindi: 'नव वर्ष की हार्दिक शुभकामनाएँ',
      gujarati: 'નૂતન વર્ષની હાર્દિક શુભેચ્છાઓ',
    },
  },

  // 13 National & Special Days
  {
    slug: 'republic_day',
    name: 'Republic Day',
    type: 'national_special_day',
    dates: ['2026-01-26', '2027-01-26'],
    visualTheme: 'Deep navy slate horizon illuminated with dignified saffron, crisp white and emerald tricolor light ribbons',
    suggestedGreeting: {
      english: 'Honoring Our Constitution & Progress This Republic Day',
      hindi: 'गणतंत्र दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'પ્રજાસત્તાક દિનની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'independence_day',
    name: 'Independence Day',
    type: 'national_special_day',
    dates: ['2026-08-15', '2027-08-15'],
    visualTheme: 'Editorial midnight indigo sky with graceful saffron, pearl white and emerald tricolor architectural lighting',
    suggestedGreeting: {
      english: 'Celebrating Freedom, Innovation & Nation Building',
      hindi: 'स्वतंत्रता दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'સ્વાતંત્ર્ય દિનની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'gandhi_jayanti',
    name: 'Gandhi Jayanti',
    type: 'national_special_day',
    dates: ['2026-10-02', '2027-10-02'],
    visualTheme: 'Minimalist warm khadi linen weave dark vignette, soft dawn light rays and subtle bronze minimalist charkha motif',
    suggestedGreeting: {
      english: 'Remembering Truth, Integrity & Purposeful Leadership',
      hindi: 'गांधी जयंती पर सादर नमन एवं शुभकामनाएँ',
      gujarati: 'ગાંધી જયંતિ નિમિત્તે સાદર વંદન',
    },
  },
  {
    slug: 'womens_day',
    name: "International Women's Day",
    type: 'national_special_day',
    dates: ['2026-03-08', '2027-03-08'],
    visualTheme: 'Deep plum violet slate, rose gold geometric light waves, refined editorial botanical shadows',
    suggestedGreeting: {
      english: 'Celebrating Visionary Women Leading Innovation & Impact',
      hindi: 'अंतर्राष्ट्रीय महिला दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'આંતરરાષ્ટ્રીય મહિલા દિવસની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'teachers_day',
    name: "Teachers' Day",
    type: 'national_special_day',
    dates: ['2026-09-05', '2027-09-05'],
    visualTheme: 'Deep library mahogany, warm amber study lamp light and subtle minimalist geometric open book silhouette',
    suggestedGreeting: {
      english: 'Gratitude to Mentors Who Inspire Lifelong Excellence',
      hindi: 'शिक्षक दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'શિક્ષક દિનની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'childrens_day',
    name: "Children's Day",
    type: 'national_special_day',
    dates: ['2026-11-14', '2027-11-14'],
    visualTheme: 'Modern deep cobalt blue with warm coral, amber and mint origami paper plane silhouettes floating cleanly',
    suggestedGreeting: {
      english: 'Celebrating Curiosity, Imagination & Tomorrow’s Builders',
      hindi: 'बाल दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'બાળ દિનની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'labour_day',
    name: 'Labour Day',
    type: 'national_special_day',
    dates: ['2026-05-01', '2027-05-01'],
    visualTheme: 'Industrial architectural steel slate, warm copper directional rim light and clean minimalist geometric structure',
    suggestedGreeting: {
      english: 'Saluting Dedication, Craftsmanship & Hard Work',
      hindi: 'अंतर्राष्ट्रीय श्रमिक दिवस पर सलाम एवं शुभकामनाएँ',
      gujarati: 'આંતરરાષ્ટ્રીય શ્રમિક દિનની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'environment_day',
    name: 'World Environment Day',
    type: 'national_special_day',
    dates: ['2026-06-05', '2027-06-05'],
    visualTheme: 'Deep forest emerald foliage in soft studio rim lighting, morning dew bokeh, sustainable architectural glass',
    suggestedGreeting: {
      english: 'Building a Cleaner, Greener & Sustainable Future Together',
      hindi: 'विश्व पर्यावरण दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'વિશ્વ પર્યાવરણ દિનની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'yoga_day',
    name: 'International Yoga Day',
    type: 'national_special_day',
    dates: ['2026-06-21', '2027-06-21'],
    visualTheme: 'Serene sunrise amber and deep indigo horizon, tranquil rippled water reflections and sacred geometry lotus rings',
    suggestedGreeting: {
      english: 'Harmony of Mind, Body & Work — Happy International Yoga Day',
      hindi: 'अंतर्राष्ट्रीय योग दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'આંતરરાષ્ટ્રીય યોગ દિવસની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'health_day',
    name: 'World Health Day',
    type: 'national_special_day',
    dates: ['2026-04-07', '2027-04-07'],
    visualTheme: 'Clean clinical teal and deep obsidian studio backdrop with luminous cyan pulse light wave and soft depth of field',
    suggestedGreeting: {
      english: 'Prioritizing Wellbeing, Vitality & Preventive Care Every Day',
      hindi: 'विश्व स्वास्थ्य दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'વિશ્વ આરોગ્ય દિનની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'engineers_day',
    name: "Engineers' Day",
    type: 'national_special_day',
    dates: ['2026-09-15', '2027-09-15'],
    visualTheme: 'Architectural blueprint cobalt navy, precision cyan laser grid geometry and brushed aluminum highlights',
    suggestedGreeting: {
      english: 'Celebrating the Engineers Who Architect Tomorrow’s Systems',
      hindi: 'अभियंता दिवस (इंजीनियर्स डे) की हार्दिक शुभकामनाएँ',
      gujarati: 'એન્જિનિયર્સ ડેની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'technology_day',
    name: 'National Technology Day',
    type: 'national_special_day',
    dates: ['2026-05-11', '2027-05-11'],
    visualTheme: 'Sleek dark carbon fiber studio, subtle holographic sapphire light beams and neural mesh depth',
    suggestedGreeting: {
      english: 'Empowering Progress Through Deep Tech & Digital Excellence',
      hindi: 'राष्ट्रीय प्रौद्योगिकी दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'રાષ્ટ્રીય ટેક્નોલોજી દિવસની હાર્દિક શુભેચ્છાઓ',
    },
  },
  {
    slug: 'entrepreneurs_day',
    name: "World Entrepreneurs' Day",
    type: 'national_special_day',
    dates: ['2026-08-21', '2027-08-21'],
    visualTheme: 'Executive charcoal slate, warm brass architectural light columns and ascending minimalist geometric horizon',
    suggestedGreeting: {
      english: 'Honoring Bold Founders & Visionary Business Leaders',
      hindi: 'विश्व उद्यमी दिवस की हार्दिक शुभकामनाएँ',
      gujarati: 'વિશ્વ ઉદ્યોગસાહસિક દિનની હાર્દિક શુભેચ્છાઓ',
    },
  },
];

export function getUpcomingFestivals(referenceDate = new Date()) {
  const todayUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );

  const items = FESTIVAL_CATALOG.map((entry) => {
    const parsedDates = entry.dates
      .map((dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const utc = Date.UTC(y, m - 1, d);
        const daysUntil = Math.round((utc - todayUtc) / 86400000);
        return { dateStr, year: y, daysUntil };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const nextUpcoming = parsedDates.find((item) => item.daysUntil >= 0) || parsedDates[parsedDates.length - 1];

    return {
      id: `${entry.slug}-${nextUpcoming.dateStr}`,
      slug: entry.slug,
      name: entry.name,
      type: entry.type,
      date: nextUpcoming.dateStr,
      year: nextUpcoming.year,
      daysUntil: nextUpcoming.daysUntil,
      visualTheme: entry.visualTheme,
      suggestedGreeting: entry.suggestedGreeting,
    };
  });

  return items.sort((a, b) => {
    if (a.daysUntil >= 0 && b.daysUntil < 0) return -1;
    if (a.daysUntil < 0 && b.daysUntil >= 0) return 1;
    return a.daysUntil - b.daysUntil;
  });
}
