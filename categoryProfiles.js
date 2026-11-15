// ─── 17 Production Business Category Profiles & Datasets ────────────────────────
// Extracted and ported from CategoryProfileEngine.kt

const CATEGORY_PROFILES = [
  {
    id: 'clothing_boutique',
    name: 'Boutique & Fashion Clothing',
    sinhalaName: 'කාන්තා සහ පිරිමි විලාසිතා',
    emoji: '👗',
    description: 'ඇඳුම් පැළඳුම්, සාරි, ගවුම්, ටී-ෂර්ට් සහ විලාසිතා අලෙවිය සඳහා',
    orderPrefix: 'BTQ',
    starterDataset: `[STORE: OMNISIX BOUTIQUE & FASHION]
අපගේ ආයතනය ශ්‍රී ලංකාවේ ප්‍රමුඛතම නවීන කාන්තා සහ පිරිමි ඇඳුම් පැළඳුම් සපයන්නා වේ.

📦 නිෂ්පාදන සහ මිල ගණන්:
• Linen Casual Frock (S, M, L, XL) - Rs. 3,850
• Premium Office Wear Shirt - Rs. 3,450
• Handloom Silk Saree Collection - Rs. 8,900
• Slim Fit Denim Jeans (28-36) - Rs. 4,200
• Ladies Cotton Nightwear Set - Rs. 2,250

🚚 බෙදාහැරීම් විස්තර (Delivery Terms):
• දිවයින පුරා Courier සේවාව මගින් දින 2-3 කින් නිවසටම ගෙන්වා ගත හැක.
• Delivery Charge: කොළඹ සහ තදාසන්න ප්‍රදේශ සඳහා Rs. 350, පිටපළාත් සඳහා Rs. 450.
• Cash on Delivery (COD) හෝ බැංකු තැන්පතු මගින් ගෙවිය හැක.
• Size ගැළපීමක් නොවුනහොත් දින 7ක් ඇතුළත Exchange කරගත හැක.

🏦 බැංකු ගිණුම් විස්තර:
• Commercial Bank | Account: 8009214562 | Name: OMNISIX BOUTIQUE | Branch: City Branch`,
    starterProducts: [
      { name: 'Linen Casual Frock', price: 3850, cost: 2200, minFloorPrice: 3500, category: 'Ladies Wear', description: 'Available in S, M, L, XL in 5 modern pastel colors' },
      { name: 'Premium Office Wear Shirt', price: 3450, cost: 1900, minFloorPrice: 3100, category: 'Mens Wear', description: '100% Breathable cotton, slim & regular fits' },
      { name: 'Handloom Silk Saree Collection', price: 8900, cost: 5500, minFloorPrice: 8200, category: 'Traditional', description: 'Exclusive handloom silk with matching blouse piece' },
      { name: 'Ladies Cotton Nightwear Set', price: 2250, cost: 1200, minFloorPrice: 2000, category: 'Nightwear', description: 'Soft pure cotton 2-piece lounge set' }
    ]
  },
  {
    id: 'wedding_studio',
    name: 'Wedding Arts & Photo Studio',
    sinhalaName: 'මංගල ඡායාරූප සහ UV Frames',
    emoji: '📸',
    description: 'මංගල ඇල්බම්, UV Gloss Frames, Photo Prints සහ Photography සඳහා',
    orderPrefix: 'WDA',
    starterDataset: `[STORE: WEDDING ARTS & UV FRAMES STUDIO]
ශ්‍රී ලංකාවේ උසස්ම තත්ත්වයේ Ultra-Violet (UV) Glossy Photo Frames සහ Wedding Albums නිපදවන්නෝ.

📦 සේවාවන් සහ පැකේජ මිල ගණන්:
• 12x18 UV Gloss Frame - Rs. 4,800 (Free Courier Delivery)
• 16x24 Executive Diamond Frame - Rs. 8,500
• 20x30 Masterpiece Grand Frame - Rs. 13,000
• 24x36 Royal Luxury Preserved Frame - Rs. 17,500
• Wedding Photo Retouching & Soft Copy Edit - Rs. 1,500

🚚 බෙදාහැරීම සහ ආරක්ෂාව:
• විශේෂිත ත්‍රිත්ව බුබුළු ආරක්ෂණ (Bubble Wrapped Cushioning) ඇසුරුම් මගින් නොබිඳෙන ලෙස නිවසටම ප්‍රවාහනය කෙරේ.
• නිෂ්පාදන කාලය: ඡායාරූපය ලැබී පැය 48ක් ඇතුළත නිමවා කුරියර් කරනු ලැබේ.

🏦 බැංකු ගිණුම් විස්තර:
• Sampath Bank | Account: 014210089201 | Name: WEDDING ARTS | Branch: Head Office`,
    starterProducts: [
      { name: '12x18 UV Gloss Frame', price: 4800, cost: 2400, minFloorPrice: 4300, category: 'UV Frames', description: 'Ultra-Glossy UV Coated, Water & Fade Proof with free delivery' },
      { name: '16x24 Executive Diamond Frame', price: 8500, cost: 4200, minFloorPrice: 7800, category: 'UV Frames', description: 'Teak finish borders with high gloss crystal UV finish' },
      { name: '20x30 Masterpiece Grand Frame', price: 13000, cost: 6800, minFloorPrice: 12000, category: 'UV Frames', description: 'Living room centerpiece frame with mounting accessories' },
      { name: '24x36 Royal Luxury Preserved Frame', price: 17500, cost: 9500, minFloorPrice: 16000, category: 'Royal Collection', description: 'Museum quality archival grade photo frame' }
    ]
  },
  {
    id: 'bakery_cakes',
    name: 'Bakery & Custom Cakes',
    sinhalaName: 'කේක් සහ රසකැවිලි නිෂ්පාදන',
    emoji: '🎂',
    description: 'උපන්දින කේක්, මංගල කේක්, Cupcakes සහ බේකරි නිෂ්පාදන සඳහා',
    orderPrefix: 'CKB',
    starterDataset: `[STORE: DELICIOUS CAKES & ARTISAN BAKERY]
ඔබගේ සියලු විශේෂ අවස්ථාවන් සඳහා ප්‍රණීත කේක් සහ බේකරි නිෂ්පාදන දිනපතා නැවුම්ව පිළියෙල කරනු ලැබේ.

🎂 කේක් වර්ග සහ මිල ගණන්:
• 1kg Ribbon Cake with Buttercream - Rs. 3,500
• 1kg Rich Chocolate Fudge Cake - Rs. 4,200
• 1kg Red Velvet with Cream Cheese - Rs. 4,800
• 6-piece Gourmet Cupcake Box - Rs. 1,800
• Customized Theme Fondant Cake (per kg) - Rs. 5,500

🚚 බෙදාහැරීම සහ ඇණවුම් කිරීමේ නීති:
• අභිරුචි කේක් (Customized Cakes) සඳහා අවම වශයෙන් පැය 24කට පෙර ඇණවුම තහවුරු කළ යුතුය.
• කොළඹ සහ ගම්පහ දිස්ත්‍රික්ක තුළ AC වාහන මගින් නොබිඳෙන පරිදි ආරක්ෂිතව Delivery සපයනු ලැබේ (Rs. 400 - 800).
• 50% ක අත්තිකාරම් මුදලක් (Advance Payment) ගෙවා ඇණවුම වෙන් කරවා ගත යුතුය.`,
    starterProducts: [
      { name: '1kg Rich Chocolate Fudge Cake', price: 4200, cost: 2100, minFloorPrice: 3900, category: 'Birthday Cakes', description: 'Decadent dark chocolate sponge layered with ganache' },
      { name: '1kg Red Velvet with Cream Cheese', price: 4800, cost: 2500, minFloorPrice: 4500, category: 'Premium Cakes', description: 'Classic velvety crumb with authentic cream cheese frosting' },
      { name: '6-piece Gourmet Cupcake Box', price: 1800, cost: 850, minFloorPrice: 1600, category: 'Cupcakes', description: 'Assorted flavors (Chocolate, Vanilla, Salted Caramel)' }
    ]
  },
  {
    id: 'electronics_mobile',
    name: 'Electronics & Mobile Phones',
    sinhalaName: 'ස්මාර්ට්ෆෝන් සහ ඉලෙක්ට්‍රොනික් උපාංග',
    emoji: '📱',
    description: 'ජංගම දුරකථන, Accessories, Smart Watches සහ පරිගණක උපාංග සඳහා',
    orderPrefix: 'ELC',
    starterDataset: `[STORE: SMART TECH & ELECTRONICS]
ශ්‍රී ලංකාවේ වගකීමක් සහිතව නවතම ස්මාර්ට්ෆෝන්, Smart Watches සහ Audio Accessories ලබාගන්න.

📱 භාණ්ඩ සහ මිල ගණන්:
• Wireless Noise-Cancelling Earbuds - Rs. 4,900 (6 Months Warranty)
• 20,000mAh Fast Charging Power Bank - Rs. 5,800
• Smart Fitness Watch with AMOLED Display - Rs. 8,900
• 65W GaN Fast Charger with Type-C Cable - Rs. 3,600
• Magnetic Car Phone Mount & Charger - Rs. 2,450

🛡️ වගකීම සහ බෙදාහැරීම:
• සියලුම උපකරණ සඳහා 6 සිට 12 මසක සමාගම් වගකීම (Warranty).
• දිවයින පුරා Cash on Delivery (COD) සේවාව සහිතයි. භාණ්ඩය ලැබුණු පසු පරීක්ෂා කර මුදල් ගෙවිය හැක.`,
    starterProducts: [
      { name: 'Wireless Noise-Cancelling Earbuds', price: 4900, cost: 2600, minFloorPrice: 4400, category: 'Audio', description: 'Active Noise Cancellation, 36h battery life, 6 months warranty' },
      { name: '20,000mAh Fast Charging Power Bank', price: 5800, cost: 3200, minFloorPrice: 5200, category: 'Power', description: '22.5W Super Charge with dual input and digital LED display' },
      { name: 'Smart Fitness Watch AMOLED', price: 8900, cost: 5100, minFloorPrice: 8200, category: 'Wearables', description: 'SpO2, Heart rate monitor, Bluetooth calling, IP68 waterproof' }
    ]
  },
  {
    id: 'cosmetics_salon',
    name: 'Cosmetics & Beauty Salon',
    sinhalaName: 'රූපලාවන්‍ය සහ සත්කාරක නිෂ්පාදන',
    emoji: '💄',
    description: 'සම පැහැපත් කරන ආලේපන, Skincare, Haircare සහ රූපලාවන්‍ය සේවා සඳහා',
    orderPrefix: 'CSM',
    starterDataset: `[STORE: GLOW BEAUTY & SALON CARE]
100% ප්‍රමිතියෙන් යුතු ස්වභාවික ශාකසාර Skincare, Hair Oil සහ Beauty Essentials.

✨ නිෂ්පාදන සහ මිල ගණන්:
• Vitamin C Brightening Face Serum (30ml) - Rs. 3,200
• Herbal Hair Growth Nourishing Oil (200ml) - Rs. 2,450
• Deep Hydrating Sunscreen Gel SPF 50+ - Rs. 2,800
• Natural Saffron Glow Night Cream - Rs. 3,600
• Keratin Repair Hair Treatment Pack - Rs. 4,100

🚚 බෙදාහැරීම සහ උපදෙස්:
• දිවයින පුරා Cash on Delivery සහිතයි.
• අපගේ රූපලාවන්‍ය උපදේශිකාවන්ගෙන් ඔබගේ සමට සුදුසුම නිෂ්පාදනය පිළිබඳ නොමිලේ උපදෙස් ලබාගත හැක.`,
    starterProducts: [
      { name: 'Vitamin C Brightening Face Serum', price: 3200, cost: 1400, minFloorPrice: 2900, category: 'Skincare', description: 'Dermatologically tested 10% Ascorbic Acid serum' },
      { name: 'Deep Hydrating Sunscreen Gel SPF 50+', price: 2800, cost: 1300, minFloorPrice: 2500, category: 'Sun Protection', description: 'Non-greasy, broad-spectrum UV protection' },
      { name: 'Herbal Hair Growth Nourishing Oil', price: 2450, cost: 950, minFloorPrice: 2200, category: 'Haircare', description: 'Infused with Bhringraj, Rosemary & Amla roots' }
    ]
  },
  {
    id: 'jewelry_accessories',
    name: 'Jewelry & Accessories',
    sinhalaName: 'ස්වර්ණාභරණ සහ අත්කම් විලාසිතා',
    emoji: '💍',
    description: 'රිදී සහ රන් ආලේපිත මාල, වළලු, කරාබු සහ මුදු අලෙවිය සඳහා',
    orderPrefix: 'JWL',
    starterDataset: `[STORE: ROYAL SPARKLE JEWELRY]
පැහැය නොමැකෙන 925 Sterling Silver සහ 24K Gold Plated නවීන ආභරණ.

💍 ආභරණ සහ මිල ගණන්:
• 925 Silver Solitaire Ring with Box - Rs. 4,800
• 24K Gold Plated Infinity Pendant Necklace - Rs. 5,400
• Crystal Drop Bridal Earrings Pair - Rs. 2,900
• Couple Magnetic Promise Bracelets - Rs. 1,950
• Velvet Luxury Jewelry Gift Box - Rs. 950

🎁 විශේෂ දීමනා:
• සියලුම ආභරණ විශේෂිත Gift Box එකක් තුළ අසුරා නොමිලේ ලැබෙන Warranty Card එකක් සමඟ එවනු ලැබේ.`,
    starterProducts: [
      { name: '925 Silver Solitaire Ring', price: 4800, cost: 2200, minFloorPrice: 4200, category: 'Rings', description: 'Hallmarked 925 silver with AAA Cubic Zirconia crystal' },
      { name: '24K Gold Plated Infinity Necklace', price: 5400, cost: 2600, minFloorPrice: 4900, category: 'Necklaces', description: 'Anti-tarnish waterproof finish with micro-link chain' }
    ]
  },
  {
    id: 'restaurant_food',
    name: 'Restaurants & Cloud Kitchen',
    sinhalaName: 'ආපනශාලා සහ ක්ෂණික ආහාර බෙදාහැරීම',
    emoji: '🍔',
    description: 'බර්ගර්, බත් සහ කරි, බිරියානි සහ ආහාර Delivery සඳහා',
    orderPrefix: 'FOD',
    starterDataset: `[STORE: URBAN CHEF RESTAURANT & KITCHEN]
නැවුම් හා රසවත් ආහාර උණුසුමෙන්ම ඔබගේ නිවසට හෝ කාර්යාලයට බෙදාහැරේ.

🍔 මෙනුව සහ මිල ගණන්:
• Double Beef / Chicken Smash Burger Meal - Rs. 1,950 (Fries + Coke)
• Special Hyderabadi Dum Chicken Biryani - Rs. 1,850
• Mixed Seafood Fried Rice (Large) - Rs. 2,600
• Crispy Hot Wings (8 pcs with Dip) - Rs. 1,450
• Fresh Fruit Faluda Grand - Rs. 650

🛵 Delivery තොරතුරු:
• ඇණවුම ලබා දී විනාඩි 30 - 45ක් තුළ ප්‍රවාහනය කරනු ලැබේ.
• අවම ඇණවුම Rs. 1,000. ප්‍රවාහන ගාස්තු පළමු 3km සඳහා Rs. 250.`,
    starterProducts: [
      { name: 'Double Smash Burger Combo', price: 1950, cost: 950, minFloorPrice: 1800, category: 'Burgers', description: 'Brioche bun, melted cheese, golden fries and 330ml soda' },
      { name: 'Special Chicken Dum Biryani', price: 1850, cost: 850, minFloorPrice: 1700, category: 'Rice', description: 'Long-grain Basmati rice, slow-cooked chicken, boiled egg, raita' }
    ]
  },
  {
    id: 'supermarket_grocery',
    name: 'Supermarket & Grocery Delivery',
    sinhalaName: 'දෛනික සිල්ලර බඩු සහ ගෘහ අවශ්‍යතා',
    emoji: '🛒',
    description: 'සහල්, පරිප්පු, තෙල්, කුළුබඩු සහ ගෘහස්ථ ද්‍රව්‍ය දිනපතා නිවසටම',
    orderPrefix: 'SUP',
    starterDataset: `[STORE: QUICK GROCERY EXPRESS]
සියලුම ගෘහස්ත අත්‍යවශ්‍ය භාණ්ඩ, සහල්, කුළුබඩු සහ සනීපාරක්ෂක ද්‍රව්‍ය සාධාරණ මිලට.

🛒 ජනප්‍රිය නිෂ්පාදන:
• Keeri Samba 5kg Bag - Rs. 1,650
• Mysore Dhal 1kg - Rs. 340
• Pure Coconut Oil 1L Bottle - Rs. 780
• Ceylon Pure Spices Curry Powder Set (500g) - Rs. 850
• Whole Chicken Fresh Chilled (per kg) - Rs. 1,250

🚚 Delivery සේවාව:
• උදෑසන 8.00 සිට රාත්‍රී 8.00 දක්වා පැය 2 ක් ඇතුළත නිවසටම බෙදාහැරේ. Rs. 5,000 ට වැඩි ඇණවුම් සඳහා Free Delivery!`,
    starterProducts: [
      { name: 'Keeri Samba 5kg Premium Bag', price: 1650, cost: 1450, minFloorPrice: 1600, category: 'Rice', description: 'Premium grade cleaned Keeri Samba' },
      { name: 'Pure Coconut Oil 1L Bottle', price: 780, cost: 650, minFloorPrice: 750, category: 'Oils', description: '100% Unrefined pure white coconut oil' }
    ]
  },
  {
    id: 'gifts_baby',
    name: 'Gifts, Toys & Baby Care',
    sinhalaName: 'තෑගි භාණ්ඩ, සෙල්ලම් බඩු සහ ළදරු භාණ්ඩ',
    emoji: '🧸',
    description: 'ළදරු ඇඳුම්, තෑගි පාර්සල්, සෙල්ලම් බඩු සහ අත්කම් භාණ්ඩ සඳහා',
    orderPrefix: 'GFT',
    starterDataset: `[STORE: WONDER GIFTS & BABY CARE]
ඔබ ආදරය කරන අයට තිළිණ කිරීමට වටිනා තෑගි සහ උසස්ම ළදරු නිෂ්පාදන.

🎁 භාණ්ඩ සහ මිල ගණන්:
• Newborn Baby Cotton Hamper Set (12 pcs) - Rs. 6,800
• Giant Teddy Bear Plushie (3 Feet) - Rs. 5,500
• Custom Printed Photo Magic Mug - Rs. 1,450
• Educational Remote Control Car - Rs. 3,800
• Baby Feeding High Chair Portable - Rs. 7,900`,
    starterProducts: [
      { name: 'Newborn Baby Cotton Hamper (12 pcs)', price: 6800, cost: 3800, minFloorPrice: 6200, category: 'Baby Care', description: '100% hypoallergenic organic cotton essential starter hamper' },
      { name: 'Giant Plush Teddy Bear 3 Feet', price: 5500, cost: 2800, minFloorPrice: 4900, category: 'Toys', description: 'Ultra-soft virgin fiber stuffed plush toy' }
    ]
  },
  {
    id: 'pharmacy_health',
    name: 'Pharmacy & Healthcare',
    sinhalaName: 'ඖෂධ, සෞඛ්‍ය උපකරණ සහ විටමින්',
    emoji: '💊',
    description: 'විටමින්, පෝෂණ අතිරේක, සෞඛ්‍ය උපකරණ සහ ප්‍රථමාධාර ද්‍රව්‍ය සඳහා',
    orderPrefix: 'PHR',
    starterDataset: `[STORE: CARE PHARMACY & WELLNESS]
නියාමනය කරන ලද උසස් තත්ත්වයේ සෞඛ්‍ය උපකරණ, විටමින් සහ පෝෂණ අතිරේක.

💊 නිෂ්පාදන සහ මිල ගණන්:
• Digital Upper Arm Blood Pressure Monitor - Rs. 7,400 (2 Year Warranty)
• Blood Glucose Monitoring Meter + 50 Strips - Rs. 5,900
• Multivitamin Complex with Zinc (60 Tablets) - Rs. 2,600
• Infrared Forehead No-Touch Thermometer - Rs. 3,800
• Organic Omega-3 Fish Oil 1000mg - Rs. 3,450`,
    starterProducts: [
      { name: 'Digital Blood Pressure Monitor', price: 7400, cost: 4200, minFloorPrice: 6800, category: 'Medical Devices', description: 'Clinically accurate, automatic memory for 2 users, 2 years warranty' },
      { name: 'Multivitamin Complex with Zinc (60 Tab)', price: 2600, cost: 1300, minFloorPrice: 2300, category: 'Supplements', description: 'Daily immune boost formula with essential micronutrients' }
    ]
  },
  {
    id: 'auto_parts',
    name: 'Auto Parts & Vehicle Services',
    sinhalaName: 'වාහන අමතර කොටස් සහ සත්කාරක නිෂ්පාදන',
    emoji: '🚗',
    description: 'එන්ජින් ඔයිල්, බැටරි, වාහන Polish සහ අමතර කොටස් සඳහා',
    orderPrefix: 'AUT',
    starterDataset: `[STORE: SPEED AUTO PARTS & CARE]
ජපන් සහ යුරෝපීය වාහන සඳහා අව්‍යාජ අමතර කොටස්, Engine Oils සහ Polish.

🚗 නිෂ්පාදන සහ මිල ගණන්:
• Fully Synthetic 5W-30 Engine Oil (4L) - Rs. 14,800
• Ceramic Coating DIY Vehicle Polish Kit - Rs. 4,900
• Microfiber Extra Plush Car Cleaning Towels (Pack of 3) - Rs. 1,650
• High Power 12V Car Vacuum Cleaner - Rs. 4,200
• LED Headlight Bulbs Pair (Ultra White) - Rs. 5,800`,
    starterProducts: [
      { name: 'Fully Synthetic 5W-30 Oil 4L', price: 14800, cost: 10500, minFloorPrice: 13900, category: 'Lubricants', description: 'API SP / ILSAC GF-6 certified engine protection' },
      { name: 'Ceramic Coating DIY Kit', price: 4900, cost: 2300, minFloorPrice: 4400, category: 'Car Detailing', description: '9H hardness scratch and water repellent nanotech coat' }
    ]
  },
  {
    id: 'agency_services',
    name: 'Agency & Professional Services',
    sinhalaName: 'වෘත්තීය සේවා සහ ආයතන',
    emoji: '💼',
    description: 'ග්‍රැෆික් ඩිසයින්, වෙබ් අඩවි නිර්මාණය, ඩිජිටල් මාර්කටින් සහ සමාගම් ලියාපදිංචිය',
    orderPrefix: 'AGN',
    starterDataset: `[STORE: NEXUS DIGITAL SOLUTIONS AGENCY]
ව්‍යාපාර දියුණු කිරීම සඳහා නවීන ඩිජිටල් තාක්ෂණික සහ නිර්මාණාත්මක සේවා.

💼 සේවාවන් සහ පැකේජ:
• Social Media Post Design (10 Designs Package) - Rs. 9,500
• Complete Company Logo & Brand Identity Guide - Rs. 12,000
• Professional E-Commerce / Business Website Development - Rs. 38,000
• Google & Facebook Ads Management (Monthly) - Rs. 18,000
• Company Registration (PVT LTD) Consultation & Filing - Rs. 32,000`,
    starterProducts: [
      { name: 'Social Media 10 Post Design Pack', price: 9500, cost: 3500, minFloorPrice: 8500, category: 'Design', description: 'High engagement branded posts for Facebook & Instagram' },
      { name: 'Professional Business Website', price: 38000, cost: 15000, minFloorPrice: 34000, category: 'Web Development', description: 'Mobile responsive, SEO friendly, domain and 1 year hosting included' }
    ]
  },
  {
    id: 'tuition_classes',
    name: 'Tuition & Education Classes',
    sinhalaName: 'උපකාරක පන්ති සහ අධ්‍යාපනය',
    emoji: '📚',
    description: 'O/L, A/L සහ ප්‍රාථමික ශ්‍රේණි සඳහා තනි හා කණ්ඩායම් පන්ති, Tute සහ Paper Packs',
    orderPrefix: 'TUT',
    starterDataset: `[STORE: ACADEMIA INSTITUTE & TUITION]
විභාග විශිෂ්ටයින් බිහිකරන දිවයිනේ ප්‍රමුඛ පෙළේ ආචාර්ය මණ්ඩලයක පන්ති.

📚 පන්ති ගාස්තු සහ සම්මන්ත්‍රණ:
• A/L Combined Maths Monthly Class Fee - Rs. 3,500
• A/L Biology Theory & Paper Class - Rs. 3,500
• O/L Science & Mathematics Master Pack - Rs. 4,000
• Model Paper Set with Marking Scheme (10 Papers) - Rs. 2,200
• Speed Revision Recordings Pack - Rs. 4,500`,
    starterProducts: [
      { name: 'A/L Combined Maths Monthly Access', price: 3500, cost: 500, minFloorPrice: 3500, category: 'Classes', description: 'Live Zoom sessions + Full Tute Pack delivered by courier' },
      { name: 'Model Paper Set 10 Papers with Scheme', price: 2200, cost: 750, minFloorPrice: 2000, category: 'Publications', description: 'Detailed step-by-step marking schemes and tute book' }
    ]
  },
  {
    id: 'school_academy',
    name: 'School & Preschool Academy',
    sinhalaName: 'පාසල්, පෙරපාසල් සහ දිවා සුරැකුම්',
    emoji: '🏫',
    description: 'පෙරපාසල් ඇතුළත් කිරීම්, නිල ඇඳුම්, පොත්පත් සහ පාසල් උපකරණ',
    orderPrefix: 'SCH',
    starterDataset: `[STORE: LITTLE STARS INTERNATIONAL ACADEMY]
දරුවාගේ මූලික ළමාවිය සංවර්ධනය සහ ගුණාත්මක අධ්‍යාපනය සඳහා විශ්වාසනීය පියවරක්.

🏫 ඇතුළත් කිරීම් සහ ගාස්තු:
• Preschool Admission Registration Fee - Rs. 15,000
• Term Activity & Learning Materials Fee - Rs. 8,500
• Complete School Uniform Set (3 Sets) - Rs. 5,200
• Activity Workbooks & Stationery Bundle - Rs. 3,800`,
    starterProducts: [
      { name: 'Preschool Admission Registration', price: 15000, cost: 2000, minFloorPrice: 15000, category: 'Admissions', description: 'Student file, medical record and welcome educational kit' }
    ]
  },
  {
    id: 'online_courses',
    name: 'Online Courses & Training',
    sinhalaName: 'මාර්ගගත පාඨමාලා සහ කුසලතා සංවර්ධනය',
    emoji: '🎓',
    description: 'Spoken English, Graphic Design, IT, Coding සහ ඩිජිටල් ව්‍යාපාර පාඨමාලා',
    orderPrefix: 'CRS',
    starterDataset: `[STORE: SKILLUP ONLINE LEARNING PLATFORM]
ඔබේ වෘත්තීය ජීවිතය සාර්ථක කරගැනීමට ප්‍රායෝගික මාර්ගගත පාඨමාලා.

🎓 පාඨමාලා සහ ගාස්තු:
• 3-Month Professional Spoken English Mastery - Rs. 12,500
• Graphic Design for Freelancers (Photoshop & Illustrator) - Rs. 14,000
• Complete Web Development & React Bootcamp - Rs. 24,000
• Digital Marketing & Facebook Ads Masterclass - Rs. 9,800`,
    starterProducts: [
      { name: 'Professional Spoken English Mastery', price: 12500, cost: 1500, minFloorPrice: 11000, category: 'Languages', description: 'Lifetime LMS access, weekly speaking sessions, certificate' },
      { name: 'Graphic Design for Freelancers', price: 14000, cost: 2000, minFloorPrice: 12500, category: 'Creative', description: 'Full software mastery with freelancing portfolio guidance' }
    ]
  },
  {
    id: 'science_tech',
    name: 'Science & Technical Labs',
    sinhalaName: 'විද්‍යාගාර උපකරණ සහ තාක්ෂණික සේවා',
    emoji: '🔬',
    description: 'විද්‍යාගාර උපකරණ, රසායනික ද්‍රව්‍ය, මිනුම් උපකරණ සහ Sensors',
    orderPrefix: 'SCI',
    starterDataset: `[STORE: PRECISION LABS & SCIENCE INSTRUMENTS]
පාසල් සහ විශ්වවිද්‍යාල සඳහා උසස් තත්ත්වයේ විද්‍යාගාර සහ මිනුම් උපකරණ.

🔬 උපකරණ සහ මිල ගණන්:
• Student Monocular Compound Microscope 1000x - Rs. 28,500
• Digital Precision Balance (0.01g Accuracy) - Rs. 6,800
• Arduino Starter Learning Kit with Sensors - Rs. 8,400
• Glassware Starter Set (Beakers, Flasks, Cylinders) - Rs. 5,900`,
    starterProducts: [
      { name: 'Student Compound Microscope 1000x', price: 28500, cost: 18000, minFloorPrice: 26000, category: 'Optics', description: 'Coaxial focus, LED illumination, glass optics' }
    ]
  },
  {
    id: 'general_store',
    name: 'General Store & Retail',
    sinhalaName: 'සාමාන්‍ය සිල්ලර හා තොග වෙළඳසැල',
    emoji: '🏪',
    description: 'සියලු වර්ගයේ සාමාන්‍ය නිෂ්පාදන සහ සේවාවන් සඳහා පරිපූර්ණ ආකෘතිය',
    orderPrefix: 'GEN',
    starterDataset: `[STORE: OMNISIX GENERAL STORE]
අපගේ ආයතනය වෙතින් උසස් තත්ත්වයේ භාණ්ඩ සාධාරණ මිලකට දිවයින පුරා බෙදාහැරේ.

📦 ප්‍රධාන නිෂ්පාදන:
• All-in-One Multi-Purpose Starter Pack - Rs. 3,500
• Standard Quality Household Kit - Rs. 5,200
• Premium Customer Care Package - Rs. 8,500

🚚 බෙදාහැරීම් සහ ගෙවීම්:
• දිවයින පුරා Cash on Delivery හෝ බැංකු තැන්පතු මගින් ගෙවිය හැක. දින 2-3ක් ඇතුළත ආරක්ෂිතව නිවසටම ප්‍රවාහනය කෙරේ.`,
    starterProducts: [
      { name: 'All-in-One Multi-Purpose Starter Pack', price: 3500, cost: 1800, minFloorPrice: 3200, category: 'General', description: 'Essential multi-purpose pack with warranty' }
    ]
  }
];

module.exports = {
  CATEGORY_PROFILES,
  getCategoryById: (id) => CATEGORY_PROFILES.find(c => c.id === id) || CATEGORY_PROFILES[0],
  getAllCategories: () => CATEGORY_PROFILES
};
