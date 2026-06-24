import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFaceSearch extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  resultsCount: number;
  ipAddress: string;
  createdAt: Date;
}

const faceSearchSchema = new Schema<IFaceSearch>(
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
    resultsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    ipAddress: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index: auto-delete logs after 30 days
faceSearchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

faceSearchSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const FaceSearch: Model<IFaceSearch> =
  mongoose.models.FaceSearch ||
  mongoose.model<IFaceSearch>('FaceSearch', faceSearchSchema);

export default FaceSearch;
