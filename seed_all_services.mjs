// Comprehensive Urban Company-style services seed for NearWork Turso DB
// Adds 50+ services across 16 categories with professional image URLs

const TURSO_DATABASE_URL = 'https://nearwork-db-aihunters.aws-ap-south-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcyNTMxMjgsImlkIjoiMDFhMDIwOTYtNWMwMS03ZGVkLTgyNzktOGIwZTQ2YWM1Y2M0Iiwia2lkIjoieDVHRXUwcUI1SmhFTTNFZHctVXRaMG5iOGUta2VORnZ0aUZndGpuSXZHQSIsInJpZCI6IjI4MTY0MTlmLTUxOGQtNDQyMC1hYmZlLTI2NmUyMmQ1YzdhNCJ9.rkBcq3pPBrXiyANwesrpD2T6Yhz61lYU1CD_4chi9LRpuSr_N2m8_QydWwzbf-EmDxsxfacSlKTQ5iWEDKP5Bg';

async function exec(sql) {
  const res = await fetch(`${TURSO_DATABASE_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }] })
  });
  const data = await res.json();
  if (data.results?.[0]?.type === 'error') throw new Error(data.results[0].error?.message || 'SQL error');
  return data;
}

// High-quality Picsum/Unsplash image URLs per category
// Using reliable CDN sources that work on Flutter Web & Android
const IMG = {
  electrician: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=600',
  ac: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600',
  fan: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
  cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600',
  kitchen: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600',
  tank: 'https://images.unsplash.com/photo-1548115184-bc6544d06a58?w=600',
  plumbing: 'https://images.unsplash.com/photo-1607400201515-c2c41c07d307?w=600',
  appliance: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=600',
  painting: 'https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=600',
  carpentry: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600',
  pest: 'https://images.unsplash.com/photo-1601972602237-8c79241e468b?w=600',
  massage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600',
  beauty: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600',
  laundry: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600',
  cctv: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600',
  shifting: 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=600',
};

// New categories to add (existing ones are: electrician, ac-service, fan-installation, house-cleaning, kitchen-cleaning, tank-cleaning, plumbing, appliance-repair)
const NEW_CATEGORIES = [
  { name: 'Painting', slug: 'painting', description: 'Professional wall & home painting services', icon: '🎨', imageUrl: IMG.painting, sortOrder: 9 },
  { name: 'Carpentry', slug: 'carpentry', description: 'Expert carpentry, furniture repair & woodwork', icon: '🪚', imageUrl: IMG.carpentry, sortOrder: 10 },
  { name: 'Pest Control', slug: 'pest-control', description: 'Safe & effective pest control for homes', icon: '🐛', imageUrl: IMG.pest, sortOrder: 11 },
  { name: 'Massage & Spa', slug: 'massage', description: 'Relaxing massage and wellness at home', icon: '💆', imageUrl: IMG.massage, sortOrder: 12 },
  { name: 'Salon at Home', slug: 'salon', description: 'Professional beauty & grooming at doorstep', icon: '💇', imageUrl: IMG.beauty, sortOrder: 13 },
  { name: 'Laundry & Dry Clean', slug: 'laundry', description: 'Expert laundry, ironing & dry cleaning', icon: '👕', imageUrl: IMG.laundry, sortOrder: 14 },
  { name: 'CCTV & Security', slug: 'cctv', description: 'CCTV installation and home security setup', icon: '📷', imageUrl: IMG.cctv, sortOrder: 15 },
  { name: 'Home Shifting', slug: 'home-shifting', description: 'Packers and movers for smooth relocation', icon: '🚛', imageUrl: IMG.shifting, sortOrder: 16 },
];

// Services for existing categories (with image URLs)
const SERVICES_FOR_EXISTING = [
  // Electrician (id: cmt1wzd3e0000tyckkp6sjvjz)
  { catSlug: 'electrician', name: 'Fan Wiring & MCB Replacement', slug: 'fan-wiring-mcb', description: 'Replace faulty MCB, wiring, and circuit breakers professionally', price: 249, duration: 45, image: IMG.electrician, inclusions: ['MCB testing & replacement','Wiring inspection','Circuit load balancing','30-day warranty'] },
  { catSlug: 'electrician', name: 'Home Wiring & Rewiring', slug: 'home-wiring', description: 'Complete electrical rewiring for rooms, halls or full home', price: 799, duration: 120, image: IMG.electrician, inclusions: ['Full wiring audit','ISI-grade wire installation','Earthing check','Completion certificate'] },
  { catSlug: 'electrician', name: 'Power Backup & Inverter Setup', slug: 'inverter-setup', description: 'Install and configure home inverter, battery backup systems', price: 499, duration: 60, image: IMG.electrician, inclusions: ['Inverter installation','Battery connections','Load testing','Operator training'] },

  // AC Service (id: cmt1wzdo80001tyck0ys6z96n)
  { catSlug: 'ac-service', name: 'AC Gas Refill (1.5 Ton)', slug: 'ac-gas-refill', description: 'Recharge AC refrigerant for optimal cooling performance', price: 799, duration: 60, image: IMG.ac, inclusions: ['Gas pressure check','Leak detection','R22/R32 gas refill','Performance test post refill'] },
  { catSlug: 'ac-service', name: 'AC Uninstallation', slug: 'ac-uninstall', description: 'Safe removal and packing of split/window AC unit', price: 399, duration: 60, image: IMG.ac, inclusions: ['Gas recovery','Safe panel removal','Copper pipe capping','Unit packing'] },
  { catSlug: 'ac-service', name: 'AC PCB & Remote Repair', slug: 'ac-pcb-repair', description: 'Diagnose and repair AC control board and remote issues', price: 599, duration: 90, image: IMG.ac, inclusions: ['PCB diagnosis','Component replacement','Remote reprogramming','Test run'] },

  // Plumbing (id: cmt1wze6i0006tyckg4zit54e)
  { catSlug: 'plumbing', name: 'Bathroom Renovation & Fixture Fitting', slug: 'bathroom-fixture', description: 'Install new faucets, showers, basins and bathroom fittings', price: 1499, duration: 180, image: IMG.plumbing, inclusions: ['Fixture installation','Waterproofing check','Drain clearing','1-month warranty'] },
  { catSlug: 'plumbing', name: 'Blocked Drain Cleaning', slug: 'drain-cleaning', description: 'Clear blocked drains, pipes and sewage lines professionally', price: 349, duration: 60, image: IMG.plumbing, inclusions: ['Drain jetting','Chemical cleaning','Root removal if needed','Flush test'] },
  { catSlug: 'plumbing', name: 'Flush Tank Repair', slug: 'flush-tank-repair', description: 'Fix running, leaking, or broken flush tanks', price: 299, duration: 45, image: IMG.plumbing, inclusions: ['Tank inspection','Fill valve replacement','Flush valve repair','Leak-free test'] },

  // House Cleaning (id: cmt1wzdxz0003tyckuzr6q015)
  { catSlug: 'house-cleaning', name: 'Bathroom Deep Cleaning', slug: 'bathroom-cleaning', description: 'Scrub tiles, sanitize toilets, clean grouts and fittings', price: 499, duration: 90, image: IMG.cleaning, inclusions: ['Tile acid wash','Toilet sanitization','Grout cleaning','Drain deodorizer'] },
  { catSlug: 'house-cleaning', name: 'Sofa & Upholstery Cleaning', slug: 'sofa-cleaning', description: 'Deep clean fabric sofas, chairs and upholstery', price: 699, duration: 90, image: IMG.cleaning, inclusions: ['Foam extraction','Stain treatment','Odour neutralisation','Fabric protection spray'] },
  { catSlug: 'house-cleaning', name: 'Carpet & Rug Shampooing', slug: 'carpet-cleaning', description: 'Professional steam and shampoo cleaning for carpets and rugs', price: 599, duration: 90, image: IMG.cleaning, inclusions: ['Pre-treatment spray','Rotary brush scrub','Steam extraction','Odor elimination'] },
  { catSlug: 'house-cleaning', name: 'Move-In / Move-Out Cleaning', slug: 'move-cleaning', description: 'Thorough cleaning before or after moving to a new home', price: 1999, duration: 240, image: IMG.cleaning, inclusions: ['All rooms deep clean','Kitchen appliance clean','Bathroom disinfection','Window & glass cleaning'] },

  // Appliance Repair (id: cmt1wze9b0007tyck6e8okhyz)
  { catSlug: 'appliance-repair', name: 'Washing Machine Repair', slug: 'washing-machine-repair', description: 'Fix all washing machine faults – drum, motor, pump & more', price: 399, duration: 60, image: IMG.appliance, inclusions: ['Full diagnosis','Spare parts (if needed, extra)','Trial wash','90-day repair warranty'] },
  { catSlug: 'appliance-repair', name: 'Refrigerator Repair', slug: 'fridge-repair', description: 'Fix cooling issues, compressor, thermostat and gas leaks', price: 449, duration: 60, image: IMG.appliance, inclusions: ['Cooling test','Gas top-up if needed','Thermostat calibration','30-day warranty'] },
  { catSlug: 'appliance-repair', name: 'Microwave & Oven Repair', slug: 'microwave-repair', description: 'Diagnose and fix microwave, OTG and built-in oven faults', price: 349, duration: 45, image: IMG.appliance, inclusions: ['Magnetron check','Plate motor fix','Capacitor replacement','Safety test'] },
  { catSlug: 'appliance-repair', name: 'Water Purifier Service', slug: 'water-purifier', description: 'Annual service, filter change and RO membrane replacement', price: 299, duration: 45, image: IMG.appliance, inclusions: ['Filter replacement','Membrane check','TDS calibration','Sanitization flush'] },
];

// New category services
const NEW_CATEGORY_SERVICES = {
  'painting': [
    { name: 'Interior Wall Painting (1 Room)', slug: 'interior-room-painting', description: 'Full room painting with primer, putty, 2 coats of emulsion', price: 1999, duration: 240, image: IMG.painting, inclusions: ['Wall primer coat','Putty & smoothening','2 coats luxury emulsion','Furniture protection'] },
    { name: 'Full Home Interior Painting', slug: 'full-home-painting', description: 'Complete home interior painting – all rooms and walls', price: 8999, duration: 480, image: IMG.painting, inclusions: ['Full room coverage','Premium Birla/Asian paint','Putty & primer','Post-paint cleanup'] },
    { name: 'Exterior & Terrace Waterproof Coating', slug: 'exterior-painting', description: 'Exterior wall painting and waterproofing treatment', price: 3999, duration: 360, image: IMG.painting, inclusions: ['Surface cleaning','Waterproof primer','2 coats exterior paint','Water sealing'] },
    { name: 'Wood Polish & Lacquer Work', slug: 'wood-polish', description: 'Polish doors, windows, and wooden furniture with lacquer', price: 999, duration: 180, image: IMG.painting, inclusions: ['Surface sanding','PU polish/lacquer','Grain filling','Anti-moisture coating'] },
  ],
  'carpentry': [
    { name: 'Door & Window Repair', slug: 'door-window-repair', description: 'Fix broken, squeaky, or misaligned doors and windows', price: 399, duration: 60, image: IMG.carpentry, inclusions: ['Hinge tightening','Frame alignment','Lock repair','Weatherstripping'] },
    { name: 'Furniture Assembly', slug: 'furniture-assembly', description: 'Assemble flat-pack furniture from IKEA, Pepperfry, Urban Ladder', price: 499, duration: 90, image: IMG.carpentry, inclusions: ['Full assembly','Hardware fitting','Level & alignment','Screw tightening'] },
    { name: 'Custom Wardrobe & Shelf Fitting', slug: 'wardrobe-fitting', description: 'Install custom wardrobes, shoe racks, and wall shelves', price: 1299, duration: 180, image: IMG.carpentry, inclusions: ['Wall drilling','Bracket & hardware fitting','Level alignment','Stability test'] },
    { name: 'Modular Kitchen Fitting', slug: 'kitchen-cabinet-fitting', description: 'Install or repair modular kitchen cabinets and trolleys', price: 2499, duration: 300, image: IMG.carpentry, inclusions: ['Module assembly','Wall mounting','Hinge & handle fitting','Counter alignment'] },
  ],
  'pest-control': [
    { name: 'General Pest Control (1BHK)', slug: 'pest-1bhk', description: 'Cockroach, ant and common insect treatment for 1BHK homes', price: 499, duration: 60, image: IMG.pest, inclusions: ['Gel treatment','Spray disinfection','Entry point sealing','3-month warranty'] },
    { name: 'General Pest Control (2-3BHK)', slug: 'pest-3bhk', description: 'Full-home pest treatment for 2-3BHK with warranty', price: 799, duration: 90, image: IMG.pest, inclusions: ['Gel & spray combo','Kitchen deep treatment','Bathroom treatment','6-month warranty'] },
    { name: 'Termite Control', slug: 'termite-control', description: 'Drill, fill and spray termite treatment for wooden structures', price: 1999, duration: 120, image: IMG.pest, inclusions: ['Drill & inject treatment','Chemical barrier','Inspection report','1-year warranty'] },
    { name: 'Bed Bug Treatment', slug: 'bedbug-treatment', description: 'Steam and chemical treatment to eliminate bed bugs', price: 999, duration: 120, image: IMG.pest, inclusions: ['Steam treatment','Chemical spray','Mattress treatment','Follow-up in 14 days'] },
    { name: 'Mosquito & Dengue Fogging', slug: 'mosquito-fogging', description: 'Fogging and spray to eliminate mosquitoes and dengue vectors', price: 699, duration: 60, image: IMG.pest, inclusions: ['ULV fogging','Breeding spot treatment','Larvae control','7-day efficacy guarantee'] },
  ],
  'massage': [
    { name: 'Swedish Full Body Massage (60 min)', slug: 'swedish-massage', description: 'Relaxing Swedish massage for stress relief and muscle recovery', price: 799, duration: 60, image: IMG.massage, inclusions: ['Aromatherapy oil','Full body 60-min massage','Certified therapist','Fresh towels & linen'] },
    { name: 'Deep Tissue Massage (90 min)', slug: 'deep-tissue-massage', description: 'Therapeutic deep-tissue massage for pain and tension relief', price: 1199, duration: 90, image: IMG.massage, inclusions: ['Hot stone warm-up','90-min deep tissue','Trigger point therapy','Relaxation cool-down'] },
    { name: 'Couple Spa at Home', slug: 'couple-spa', description: 'Luxurious couple spa experience at your home', price: 2499, duration: 120, image: IMG.massage, inclusions: ['2 certified therapists','90-min dual massage','Aroma diffuser setup','Herbal foot soak'] },
  ],
  'salon': [
    { name: 'Full Face Cleanup & Glow Facial', slug: 'facial-cleanup', description: 'Professional facial cleanup, scrub and hydration mask', price: 449, duration: 60, image: IMG.beauty, inclusions: ['Cleanse & tone','Scrub exfoliation','Hydrating mask','SPF finish moisturizer'] },
    { name: 'Hair Cut & Blow Dry (Women)', slug: 'haircut-women', description: 'Expert haircut, wash and blowdry by a professional stylist', price: 349, duration: 60, image: IMG.beauty, inclusions: ['Hair wash','Trim & style cut','Blow dry & set','Serum finishing'] },
    { name: 'Bridal Makeup at Home', slug: 'bridal-makeup', description: 'Complete bridal makeup look with hair styling for weddings', price: 3999, duration: 180, image: IMG.beauty, inclusions: ['Base & contouring','Eye & bridal look','Hair styling','Touch-up kit provided'] },
    { name: 'Waxing – Full Arms & Legs', slug: 'waxing-full', description: 'Full body waxing (arms + legs) with Rica or honey wax', price: 499, duration: 60, image: IMG.beauty, inclusions: ['Full arms & legs','Rica/honey wax','Post-wax soother','Moisturizer application'] },
    { name: 'Pedicure & Manicure Combo', slug: 'pedi-mani', description: 'Classic pedicure and manicure with nail polish and massage', price: 599, duration: 90, image: IMG.beauty, inclusions: ['Soaking & scrub','Nail shaping & filing','Cuticle care','Color nail polish'] },
  ],
  'laundry': [
    { name: 'Wash & Fold (per kg)', slug: 'wash-fold', description: 'Machine wash and neatly fold your clothes, min 3 kg', price: 99, duration: 0, image: IMG.laundry, inclusions: ['Detergent wash','Fabric softener','Neatly folded','12-hr turnaround'] },
    { name: 'Dry Cleaning (per piece)', slug: 'dry-cleaning', description: 'Professional dry cleaning for suits, jackets and delicates', price: 199, duration: 0, image: IMG.laundry, inclusions: ['Dry clean solvent','Spot treatment','Press & finish','Garment bag packaging'] },
    { name: 'Ironing Service (per piece)', slug: 'ironing', description: 'Precision steam ironing and pressing for all garments', price: 15, duration: 0, image: IMG.laundry, inclusions: ['Steam iron press','Collar/cuff shaping','Crease-free finish','Same-day return'] },
  ],
  'cctv': [
    { name: 'CCTV Installation (2 Cameras)', slug: 'cctv-2cam', description: 'Install 2 HD cameras with DVR/NVR and remote viewing setup', price: 2499, duration: 180, image: IMG.cctv, inclusions: ['2 HD cameras','DVR/NVR setup','Cable routing','Mobile app config'] },
    { name: 'CCTV Installation (4 Cameras)', slug: 'cctv-4cam', description: 'Install 4 HD cameras for full home coverage', price: 3999, duration: 240, image: IMG.cctv, inclusions: ['4 HD cameras','4-ch DVR','Power & cable run','Mobile remote view'] },
    { name: 'Video Door Phone Setup', slug: 'video-doorbell', description: 'Install and configure wireless video door phone/bell', price: 999, duration: 90, image: IMG.cctv, inclusions: ['Door panel fitting','Indoor monitor install','Wi-Fi config','App setup'] },
  ],
  'home-shifting': [
    { name: 'Local Home Shifting (1BHK)', slug: 'shifting-1bhk', description: 'Packing, loading and unloading for 1BHK local move', price: 3999, duration: 480, image: IMG.shifting, inclusions: ['Packing materials','Trained movers','Loading & unloading','Basic assembly'] },
    { name: 'Local Home Shifting (2-3BHK)', slug: 'shifting-3bhk', description: 'Complete relocation service for 2-3BHK homes', price: 6999, duration: 600, image: IMG.shifting, inclusions: ['Bubble wrap packing','6 trained movers','Safe transit','Full unboxing'] },
    { name: 'Furniture Relocation', slug: 'furniture-shifting', description: 'Move heavy furniture safely within the same building or nearby', price: 1499, duration: 180, image: IMG.shifting, inclusions: ['Disassembly if needed','Protective wrapping','Safe carry','Reassembly'] },
  ],
};

async function cuid() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `c${ts}${rand}`;
}

async function main() {
  console.log('🚀 Starting NearWork Full Services Seed...\n');

  // Step 1: Update existing services with imageUrls
  const existingUpdates = [
    { slug: 'ac-installation', image: IMG.ac },
    { slug: 'ac-foam-jet-deep-service', image: IMG.ac },
    { slug: 'switchboard-socket-repair', image: IMG.electrician },
    { slug: 'ceiling-fan-installation-repair', image: IMG.fan },
    { slug: 'complete-full-home-deep-cleaning', image: IMG.cleaning },
    { slug: 'modular-kitchen-deep-clean', image: IMG.kitchen },
    { slug: 'overhead-water-tank-cleaning', image: IMG.tank },
    { slug: 'tap-pipe-leakage-repair', image: IMG.plumbing },
  ];

  for (const u of existingUpdates) {
    await exec(`UPDATE "Service" SET "imageUrl" = '${u.image}' WHERE slug = '${u.slug}'`);
    console.log(`✅ Updated image for: ${u.slug}`);
  }

  // Update existing category imageUrls
  const catImageUpdates = [
    { slug: 'electrician', img: IMG.electrician },
    { slug: 'ac-service', img: IMG.ac },
    { slug: 'fan-installation', img: IMG.fan },
    { slug: 'house-cleaning', img: IMG.cleaning },
    { slug: 'kitchen-cleaning', img: IMG.kitchen },
    { slug: 'tank-cleaning', img: IMG.tank },
    { slug: 'plumbing', img: IMG.plumbing },
    { slug: 'appliance-repair', img: IMG.appliance },
  ];
  for (const u of catImageUpdates) {
    await exec(`UPDATE "ServiceCategory" SET "imageUrl" = '${u.img}' WHERE slug = '${u.slug}'`);
    console.log(`✅ Updated category image for: ${u.slug}`);
  }

  // Step 2: Get existing category IDs
  const catRes = await fetch(`${TURSO_DATABASE_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT id, slug FROM "ServiceCategory"' } }, { type: 'close' }] })
  });
  const catData = await catRes.json();
  const catRows = catData.results?.[0]?.response?.result?.rows || [];
  const catCols = catData.results?.[0]?.response?.result?.cols || [];
  const catMap = {};
  catRows.forEach(row => {
    const o = {};
    catCols.forEach((c, i) => o[c.name] = row[i]?.value);
    catMap[o.slug] = o.id;
  });
  console.log('\n📋 Existing categories:', Object.keys(catMap).join(', '));

  // Step 3: Add new categories
  console.log('\n➕ Adding new categories...');
  for (const cat of NEW_CATEGORIES) {
    const exists = catMap[cat.slug];
    if (exists) {
      await exec(`UPDATE "ServiceCategory" SET "imageUrl" = '${cat.imageUrl}', "description" = '${cat.description.replace(/'/g, "''")}', "sortOrder" = ${cat.sortOrder} WHERE slug = '${cat.slug}'`);
      catMap[cat.slug] = exists;
      console.log(`  ⟳ Updated: ${cat.name}`);
    } else {
      const id = await cuid();
      const now = new Date().toISOString();
      await exec(`INSERT INTO "ServiceCategory" (id, name, slug, description, icon, imageUrl, isActive, sortOrder, createdAt, updatedAt) VALUES ('${id}', '${cat.name}', '${cat.slug}', '${cat.description.replace(/'/g, "''")}', '${cat.icon}', '${cat.imageUrl}', 1, ${cat.sortOrder}, '${now}', '${now}')`);
      catMap[cat.slug] = id;
      console.log(`  ✅ Created: ${cat.name} (${id})`);
    }
  }

  // Step 4: Add services for existing categories
  console.log('\n➕ Adding services for existing categories...');
  for (const srv of SERVICES_FOR_EXISTING) {
    const catId = catMap[srv.catSlug];
    if (!catId) { console.log(`  ⚠️ No catId for ${srv.catSlug}`); continue; }
    const incl = JSON.stringify(srv.inclusions);
    const id = await cuid();
    const now = new Date().toISOString();
    try {
      await exec(`INSERT INTO "Service" (id, categoryId, name, slug, description, basePrice, durationMinutes, inclusions, imageUrl, isActive, createdAt, updatedAt) VALUES ('${id}', '${catId}', '${srv.name.replace(/'/g, "''")}', '${srv.slug}', '${srv.description.replace(/'/g, "''")}', ${srv.price}, ${srv.duration}, '${incl.replace(/'/g, "''")}', '${srv.image}', 1, '${now}', '${now}')`);
      console.log(`  ✅ ${srv.name} (₹${srv.price})`);
    } catch (e) {
      console.log(`  ⚠️ Skip (may exist): ${srv.name} - ${e.message}`);
    }
  }

  // Step 5: Add services for new categories
  console.log('\n➕ Adding services for new categories...');
  for (const [catSlug, services] of Object.entries(NEW_CATEGORY_SERVICES)) {
    const catId = catMap[catSlug];
    if (!catId) { console.log(`  ⚠️ No catId for ${catSlug}`); continue; }
    for (const srv of services) {
      const incl = JSON.stringify(srv.inclusions);
      const id = await cuid();
      const now = new Date().toISOString();
      try {
        await exec(`INSERT INTO "Service" (id, categoryId, name, slug, description, basePrice, durationMinutes, inclusions, imageUrl, isActive, createdAt, updatedAt) VALUES ('${id}', '${catId}', '${srv.name.replace(/'/g, "''")}', '${srv.slug}', '${srv.description.replace(/'/g, "''")}', ${srv.price}, ${srv.duration}, '${incl.replace(/'/g, "''")}', '${srv.image}', 1, '${now}', '${now}')`);
        console.log(`  ✅ ${srv.name} (₹${srv.price})`);
      } catch (e) {
        console.log(`  ⚠️ Skip (may exist): ${srv.name} - ${e.message}`);
      }
    }
  }

  // Final count
  const countRes = await fetch(`${TURSO_DATABASE_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT COUNT(*) as cnt FROM "Service"' } }, { type: 'close' }] })
  });
  const countData = await countRes.json();
  const cnt = countData.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value;
  console.log(`\n🎉 Seed complete! Total services in Turso: ${cnt}`);

  const catCountRes = await fetch(`${TURSO_DATABASE_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT COUNT(*) as cnt FROM "ServiceCategory"' } }, { type: 'close' }] })
  });
  const catCountData = await catCountRes.json();
  const catCnt = catCountData.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value;
  console.log(`📦 Total categories in Turso: ${catCnt}`);
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });
