require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Category = require('../models/Category');

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Refusing to run import script in production environment.');
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/BigMart';

// Provided product data converted to valid JS objects
const providedProducts = [
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Smart Fitness Band 7',
    slug: 'smart-fitness-band-7',
    shortDescription: '1.62-inch AMOLED display with 120 sports modes.',
    description: 'Track your daily activity, heart rate, SPO2 levels, and sleep quality with the Smart Fitness Band 7. Features continuous health monitoring, 5ATM water resistance, and up to 14 days of battery life on a single charge.',
    brand: 'FitTrack',
    sku: 'FIT-BND-BLK-002',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/fitband1.jpg',
        fileId: '6ac871efead997d09a0ae8d9',
        sortOrder: 0
      }
    ],
    price: 2499,
    compareAtPrice: 3999,
    costPrice: 1800,
    gstRate: 18,
    stock: 15,
    lowStockThreshold: 5,
    weight: 0.2,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:00:00.000Z'),
    updatedAt: new Date('2026-10-09T06:00:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'RGB Mechanical Gaming Keyboard',
    slug: 'rgb-mechanical-gaming-keyboard',
    shortDescription: 'Tactile blue switches with customizable RGB backlighting.',
    description: 'Enhance your gaming setup with this full-sized mechanical keyboard equipped with responsive tactile switches, anti-ghosting keys, durable aluminum frame, and per-key RGB backlighting customizable via software.',
    brand: 'HyperGear',
    sku: 'KB-MECH-RGB-003',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/keyboard1.jpg',
        fileId: '6ac871efead997d09a0ae8e0',
        sortOrder: 0
      }
    ],
    price: 3299,
    compareAtPrice: 4999,
    costPrice: 2500,
    gstRate: 18,
    stock: 20,
    lowStockThreshold: 3,
    weight: 1.1,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:05:00.000Z'),
    updatedAt: new Date('2026-10-09T06:05:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Wireless Ergonomic Optical Mouse',
    slug: 'wireless-ergonomic-optical-mouse',
    shortDescription: '2.4GHz wireless connectivity with adjustable DPI settings.',
    description: 'Designed for ultimate comfort during long work hours. Features silent clicks, ergonomic thumb grip, optical tracking up to 2400 DPI, and automatic power-saving sleep mode.',
    brand: 'LogiTech',
    sku: 'MSE-WRL-ERG-004',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/mouse1.jpg',
        fileId: '6ac871efead997d09a0ae8e1',
        sortOrder: 0
      }
    ],
    price: 899,
    compareAtPrice: 1499,
    costPrice: 600,
    gstRate: 18,
    stock: 45,
    lowStockThreshold: 10,
    weight: 0.15,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:10:00.000Z'),
    updatedAt: new Date('2026-10-09T06:10:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: '20000mAh 22.5W Fast Power Bank',
    slug: '20000mah-22-5w-fast-power-bank',
    shortDescription: 'Dual USB output and Type-C Power Delivery support.',
    description: 'Keep all your gadgets charged on the go. High-density lithium polymer power bank featuring 22.5W fast charging, LED battery indicator, and multi-layer circuit safety protection.',
    brand: 'VoltCharge',
    sku: 'PWR-20k-FAST-005',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/powerbank1.jpg',
        fileId: '6ac871efead997d09a0ae8e2',
        sortOrder: 0
      }
    ],
    price: 1699,
    compareAtPrice: 2999,
    costPrice: 1200,
    gstRate: 18,
    stock: 30,
    lowStockThreshold: 5,
    weight: 0.45,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:15:00.000Z'),
    updatedAt: new Date('2026-10-09T06:15:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Full HD 1080p Webcam with Mic',
    slug: 'full-hd-1080p-webcam-with-mic',
    shortDescription: 'Plug-and-play USB webcam with noise-canceling dual microphones.',
    description: 'Ideal for online meetings, video conferencing, and live streaming. Provides sharp 1080p video at 30fps, automatic low-light correction, and built-in privacy shutter.',
    brand: 'VisionPro',
    sku: 'CAM-1080-HD-006',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/webcam1.jpg',
        fileId: '6ac871efead997d09a0ae8e3',
        sortOrder: 0
      }
    ],
    price: 1899,
    compareAtPrice: 2999,
    costPrice: 1300,
    gstRate: 18,
    stock: 12,
    lowStockThreshold: 4,
    weight: 0.25,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:20:00.000Z'),
    updatedAt: new Date('2026-10-09T06:20:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Portable Bluetooth Speaker 16W',
    slug: 'portable-bluetooth-speaker-16w',
    shortDescription: 'IPX7 waterproof speaker with punchy bass and 12-hour playtime.',
    description: 'Take your sound anywhere. Compact outdoor speaker engineered with dual passive radiators for deep bass, Bluetooth 5.3 connectivity, and TWS pairing support for stereo sound.',
    brand: 'Boot',
    sku: 'SPK-BT-16W-007',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/speaker1.jpg',
        fileId: '6ac871efead997d09a0ae8e4',
        sortOrder: 0
      }
    ],
    price: 2199,
    compareAtPrice: 3499,
    costPrice: 1550,
    gstRate: 18,
    stock: 25,
    lowStockThreshold: 5,
    weight: 0.6,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:25:00.000Z'),
    updatedAt: new Date('2026-10-09T06:25:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Smart WiFi Security Camera 360',
    slug: 'smart-wifi-security-camera-360',
    shortDescription: '1080p pan-tilt indoor camera with motion tracking and night vision.',
    description: 'Monitor your home from anywhere with 360-degree pan-tilt coverage, AI motion detection alerts, 2-way audio communication, and cloud/microSD storage options.',
    brand: 'SecureHome',
    sku: 'CAM-WIFI-360-008',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/seccam1.jpg',
        fileId: '6ac871efead997d09a0ae8e5',
        sortOrder: 0
      }
    ],
    price: 2299,
    compareAtPrice: 3999,
    costPrice: 1600,
    gstRate: 18,
    stock: 18,
    lowStockThreshold: 5,
    weight: 0.35,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:30:00.000Z'),
    updatedAt: new Date('2026-10-09T06:30:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'USB-C Multi-Port Hub 7-in-1',
    slug: 'usb-c-multi-port-hub-7-in-1',
    shortDescription: '4K HDMI, 100W PD charging, SD/TF card reader, and 3 USB 3.0 ports.',
    description: 'Expand your laptop connectivity instantly. Compact aluminum USB-C dock offering 4K @ 30Hz HDMI output, fast data transfer speeds up to 5Gbps, and 100W pass-through charging.',
    brand: 'HubMax',
    sku: 'HUB-USBC-7IN1-009',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/usbhub1.jpg',
        fileId: '6ac871efead997d09a0ae8e6',
        sortOrder: 0
      }
    ],
    price: 1799,
    compareAtPrice: 2999,
    costPrice: 1150,
    gstRate: 18,
    stock: 22,
    lowStockThreshold: 4,
    weight: 0.18,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:35:00.000Z'),
    updatedAt: new Date('2026-10-09T06:35:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: '65W GaN Fast Wall Charger',
    slug: '65w-gan-fast-wall-charger',
    shortDescription: 'Triple port fast adapter for laptops, tablets, and smartphones.',
    description: 'Powered by Gallium Nitride (GaN) technology for high power output in a compact size. Charge laptops, iPhones, and Android devices simultaneously with dual Type-C and single USB-A ports.',
    brand: 'VoltCharge',
    sku: 'CHG-GAN-65W-010',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/gancharger1.jpg',
        fileId: '6ac871efead997d09a0ae8e7',
        sortOrder: 0
      }
    ],
    price: 1999,
    compareAtPrice: 2999,
    costPrice: 1400,
    gstRate: 18,
    stock: 35,
    lowStockThreshold: 8,
    weight: 0.22,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:40:00.000Z'),
    updatedAt: new Date('2026-10-09T06:40:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Over-Ear Active Noise Cancelling Headphones',
    slug: 'over-ear-active-noise-cancelling-headphones',
    shortDescription: '40mm drivers with up to 40 hours wireless playtime.',
    description: 'Immerse yourself in high-fidelity audio with Hybrid Active Noise Cancellation. Soft memory foam earcups ensure all-day comfort, accompanied by quick charge capabilities and clear call quality.',
    brand: 'Boot',
    sku: 'HDPH-ANC-BLK-011',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/headphones1.jpg',
        fileId: '6ac871efead997d09a0ae8e8',
        sortOrder: 0
      }
    ],
    price: 4499,
    compareAtPrice: 6999,
    costPrice: 3100,
    gstRate: 18,
    stock: 10,
    lowStockThreshold: 3,
    weight: 0.38,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:45:00.000Z'),
    updatedAt: new Date('2026-10-09T06:45:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Adjustable Aluminium Laptop Stand',
    slug: 'adjustable-aluminium-laptop-stand',
    shortDescription: 'Foldable ergonomic stand for laptops up to 15.6 inches.',
    description: 'Improve body posture and laptop airflow with this premium aluminium alloy stand featuring 6 adjustable height levels, non-slip silicone pads, and portable folding design.',
    brand: 'DeskCraft',
    sku: 'STND-LPT-ALU-012',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/stand1.jpg',
        fileId: '6ac871efead997d09a0ae8e9',
        sortOrder: 0
      }
    ],
    price: 799,
    compareAtPrice: 1499,
    costPrice: 450,
    gstRate: 18,
    stock: 50,
    lowStockThreshold: 10,
    weight: 0.3,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:50:00.000Z'),
    updatedAt: new Date('2026-10-09T06:50:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Electric Kettle 1.8L Stainless Steel',
    slug: 'electric-kettle-1-8l-stainless-steel',
    shortDescription: '1500W rapid boil kettle with auto shut-off protection.',
    description: 'Boil water quickly for tea, coffee, or instant meals. Made of food-grade 304 stainless steel with cool-touch handle, dry-boil protection, and 360-degree swivel base.',
    brand: 'HomeEase',
    sku: 'KTL-ELE-18L-013',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/kettle1.jpg',
        fileId: '6ac871efead997d09a0ae8f0',
        sortOrder: 0
      }
    ],
    price: 999,
    compareAtPrice: 1799,
    costPrice: 650,
    gstRate: 18,
    stock: 40,
    lowStockThreshold: 8,
    weight: 0.9,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T06:55:00.000Z'),
    updatedAt: new Date('2026-10-09T06:55:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Digital Food Kitchen Scale',
    slug: 'digital-food-kitchen-scale',
    shortDescription: 'High precision sensor measuring up to 10kg with tare function.',
    description: 'Accurately weigh ingredients for baking and meal prep. LCD display, unit conversion options (g, oz, lb, ml), and durable stainless steel top platform.',
    brand: 'ChefScale',
    sku: 'SCL-KTN-DIG-014',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/scale1.jpg',
        fileId: '6ac871efead997d09a0ae8f1',
        sortOrder: 0
      }
    ],
    price: 599,
    compareAtPrice: 999,
    costPrice: 350,
    gstRate: 18,
    stock: 30,
    lowStockThreshold: 5,
    weight: 0.4,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:00:00.000Z'),
    updatedAt: new Date('2026-10-09T07:00:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Smart RGB LED Desk Lamp',
    slug: 'smart-rgb-led-desk-lamp',
    shortDescription: 'Dimmable eye-care lamp with wireless charging pad built-in.',
    description: 'Versatile desk lamp featuring adjustable color temperatures (3000K-6000K), touch controls, ambient RGB base lighting, and an integrated 10W wireless smartphone charger.',
    brand: 'Lumina',
    sku: 'LMP-DSK-RGB-015',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/desklamp1.jpg',
        fileId: '6ac871efead997d09a0ae8f2',
        sortOrder: 0
      }
    ],
    price: 1599,
    compareAtPrice: 2499,
    costPrice: 1000,
    gstRate: 18,
    stock: 18,
    lowStockThreshold: 4,
    weight: 0.7,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:05:00.000Z'),
    updatedAt: new Date('2026-10-09T07:05:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: '1TB External Portable SSD USB 3.2',
    slug: '1tb-external-portable-ssd-usb-3-2',
    shortDescription: 'Transfer speeds up to 1050MB/s in a shock-resistant body.',
    description: 'High-speed solid state drive for backing up photos, videos, and large project files. Compact metal housing, hardware encryption support, and broad compatibility with Mac, Windows, and Android.',
    brand: 'DataPro',
    sku: 'SSD-EXT-1TB-016',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/ssd1.jpg',
        fileId: '6ac871efead997d09a0ae8f3',
        sortOrder: 0
      }
    ],
    price: 6999,
    compareAtPrice: 9999,
    costPrice: 5200,
    gstRate: 18,
    stock: 8,
    lowStockThreshold: 2,
    weight: 0.1,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:10:00.000Z'),
    updatedAt: new Date('2026-10-09T07:10:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Automatic Cordless Hair Trimmer',
    slug: 'automatic-cordless-hair-trimmer',
    shortDescription: 'Self-sharpening stainless steel blades with 90-min runtime.',
    description: 'Precision grooming kit for beard and hair styling. Includes 4 guide combs, fast USB charging, ergonomic grip, and quiet rotary motor operation.',
    brand: 'GroomTech',
    sku: 'TRM-HAIR-CRD-017',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/trimmer1.jpg',
        fileId: '6ac871efead997d09a0ae8f4',
        sortOrder: 0
      }
    ],
    price: 1299,
    compareAtPrice: 1999,
    costPrice: 850,
    gstRate: 18,
    stock: 25,
    lowStockThreshold: 5,
    weight: 0.32,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:15:00.000Z'),
    updatedAt: new Date('2026-10-09T07:15:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Smart Plug WiFi Socket 16A',
    slug: 'smart-plug-wifi-socket-16a',
    shortDescription: 'Voice control via Alexa/Google Assistant with energy monitoring.',
    description: 'Automate your home appliances. Control high-power electronics remotely, schedule timers, track real-time power consumption, and create smart home routines.',
    brand: 'SecureHome',
    sku: 'PLG-WIFI-16A-018',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/smartplug1.jpg',
        fileId: '6ac871efead997d09a0ae8f5',
        sortOrder: 0
      }
    ],
    price: 899,
    compareAtPrice: 1499,
    costPrice: 550,
    gstRate: 18,
    stock: 35,
    lowStockThreshold: 7,
    weight: 0.12,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:20:00.000Z'),
    updatedAt: new Date('2026-10-09T07:20:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Car Phone Mount Wireless Charger 15W',
    slug: 'car-phone-mount-wireless-charger-15w',
    shortDescription: 'Automatic clamping dashboard and air vent phone holder.',
    description: 'Secure and charge your smartphone while driving. Built-in smart sensor automatically opens and closes arms, supporting Qi wireless fast charging up to 15W.',
    brand: 'AutoPro',
    sku: 'CAR-WLS-MNT-019',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/carmount1.jpg',
        fileId: '6ac871efead997d09a0ae8f6',
        sortOrder: 0
      }
    ],
    price: 1399,
    compareAtPrice: 2299,
    costPrice: 900,
    gstRate: 18,
    stock: 20,
    lowStockThreshold: 4,
    weight: 0.28,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:25:00.000Z'),
    updatedAt: new Date('2026-10-09T07:25:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Stainless Steel Insulated Water Bottle 1L',
    slug: 'stainless-steel-insulated-water-bottle-1l',
    shortDescription: 'Double-wall vacuum insulation keeps drinks cold 24h / hot 12h.',
    description: 'Durable, leak-proof, and BPA-free vacuum flask designed for gym, travel, and daily use. Made with high-grade 18/8 stainless steel and sweat-proof powder coating.',
    brand: 'HydroLife',
    sku: 'BTL-VAC-1L-020',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/bottle1.jpg',
        fileId: '6ac871efead997d09a0ae8f7',
        sortOrder: 0
      }
    ],
    price: 749,
    compareAtPrice: 1299,
    costPrice: 450,
    gstRate: 18,
    stock: 60,
    lowStockThreshold: 10,
    weight: 0.5,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:30:00.000Z'),
    updatedAt: new Date('2026-10-09T07:30:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Dual-Band AC1200 WiFi Router',
    slug: 'dual-band-ac1200-wifi-router',
    shortDescription: 'High-speed wireless internet router with 4 external antennas.',
    description: 'Provide seamless connectivity across your home with concurrent 2.4GHz (300Mbps) and 5GHz (867Mbps) dual-band Wi-Fi, WPS quick setup, and parental controls.',
    brand: 'NetSpeed',
    sku: 'RTR-AC1200-WIFI-021',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/router1.jpg',
        fileId: '6ac871efead997d09a0ae8f8',
        sortOrder: 0
      }
    ],
    price: 1899,
    compareAtPrice: 2999,
    costPrice: 1300,
    gstRate: 18,
    stock: 14,
    lowStockThreshold: 3,
    weight: 0.45,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:35:00.000Z'),
    updatedAt: new Date('2026-10-09T07:35:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Heavy Duty Extended Gaming Mouse Pad',
    slug: 'heavy-duty-extended-gaming-mouse-pad',
    shortDescription: 'Large desk mat (900x400mm) with stitched edges and non-slip rubber base.',
    description: 'Spacious desk pad accommodating keyboard and mouse seamlessly. Smooth micro-woven cloth surface optimized for precise mouse tracking and liquid resistance.',
    brand: 'HyperGear',
    sku: 'PAD-DESK-XL-022',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/mousepad1.jpg',
        fileId: '6ac871efead997d09a0ae8f9',
        sortOrder: 0
      }
    ],
    price: 699,
    compareAtPrice: 1199,
    costPrice: 400,
    gstRate: 18,
    stock: 40,
    lowStockThreshold: 8,
    weight: 0.6,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:40:00.000Z'),
    updatedAt: new Date('2026-10-09T07:40:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Condenser USB Studio Microphone',
    slug: 'condenser-usb-studio-microphone',
    shortDescription: 'Cardioid pickup pattern microphone for voiceover and podcasting.',
    description: 'Plug-and-play condenser mic featuring zero-latency monitoring headphone jack, gain control dial, pop filter, and sturdy adjustable tripod stand.',
    brand: 'AudioCraft',
    sku: 'MIC-USB-CND-023',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/mic1.jpg',
        fileId: '6ac871efead997d09a0ae8fa',
        sortOrder: 0
      }
    ],
    price: 2799,
    compareAtPrice: 4499,
    costPrice: 1950,
    gstRate: 18,
    stock: 11,
    lowStockThreshold: 3,
    weight: 0.8,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:45:00.000Z'),
    updatedAt: new Date('2026-10-09T07:45:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Smart Air Purifier for Home',
    slug: 'smart-air-purifier-for-home',
    shortDescription: 'H13 True HEPA filter capturing 99.97% airborne particles.',
    description: 'Purify room air efficiently with 3-stage filtration system including pre-filter, True HEPA filter, and activated carbon filter. Features real-time air quality sensor and silent sleep mode.',
    brand: 'PureAir',
    sku: 'PUR-AIR-HEPA-024',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/airpurifier1.jpg',
        fileId: '6ac871efead997d09a0ae8fb',
        sortOrder: 0
      }
    ],
    price: 7999,
    compareAtPrice: 11999,
    costPrice: 5800,
    gstRate: 18,
    stock: 6,
    lowStockThreshold: 2,
    weight: 3.5,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:50:00.000Z'),
    updatedAt: new Date('2026-10-09T07:50:00.000Z')
  },
  {
    originalSellerId: '6ac7491a257703863bd07633',
    originalCategoryId: '6ac7b41b5080fa3e6cf39198',
    subCategory: null,
    name: 'Foldable Ring Light 10-inch with Stand',
    slug: 'foldable-ring-light-10-inch-with-stand',
    shortDescription: 'Dimmable LED ring light with phone holder for content creators.',
    description: '3 light color modes (warm, cool white, daylight) and 10 brightness levels. Includes extensible tripod stand extending up to 5 feet and bluetooth remote shutter.',
    brand: 'VisionPro',
    sku: 'LGT-RNG-10IN-025',
    images: [
      {
        url: 'https://ik.imagekit.io/u8hd5asjt/bigmart/products/ringlight1.jpg',
        fileId: '6ac871efead997d09a0ae8fc',
        sortOrder: 0
      }
    ],
    price: 1199,
    compareAtPrice: 1999,
    costPrice: 780,
    gstRate: 18,
    stock: 28,
    lowStockThreshold: 5,
    weight: 0.95,
    status: 'active',
    isPublished: true,
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    createdAt: new Date('2026-10-09T07:55:00.000Z'),
    updatedAt: new Date('2026-10-09T07:55:00.000Z')
  }
];

