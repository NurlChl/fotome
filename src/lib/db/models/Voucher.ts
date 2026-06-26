import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVoucher extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  usageLimitPerUser?: number;
  allowedUserIds?: mongoose.Types.ObjectId[];
  minPhotos: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

const voucherSchema = new Schema<IVoucher>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Voucher name is required'],
      trim: true,
      maxlength: [100, 'Voucher name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    usageLimitPerUser: {
      type: Number,
      default: null,
      min: [1, 'Usage limit must be at least 1'],
    },
    allowedUserIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    minPhotos: {
      type: Number,
      required: [true, 'Minimum photos is required'],
      default: 1,
      min: [1, 'Minimum photos must be at least 1'],
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: [0, 'Discount value must be at least 0'],
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Voucher: Model<IVoucher> =
  mongoose.models.Voucher || mongoose.model<IVoucher>('Voucher', voucherSchema);

export default Voucher;
