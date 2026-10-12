import type { CauseLabel } from './types';

export interface IngestedListingRow {
  sku: string;
  platform: string;
  title: string;
  description?: string;
  category?: string;
  price: number;
  attributes?: Record<string, any>;
  sizeChartPresent?: boolean;
}

export interface IngestedReviewRow {
  sku: string;
  platform: string;
  rating: number;
  text: string;
  date?: string;
  hasPhotos?: boolean;
  photoUrls?: string[];
  returnReason?: string;
}

export interface SeedListingDetail extends IngestedListingRow {
  images: Array<{
    url: string;
    type: 'catalog' | 'size_chart' | 'detail' | 'swatch';
    resolutionWidth?: number;
    resolutionHeight?: number;
    metadata?: any;
  }>;
}

export interface LabelledReview extends IngestedReviewRow {
  expectedCause: CauseLabel;
  isEvaluationSample?: boolean;
}

// 15 realistic D2C SKUs across categories
export const SEED_LISTINGS: SeedListingDetail[] = [
  // 1. High Colour Mismatch SKU
  {
    sku: 'SKU-ETH-01',
    platform: 'shopify',
    title: 'Midnight Royal Blue Anarkali Kurta Set',
    description: 'Crafted from pure modal silk, this royal blue kurta features gold zari embroidery and matching dupatta.',
    category: 'Apparel',
    price: 2499,
    attributes: { fabric: 'Modal Silk', color: 'Royal Blue', fit: 'Regular' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-eth-01/main.jpg', type: 'catalog', resolutionWidth: 1200, resolutionHeight: 1200, metadata: { filterApplied: 'saturation_boost_high' } },
      { url: 'https://images.example.com/sku-eth-01/size-chart.jpg', type: 'size_chart', resolutionWidth: 1000, resolutionHeight: 1000 },
    ],
  },
  // 2. High Size / Fit Issue SKU (Missing size chart, runs small)
  {
    sku: 'SKU-WES-02',
    platform: 'myntra',
    title: 'High-Waist Tailored Slim Fit Chinos',
    description: 'Crisp stretch cotton chinos with slim tapered fit and mid-rise waist.',
    category: 'Apparel',
    price: 1599,
    attributes: { fabric: 'Stretch Cotton', fit: 'Slim Fit', waist: 'Mid-Rise' },
    sizeChartPresent: false, // Defect: Missing size chart
    images: [
      { url: 'https://images.example.com/sku-wes-02/main.jpg', type: 'catalog', resolutionWidth: 1200, resolutionHeight: 1200 },
    ],
  },
  // 3. Description Mismatch SKU (Title says 100% Cotton, actually polyester blend)
  {
    sku: 'SKU-CAS-03',
    platform: 'amazon',
    title: '100% Pure Organic Cotton Oversized Graphic Tee',
    description: 'Breathable pure combed organic cotton heavy-gauge tee with minimal typography.',
    category: 'Apparel',
    price: 899,
    attributes: { fabric: 'Organic Cotton', weave: 'Jersey' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-cas-03/main.jpg', type: 'catalog', resolutionWidth: 1000, resolutionHeight: 1000 },
      { url: 'https://images.example.com/sku-cas-03/size-chart.jpg', type: 'size_chart', resolutionWidth: 800, resolutionHeight: 800 },
    ],
  },
  // 4. Image Mismatch / Resolution Defect SKU
  {
    sku: 'SKU-ETH-04',
    platform: 'flipkart',
    title: 'Handcrafted Chikankari Georgette Kurti',
    description: 'Exquisite hand embroidery with floral motifs and translucent georgette styling.',
    category: 'Apparel',
    price: 1899,
    attributes: { fabric: 'Georgette', craft: 'Chikankari' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-eth-04/main_thumb.jpg', type: 'catalog', resolutionWidth: 400, resolutionHeight: 400 }, // Low res defect
    ],
  },
  // 5. Healthy Pristine SKU
  {
    sku: 'SKU-HLT-05',
    platform: 'shopify',
    title: 'Everyday Pima Cotton Classic Polo',
    description: 'Pre-shrunk Supima cotton with rib-knit collar and laser-engraved mother of pearl buttons.',
    category: 'Apparel',
    price: 1499,
    attributes: { fabric: '100% Supima Cotton', fit: 'True to Size' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-hlt-05/main.jpg', type: 'catalog', resolutionWidth: 1600, resolutionHeight: 1600 },
      { url: 'https://images.example.com/sku-hlt-05/size-chart.jpg', type: 'size_chart', resolutionWidth: 1400, resolutionHeight: 1400 },
    ],
  },
  // 6. Healthy Footwear SKU
  {
    sku: 'SKU-HLT-06',
    platform: 'shopify',
    title: 'CloudWalk Memory Foam Lifestyle Sneakers',
    description: 'Breathable flyknit mesh with responsive dual-density cushioning sole.',
    category: 'Footwear',
    price: 2999,
    attributes: { upper: 'Knit', sole: 'EVA Foam' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-hlt-06/main.jpg', type: 'catalog', resolutionWidth: 1400, resolutionHeight: 1400 },
      { url: 'https://images.example.com/sku-hlt-06/size-chart.jpg', type: 'size_chart', resolutionWidth: 1200, resolutionHeight: 1200 },
    ],
  },
  // 7. Quality / Stitching Issue SKU
  {
    sku: 'SKU-QLT-07',
    platform: 'myntra',
    title: 'Ribbed Knit Bodycon Midi Dress',
    description: 'Figure-hugging ribbed knit dress with square neckline and side slit.',
    category: 'Apparel',
    price: 1299,
    attributes: { fabric: 'Ribbed Acrylic' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-qlt-07/main.jpg', type: 'catalog', resolutionWidth: 1200, resolutionHeight: 1200 },
    ],
  },
  // 8. Damaged in Transit SKU (Cosmetic/Liquid)
  {
    sku: 'SKU-DMG-08',
    platform: 'amazon',
    title: 'Botanical Rosewater Hydrating Face Mist',
    description: 'Steam-distilled Kannauj rose water in glass apothecary bottle.',
    category: 'Beauty',
    price: 650,
    attributes: { volume: '100ml', packaging: 'Glass' },
    sizeChartPresent: false,
    images: [
      { url: 'https://images.example.com/sku-dmg-08/main.jpg', type: 'catalog', resolutionWidth: 1000, resolutionHeight: 1000 },
    ],
  },
  // 9. Delivery / Courier Delayed SKU
  {
    sku: 'SKU-DLV-09',
    platform: 'flipkart',
    title: 'Vintage Leather Bifold Wallet',
    description: 'Full-grain hunter leather wallet with 8 card slots and RFID protection.',
    category: 'Accessories',
    price: 1199,
    attributes: { material: 'Leather' },
    sizeChartPresent: false,
    images: [
      { url: 'https://images.example.com/sku-dlv-09/main.jpg', type: 'catalog', resolutionWidth: 1000, resolutionHeight: 1000 },
    ],
  },
  // 10. Price / Overpriced Expectation SKU
  {
    sku: 'SKU-PRC-10',
    platform: 'shopify',
    title: 'Minimalist Matte Ceramic Coffee Mug Set of 2',
    description: 'Hand-thrown stoneware ceramic mugs with tactile matte speckle glaze.',
    category: 'Home',
    price: 1899,
    attributes: { material: 'Ceramic' },
    sizeChartPresent: false,
    images: [
      { url: 'https://images.example.com/sku-prc-10/main.jpg', type: 'catalog', resolutionWidth: 1200, resolutionHeight: 1200 },
    ],
  },
  // 11. Saree with Blouse Piece Size Issue
  {
    sku: 'SKU-ETH-11',
    platform: 'woocommerce',
    title: 'Banarasi Art Silk Zari Woven Saree with Blouse',
    description: 'Traditional motifs with opulent pallu and unstitched blouse piece.',
    category: 'Apparel',
    price: 2199,
    attributes: { fabric: 'Art Silk' },
    sizeChartPresent: false,
    images: [
      { url: 'https://images.example.com/sku-eth-11/main.jpg', type: 'catalog', resolutionWidth: 1000, resolutionHeight: 1000 },
    ],
  },
  // 12. Men Casual Linen Shirt
  {
    sku: 'SKU-CAS-12',
    platform: 'shopify',
    title: 'Pure French Linen Mandarin Collar Shirt',
    description: 'Relaxed fit summer shirt made from European flax linen.',
    category: 'Apparel',
    price: 2299,
    attributes: { fabric: '100% Linen' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-cas-12/main.jpg', type: 'catalog', resolutionWidth: 1200, resolutionHeight: 1200 },
      { url: 'https://images.example.com/sku-cas-12/size-chart.jpg', type: 'size_chart', resolutionWidth: 1000, resolutionHeight: 1000 },
    ],
  },
  // 13. Activewear Leggings
  {
    sku: 'SKU-ACT-13',
    platform: 'amazon',
    title: 'Seamless Squat-Proof High Waist Leggings',
    description: 'Four-way stretch compressive nylon-spandex active leggings.',
    category: 'Apparel',
    price: 1399,
    attributes: { fabric: 'Nylon Spandex' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-act-13/main.jpg', type: 'catalog', resolutionWidth: 1000, resolutionHeight: 1000 },
    ],
  },
  // 14. Woolen Cardigan
  {
    sku: 'SKU-WIN-14',
    platform: 'myntra',
    title: 'Chunky Cable Knit Buttoned Cardigan',
    description: 'Cozy winter layering piece with tortoiseshell buttons and drop shoulders.',
    category: 'Apparel',
    price: 2799,
    attributes: { fabric: 'Wool Blend' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-win-14/main.jpg', type: 'catalog', resolutionWidth: 1200, resolutionHeight: 1200 },
    ],
  },
  // 15. Canvas Tote Bag
  {
    sku: 'SKU-ACC-15',
    platform: 'shopify',
    title: 'Heavyweight Utility Canvas Carryall Tote',
    description: '16oz waxed canvas utility tote bag with reinforced top handles and zipper pocket.',
    category: 'Accessories',
    price: 999,
    attributes: { material: 'Waxed Canvas' },
    sizeChartPresent: true,
    images: [
      { url: 'https://images.example.com/sku-acc-15/main.jpg', type: 'catalog', resolutionWidth: 1200, resolutionHeight: 1200 },
    ],
  },
];

