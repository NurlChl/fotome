let modelsLoaded = false;
let modelsLoadFailed = false;
let loadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 2;
let faceapi: typeof import('@vladmandic/face-api') | null = null;

export interface FaceData {
  boundingBox: { x: number; y: number; width: number; height: number };
  descriptor: number[];
}

export async function loadModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  
  // Don't retry forever if models are broken
  if (modelsLoadFailed && loadAttempts >= MAX_LOAD_ATTEMPTS) {
    console.warn('Face detection models failed to load previously. Skipping.');
    return false;
  }

  if (!faceapi) {
    faceapi = await import('@vladmandic/face-api');
  }

  loadAttempts++;

  try {
    // Load models from /public/models
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    modelsLoaded = true;
    modelsLoadFailed = false;
    console.log('Face-api models loaded successfully from local public folder.');
    return true;
  } catch (error) {
    modelsLoadFailed = true;
    console.error('Error loading face-api models:', error);
    // Don't throw - return false so callers can handle gracefully
    return false;
  }
}

export async function getFaceDescriptor(
  input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<number[] | null> {
  try {
    const loaded = await loadModels();
    if (!loaded) return null;
    
    if (!faceapi) {
      faceapi = await import('@vladmandic/face-api');
    }

    const detection = await faceapi
      .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
      
    if (!detection) {
      console.warn('No face detected in the provided image input.');
      return null;
    }
    
    return Array.from(detection.descriptor);
  } catch (error) {
    console.error('Error extracting face descriptor:', error);
    return null;
  }
}

export async function detectAllFacesInImage(
  img: HTMLImageElement
): Promise<FaceData[]> {
  try {
    const loaded = await loadModels();
    if (!loaded) return [];
    
    if (!faceapi) {
      faceapi = await import('@vladmandic/face-api');
    }

    const detections = await faceapi
      .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    return detections.map((d) => ({
      boundingBox: {
        x: d.detection.box.x,
        y: d.detection.box.y,
        width: d.detection.box.width,
        height: d.detection.box.height,
      },
      descriptor: Array.from(d.descriptor),
    }));
  } catch (error) {
    console.error('Error detecting all faces:', error);
    return [];
  }
}
