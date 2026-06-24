import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  photographerId: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  category: 'marathon' | 'concert' | 'graduation' | 'wedding' | 'corporate' | 'community' | 'other';
  location: {
    name: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  eventDate: Date;
  coverImage?: string;
  status: 'draft' | 'published' | 'archived';
  photoCount: number;
  pricePerPhoto: number;
  pricePackage?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    photographerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      enum: ['marathon', 'concert', 'graduation', 'wedding', 'corporate', 'community', 'other'],
      required: true,
      index: true,
    },
    location: {
      name: { type: String, required: true },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    eventDate: {
      type: Date,
      required: true,
    },
    coverImage: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    photoCount: {
      type: Number,
      default: 0,
    },
    pricePerPhoto: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    pricePackage: {
      type: Number,
      default: null,
      min: [0, 'Package price cannot be negative'],
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for browsing events
eventSchema.index({ status: 1, eventDate: -1 });

// Generate slug from title before validation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(eventSchema as any).pre('validate', function (this: any) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    // Append timestamp for uniqueness
    this.slug += '-' + Date.now().toString(36);
  }
});

eventSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>('Event', eventSchema);

export default Event;
