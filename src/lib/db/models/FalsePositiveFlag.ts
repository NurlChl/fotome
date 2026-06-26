import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFalsePositiveFlag extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  photoId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  ipAddress?: string;
  createdAt: Date;
}

const falsePositiveFlagSchema = new Schema<IFalsePositiveFlag>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    photoId: {
      type: Schema.Types.ObjectId,
      ref: 'Photo',
      required: true,
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index to prevent duplicate flags
falsePositiveFlagSchema.index({ userId: 1, photoId: 1 }, { unique: true });

falsePositiveFlagSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const FalsePositiveFlag: Model<IFalsePositiveFlag> =
  mongoose.models.FalsePositiveFlag ||
  mongoose.model<IFalsePositiveFlag>('FalsePositiveFlag', falsePositiveFlagSchema);

export default FalsePositiveFlag;
