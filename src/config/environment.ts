import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || '',
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || '',
  JWT_SECRET: process.env.JWT_SECRET || 'nearwork_jwt_secret_key_dev_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'nearwork_jwt_refresh_secret_key_dev_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_NearWorkMockKey123',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_NearWorkSecret456',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'nearwork_webhook_secret_789',
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || 'mock_google_maps_key',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  WORKER_APP_URL: process.env.WORKER_APP_URL || 'http://localhost:3001',
  ADMIN_URL: process.env.ADMIN_URL || 'http://localhost:3002',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || '',
  GOOGLE_DRIVE_FOLDER_NAME: process.env.GOOGLE_DRIVE_FOLDER_NAME || 'GoogleDatabase_5TB_Storage',
};
