import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Order, OrderItem, Photo, Event, User, FaceDescriptor, Voucher, VoucherUsage } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { createOrderSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { getUserHardNegatives, isHardNegativeMatch, euclideanDistance, saveClaimedPhotoAndLearn } from '@/lib/biometrics';
import { createSnapToken } from '@/lib/midtrans';

/**
 * GET /api/orders - List user's orders
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const orders = await Order.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    const orderIds = orders.map((o) => o._id);
    const allItems = await OrderItem.find({ orderId: { $in: orderIds } })
      .populate('photoId', 'thumbnailUrl watermarkedUrl cloudinaryUrl')
      .populate('eventId', 'title slug')
      .lean();

    const itemsByOrderId = allItems.reduce((acc, item) => {
      const orderIdStr = item.orderId.toString();
      if (!acc[orderIdStr]) acc[orderIdStr] = [];
      acc[orderIdStr].push(item);
      return acc;
    }, {} as Record<string, typeof allItems>);

    const ordersWithItems = orders.map((order) => ({
      ...order,
      items: itemsByOrderId[order._id.toString()] || [],
    }));

    return NextResponse.json({ orders: ordersWithItems });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders - Create new order
 */
export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, 'general');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = createOrderSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { photoIds, eventId, voucherId } = result.data;

    await connectDB();

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Handle voucher
    let discountAmount = 0;
    let voucher = null;
    
    if (voucherId) {
      voucher = await Voucher.findOne({ _id: voucherId, eventId: event._id });
      
      if (!voucher) {
        return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
      }
      
      if (voucher.status !== 'published') {
        return NextResponse.json({ error: 'Voucher is not active' }, { status: 400 });
      }
      
      if (event.pricePerPhoto <= 0) {
        return NextResponse.json({ error: 'Voucher cannot be used on free event' }, { status: 400 });
      }
      
      // Check min photos
      if (photoIds.length < voucher.minPhotos) {
        return NextResponse.json({ 
          error: `Minimum ${voucher.minPhotos} photos required to use this voucher` 
        }, { status: 400 });
      }
      
      // Check allowed users
      if (voucher.allowedUserIds && voucher.allowedUserIds.length > 0) {
        const isAllowed = voucher.allowedUserIds.some((id: any) => id.toString() === session.user.id);
        if (!isAllowed) {
          return NextResponse.json({ error: 'Voucher not applicable for your account' }, { status: 400 });
        }
      }
      
      // Check usage limit
      if (voucher.usageLimitPerUser) {
        const usageCount = await VoucherUsage.countDocuments({ 
          voucherId: voucher._id, 
          userId: session.user.id 
        });
        if (usageCount >= voucher.usageLimitPerUser) {
          return NextResponse.json({ error: 'Voucher usage limit exceeded' }, { status: 400 });
        }
      }
      
      // Calculate discount
      const totalBeforeDiscount = photoIds.length * event.pricePerPhoto;
      if (voucher.discountType === 'percentage') {
        discountAmount = Math.max(0, Math.round(totalBeforeDiscount * (voucher.discountValue / 100)));
      } else {
        discountAmount = Math.max(0, Math.min(voucher.discountValue, totalBeforeDiscount));
      }
    }

    // Get photos and verify they belong to the event
    const photos = await Photo.find({
      _id: { $in: photoIds },
      eventId,
      status: 'active',
    });

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'No valid photos found' },
        { status: 400 }
      );
    }

    // Check for photos already in a paid or pending order
    const existingItems = await OrderItem.find({
      photoId: { $in: photoIds },
      orderId: {
        $in: await Order.find({
          userId: session.user.id,
          status: { $in: ['paid', 'pending'] },
        }).distinct('_id'),
      },
    }).populate('orderId', 'orderNumber status');

    const paidPhotoIds = new Set<string>();
    const pendingPhotoIds = new Set<string>();
    const pendingOrderMap = new Map<string, { orderNumber: string; orderId: string }>();

    for (const item of existingItems) {
      const photoIdStr = item.photoId.toString();
      const order = item.orderId as unknown as { _id: string; orderNumber: string; status: string } | null;
      if (!order) continue;
      if (order.status === 'paid') {
        paidPhotoIds.add(photoIdStr);
      } else if (order.status === 'pending') {
        pendingPhotoIds.add(photoIdStr);
        if (!pendingOrderMap.has(photoIdStr)) {
          pendingOrderMap.set(photoIdStr, { orderNumber: order.orderNumber, orderId: order._id.toString() });
        }
      }
    }

    const blockedPhotoIds = new Set([...paidPhotoIds, ...pendingPhotoIds]);
    const newPhotos = photos.filter(
      (p) => !blockedPhotoIds.has(p._id.toString())
    );

    if (newPhotos.length === 0) {
      if (pendingPhotoIds.size > 0) {
        const firstPending = pendingOrderMap.values().next().value;
        return NextResponse.json(
          {
            error: 'Some selected photos are waiting for payment. Please complete the existing order first.',
            pendingOrderId: firstPending?.orderId,
            pendingOrderNumber: firstPending?.orderNumber,
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'You have already purchased all selected photos' },
        { status: 400 }
      );
    }

    // If some photos are blocked, still reject so the user must resolve them first
    if (blockedPhotoIds.size > 0) {
      const firstPending = pendingOrderMap.values().next().value;
      return NextResponse.json(
        {
          error: `${blockedPhotoIds.size} photo(s) are already purchased or waiting for payment. Please remove them from your selection.`,
          paidCount: paidPhotoIds.size,
          pendingCount: pendingPhotoIds.size,
          pendingOrderId: firstPending?.orderId,
          pendingOrderNumber: firstPending?.orderNumber,
        },
        { status: 400 }
      );
    }

    // Biometric Owner Verification for new items being purchased (except for Admin, Superadmin, or Photographer Owner)
    const isPhotographerOwner = session.user.id === event.photographerId.toString();
    const isBypassUser = session.user.role === 'admin' || session.user.role === 'superadmin' || isPhotographerOwner;

    if (!isBypassUser) {
      const fullUser = await User.findById(session.user.id);
      if (!fullUser || !fullUser.faceDescriptor || fullUser.faceDescriptor.length !== 128) {
        return NextResponse.json(
          { error: 'Biometric registration required. Please complete face recognition in your profile settings to buy photos.' },
          { status: 400 }
        );
      }

      // Load user's hard negatives for continuous learning
      const hardNegatives = await getUserHardNegatives(session.user.id);

      for (const photo of newPhotos) {
        const photoFaces = await FaceDescriptor.find({ photoId: photo._id });
        if (photoFaces.length > 0) {
          let hasMatch = false;
          let bestMatchDescriptor: number[] | null = null;
          let lowestDistance = Infinity;
          
          for (const face of photoFaces) {
            const dist = euclideanDistance(fullUser.faceDescriptor, face.descriptor);
            
            if (dist < lowestDistance) {
              lowestDistance = dist;
              bestMatchDescriptor = face.descriptor;
            }
            
            // Check if this face matches a hard negative
            const isHardNegative = isHardNegativeMatch(face.descriptor, hardNegatives, dist);
            
            // Only count as match if distance is within threshold AND not a hard negative
            if (dist <= 0.55 && !isHardNegative) {
              hasMatch = true;
              // Don't break - we want to find the best match for learning
            }
          }
          
          if (!hasMatch) {
            return NextResponse.json(
              { error: 'Biometric verification failed: You are not present in one or more of the selected photos.' },
              { status: 403 }
            );
          }
          
          // Auto-save matched photos for continuous learning
          if (bestMatchDescriptor && hasMatch) {
            await saveClaimedPhotoAndLearn(
              session.user.id,
              photo._id.toString(),
              event._id.toString(),
              bestMatchDescriptor
            );
          }
        } else {
          // If the photo contains no faces, but it has hasFaces set to true, block it
          if (photo.hasFaces) {
            return NextResponse.json(
              { error: 'Biometric verification pending for one or more selected photos.' },
              { status: 403 }
            );
          }
        }
      }
    }

    // Calculate total
    const commissionPercent =
      parseInt(process.env.PLATFORM_COMMISSION_PERCENT || '25') / 100;

    const totalBeforeDiscount = newPhotos.length * event.pricePerPhoto;
    const totalAmount = Math.max(0, totalBeforeDiscount - discountAmount);

    // Create order
    const order = await Order.create({
      userId: session.user.id,
      totalAmount,
      discountAmount,
      voucherId: voucher ? voucher._id : null,
      status: 'pending',
    });

    // Create order items (use adjusted per-item price based on discount)
    const orderItems = newPhotos.map((photo) => {
      const adjustedPrice = totalAmount > 0 
        ? Math.round(event.pricePerPhoto * (totalAmount / totalBeforeDiscount)) 
        : 0;
      return {
        orderId: order._id,
        photoId: photo._id,
        eventId: event._id,
        photographerId: event.photographerId,
        price: adjustedPrice,
        platformFee: Math.round(adjustedPrice * commissionPercent),
        photographerRevenue: Math.round(
          adjustedPrice * (1 - commissionPercent)
        ),
      };
    });

    await OrderItem.insertMany(orderItems);

    // If voucher was used, record the usage
    if (voucher) {
      await VoucherUsage.create({
        voucherId: voucher._id,
        userId: session.user.id,
        orderId: order._id,
      });
    }

    // Generate Midtrans Snap Token for payment (if not free)
    let snapToken = null;
    let redirectUrl = null;

    if (totalAmount > 0) {
      try {
        const snapData = await createSnapToken({
          orderId: order.orderNumber,
          amount: totalAmount,
          customerDetails: {
            firstName: session.user.name || 'Customer',
            email: session.user.email || '',
          },
          itemDetails: newPhotos.map((photo) => ({
            id: photo._id.toString(),
            name: `Photo from ${event.title}`,
            price: event.pricePerPhoto,
            quantity: 1,
          })),
        });

        snapToken = snapData.token;
        redirectUrl = snapData.redirectUrl;

        // Store payment details on the order for later continuation
        order.midtransSnapToken = snapToken;
        order.midtransRedirectUrl = redirectUrl;
        order.paymentMethod = 'midtrans';
        await order.save();
      } catch (midtransError) {
        console.error('Midtrans error:', midtransError);
        // If Midtrans fails, delete the order and return error
        await Order.findByIdAndDelete(order._id);
        await OrderItem.deleteMany({ orderId: order._id });
        
        throw new Error(
          midtransError instanceof Error 
            ? midtransError.message 
            : 'Failed to create payment gateway'
        );
      }
    } else {
      // Free event - auto-complete the order
      await Order.findByIdAndUpdate(order._id, {
        status: 'paid',
        paymentStatus: 'completed',
        paymentMethod: 'free',
        paidAt: new Date(),
      });
    }

    return NextResponse.json(
      {
        message: 'Order created',
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          discountAmount: order.discountAmount,
          itemCount: newPhotos.length,
          status: totalAmount > 0 ? order.status : 'paid',
          snapToken, // For Midtrans Snap
          redirectUrl, // Alternative: redirect to Midtrans page
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
