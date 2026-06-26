import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * SavedPhoto - User's saved/favorited photo collection
 * User can save photos they like for quick access later
 * Combined with ClaimedPhoto in "Tersimpan" (Saved) filter
 */
export interface ISavedPhoto extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  photoId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  savedAt: Date;
}

const savedPhotoSchema = new Schema<ISavedPhoto>(
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
  },
  {
    timestamps: { createdAt: 'savedAt', updatedAt: false },
  }
);

// Compound index to prevent duplicate saves
savedPhotoSchema.index({ userId: 1, photoId: 1 }, { unique: true });

savedPhotoSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const SavedPhoto: Model<ISavedPhoto> =
  mongoose.models.SavedPhoto ||
  mongoose.model<ISavedPhoto>('SavedPhoto', savedPhotoSchema);

export default SavedPhoto;
