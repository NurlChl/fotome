import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * ClaimedPhoto - Auto-saved collection of photos claimed by users
 * These photos are confirmed to contain the user and are used for:
 * 1. Quick access - user doesn't need to claim multiple times
 * 2. Continuous learning - improve face matching accuracy
 */
export interface IClaimedPhoto extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  photoId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  faceDescriptor: number[]; // The specific face in the photo that belongs to the user
  claimedAt: Date;
}

const claimedPhotoSchema = new Schema<IClaimedPhoto>(
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
    faceDescriptor: {
      type: [Number],
      required: true,
      validate: {
        validator: function (v: number[]) {
          return v.length === 128;
        },
        message: 'Face descriptor must be a 128-dimensional vector',
      },
    },
  },
  {
    timestamps: { createdAt: 'claimedAt', updatedAt: false },
  }
);

// Compound index to prevent duplicate claims
claimedPhotoSchema.index({ userId: 1, photoId: 1 }, { unique: true });

claimedPhotoSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const ClaimedPhoto: Model<IClaimedPhoto> =
  mongoose.models.ClaimedPhoto ||
  mongoose.model<IClaimedPhoto>('ClaimedPhoto', claimedPhotoSchema);

export default ClaimedPhoto;
