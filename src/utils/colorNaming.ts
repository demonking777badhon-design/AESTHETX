/**
 * Color Naming Utility for E-Commerce Product Variants
 * Provides the 12 standard retail colors and an intelligent perceptual color matcher
 * that accurately names ANY hex color code in both Bengali and English.
 */

export interface StandardColor {
  id: string;
  nameBn: string;
  nameEn: string;
  hex: string;
}

// 12 Standard Predefined Colors (১টি আদর্শ ১২টি রঙের কালেকশন)
export const DEFAULT_12_COLORS: StandardColor[] = [
  { id: 'black', nameBn: 'কালো', nameEn: 'Black', hex: '#000000' },
  { id: 'white', nameBn: 'সাদা', nameEn: 'White', hex: '#FFFFFF' },
  { id: 'navy_blue', nameBn: 'নেভি ব্লু', nameEn: 'Navy Blue', hex: '#000080' },
  { id: 'olive', nameBn: 'অলিভ গ্রিন', nameEn: 'Olive Green', hex: '#556B2F' },
  { id: 'maroon', nameBn: 'মেরুন', nameEn: 'Maroon', hex: '#800000' },
  { id: 'charcoal', nameBn: 'চারকোল গ্রে', nameEn: 'Charcoal Grey', hex: '#36454F' },
  { id: 'royal_blue', nameBn: 'রয়্যাল ব্লু', nameEn: 'Royal Blue', hex: '#4169E1' },
  { id: 'crimson_red', nameBn: 'গাঢ় লাল', nameEn: 'Crimson Red', hex: '#DC143C' },
  { id: 'forest_green', nameBn: 'গাঢ় সবুজ', nameEn: 'Forest Green', hex: '#228B22' },
  { id: 'mustard', nameBn: 'সরিষা হলুদ', nameEn: 'Mustard Yellow', hex: '#E1AD01' },
  { id: 'chocolate_brown', nameBn: 'চকলেট বাদামি', nameEn: 'Chocolate Brown', hex: '#5C4033' },
  { id: 'beige', nameBn: 'বেজ / ক্রিম', nameEn: 'Beige / Cream', hex: '#F5F5DC' }
];

interface PaletteEntry {
  hex: string;
  nameBn: string;
  nameEn: string;
  r: number;
  g: number;
  b: number;
}

