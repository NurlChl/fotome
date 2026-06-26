import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPhotoClaim extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  photoId: mongoose.Types.ObjectId;
  selfieUrl: string;
  selfieDescriptor?: number[];
  ipAddress: string;
  isMatched: boolean;
  createdAt: Date;
}

const photoClaimSchema = new Schema<IPhotoClaim>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    photoId: {
      type: Schema.Types.ObjectId,
      ref: 'Photo',
      required: true,
      index: true,
    },
    selfieUrl: {
      type: String,
      required: true,
    },
    selfieDescriptor: {
      type: [Number],
      default: undefined,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    isMatched: {
      type: Boolean,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

photoClaimSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const PhotoClaim: Model<IPhotoClaim> =
  mongoose.models.PhotoClaim ||
  mongoose.model<IPhotoClaim>('PhotoClaim', photoClaimSchema);

export default PhotoClaim;
