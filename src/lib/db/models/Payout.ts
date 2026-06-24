import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPayout extends Document {
  _id: mongoose.Types.ObjectId;
  photographerId: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bankName: string;
  bankAccount: string;
  notes?: string;
  requestedAt: Date;
  processedAt?: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    photographerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [50000, 'Minimum payout is Rp 50.000'],
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    bankName: {
      type: String,
      required: true,
    },
    bankAccount: {
      type: String,
      required: true,
    },
    notes: String,
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: Date,
  },
  {
    timestamps: false,
  }
);

payoutSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const Payout: Model<IPayout> =
  mongoose.models.Payout || mongoose.model<IPayout>('Payout', payoutSchema);

export default Payout;