const runImport = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to Database.');

    // Find a valid seller
    let validSeller = await Seller.findOne({ verificationStatus: 'approved' });
    if (!validSeller) {
      console.log('No valid seller found. Import skipped.');
      process.exit(1);
    }
    console.log(`Using seller ID: ${validSeller._id}`);

    // Find a valid category
    let validCategory = await Category.findOne({ isActive: true });
    if (!validCategory) {
      console.log('No valid category found. Import skipped.');
      process.exit(1);
    }
    console.log(`Using category ID: ${validCategory._id}`);

    let importedCount = 0;
    let skippedCount = 0;

    for (const prodData of providedProducts) {
      // Map missing/invalid seller and category
      const productToSave = { ...prodData };
      delete productToSave.originalSellerId;
      delete productToSave.originalCategoryId;
      
      productToSave.seller = validSeller._id;
      productToSave.category = validCategory._id;

      // Idempotency check
      const existingProduct = await Product.findOne({
        $or: [
          { sku: productToSave.sku },
          { slug: productToSave.slug }
        ]
      });

      if (existingProduct) {
        console.log(`Skipped: Product with SKU ${productToSave.sku} or slug ${productToSave.slug} already exists.`);
        skippedCount++;
        continue;
      }

      await Product.create(productToSave);
      console.log(`Imported: ${productToSave.name} (SKU: ${productToSave.sku})`);
      importedCount++;
    }

    console.log(`\nImport Summary:`);
    console.log(`Successfully imported: ${importedCount}`);
    console.log(`Skipped (already exists): ${skippedCount}`);

    process.exit(0);

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
};

runImport();
