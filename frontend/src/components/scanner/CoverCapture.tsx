"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Camera,
  Image as ImageIcon,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Crop,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Check,
} from "lucide-react";
import { aiApi, type CoverRecognitionResult } from "@/lib/api/ai";

interface CoverCaptureProps {
  onResult: (result: CoverRecognitionResult, coverImage?: string | null) => void;
  onClose: () => void;
}

/**
 * Utility to crop and compress an image from an Image element using specified source rectangle, rotation, and export to 2:3 ratio.
 */
function renderCroppedCanvas(
  img: HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
  rotation: number = 0,
  targetWidth = 600,
  targetHeight = 900,
  quality = 0.85
): { dataUrl: string; base64: string; mimeType: string } {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Handle rotation
  if (rotation % 360 !== 0) {
    ctx.save();
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    // Draw rotated
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -targetWidth / 2,
      -targetHeight / 2,
      targetWidth,
      targetHeight
    );
    ctx.restore();
  } else {
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      targetWidth,
      targetHeight
    );
  }

  const mimeType = "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const base64 = dataUrl.split(",")[1];
  return { dataUrl, base64, mimeType };
}

/**
 * Standard auto-crop for raw photos: scales down to manageable dimensions (<1200px)
 */
function prepareImageForAnalysis(file: File): Promise<{ dataUrl: string; base64: string; mimeType: string; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context failed"));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = "image/jpeg";
        const dataUrl = canvas.toDataURL(mimeType, 0.85);
        const base64 = dataUrl.split(",")[1];

        const scaledImg = new window.Image();
        scaledImg.onload = () => resolve({ dataUrl, base64, mimeType, img: scaledImg });
        scaledImg.src = dataUrl;
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function CoverCapture({ onResult, onClose }: CoverCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Raw & current processed preview
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<CoverRecognitionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual Crop modal state
  const [isCropping, setIsCropping] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const processFile = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      // 1. Prepare image for analysis
      const prepared = await prepareImageForAnalysis(file);
      setLoadedImg(prepared.img);
      setPreview(prepared.dataUrl);

      // 2. Call Gemini AI to identify metadata & bounding box
      const recognition = await aiApi.recognizeCover(prepared.base64, prepared.mimeType);
      setResult(recognition);

      // 3. If Gemini detected book boundaries (box_2d: [ymin, xmin, ymax, xmax] in 0..1000)
      if (recognition.box_2d && recognition.box_2d.length === 4) {
        const [ymin, xmin, ymax, xmax] = recognition.box_2d;
        const imgW = prepared.img.width;
        const imgH = prepared.img.height;

        const cropX = Math.max(0, Math.round((xmin / 1000) * imgW));
        const cropY = Math.max(0, Math.round((ymin / 1000) * imgH));
        const cropW = Math.min(imgW - cropX, Math.round(((xmax - xmin) / 1000) * imgW));
        const cropH = Math.min(imgH - cropY, Math.round(((ymax - ymin) / 1000) * imgH));

        if (cropW > 80 && cropH > 80) {
          const autoCropped = renderCroppedCanvas(
            prepared.img,
            { x: cropX, y: cropY, width: cropW, height: cropH },
            0,
            600,
            900,
            0.85
          );
          setPreview(autoCropped.dataUrl);
        }
      }
    } catch (err) {
      console.error("Error recognizing cover:", err);
      setError("Error al procesar o analizar la imagen con IA. Intenta con otra foto con mejor iluminación.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleUseResult = () => {
    if (result) {
      onResult(result, preview);
    }
  };

  const handleReset = () => {
    setLoadedImg(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setIsCropping(false);
  };

  // ── Manual Crop Handlers ──
  const handleOpenCropper = () => {
    setIsCropping(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Touch / Mouse Drag handlers for positioning inside crop frame
  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY, panX: pan.x, panY: pan.y };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleApplyCrop = () => {
    if (!loadedImg) return;

    // The crop window has 2:3 aspect ratio (e.g. 240px x 360px on screen)
    // Calculate mapping between container coordinates and image original dimensions
    const imgW = loadedImg.width;
    const imgH = loadedImg.height;

    // Center crop based on zoom and pan
    const baseW = imgW / zoom;
    const baseH = (baseW * 3) / 2; // 2:3 ratio

    const normPanX = (pan.x / 150) * (imgW * 0.3);
    const normPanY = (pan.y / 150) * (imgH * 0.3);

    let cropX = Math.round((imgW - baseW) / 2 - normPanX);
    let cropY = Math.round((imgH - baseH) / 2 - normPanY);
    let cropW = Math.round(baseW);
    let cropH = Math.round(baseH);

    // Clamp coordinates
    cropX = Math.max(0, Math.min(imgW - 50, cropX));
    cropY = Math.max(0, Math.min(imgH - 50, cropY));
    cropW = Math.min(imgW - cropX, cropW);
    cropH = Math.min(imgH - cropY, cropH);

    const cropped = renderCroppedCanvas(
      loadedImg,
      { x: cropX, y: cropY, width: cropW, height: cropH },
      rotation,
      600,
      900,
      0.85
    );

    setPreview(cropped.dataUrl);
    setIsCropping(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl overflow-hidden w-full max-w-md shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-50 text-primary-600 rounded-xl">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">Reconocer Portada con IA</h3>
              <p className="text-[11px] text-gray-400">Toma una foto y ajústala para que quede perfecta</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Hidden file inputs: Camera & Gallery */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {!preview ? (
            /* Mode 1: Initial Capture buttons */
            <div className="space-y-3 py-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full py-4 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-3 transition shadow-sm group"
              >
                <div className="p-2 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                  <Camera className="h-6 w-6" />
                </div>
                <span>📸 Tomar Foto con la Cámara</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-full py-3.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-2xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2.5 transition"
              >
                <ImageIcon className="h-4 w-4 text-gray-500" />
                <span>Elegir foto de la galería o archivo</span>
              </button>

              <p className="text-[11px] text-gray-400 text-center pt-2">
                La foto se recortará y optimizará automáticamente para ser la portada oficial de tu libro.
              </p>
            </div>
          ) : isCropping ? (
            /* Mode 2: Interactive Cropper Viewfinder */
            <div className="space-y-4">
              <div className="text-center space-y-0.5">
                <p className="text-xs font-bold text-gray-800">Encuadra la portada del libro</p>
                <p className="text-[11px] text-gray-400">Arrastra para centrar o rota si está de lado</p>
              </div>

              {/* Crop Viewport with 2:3 ratio frame */}
              <div
                className="relative w-64 h-96 mx-auto bg-gray-900 rounded-2xl overflow-hidden border-2 border-primary-500 shadow-lg cursor-grab active:cursor-grabbing select-none"
                onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
                onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  handleDragStart(touch.clientX, touch.clientY);
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  handleDragMove(touch.clientX, touch.clientY);
                }}
                onTouchEnd={handleDragEnd}
              >
                {/* Visual grid guide */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-10 opacity-30 border border-white/40">
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-white/40" />
                  <div className="border-r border-white/40" />
                  <div />
                </div>

                {/* Image being cropped */}
                {loadedImg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={loadedImg.src}
                    alt="Ajustando recorte"
                    draggable={false}
                    className="absolute max-w-none transition-transform duration-75 pointer-events-none"
                    style={{
                      width: `${100 * zoom}%`,
                      height: "auto",
                      left: "50%",
                      top: "50%",
                      transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) rotate(${rotation}deg)`,
                      transformOrigin: "center center",
                    }}
                  />
                )}
              </div>

              {/* Cropper controls: Rotate & Zoom */}
              <div className="flex items-center justify-between gap-2 px-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <button
                  type="button"
                  onClick={handleRotate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg hover:bg-gray-100 transition shadow-xs"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Rotar 90°
                </button>

                {/* Zoom control */}
                <div className="flex items-center gap-2 flex-1 justify-end max-w-[180px]">
                  <ZoomOut className="h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <ZoomIn className="h-3.5 w-3.5 text-gray-400" />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCropping(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Aplicar recorte
                </button>
              </div>
            </div>
          ) : (
            /* Mode 3: Normal Preview & Results */
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-200 max-h-60 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Portada del libro recortada"
                  className="max-h-60 w-auto object-contain rounded-lg shadow-sm"
                />

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2.5 p-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
                    <p className="text-xs font-semibold">Gemini AI reconociendo portada...</p>
                    <p className="text-[11px] text-gray-300">Detectando título, autor y encuadre</p>
                  </div>
                )}
              </div>

              {/* Button to open manual crop / rotate tool */}
              {!isAnalyzing && (
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleOpenCropper}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3.5 py-1.5 rounded-xl transition border border-primary-200 shadow-xs"
                  >
                    <Crop className="h-3.5 w-3.5" />
                    ✂️ Ajustar recorte o rotar portada
                  </button>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="flex items-start gap-2.5 text-red-700 text-xs bg-red-50 border border-red-200 p-3 rounded-xl">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Recognized details card */}
              {result && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Libro Identificado</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {Math.round(result.confidence * 100)}% certeza
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-gray-500 font-medium">Título: </span>
                      <strong className="text-gray-900">{result.title || "No identificado"}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Autor: </span>
                      <span className="text-gray-800 font-semibold">{result.author || "No identificado"}</span>
                    </div>
                    {result.publisher && (
                      <div>
                        <span className="text-gray-500 font-medium">Editorial: </span>
                        <span className="text-gray-700">{result.publisher}</span>
                      </div>
                    )}
                    {result.isbn && (
                      <div>
                        <span className="text-gray-500 font-medium">ISBN: </span>
                        <span className="font-mono text-gray-700">{result.isbn}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleUseResult}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    ✓ Usar estos datos y foto de portada
                  </button>
                </div>
              )}

              {/* Retake button */}
              {!isAnalyzing && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tomar otra foto
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
