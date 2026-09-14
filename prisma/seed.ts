import { prisma } from '../src/config/db';
import bcrypt from 'bcryptjs';



async function main() {
  console.log('🌱 Starting NearWork database seed...');

  // 1. Service Categories
  const categoriesData = [
    {
      name: 'Electrician',
      slug: 'electrician',
      icon: 'Zap',
      description: 'Expert electrical repairs, wiring, switches & fixture installations',
      sortOrder: 1
    },
    {
      name: 'AC Service & Repair',
      slug: 'ac-service',
      icon: 'Wind',
      description: 'AC installation, gas filling, master cleaning & deep servicing',
      sortOrder: 2
    },
    {
      name: 'Fan Installation',
      slug: 'fan-installation',
      icon: 'Disc',
      description: 'Ceiling & exhaust fan installation, repair & regulator replacement',
      sortOrder: 3
    },
    {
      name: 'House Cleaning',
      slug: 'house-cleaning',
      icon: 'Sparkles',
      description: 'Complete home deep cleaning, floor scrub & sanitization',
      sortOrder: 4
    },
    {
      name: 'Kitchen Cleaning',
      slug: 'kitchen-cleaning',
      icon: 'UtensilsCrossed',
      description: 'Degreasing chimneys, cabinets, gas stoves & tiles deep clean',
      sortOrder: 5
    },
    {
      name: 'Water Tank Cleaning',
      slug: 'tank-cleaning',
      icon: 'Droplets',
      description: 'High-pressure mechanized scrubbing and UV disinfection',
      sortOrder: 6
    },
    {
      name: 'Plumbing',
      slug: 'plumbing',
      icon: 'Wrench',
      description: 'Tap repairs, drain blockages, pipe fittings & bathroom fixtures',
      sortOrder: 7
    },
    {
      name: 'Appliance Repair',
      slug: 'appliance-repair',
      icon: 'Tv',
      description: 'Washing machine, refrigerator, microwave & geyser repairs',
      sortOrder: 8
    }
  ];

  const categoryMap: Record<string, any> = {};
  for (const cat of categoriesData) {
    const created = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat
    });
    categoryMap[cat.slug] = created;
  }

  // 2. Services
  const servicesData = [
    {
      categoryId: categoryMap['ac-service'].id,
      name: 'AC Installation',
      slug: 'ac-installation',
      description: 'Complete split/window AC installation with indoor and outdoor unit mounting',
      basePrice: 699,
      durationMinutes: 120,
      inclusions: JSON.stringify([
        'Standard mounting & bracket installation',
        'Copper pipe connection & vacuum check',
        'Gas pressure and cooling testing',
        'Post-installation cleanup'
      ]),
      icon: 'Wind'
    },
    {
      categoryId: categoryMap['ac-service'].id,
      name: 'AC Foam Jet Deep Service',
      slug: 'ac-deep-service',
      description: '2x deeper cooling power with specialized high-pressure foam jet wash',
      basePrice: 499,
      durationMinutes: 60,
      inclusions: JSON.stringify([
        'Indoor unit foam jet washing',
        'Outdoor unit coil cleanup',
        'Air filter & drain tray disinfection',
        'Cooling efficiency inspection'
      ]),
      icon: 'Sparkles'
    },
    {
      categoryId: categoryMap['electrician'].id,
      name: 'Switchboard & Socket Repair',
      slug: 'switchboard-repair',
      description: 'Inspection and repair of faulty switches, sockets, and short circuits',
      basePrice: 199,
      durationMinutes: 45,
      inclusions: JSON.stringify([
        'Diagnostic inspection of electrical board',
        'Replacement/repair of up to 2 switches',
        'Load & voltage safety check'
      ]),
      icon: 'Zap'
    },
    {
      categoryId: categoryMap['fan-installation'].id,
      name: 'Ceiling Fan Installation & Repair',
      slug: 'ceiling-fan-install',
      description: 'Ceiling fan assembly, rod mounting, safety pin check, and wiring',
      basePrice: 199,
      durationMinutes: 40,
      inclusions: JSON.stringify([
        'Safe assembly and downrod fixing',
        'Secure ceiling hook connection',
        'Regulator speed calibration'
      ]),
      icon: 'Disc'
    },
    {
      categoryId: categoryMap['house-cleaning'].id,
      name: 'Complete Full Home Deep Cleaning',
      slug: 'full-home-deep-cleaning',
      description: 'Comprehensive 360-degree deep cleaning for living room, bedrooms, and balconies',
      basePrice: 1499,
      durationMinutes: 240,
      inclusions: JSON.stringify([
        'Mechanized single-disc floor scrubbing',
        'Cobweb removal and high-dusting',
        'Window sill, frame, and glass cleaning',
        'Dry vacuuming of sofas & mattresses'
      ]),
      icon: 'Home'
    },
    {
      categoryId: categoryMap['kitchen-cleaning'].id,
      name: 'Modular Kitchen Deep Clean',
      slug: 'modular-kitchen-deep-clean',
      description: 'Deep degreasing of chimney, stovetop, slab, and oil-stained tiles',
      basePrice: 899,
      durationMinutes: 150,
      inclusions: JSON.stringify([
        'Chemical oil & grease removal',
        'Exhaust fan and chimney exterior scrub',
        'Cabinet interior & exterior wipe-down',
        'Sink drain deodorization'
      ]),
      icon: 'Utensils'
    },
    {
      categoryId: categoryMap['tank-cleaning'].id,
      name: 'Overhead Water Tank Cleaning',
      slug: 'overhead-tank-cleaning',
      description: '6-stage mechanized cleaning and antibacterial sludge extraction',
      basePrice: 799,
      durationMinutes: 90,
      inclusions: JSON.stringify([
        'Sludge & muddy water de-watering',
        'High-pressure rotary jet washing',
        'Vacuum sediment removal',
        'UV radiation disinfectant treatment'
      ]),
      icon: 'Droplets'
    },
    {
      categoryId: categoryMap['plumbing'].id,
      name: 'Tap & Pipe Leakage Repair',
      slug: 'tap-leakage-repair',
      description: 'Fixing dripping taps, washers, angle valves, and pipe leakage',
      basePrice: 249,
      durationMinutes: 45,
      inclusions: JSON.stringify([
        'Leakage detection and washer sealing',
        'Thread seal taping & valve tight-fit',
        'Water flow pressure test'
      ]),
      icon: 'Wrench'
    }
  ];

  for (const s of servicesData) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: s,
      create: s
    });
  }

  // 3. Password Hash
  const passwordHash = await bcrypt.hash('password123', 10);

  // 4. Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nearwork.com' },
    update: {},
    create: {
      email: 'admin@nearwork.com',
      phone: '9876543210',
      name: 'System Admin',
      passwordHash,
      role: "ADMIN",
      adminProfile: {
        create: {
          department: 'Platform Operations',
          permissions: 'ALL'
        }
      }
    }
  });

  // 5. Demo Customer (Gorakhpur coordinates: 26.7606, 83.3732)
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@nearwork.com' },
    update: {},
    create: {
      email: 'customer@nearwork.com',
      phone: '9876543211',
      name: 'Sandeep Sharma',
      passwordHash,
      role: "CUSTOMER",
      addresses: {
        create: [
          {
            label: 'Home',
            addressLine: 'Flat 402, Royal Palms Apartment, Civil Lines',
            landmark: 'Near Golghar Chowk',
            city: 'Gorakhpur',
            state: 'Uttar Pradesh',
            pincode: '273001',
            latitude: 26.7606,
            longitude: 83.3732,
            isDefault: true
          },
          {
            label: 'Office',
            addressLine: 'Tech Hub Park, Sector 4',
            landmark: 'Opposite Railway Stadium',
            city: 'Gorakhpur',
            state: 'Uttar Pradesh',
            pincode: '273012',
            latitude: 26.758,
            longitude: 83.385,
            isDefault: false
          }
        ]
      }
    }
  });

  // 6. Verified Worker 1 (Electrician & AC Technician) - 2.1km from customer
  const worker1User = await prisma.user.upsert({
    where: { email: 'worker1@nearwork.com' },
    update: {},
    create: {
      email: 'worker1@nearwork.com',
      phone: '9876543212',
      name: 'Raj Kumar',
      passwordHash,
      role: "WORKER",
      workerProfile: {
        create: {
          status: "ONLINE",
          verificationStatus: "VERIFIED",
          experienceYears: 6,
          workingRadiusKm: 20.0,
          currentLat: 26.765,
          currentLng: 83.38,
          address: 'Mohaddipur, Gorakhpur, UP',
          bankAccountNumber: '98765432101234',
          bankIfsc: 'HDFC0001234',
          totalJobsCompleted: 54,
          averageRating: 4.9,
          totalReviews: 48,
          availableBalance: 2450.0,
          skills: {
            create: [
              { categoryId: categoryMap['electrician'].id, experienceYears: 6 },
              { categoryId: categoryMap['ac-service'].id, experienceYears: 5 },
              { categoryId: categoryMap['fan-installation'].id, experienceYears: 6 }
            ]
          },
          availability: {
            create: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
              dayOfWeek: day,
              startTime: '08:00',
              endTime: '20:00',
              isOff: day === 0
            }))
          }
        }
      }
    }
  });

  // 7. Verified Worker 2 (House Cleaning & Plumbing Specialist) - 1.8km
  const worker2User = await prisma.user.upsert({
    where: { email: 'worker2@nearwork.com' },
    update: {},
    create: {
      email: 'worker2@nearwork.com',
      phone: '9876543213',
      name: 'Amit Verma',
      passwordHash,
      role: "WORKER",
      workerProfile: {
        create: {
          status: "ONLINE",
          verificationStatus: "VERIFIED",
          experienceYears: 4,
          workingRadiusKm: 15.0,
          currentLat: 26.758,
          currentLng: 83.369,
          address: 'Betiahata, Gorakhpur, UP',
          bankAccountNumber: '12345678909876',
          bankIfsc: 'SBIN0004321',
          totalJobsCompleted: 32,
          averageRating: 4.8,
          totalReviews: 29,
          availableBalance: 1850.0,
          skills: {
            create: [
              { categoryId: categoryMap['house-cleaning'].id, experienceYears: 4 },
              { categoryId: categoryMap['kitchen-cleaning'].id, experienceYears: 4 },
              { categoryId: categoryMap['tank-cleaning'].id, experienceYears: 3 },
              { categoryId: categoryMap['plumbing'].id, experienceYears: 3 }
            ]
          },
          availability: {
            create: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
              dayOfWeek: day,
              startTime: '09:00',
              endTime: '19:00',
              isOff: false
            }))
          }
        }
      }
    }
  });

  // 8. Pending Worker 3 (Waiting for KYC Approval)
  const worker3User = await prisma.user.upsert({
    where: { email: 'worker3@nearwork.com' },
    update: {},
    create: {
      email: 'worker3@nearwork.com',
      phone: '9876543214',
      name: 'Vikram Singh',
      passwordHash,
      role: "WORKER",
      workerProfile: {
        create: {
          status: "OFFLINE",
          verificationStatus: "PENDING",
          experienceYears: 2,
          workingRadiusKm: 10.0,
          currentLat: 26.77,
          currentLng: 83.39,
          address: 'Taramandal, Gorakhpur, UP',
          idProofType: 'Aadhaar Card',
          idProofUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
          skills: {
            create: [{ categoryId: categoryMap['appliance-repair'].id, experienceYears: 2 }]
          }
        }
      }
    }
  });

  // 9. Promotional Coupons
  const coupons = [
    {
      code: 'WELCOME50',
      discountType: "PERCENTAGE",
      discountValue: 50,
      minOrderValue: 0,
      maxDiscount: 150,
      usageLimit: 5000,
      isActive: true
    },
    {
      code: 'FIRSTBOOKING',
      discountType: "FIXED",
      discountValue: 100,
      minOrderValue: 0,
      usageLimit: 5000,
      isActive: true
    },
    {
      code: 'CLEAN20',
      discountType: "PERCENTAGE",
      discountValue: 20,
      minOrderValue: 0,
      maxDiscount: 300,
      usageLimit: 5000,
      isActive: true
    }
  ];

  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: c,
      create: c
    });
  }

  console.log('✅ NearWork database seed completed successfully!');
  console.log('----------------------------------------------------');
  console.log('👤 Customer: customer@nearwork.com / password123');
  console.log('🛠️  Worker 1 (Verified): worker1@nearwork.com / password123');
  console.log('🛠️  Worker 2 (Verified): worker2@nearwork.com / password123');
  console.log('⏳ Worker 3 (Pending KYC): worker3@nearwork.com / password123');
  console.log('🛡️  Admin: admin@nearwork.com / password123');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