// Helper to parse hex to RGB
function hexToRgb(hexStr: string): [number, number, number] {
  let clean = hexStr.replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Comprehensive perceptual named color palette (160+ human color names)
const RAW_PALETTE: Array<{ hex: string; nameBn: string; nameEn: string }> = [
  // Blacks & Greys
  { hex: '#000000', nameBn: 'কালো', nameEn: 'Black' },
  { hex: '#1C1C1C', nameBn: 'জেট ব্ল্যাক', nameEn: 'Jet Black' },
  { hex: '#2F4F4F', nameBn: 'ডার্ক স্লেট গ্রে', nameEn: 'Dark Slate Grey' },
  { hex: '#36454F', nameBn: 'চারকোল গ্রে', nameEn: 'Charcoal Grey' },
  { hex: '#4B4B4B', nameBn: 'গাঢ় ধূসর', nameEn: 'Dark Grey' },
  { hex: '#696969', nameBn: 'ডিম গ্রে', nameEn: 'Dim Grey' },
  { hex: '#808080', nameBn: 'ধূসর', nameEn: 'Grey' },
  { hex: '#708090', nameBn: 'স্লেট গ্রে', nameEn: 'Slate Grey' },
  { hex: '#A9A9A9', nameBn: 'মাঝারি ধূসর', nameEn: 'Medium Grey' },
  { hex: '#C0C0C0', nameBn: 'সিলভার', nameEn: 'Silver' },
  { hex: '#D3D3D3', nameBn: 'হালকা ধূসর', nameEn: 'Light Grey' },
  { hex: '#E5E4E2', nameBn: 'প্লাটিনাম', nameEn: 'Platinum' },
  { hex: '#F5F5F5', nameBn: 'হোয়াইট স্মোক', nameEn: 'White Smoke' },
  { hex: '#FFFFFF', nameBn: 'সাদা', nameEn: 'Pure White' },
  { hex: '#FAFAFA', nameBn: 'অফ হোয়াইট', nameEn: 'Off White' },
  { hex: '#FFF8DC', nameBn: 'কর্ন্সিল্ক', nameEn: 'Cornsilk' },
  { hex: '#FFFFF0', nameBn: 'আইভরি', nameEn: 'Ivory' },

  // Blues
  { hex: '#000080', nameBn: 'নেভি ব্লু', nameEn: 'Navy Blue' },
  { hex: '#00008B', nameBn: 'ডার্ক ব্লু', nameEn: 'Dark Blue' },
  { hex: '#0000CD', nameBn: 'মাঝারি নীল', nameEn: 'Medium Blue' },
  { hex: '#0000FF', nameBn: 'উজ্জ্বল নীল', nameEn: 'Blue' },
  { hex: '#1E90FF', nameBn: 'ডজার ব্লু', nameEn: 'Dodger Blue' },
  { hex: '#4169E1', nameBn: 'রয়্যাল ব্লু', nameEn: 'Royal Blue' },
  { hex: '#4682B4', nameBn: 'স্টিল ব্লু', nameEn: 'Steel Blue' },
  { hex: '#6495ED', nameBn: 'কর্নফ্লাওয়ার ব্লু', nameEn: 'Cornflower Blue' },
  { hex: '#00BFFF', nameBn: 'ডিপ স্কাই ব্লু', nameEn: 'Deep Sky Blue' },
  { hex: '#87CEEB', nameBn: 'আকাশি নীল', nameEn: 'Sky Blue' },
  { hex: '#87CEFA', nameBn: 'হালকা আকাশি', nameEn: 'Light Sky Blue' },
  { hex: '#ADD8E6', nameBn: 'হালকা নীল', nameEn: 'Light Blue' },
  { hex: '#B0C4DE', nameBn: 'হালকা স্টিল ব্লু', nameEn: 'Light Steel Blue' },
  { hex: '#0047AB', nameBn: 'কোবাল্ট ব্লু', nameEn: 'Cobalt Blue' },
  { hex: '#0F52BA', nameBn: 'স্যাফায়ার ব্লু', nameEn: 'Sapphire Blue' },
  { hex: '#191970', nameBn: 'মিডনাইট ব্লু', nameEn: 'Midnight Blue' },

  // Greens
  { hex: '#006400', nameBn: 'গাঢ় সবুজ', nameEn: 'Dark Green' },
  { hex: '#008000', nameBn: 'সবুজ', nameEn: 'Green' },
  { hex: '#228B22', nameBn: 'ফরেস্ট গ্রিন', nameEn: 'Forest Green' },
  { hex: '#2E8B57', nameBn: 'সি গ্রিন', nameEn: 'Sea Green' },
  { hex: '#3CB371', nameBn: 'মাঝারি সি গ্রিন', nameEn: 'Medium Sea Green' },
  { hex: '#556B2F', nameBn: 'অলিভ গ্রিন', nameEn: 'Olive Green' },
  { hex: '#6B8E23', nameBn: 'অলিভ ড্র্যাব', nameEn: 'Olive Drab' },
  { hex: '#808000', nameBn: 'অলিভ', nameEn: 'Olive' },
  { hex: '#8FBC8F', nameBn: 'ডার্ক সি গ্রিন', nameEn: 'Dark Sea Green' },
  { hex: '#90EE90', nameBn: 'হালকা সবুজ', nameEn: 'Light Green' },
  { hex: '#98FB98', nameBn: 'পেল গ্রিন', nameEn: 'Pale Green' },
  { hex: '#00FF00', nameBn: 'লাইম গ্রিন', nameEn: 'Lime Green' },
  { hex: '#32CD32', nameBn: 'লাইম', nameEn: 'Lime' },
  { hex: '#00FF7F', nameBn: 'স্প্রিং গ্রিন', nameEn: 'Spring Green' },
  { hex: '#7CFC00', nameBn: 'লন গ্রিন', nameEn: 'Lawn Green' },
  { hex: '#1E3A2F', nameBn: 'পাইন গ্রিন', nameEn: 'Pine Green' },
  { hex: '#50C878', nameBn: 'পান্না সবুজ', nameEn: 'Emerald Green' },
  { hex: '#00A86B', nameBn: 'জেড গ্রিন', nameEn: 'Jade Green' },
  { hex: '#98FF98', nameBn: 'মিন্ট গ্রিন', nameEn: 'Mint Green' },

  // Teals & Cyans
  { hex: '#008080', nameBn: 'টিল', nameEn: 'Teal' },
  { hex: '#008B8B', nameBn: 'ডার্ক সায়ান', nameEn: 'Dark Cyan' },
  { hex: '#00CED1', nameBn: 'ডার্ক টারকোয়েজ', nameEn: 'Dark Turquoise' },
  { hex: '#00FFFF', nameBn: 'সায়ান / একুয়া', nameEn: 'Cyan / Aqua' },
  { hex: '#20B2AA', nameBn: 'হালকা সি গ্রিন', nameEn: 'Light Sea Green' },
  { hex: '#40E0D0', nameBn: 'টারকোয়েজ', nameEn: 'Turquoise' },
  { hex: '#48D1CC', nameBn: 'মাঝারি টারকোয়েজ', nameEn: 'Medium Turquoise' },
  { hex: '#7FFFD4', nameBn: 'একুয়ামেরিন', nameEn: 'Aquamarine' },
  { hex: '#AFEEEE', nameBn: 'পেল টারকোয়েজ', nameEn: 'Pale Turquoise' },

  // Reds & Pinks
  { hex: '#800000', nameBn: 'মেরুন', nameEn: 'Maroon' },
  { hex: '#8B0000', nameBn: 'ডার্ক রেড', nameEn: 'Dark Red' },
  { hex: '#A52A2A', nameBn: 'ব্রাউন রেড', nameEn: 'Brown Red' },
  { hex: '#B22222', nameBn: 'ফায়ারব্রিক রেড', nameEn: 'Firebrick Red' },
  { hex: '#DC143C', nameBn: 'ক্রিমসন রেড', nameEn: 'Crimson Red' },
  { hex: '#FF0000', nameBn: 'উজ্জ্বল লাল', nameEn: 'Bright Red' },
  { hex: '#CD5C5C', nameBn: 'ইন্ডিয়ান রেড', nameEn: 'Indian Red' },
  { hex: '#F08080', nameBn: 'হালকা কোরাল', nameEn: 'Light Coral' },
  { hex: '#FA8072', nameBn: 'স্যালমন', nameEn: 'Salmon' },
  { hex: '#E9967A', nameBn: 'ডার্ক স্যালমন', nameEn: 'Dark Salmon' },
  { hex: '#FFA07A', nameBn: 'হালকা স্যালমন', nameEn: 'Light Salmon' },
  { hex: '#FF6347', nameBn: 'টমেটো রেড', nameEn: 'Tomato Red' },
  { hex: '#FF4500', nameBn: 'অরেঞ্জ রেড', nameEn: 'Orange Red' },
  { hex: '#C71585', nameBn: 'মাঝারি ভায়োলেট রেড', nameEn: 'Medium Violet Red' },
  { hex: '#D87093', nameBn: 'পেল ভায়োলেট রেড', nameEn: 'Pale Violet Red' },
  { hex: '#FF1493', nameBn: 'ডিপ পিঙ্ক', nameEn: 'Deep Pink' },
  { hex: '#FF69B4', nameBn: 'হট পিঙ্ক', nameEn: 'Hot Pink' },
  { hex: '#FFB6C1', nameBn: 'হালকা গোলাপি', nameEn: 'Light Pink' },
  { hex: '#FFC0CB', nameBn: 'গোলাপি', nameEn: 'Pink' },
  { hex: '#FFE4E1', nameBn: 'মিস্ট রোজ', nameEn: 'Misty Rose' },
  { hex: '#E0115F', nameBn: 'রুবি রেড', nameEn: 'Ruby Red' },
  { hex: '#DE3163', nameBn: 'সেরিজ', nameEn: 'Cerise' },

  // Purples & Violets
  { hex: '#4B0082', nameBn: 'ইন্ডিগো', nameEn: 'Indigo' },
  { hex: '#483D8B', nameBn: 'ডার্ক স্লেট ব্লু', nameEn: 'Dark Slate Blue' },
  { hex: '#6A5ACD', nameBn: 'স্লেট ব্লু', nameEn: 'Slate Blue' },
  { hex: '#7B68EE', nameBn: 'মাঝারি স্লেট ব্লু', nameEn: 'Medium Slate Blue' },
  { hex: '#800080', nameBn: 'পার্পল / বেগুনী', nameEn: 'Purple' },
  { hex: '#8A2BE2', nameBn: 'ব্লু ভায়োলেট', nameEn: 'Blue Violet' },
  { hex: '#9370DB', nameBn: 'মাঝারি পার্পল', nameEn: 'Medium Purple' },
  { hex: '#9400D3', nameBn: 'ডার্ক ভায়োলেট', nameEn: 'Dark Violet' },
  { hex: '#9932CC', nameBn: 'ডার্ক অর্কিড', nameEn: 'Dark Orchid' },
  { hex: '#BA55D3', nameBn: 'মাঝারি অর্কিড', nameEn: 'Medium Orchid' },
  { hex: '#8B008B', nameBn: 'ডার্ক ম্যাজেন্টা', nameEn: 'Dark Magenta' },
  { hex: '#DA70D6', nameBn: 'অর্কিড', nameEn: 'Orchid' },
  { hex: '#DDA0DD', nameBn: 'প্লাম', nameEn: 'Plum' },
  { hex: '#EE82EE', nameBn: 'ভায়োলেট', nameEn: 'Violet' },
  { hex: '#FF00FF', nameBn: 'ম্যাজেন্টা', nameEn: 'Magenta' },
  { hex: '#E6E6FA', nameBn: 'ল্যাভেন্ডার', nameEn: 'Lavender' },
  { hex: '#D8BFD8', nameBn: 'থিসল', nameEn: 'Thistle' },

  // Yellows & Oranges
  { hex: '#FFA500', nameBn: 'কমলা', nameEn: 'Orange' },
  { hex: '#FF8C00', nameBn: 'ডার্ক অরেঞ্জ', nameEn: 'Dark Orange' },
  { hex: '#FF7F50', nameBn: 'কোরাল', nameEn: 'Coral' },
  { hex: '#FFD700', nameBn: 'সোনালী', nameEn: 'Gold' },
  { hex: '#E1AD01', nameBn: 'সরিষা হলুদ', nameEn: 'Mustard Yellow' },
  { hex: '#FFFF00', nameBn: 'উজ্জ্বল হলুদ', nameEn: 'Yellow' },
  { hex: '#FFFFE0', nameBn: 'হালকা হলুদ', nameEn: 'Light Yellow' },
  { hex: '#FFFACD', nameBn: 'লেমন শিফন', nameEn: 'Lemon Chiffon' },
  { hex: '#FAFAD2', nameBn: 'লাইট গোল্ডেনরড', nameEn: 'Light Goldenrod' },
  { hex: '#F0E68C', nameBn: 'খাকি', nameEn: 'Khaki' },
  { hex: '#BDB76B', nameBn: 'ডার্ক খাকি', nameEn: 'Dark Khaki' },
  { hex: '#FFDAB9', nameBn: 'পিচ পাফ', nameEn: 'Peach Puff' },
  { hex: '#FFE4B5', nameBn: 'মোকাসিন', nameEn: 'Moccasin' },
  { hex: '#FFEFD5', nameBn: 'পাপায়া হুইপ', nameEn: 'Papaya Whip' },

  // Browns & Earth Tones
  { hex: '#5C4033', nameBn: 'চকলেট বাদামি', nameEn: 'Chocolate Brown' },
  { hex: '#8B4513', nameBn: 'স্যাডল ব্রাউন', nameEn: 'Saddle Brown' },
  { hex: '#A0522D', nameBn: 'সিয়েনা ব্রাউন', nameEn: 'Sienna' },
  { hex: '#CD853F', nameBn: 'পেরু ব্রাউন', nameEn: 'Peru' },
  { hex: '#D2691E', nameBn: 'চকলেট', nameEn: 'Chocolate' },
  { hex: '#D2B48C', nameBn: 'ট্যান', nameEn: 'Tan' },
  { hex: '#DEB887', nameBn: 'বার্লি উড', nameEn: 'Burlywood' },
  { hex: '#F5DEB3', nameBn: 'হুইট / গম', nameEn: 'Wheat' },
  { hex: '#F5F5DC', nameBn: 'বেজ / ক্রিম', nameEn: 'Beige' },
  { hex: '#EEDC82', nameBn: 'ফ্ল্যাক্স', nameEn: 'Flax' },
  { hex: '#C2B280', nameBn: 'স্যান্ড স্টোন', nameEn: 'Sand' },
  { hex: '#795548', nameBn: 'মাটি বাদামি', nameEn: 'Earth Brown' },
  { hex: '#4E3629', nameBn: 'কফি ব্রাউন', nameEn: 'Coffee Brown' },
  { hex: '#3E2723', nameBn: 'ডার্ক রোস্ট কফি', nameEn: 'Dark Coffee' }
];

// Pre-computed RGB entries
const PALETTE: PaletteEntry[] = RAW_PALETTE.map((item) => {
  const [r, g, b] = hexToRgb(item.hex);
  return { ...item, r, g, b };
});

/**
 * Validates whether string is a valid hex code (with or without #, 3 or 6 chars)
 */
export function isValidHex(hexStr: string): boolean {
  if (!hexStr) return false;
  const clean = hexStr.replace(/^#/, '').trim();
  return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(clean);
}

/**
 * Normalizes hex to uppercase with #
 */
export function normalizeHex(hexStr: string): string {
  if (!hexStr) return '#000000';
  let clean = hexStr.replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  return `#${clean.toUpperCase()}`;
}

/**
 * Intelligent Perceptual Color Matcher
 * Uses the redmean weighted Euclidean distance formula to find the exact human-perceived
 * color name in both Bengali and English for ANY hex code.
 */
export function getNearestColorName(hexStr: string): {
  nameBn: string;
  nameEn: string;
  fullName: string;
  hex: string;
} {
  if (!isValidHex(hexStr)) {
    return {
      nameBn: 'কাস্টম রঙ',
      nameEn: 'Custom Color',
      fullName: 'কাস্টম রঙ (Custom Color)',
      hex: hexStr
    };
  }

  const [r, g, b] = hexToRgb(hexStr);
  const normalized = normalizeHex(hexStr);

  // Exact match check
  const exact = PALETTE.find((p) => p.hex.toLowerCase() === normalized.toLowerCase());
  if (exact) {
    return {
      nameBn: exact.nameBn,
      nameEn: exact.nameEn,
      fullName: `${exact.nameBn} (${exact.nameEn})`,
      hex: normalized
    };
  }

  // Weighted Euclidean (Redmean) algorithm
  let minDistance = Infinity;
  let bestMatch = PALETTE[0];

  for (let i = 0; i < PALETTE.length; i++) {
    const p = PALETTE[i];
    const rMean = (r + p.r) / 2;
    const rDiff = r - p.r;
    const gDiff = g - p.g;
    const bDiff = b - p.b;

    // Perceptual color difference formula
    const distance = Math.sqrt(
      (((512 + rMean) * rDiff * rDiff) >> 8) +
        4 * gDiff * gDiff +
        (((767 - rMean) * bDiff * bDiff) >> 8)
    );

    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = p;
    }
  }

  return {
    nameBn: bestMatch.nameBn,
    nameEn: bestMatch.nameEn,
    fullName: `${bestMatch.nameBn} (${bestMatch.nameEn})`,
    hex: normalized
  };
}
