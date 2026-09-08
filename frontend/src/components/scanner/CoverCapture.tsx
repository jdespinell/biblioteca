"use client";

import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, X, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { aiApi, type CoverRecognitionResponse } from "@/lib/api/ai";

interface CoverCaptureProps {
  onResult: (result: CoverRecognitionResponse, coverImage?: string | null) => void;
  onClose: () => void;
}

export default function CoverCapture({ onResult, onClose }: CoverCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<CoverRecognitionResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Convert to base64 and send to API
    const base64Reader = new FileReader();
    base64Reader.onloadend = async () => {
      const base64 = (base64Reader.result as string).split(",")[1];
      setIsAnalyzing(true);
      setError(null);
      setResult(null);

      try {
        const recognition = await aiApi.recognizeCover(base64, file.type);
        setResult(recognition);
      } catch (err) {
        console.error("Error recognizing cover:", err);
        setError("Error al analizar la imagen con IA. Intenta con otra foto con mejor iluminación o ángulo.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    base64Reader.readAsDataURL(file);
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
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl overflow-hidden w-full max-w-md shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-50 text-primary-600 rounded-xl">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">Reconocer Portada con IA</h3>
              <p className="text-[11px] text-gray-400">Toma una foto para identificar el libro automáticamente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Hidden file inputs: One for Camera, one for Gallery */}
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
            /* Choose capture mode */
            <div className="space-y-3">
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
                Apunta a la portada con buena luz para que Gemini pueda leer el título y autor.
              </p>
            </div>
          ) : (
            /* Preview & Result section */
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-200 max-h-60 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Foto de la portada"
                  className="max-h-60 w-auto object-contain"
                />

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2.5 p-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
                    <p className="text-xs font-semibold">Gemini AI analizando portada...</p>
                    <p className="text-[11px] text-gray-300">Identificando título, autor y datos</p>
                  </div>
                )}
              </div>

              {/* Error state */}
              {error && (
                <div className="flex items-start gap-2.5 text-red-700 text-xs bg-red-50 border border-red-200 p-3 rounded-xl">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Result card */}
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
                    ✓ Usar estos datos y añadir libro
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
