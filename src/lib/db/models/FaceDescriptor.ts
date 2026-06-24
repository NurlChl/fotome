import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFaceDescriptor extends Document {
  _id: mongoose.Types.ObjectId;
  photoId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  descriptor: number[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  faceIndex: number;
  createdAt: Date;
}

const faceDescriptorSchema = new Schema<IFaceDescriptor>(
  {
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
    descriptor: {
      type: [Number],
      required: true,
      validate: {
        validator: function (v: number[]) {
          return v.length === 128;
        },
        message: 'Face descriptor must be a 128-dimensional vector',
      },
    },
    boundingBox: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    faceIndex: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Note: MongoDB Atlas Vector Search index must be created via Atlas UI or API:
// {
//   "name": "face_vector_index",
//   "type": "vectorSearch",
//   "definition": {
//     "fields": [
//       { "type": "vector", "path": "descriptor", "numDimensions": 128, "similarity": "cosine" },
//       { "type": "filter", "path": "eventId" }
//     ]
//   }
// }

faceDescriptorSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const FaceDescriptor: Model<IFaceDescriptor> =
  mongoose.models.FaceDescriptor ||
  mongoose.model<IFaceDescriptor>('FaceDescriptor', faceDescriptorSchema);

export default FaceDescriptor;
