"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, AlertCircle, Zap, ZapOff, Loader2, Focus } from "lucide-react";
import {
  BrowserMultiFormatReader,
  NotFoundException,
  BarcodeFormat,
  DecodeHintType,
} from "@zxing/library";

interface BarcodeScannerProps {
  onScan: (isbn: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Camera capabilities
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);

  // Manual fallback
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");

  const getTrack = (): MediaStreamTrack | null => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    return stream?.getVideoTracks()[0] || null;
  };

  useEffect(() => {
    // Configure reader hints specifically for book barcodes (EAN-13, EAN-8, UPC, Code 128)
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;

    const handleResult = (result: any, err: any) => {
      if (result && scanning) {
        const text = result.getText().replace(/[-\s]/g, "");
        if (/^(\d{10}|\d{13})$/.test(text) || (text.length >= 8 && /^\d+$/.test(text))) {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(100);
          }
          setScanning(false);
          onScan(text);
        }
      }
      if (err && !(err instanceof NotFoundException)) {
        console.warn("Scanner frame warning:", err);
      }
    };

    const startScanning = async () => {
      try {
        const devices = await reader.listVideoInputDevices();

        if (devices.length === 0) {
          setError("No se encontró cámara en este dispositivo");
          return;
        }

        // Prefer rear camera on mobile
        const rearCamera = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("trasera") ||
            d.label.toLowerCase().includes("environment")
        );
        const deviceId = rearCamera?.deviceId ?? devices[0].deviceId;

        if (!videoRef.current) return;

        // Try decodeFromConstraints with Full HD / high resolution & continuous focus
        try {
          await reader.decodeFromConstraints(
            {
              audio: false,
              video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                facingMode: deviceId ? undefined : { ideal: "environment" },
                width: { ideal: 1920, min: 640 },
                height: { ideal: 1080, min: 480 },
                // @ts-ignore
                advanced: [{ focusMode: "continuous" }],
              },
            },
            videoRef.current,
            handleResult
          );
        } catch (constraintErr) {
          console.warn("Constraints failed, falling back to standard device scan", constraintErr);
          await reader.decodeFromVideoDevice(deviceId, videoRef.current, handleResult);
        }

        // Inspect hardware capabilities once stream is active
        setTimeout(() => {
          const track = getTrack();
          if (track) {
            const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;

            if (caps.zoom) {
              setZoomCaps({
                min: caps.zoom.min ?? 1,
                max: caps.zoom.max ?? 4,
                step: caps.zoom.step ?? 0.1,
              });
            } else {
              // Even if not reported, allow 1x and 2x attempts
              setZoomCaps({ min: 1, max: 3, step: 0.5 });
            }

            if (caps.torch) {
              setHasTorch(true);
            }

            // Force continuous autofocus if available
            if (caps.focusMode && caps.focusMode.includes("continuous")) {
              track
                .applyConstraints({
                  advanced: [{ focusMode: "continuous" } as any],
                })
                .catch(() => {});
            }
          }
        }, 500);
      } catch (e) {
        if ((e as Error).name === "NotAllowedError") {
          setError(
            "Permiso de cámara denegado. Habilita el acceso a la cámara en los permisos de tu navegador."
          );
        } else {
          setError("Error al iniciar la cámara. Intenta usar el botón de foto nativa.");
        }
      }
    };

    startScanning();

    return () => {
      reader.reset();
      const track = getTrack();
      if (track) {
        track.stop();
      }
    };
  }, [onScan, scanning]);

  const handleZoom = async (level: number) => {
    const track = getTrack();
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: level } as any],
      });
      setCurrentZoom(level);
    } catch (e) {
      console.warn("Zoom not supported by device hardware", e);
    }
  };

  const handleToggleTorch = async () => {
    const track = getTrack();
    if (!track) return;
    const nextTorch = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn("Torch failed", e);
    }
  };

  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusRing({ x, y });
    setTimeout(() => setFocusRing(null), 1200);

    const track = getTrack();
    if (!track) return;
    try {
      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (caps.focusMode && caps.focusMode.includes("continuous")) {
        await track.applyConstraints({
          advanced: [{ focusMode: "continuous" } as any],
        });
      }
    } catch (err) {
      // Ignored
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setError(null);

    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("No se pudo cargar la foto tomada"));
        img.src = url;
      });

      // Scale to max 1600px to ensure fast & reliable decoding without memory spikes
      const maxDim = 1600;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");
      ctx.drawImage(img, 0, 0, w, h);

      const processedImg = new Image();
      processedImg.src = canvas.toDataURL("image/jpeg", 0.92);
      await new Promise((res) => {
        processedImg.onload = res;
      });

      URL.revokeObjectURL(url);

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      const result = await reader.decodeFromImageElement(processedImg);

      if (result) {
        const clean = result.getText().replace(/[-\s]/g, "");
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(100);
        }
        setScanning(false);
        onScan(clean);
        return;
      }
    } catch (err) {
      console.error("Error decodificando foto:", err);
      setError(
        "No se detectó código de barras en la foto. Intenta encuadrar el código más cerca o con más iluminación."
      );
    } finally {
      setIsProcessingPhoto(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualIsbn.replace(/[-\s]/g, "");
    if (clean.length >= 8) {
      setScanning(false);
      onScan(clean);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 backdrop-blur-sm">
      <div className="bg-white rounded-3xl overflow-hidden w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Escanear ISBN</h3>
              <p className="text-[11px] text-gray-500 leading-none">Código de barras del libro</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div
          className="relative bg-black aspect-square cursor-crosshair overflow-hidden select-none"
          onClick={handleTapToFocus}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Tap-to-focus ring animation */}
          {focusRing && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 w-14 h-14 border-2 border-yellow-400 rounded-lg animate-ping opacity-80"
              style={{ left: focusRing.x, top: focusRing.y }}
            />
          )}

          {/* Viewfinder overlay */}
          {!error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-64 h-36 border-2 border-primary-400/80 rounded-2xl relative flex items-center justify-center shadow-lg bg-black/10">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary-500 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary-500 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary-500 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary-500 rounded-br-xl" />

                {/* Laser scan animation line */}
                <div className="absolute inset-x-2 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse" />
              </div>
              <p className="text-[11px] text-white/80 mt-2 bg-black/60 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                Toca la pantalla para enfocar
              </p>
            </div>
          )}

          {/* Quick On-Screen Camera Controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
            {hasTorch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTorch();
                }}
                className={`p-2 rounded-full backdrop-blur-md transition-colors shadow-md ${
                  torchOn
                    ? "bg-amber-400 text-gray-900 ring-2 ring-amber-300 shadow-amber-400/40"
                    : "bg-black/60 text-white hover:bg-black/80"
                }`}
                title={torchOn ? "Apagar linterna" : "Encender linterna"}
              >
                {torchOn ? <Zap className="h-4 w-4 fill-current" /> : <ZapOff className="h-4 w-4" />}
              </button>
            )}
          </div>

          {/* Zoom Selector Controls (1x, 2x, 3x) */}
          {zoomCaps && (
            <div
              className="absolute bottom-3 inset-x-0 flex justify-center items-center gap-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {[1, 2, 3].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleZoom(lvl)}
                  className={`w-9 h-8 rounded-full text-xs font-bold transition-all shadow-md backdrop-blur-md ${
                    currentZoom === lvl
                      ? "bg-white text-gray-900 ring-2 ring-primary-500 scale-110"
                      : "bg-black/60 text-white/90 hover:bg-black/80"
                  }`}
                >
                  {lvl}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Actions & Guidance */}
        <div className="p-4 space-y-3 bg-white">
          {/* Advice / Tip */}
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            💡 <strong className="text-gray-700">Consejo:</strong> Mantén el teléfono a{" "}
            <strong>15–20 cm</strong> de distancia. Si el código es muy pequeño, presiona{" "}
            <span className="font-semibold text-primary-700 bg-primary-50 px-1 py-0.5 rounded">
              2x
            </span>{" "}
            en lugar de acercar el celular.
          </p>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-2.5 rounded-xl text-xs">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Native Camera Photo Fallback Button */}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingPhoto}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-primary-50 hover:bg-primary-100 text-primary-800 font-medium text-xs rounded-xl border border-primary-200 transition-colors shadow-sm"
            >
              {isProcessingPhoto ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                  <span>Analizando foto tomada...</span>
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 text-primary-600" />
                  <span>¿Sigue sin enfocar? Tomar foto nítida</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoCapture}
            />
          </div>

          {/* Manual ISBN Input Fallback */}
          <div className="pt-2 border-t border-gray-100 text-center">
            {showManualInput ? (
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9X-]*"
                  value={manualIsbn}
                  onChange={(e) => setManualIsbn(e.target.value)}
                  placeholder="Ej: 9788524403118 (solo números)"
                  className="flex-1 px-3 py-1.5 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!manualIsbn.trim()}
                  className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  Usar
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="text-xs text-primary-600 hover:underline font-medium inline-block"
              >
                ¿No se puede leer el código? Escribir ISBN manualmente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