// Helper to generate realistic review text with Hinglish nuances
export function generateSeedReviewsAndReturns(): {
  allReviews: LabelledReview[];
  evaluationSet: LabelledReview[];
} {
  const reviews: LabelledReview[] = [];
  const evalSet: LabelledReview[] = [];

  const colourMismatchPhrases = [
    { text: 'Photo me royal blue dikh raha tha par deliver blackish navy hua. Bilkul alag color hai.', expected: 'colour_mismatch' },
    { text: 'Color mismatch issue! The shade is very dull compared to the catalog picture.', expected: 'colour_mismatch' },
    { text: 'Colour faded lag raha hai, photo me bright tha. Not the same royal blue.', expected: 'colour_mismatch' },
    { text: 'Dusra rang lag raha hai, catalog photo has heavy studio lighting filters.', expected: 'colour_mismatch' },
    { text: 'Looks dark purple/black in normal room light. Actual color is completely different from picture.', expected: 'colour_mismatch' },
    { text: 'Alag colour bheja hai, photo mai alag shade tha. Returning immediately.', expected: 'colour_mismatch' },
    { text: 'Rang bilkul match nahi karta. Very disappointed with the color accuracy.', expected: 'colour_mismatch' },
    { text: 'Shade is much darker than shown. Gold zari color is also very brassy.', expected: 'colour_mismatch' },
  ];

  const sizeFitPhrases = [
    { text: 'Size M order kiya tha par ye XS jaisa tight hai! Fitting bilkul galat hai.', expected: 'size_fit' },
    { text: 'Runs very small. Waist is too tight and length is short. Where is the size chart?', expected: 'size_fit' },
    { text: 'Size chart nahi tha listing me isliye L order kiya, par bohot chhota nikla.', expected: 'size_fit' },
    { text: 'Too tight around thighs and waist. Size issue hai, please provide proper measurements.', expected: 'size_fit' },
    { text: 'Chota size hai, fitting issue. Exchange for one size up if possible.', expected: 'size_fit' },
    { text: 'Sizing is completely off. Sleeves and shoulder too tight.', expected: 'size_fit' },
    { text: 'Bada size order karna chahiye tha. Size chart galat guide karta hai.', expected: 'size_fit' },
    { text: 'Tight fitting around hips. Measurement not matching standard Indian sizes.', expected: 'size_fit' },
  ];

  const descriptionMismatchPhrases = [
    { text: 'Description me 100% pure organic cotton likha hai par tag pe 60% polyester hai! Jhooth likha hai.', expected: 'description_mismatch' },
    { text: 'Cotton bolke synthetic polyester kapda deliver kiya. Material mismatch.', expected: 'description_mismatch' },
    { text: 'Fabric details are completely misleading. It feels like cheap nylon blend, not breathable cotton.', expected: 'description_mismatch' },
    { text: 'Specification mismatch: title says heavy gauge 240 GSM but this is very thin transparent cloth.', expected: 'description_mismatch' },
    { text: 'Galat details di hai description me. Pure cotton nahi nikla.', expected: 'description_mismatch' },
    { text: 'Not as described. Cloth material is synthetic and makes you sweat.', expected: 'description_mismatch' },
  ];

  const imageMismatchPhrases = [
    { text: 'Catalog photo me chikankari bohot rich dikh rahi thi, real me print jaisa flat hai. Photo me kuch aur tha.', expected: 'image_mismatch' },
    { text: 'Picture alag hai real product se! Heavy photoshop filter laga ke photo dali hai.', expected: 'image_mismatch' },
    { text: 'Image mismatch. The real product embroidery pattern is completely different from model photo.', expected: 'image_mismatch' },
    { text: 'Model pe photo alag lagti hai, reality me finish bohot cheap hai. Misleading photos.', expected: 'image_mismatch' },
  ];

  const qualityPhrases = [
    { text: 'Kapda bohot bekar hai, pehle wash me hi silai khul gayi. Third class quality.', expected: 'quality' },
    { text: 'Very poor stitching quality. Loose threads everywhere. Raddi kapda.', expected: 'quality' },
    { text: 'Ghatiya quality material. Fabric shrank and threading came off.', expected: 'quality' },
  ];

  const damagedPhrases = [
    { text: 'Bottle was leaking inside bubble wrap. Parcel completely soaked and damaged.', expected: 'damaged' },
    { text: 'Box crushed and bottle cap toota hua nikla. Defective piece.', expected: 'damaged' },
    { text: 'Received torn parcel and dirty product. Broken bottle.', expected: 'damaged' },
  ];

  const deliveryPhrases = [
    { text: 'Delivery bohot late hui. Courier boy did not call and marked customer unavailable.', expected: 'delivery' },
    { text: 'Delivery was delayed by 6 days. Terrible courier service.', expected: 'delivery' },
    { text: 'Fake attempt marked by delivery person. Door closed likh diya bina aaye.', expected: 'delivery' },
  ];

  const pricePhrases = [
    { text: 'Paisa barbad. Normal mug hai aur 1900 le rahe hain. Overpriced product.', expected: 'price' },
    { text: 'Not worth the high price. Similar mugs available in market for 400 rupees.', expected: 'price' },
  ];

  const expectationGapPhrases = [
    { text: 'Average product, expected much better finish for this brand. Not very happy.', expected: 'expectation_gap' },
    { text: 'Theek thaak hai, kuch khas nahi. So-so product.', expected: 'expectation_gap' },
  ];

  const positivePhrases = [
    { text: 'Bohot hi badiya product! Fabric is so soft and comfortable. Perfect fit.', expected: 'other' },
    { text: 'Loved the quality! Exactly as shown in the picture, fast delivery.', expected: 'other' },
    { text: 'Superb quality and packaging. Worth every penny. Highly recommended!', expected: 'other' },
    { text: 'Great purchase. Fitting is true to size and color is very rich.', expected: 'other' },
    { text: 'Bahut sundar kurta hai. Genuine brand, will definitely buy again.', expected: 'other' },
  ];

  const evalCountByLabel = new Map<CauseLabel, number>();

  function pushReview(sku: string, platform: string, p: { text: string; expected: string }, rating: number, isReturn: boolean, daysAgo: number) {
    const label = p.expected as CauseLabel;
    const currentCount = evalCountByLabel.get(label) || 0;
    const isEval = currentCount < 10;
    if (isEval) {
      evalCountByLabel.set(label, currentCount + 1);
    }

    const review: LabelledReview = {
      sku,
      platform,
      rating,
      text: p.text,
      date: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      hasPhotos: rating <= 2 && Math.random() > 0.4,
      photoUrls: rating <= 2 ? ['https://images.example.com/customer-uploads/c1.jpg'] : [],
      returnReason: isReturn ? p.text : undefined,
      expectedCause: label,
      isEvaluationSample: isEval,
    };
    reviews.push(review);
    if (isEval) {
      evalSet.push(review);
    }
  }

  // 1. SKU-ETH-01: 65 reviews (45 colour mismatch complaints, 20 returns, 20 positive)
  for (let i = 0; i < 65; i++) {
    const p = i < 45 ? colourMismatchPhrases[i % colourMismatchPhrases.length] : positivePhrases[i % positivePhrases.length];
    const isRet = i < 20;
    pushReview('SKU-ETH-01', 'shopify', p, i < 45 ? (i % 2 === 0 ? 1 : 2) : 5, isRet, i * 2);
  }

  // 2. SKU-WES-02: 70 reviews (50 size_fit complaints, 25 returns, 20 positive)
  for (let i = 0; i < 70; i++) {
    const p = i < 50 ? sizeFitPhrases[i % sizeFitPhrases.length] : positivePhrases[i % positivePhrases.length];
    const isRet = i < 25;
    pushReview('SKU-WES-02', 'myntra', p, i < 50 ? (i % 2 === 0 ? 1 : 2) : 5, isRet, i * 2);
  }

  // 3. SKU-CAS-03: 55 reviews (40 description_mismatch complaints, 15 returns)
  for (let i = 0; i < 55; i++) {
    const p = i < 40 ? descriptionMismatchPhrases[i % descriptionMismatchPhrases.length] : positivePhrases[i % positivePhrases.length];
    const isRet = i < 15;
    pushReview('SKU-CAS-03', 'amazon', p, i < 40 ? 1 : 5, isRet, i * 2);
  }

  // 4. SKU-ETH-04: 45 reviews (30 image_mismatch complaints, 10 returns)
  for (let i = 0; i < 45; i++) {
    const p = i < 30 ? imageMismatchPhrases[i % imageMismatchPhrases.length] : positivePhrases[i % positivePhrases.length];
    const isRet = i < 10;
    pushReview('SKU-ETH-04', 'flipkart', p, i < 30 ? 2 : 4, isRet, i * 2);
  }

  // 5. SKU-HLT-05: 50 reviews (45 positive, 5 minor)
  for (let i = 0; i < 50; i++) {
    const p = i < 45 ? positivePhrases[i % positivePhrases.length] : expectationGapPhrases[i % expectationGapPhrases.length];
    pushReview('SKU-HLT-05', 'shopify', p, i < 45 ? 5 : 3, false, i * 2);
  }

  // 6. SKU-HLT-06: 45 reviews (40 positive, 5 minor)
  for (let i = 0; i < 45; i++) {
    const p = i < 40 ? positivePhrases[i % positivePhrases.length] : sizeFitPhrases[0];
    pushReview('SKU-HLT-06', 'shopify', p, i < 40 ? 5 : 3, false, i * 2);
  }

  // 7. SKU-QLT-07: 40 reviews (28 quality complaints)
  for (let i = 0; i < 40; i++) {
    const p = i < 28 ? qualityPhrases[i % qualityPhrases.length] : positivePhrases[i % positivePhrases.length];
    pushReview('SKU-QLT-07', 'myntra', p, i < 28 ? 1 : 4, i < 12, i * 2);
  }

  // 8. SKU-DMG-08: 35 reviews (25 damaged complaints)
  for (let i = 0; i < 35; i++) {
    const p = i < 25 ? damagedPhrases[i % damagedPhrases.length] : positivePhrases[i % positivePhrases.length];
    pushReview('SKU-DMG-08', 'amazon', p, i < 25 ? 1 : 5, i < 15, i * 2);
  }

  // 9. SKU-DLV-09: 35 reviews (22 delivery complaints)
  for (let i = 0; i < 35; i++) {
    const p = i < 22 ? deliveryPhrases[i % deliveryPhrases.length] : positivePhrases[i % positivePhrases.length];
    pushReview('SKU-DLV-09', 'flipkart', p, i < 22 ? 2 : 5, i < 8, i * 2);
  }

  // 10. SKU-PRC-10: 30 reviews (18 price complaints)
  for (let i = 0; i < 30; i++) {
    const p = i < 18 ? pricePhrases[i % pricePhrases.length] : positivePhrases[i % positivePhrases.length];
    pushReview('SKU-PRC-10', 'shopify', p, i < 18 ? 2 : 4, false, i * 2);
  }

  // 11 to 15: General spread
  const otherSkus = ['SKU-ETH-11', 'SKU-CAS-12', 'SKU-ACT-13', 'SKU-WIN-14', 'SKU-ACC-15'];
  for (const sku of otherSkus) {
    for (let i = 0; i < 28; i++) {
      const p = i < 18 ? positivePhrases[i % positivePhrases.length] : sizeFitPhrases[i % sizeFitPhrases.length];
      pushReview(sku, 'shopify', p, i < 18 ? 5 : 2, i >= 20, i * 3);
    }
  }

  return { allReviews: reviews, evaluationSet: evalSet };
}
