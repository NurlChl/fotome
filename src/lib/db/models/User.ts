import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash?: string;
  name: string;
  avatar?: string;
  role: 'user' | 'photographer' | 'admin' | 'superadmin';
  googleOAuth?: {
    googleId: string;
    accessToken?: string;
  };
  adminPermissions?: {
    manageUsers: boolean;
    manageEvents: boolean;
    managePayouts: boolean;
    manageLogs: boolean;
    manageTransactions: boolean;
    manageClaims: boolean;
  };
  isVerified: boolean;
  isBanned: boolean;
  photographerProfile?: {
    bio?: string;
    portfolio?: string;
    bankName?: string;
    bankAccount?: string;
    totalRevenue: number;
    availableBalance: number;
  };
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  faceDescriptor?: number[];
  faceImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      select: false, // Don't return password by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    avatar: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'photographer', 'admin', 'superadmin'],
      default: 'user',
      index: true,
    },
    googleOAuth: {
      googleId: { type: String, index: true, sparse: true },
      accessToken: { type: String },
    },
    adminPermissions: {
      manageUsers: { type: Boolean, default: false },
      manageEvents: { type: Boolean, default: false },
      managePayouts: { type: Boolean, default: false },
      manageLogs: { type: Boolean, default: false },
      manageTransactions: { type: Boolean, default: false },
      manageClaims: { type: Boolean, default: false },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    verificationToken: { type: String },
    verificationTokenExpiry: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpiry: { type: Date },
    photographerProfile: {
      bio: { type: String, maxlength: 500 },
      portfolio: { type: String },
      bankName: { type: String },
      bankAccount: { type: String },
      totalRevenue: { type: Number, default: 0 },
      availableBalance: { type: Number, default: 0 },
    },
    faceDescriptor: {
      type: [Number],
      default: undefined,
      validate: {
        validator: function (v: number[]) {
          return !v || v.length === 128;
        },
        message: 'Face descriptor must be a 128-dimensional vector',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Remove sensitive data when converting to JSON
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;
