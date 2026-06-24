import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPhoto extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  photographerId: mongoose.Types.ObjectId;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  watermarkedUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  metadata?: {
    camera?: string;
    lens?: string;
    iso?: number;
    aperture?: string;
    shutterSpeed?: string;
    takenAt?: Date;
  };
  hasFaces: boolean;
  faceCount: number;
  status: 'processing' | 'active' | 'disabled';
  createdAt: Date;
}

const photoSchema = new Schema<IPhoto>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    photographerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    cloudinaryUrl: {
      type: String,
      required: true,
    },
    watermarkedUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    metadata: {
      camera: String,
      lens: String,
      iso: Number,
      aperture: String,
      shutterSpeed: String,
      takenAt: Date,
    },
    hasFaces: {
      type: Boolean,
      default: false,
    },
    faceCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['processing', 'active', 'disabled'],
      default: 'processing',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

photoSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const Photo: Model<IPhoto> =
  mongoose.models.Photo || mongoose.model<IPhoto>('Photo', photoSchema);

export default Photo;
