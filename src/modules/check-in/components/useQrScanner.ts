'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

/**
 * Scans QR codes from the camera, continuously, and hands each one read to
 * onScanned. Shared by the registration desk (back camera) and the self
 * check in kiosk (front camera, facing the person).
 *
 * Uses the browser's own BarcodeDetector where it exists, which is most
 * Android phones and Chrome. Only when it does not is a decoder downloaded.
 */
export function useQrScanner(
  handleScanned: (raw: string) => void,
  facingMode: 'environment' | 'user',
) {
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    releaseStream();
    setCameraOn(false);
  }, [releaseStream]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    // A second press must not leave the first camera running.
    releaseStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.muted = true;
        video.srcObject = stream;
      }
      // Show the picture first. The video is hidden until this is true, and a
      // hidden video may never finish play(), so waiting for play() here
      // would leave the camera running behind a page that never moves on.
      setCameraOn(true);
      void video?.play().catch(() => undefined);

      // If the camera is open but sends no picture (another app has it, or a
      // privacy shutter), say so and offer the button again.
      window.setTimeout(() => {
        if (streamRef.current !== stream) return;
        if (!video || video.readyState < 2) {
          stopCamera();
          setCameraError(
            'The camera is on but sending no picture. Close anything else using it (a video call, another tab), then press Start the camera again.',
          );
        }
      }, 8000);
    } catch {
      setCameraError('The camera could not start. Check the browser has permission to use it.');
      setCameraOn(false);
    }
  }, [facingMode, releaseStream, stopCamera]);

  // Always let go of the camera when leaving the page.
  useEffect(() => () => stopCamera(), [stopCamera]);

  // The scanning loop.
  useEffect(() => {
    if (!cameraOn) return;

    let stopped = false;
    let frame = 0;
    let detector: BarcodeDetectorLike | null = null;
    let decodeFallback: typeof import('jsqr').default | null = null;

    const setup = async () => {
      const maybe = (
        window as unknown as {
          BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
        }
      ).BarcodeDetector;

      if (maybe) {
        try {
          detector = new maybe({ formats: ['qr_code'] });
          return;
        } catch {
          detector = null;
        }
      }
      // Only downloaded when the browser cannot do it itself.
      decodeFallback = (await import('jsqr')).default;
    };

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          try {
            if (detector) {
              const found = await detector.detect(video);
              const value = found[0]?.rawValue;
              if (value) handleScanned(value);
            } else if (decodeFallback) {
              canvas.width = width;
              canvas.height = height;
              const context = canvas.getContext('2d', { willReadFrequently: true });
              if (context) {
                context.drawImage(video, 0, 0, width, height);
                const image = context.getImageData(0, 0, width, height);
                const found = decodeFallback(image.data, width, height);
                if (found?.data) handleScanned(found.data);
              }
            }
          } catch {
            // A single bad frame is not worth stopping the scanner for.
          }
        }
      }

      if (!stopped) frame = window.setTimeout(tick, 220) as unknown as number;
    };

    void setup().then(() => {
      if (!stopped) void tick();
    });

    return () => {
      stopped = true;
      window.clearTimeout(frame);
    };
  }, [cameraOn, handleScanned]);

  return { videoRef, canvasRef, cameraOn, cameraError, startCamera, stopCamera };
}
