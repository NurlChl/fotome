import { z } from 'zod';

// ============================================
// Auth Schemas
// ============================================

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  email: z
    .string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  role: z.enum(['user', 'photographer']).default('user'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

// ============================================
// Event Schemas
// ============================================

export const createEventSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .trim(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .trim(),
  category: z.enum([
    'marathon',
    'concert',
    'graduation',
    'wedding',
    'corporate',
    'community',
    'other',
  ]),
  location: z.object({
    name: z.string().min(1, 'Location name is required').trim(),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .optional(),
  }),
  eventDate: z.string().datetime().or(z.string().min(1)),
  pricePerPhoto: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(10000000, 'Price too high'),
  tags: z.array(z.string()).max(10).optional(),
});

export const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

// ============================================
// Face Search Schema
// ============================================

export const faceSearchSchema = z.object({
  descriptor: z
    .array(z.number())
    .length(128, 'Face descriptor must be a 128-dimensional vector'),
  eventId: z.string().min(1, 'Event ID is required'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.6),
});

// ============================================
// Order Schemas
// ============================================

export const createOrderSchema = z.object({
  photoIds: z
    .array(z.string())
    .min(1, 'At least one photo is required')
    .max(50, 'Maximum 50 photos per order'),
  eventId: z.string().min(1, 'Event ID is required'),
  voucherId: z.string().nullable().optional(),
});

// ============================================
// Payout Schema
// ============================================

export const createPayoutSchema = z.object({
  amount: z
    .number()
    .min(50000, 'Minimum payout is Rp 50,000'),
  bankName: z.string().min(1, 'Bank name is required').trim(),
  bankAccount: z.string().min(1, 'Bank account is required').trim(),
});

// ============================================
// Profile Schema
// ============================================

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100)
    .optional(),
  bio: z.string().max(500).optional(),
  portfolio: z.string().url().optional().or(z.literal('')),
  faceDescriptor: z
    .array(z.number())
    .length(128, 'Face descriptor must be a 128-dimensional vector')
    .optional(),
  faceImageUrl: z.string().optional(),
});

export const voucherSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama voucher wajib diisi')
    .max(100, 'Nama voucher maksimal 100 karakter'),
  description: z.string().max(500).optional(),
  usageLimitPerUser: z
    .number()
    .int('Batas penggunaan harus berupa bilangan bulat')
    .min(1, 'Batas penggunaan minimal 1')
    .optional()
    .nullable(),
  allowedUserIds: z.array(z.string()).optional(),
  minPhotos: z
    .number()
    .int('Minimal foto harus berupa bilangan bulat')
    .min(1, 'Minimal foto minimal 1'),
  discountType: z.enum(['percentage', 'fixed'], {
    message: 'Tipe diskon wajib diisi',
  }),
  discountValue: z
    .number()
    .min(1, 'Nilai diskon minimal 1'),
  status: z.enum(['draft', 'published'], {
    message: 'Status voucher wajib diisi',
  }),
}).refine((data) => {
  if (data.discountType === 'percentage' && data.discountValue > 100) {
    return false;
  }
  return true;
}, {
  message: 'Persentase diskon maksimal 100',
  path: ['discountValue'],
});

// ============================================
// Types
// ============================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type FaceSearchInput = z.infer<typeof faceSearchSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreatePayoutInput = z.infer<typeof createPayoutSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
