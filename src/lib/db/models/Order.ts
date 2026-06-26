import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================
// Order
// ============================================
export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderNumber: string;
  totalAmount: number;
  discountAmount: number;
  voucherId?: mongoose.Types.ObjectId;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentMethod?: string;
  midtransTransactionId?: string;
  midtransSnapToken?: string;
  midtransRedirectUrl?: string;
  midtransTransactionStatus?: string;
  midtransFraudStatus?: string;
  midtransPaymentType?: string;
  midtransTransactionTime?: string;
  paymentDetails?: Record<string, unknown>;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    voucherId: {
      type: Schema.Types.ObjectId,
      ref: 'Voucher',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: String,
    midtransTransactionId: String,
    midtransSnapToken: String,
    midtransRedirectUrl: String,
    midtransTransactionStatus: String,
    midtransFraudStatus: String,
    midtransPaymentType: String,
    midtransTransactionTime: String,
    paymentDetails: {
      type: Schema.Types.Mixed,
      default: {},
    },
    paidAt: Date,
  },
  {
    timestamps: true,
  }
);

// Generate order number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(orderSchema as any).pre('validate', function (this: any) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `FM-${timestamp}-${random}`;
  }
});

orderSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);

// ============================================
// OrderItem
// ============================================
export interface IOrderItem extends Document {
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  photoId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  photographerId: mongoose.Types.ObjectId;
  price: number;
  platformFee: number;
  photographerRevenue: number;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    photoId: {
      type: Schema.Types.ObjectId,
      ref: 'Photo',
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    photographerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      required: true,
      min: 0,
    },
    photographerRevenue: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: false,
  }
);

orderItemSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

const OrderItem: Model<IOrderItem> =
  mongoose.models.OrderItem || mongoose.model<IOrderItem>('OrderItem', orderItemSchema);

export { Order, OrderItem };
export default Order;
