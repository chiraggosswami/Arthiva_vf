export type Seller = {
  id: string;
  name: string;
  category: string;
  tagline: string;
  description?: string;
  accentColor: {
    primary: string;       // Main brand tone (e.g. sidebar, primary buttons)
    secondary: string;     // Support tone (icons, pills)
    highlight: string;     // High-energy accent (dots, badges, warnings)
    lightBg: string;       // Subtle tinted background for cards/chips
    border: string;        // Accent border
  };
  productIds: string[];
  sampleAov: number;
  monthlyOrders: number;
  isCustom?: boolean;
  createdAt?: string;
  connectionMode?: 'live_sync' | 'csv_import' | 'demo';
  connectionStatus?: 'not_connected' | 'connecting' | 'connected' | 'error';
  lastConnectedAt?: string;
  paletteIndex?: number;
};

export const BRAND_PALETTES = [
  {
    name: 'Royal Amber (Toys & Kids)',
    primary: '#143438',
    secondary: '#1d735f',
    highlight: '#f59e0b',
    lightBg: '#fef3c7',
    border: '#fcd34d'
  },
  {
    name: 'Ink Teal (Skincare)',
    primary: '#0e3b43',
    secondary: '#1f8a5b',
    highlight: '#f5a524',
    lightBg: '#eaf5ef',
    border: '#9bbcaf'
  },
  {
    name: 'Ruby Plum (Ethnic & Couture)',
    primary: '#831843',
    secondary: '#be185d',
    highlight: '#f43f5e',
    lightBg: '#fdf2f8',
    border: '#f472b6'
  },
  {
    name: 'Cobalt Navy (Performance / Gear)',
    primary: '#1e3a8a',
    secondary: '#2563eb',
    highlight: '#06b6d4',
    lightBg: '#eff6ff',
    border: '#93c5fd'
  },
  {
    name: 'Burnt Terracotta (Home & Decor)',
    primary: '#9a3412',
    secondary: '#c2410c',
    highlight: '#d97706',
    lightBg: '#fff7ed',
    border: '#fdba74'
  },
  {
    name: 'Emerald Forest (Organic / Nature)',
    primary: '#064e3b',
    secondary: '#059669',
    highlight: '#10b981',
    lightBg: '#ecfdf5',
    border: '#a7f3d0'
  }
];

export function generateStableSellerId(name: string, connectionMode: 'live_sync' | 'csv_import' = 'csv_import'): string {
  const cleanName = name.trim();
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 20) || 'brand';

  if (connectionMode === 'live_sync') {
    // Unique, stable seller ID with prefix for live Firestore syncing
    const randSuffix = Math.random().toString(36).slice(2, 6);
    return `slr_${slug}_${randSuffix}`;
  }
  return slug;
}

export function createSellerProfile(
  name: string,
  description: string,
  categoryHint?: string,
  paletteIndex: number = 0,
  connectionMode: 'live_sync' | 'csv_import' = 'csv_import',
  forcedId?: string
): Seller {
  const cleanName = name.trim();
  const sellerId = forcedId || generateStableSellerId(cleanName, connectionMode);

  const palette = BRAND_PALETTES[paletteIndex % BRAND_PALETTES.length];

  return {
    id: sellerId,
    name: cleanName,
    category: categoryHint || 'D2C Consumer Retail',
    tagline: description.length > 50 ? `${description.slice(0, 47)}...` : description,
    description: description.trim(),
    accentColor: {
      primary: palette.primary,
      secondary: palette.secondary,
      highlight: palette.highlight,
      lightBg: palette.lightBg,
      border: palette.border
    },
    productIds: [],
    sampleAov: 1500,
    monthlyOrders: 0,
    isCustom: true,
    createdAt: new Date().toISOString(),
    connectionMode,
    connectionStatus: connectionMode === 'live_sync' ? 'not_connected' : 'connected',
    paletteIndex
  };
}

export const SELLERS: Seller[] = [
  {
    id: 'ojas-botanics',
    name: 'Ojas Botanics',
    category: 'Ayurvedic Skincare & Wellness',
    tagline: 'Clean Ayurvedic Formulations & Herbal Extracts',
    accentColor: {
      primary: '#0e3b43',
      secondary: '#1f8a5b',
      highlight: '#f5a524',
      lightBg: '#eaf5ef',
      border: '#9bbcaf'
    },
    productIds: ['P01', 'P02', 'P03', 'P05', 'P06', 'P07', 'P08'],
    sampleAov: 1840,
    monthlyOrders: 1420
  },
  {
    id: 'kavya-couture',
    name: 'Kavya Couture',
    category: 'Artisanal Ethnic & Festive Wear',
    tagline: 'Handloom Silks, Chanderi & Embroidered Anarkalis',
    accentColor: {
      primary: '#831843',
      secondary: '#be185d',
      highlight: '#f43f5e',
      lightBg: '#fdf2f8',
      border: '#f472b6'
    },
    productIds: ['KC01', 'KC02', 'KC03', 'KC04'],
    sampleAov: 4250,
    monthlyOrders: 890
  },
  {
    id: 'urban-stride',
    name: 'Urban Stride',
    category: 'Athleisure & Performance Streetwear',
    tagline: 'Technical Running Gear, Joggers & Activewear',
    accentColor: {
      primary: '#1e3a8a',
      secondary: '#2563eb',
      highlight: '#06b6d4',
      lightBg: '#eff6ff',
      border: '#93c5fd'
    },
    productIds: ['US01', 'US02', 'US03', 'US04'],
    sampleAov: 2490,
    monthlyOrders: 2180
  },
  {
    id: 'aura-living',
    name: 'Aura Living',
    category: 'Sustainable Home & Ceramic Decor',
    tagline: 'Hand-thrown Ceramics, Linen & Botanical Living',
    accentColor: {
      primary: '#9a3412',
      secondary: '#c2410c',
      highlight: '#d97706',
      lightBg: '#fff7ed',
      border: '#fdba74'
    },
    productIds: ['AL01', 'AL02', 'AL03', 'AL04'],
    sampleAov: 2150,
    monthlyOrders: 1140
  }
];

export const DEFAULT_SELLER = SELLERS[0];
