import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVoucherUsage extends Document {
  _id: mongoose.Types.ObjectId;
  voucherId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const voucherUsageSchema = new Schema<IVoucherUsage>(
  {
    voucherId: {
      type: Schema.Types.ObjectId,
      ref: 'Voucher',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const VoucherUsage: Model<IVoucherUsage> =
  mongoose.models.VoucherUsage || mongoose.model<IVoucherUsage>('VoucherUsage', voucherUsageSchema);

export default VoucherUsage;
