import { FalsePositiveFlag, Photo, FaceDescriptor, ClaimedPhoto, User } from '@/lib/db/models';
import mongoose from 'mongoose';

/**
 * Calculates the Euclidean distance between two face descriptor vectors.
 * @param a First 128-dimensional face descriptor
 * @param b Second 128-dimensional face descriptor
 * @returns Euclidean distance (lower = more similar)
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

/**
 * Averages multiple face descriptor vectors to create a more robust representation.
 * Used in continuous learning to combine multiple verified photos of the user.
 * @param descriptors Array of face descriptor vectors
 * @returns Averaged 128-dimensional vector
 */
export function averageDescriptors(descriptors: number[][]): number[] {
  if (descriptors.length === 0) {
    throw new Error('Cannot average empty descriptor array');
  }
  
  const dimension = descriptors[0].length;
  const averaged = new Array(dimension).fill(0);
  
  for (const descriptor of descriptors) {
    for (let i = 0; i < dimension; i++) {
      averaged[i] += descriptor[i];
    }
  }
  
  for (let i = 0; i < dimension; i++) {
    averaged[i] /= descriptors.length;
  }
  
  return averaged;
}

/**
 * Retrieves all face descriptors that the user has flagged as false positives.
 * These represent "hard negatives" - faces that the AI incorrectly matched to the user.
 * @param userId User ID to get hard negatives for
 * @returns Array of face descriptor vectors (128-dimensional arrays)
 */
export async function getUserHardNegatives(userId: string): Promise<number[][]> {
  const falsePositiveFlags = await FalsePositiveFlag.find({
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();

  const hardNegatives: number[][] = [];
  
  for (const flag of falsePositiveFlags) {
    // Get all face descriptors for this flagged photo
    const faceDescriptors = await FaceDescriptor.find({
      photoId: flag.photoId,
    }).lean();

    // Each photo can have multiple faces detected
    for (const descriptor of faceDescriptors) {
      // The descriptor is already a number array in MongoDB
      hardNegatives.push(descriptor.descriptor);
    }
  }

  return hardNegatives;
}

/**
 * Determines if a candidate face descriptor matches any of the user's hard negatives.
 * A match occurs if:
 * 1. The candidate is extremely similar to a hard negative (distance < 0.40), OR
 * 2. The candidate is closer to a hard negative than to the user's actual face
 * 
 * @param candidateDescriptor The face descriptor being evaluated
 * @param hardNegatives Array of face descriptors flagged as false positives
 * @param distToUser Distance from candidate to the user's registered Face ID
 * @returns true if this face should be suppressed (matches a hard negative)
 */
export function isHardNegativeMatch(
  candidateDescriptor: number[],
  hardNegatives: number[][],
  distToUser: number
): boolean {
  const HARD_NEGATIVE_THRESHOLD = 0.40; // Very similar to a flagged false positive
  
  for (const hardNegative of hardNegatives) {
    const distToHardNegative = euclideanDistance(candidateDescriptor, hardNegative);
    
    // Suppress if extremely similar to a hard negative
    if (distToHardNegative < HARD_NEGATIVE_THRESHOLD) {
      return true;
    }
    
    // Suppress if closer to hard negative than to user's actual face
    if (distToHardNegative < distToUser) {
      return true;
    }
  }
  
  return false;
}

/**
 * Saves a claimed photo to the user's collection and updates the user's face descriptor
 * using continuous learning (averaging with claimed face descriptors).
 * 
 * @param userId User ID
 * @param photoId Photo ID that was claimed
 * @param eventId Event ID
 * @param matchedFaceDescriptor The specific face descriptor that matched the user
 * @returns true if successfully saved and learning applied
 */
export async function saveClaimedPhotoAndLearn(
  userId: string,
  photoId: string,
  eventId: string,
  matchedFaceDescriptor: number[]
): Promise<boolean> {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const photoObjectId = new mongoose.Types.ObjectId(photoId);
    const eventObjectId = new mongoose.Types.ObjectId(eventId);

    // Save to ClaimedPhoto collection (upsert to handle duplicates gracefully)
    await ClaimedPhoto.findOneAndUpdate(
      { userId: userObjectId, photoId: photoObjectId },
      {
        userId: userObjectId,
        photoId: photoObjectId,
        eventId: eventObjectId,
        faceDescriptor: matchedFaceDescriptor,
      },
      { upsert: true, new: true }
    );

    // Continuous Learning: Update user's face descriptor
    // Get all claimed face descriptors for this user
    const allClaimedPhotos = await ClaimedPhoto.find({
      userId: userObjectId,
    }).lean();

    const claimedDescriptors = allClaimedPhotos.map(cp => cp.faceDescriptor);

    // Get user's current face descriptor
    const user = await User.findById(userObjectId);
    if (!user) return false;

    // If user has a registered face descriptor, include it in the average
    if (user.faceDescriptor && user.faceDescriptor.length === 128) {
      claimedDescriptors.push(user.faceDescriptor);
    }

    // Average all descriptors to create an improved face representation
    if (claimedDescriptors.length > 0) {
      const improvedDescriptor = averageDescriptors(claimedDescriptors);
      
      // Update user's face descriptor
      await User.findByIdAndUpdate(userObjectId, {
        faceDescriptor: improvedDescriptor,
      });

      console.log(`Continuous learning: Updated face descriptor for user ${userId} using ${claimedDescriptors.length} samples`);
    }

    return true;
  } catch (error) {
    console.error('Error saving claimed photo and learning:', error);
    return false;
  }
}

/**
 * Checks if a user has already claimed a specific photo.
 * If claimed, returns the claimed record. Otherwise returns null.
 * 
 * @param userId User ID
 * @param photoId Photo ID
 * @returns ClaimedPhoto record if exists, null otherwise
 */
export async function isPhotoClaimed(
  userId: string,
  photoId: string
): Promise<{ claimed: boolean; claimedPhoto?: any }> {
  const claimedPhoto = await ClaimedPhoto.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    photoId: new mongoose.Types.ObjectId(photoId),
  }).lean();

  return {
    claimed: !!claimedPhoto,
    claimedPhoto: claimedPhoto || undefined,
  };
}
