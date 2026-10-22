/** Anything the trigger + hand detector can read pixels from. */
export type FrameElement = HTMLVideoElement | HTMLCanvasElement;

export interface CameraSource {
  /** Element showing the live (low-res) preview. */
  element: FrameElement | null;
  ready: boolean;
  error: string | null;
  /** Grab a high-res still for grading. */
  captureHighRes: () => Promise<Blob>;
}

export function frameSize(el: FrameElement): [number, number] {
  return el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : [el.width, el.height];
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("capture failed"))), "image/jpeg", quality),
  );
}

export function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}
