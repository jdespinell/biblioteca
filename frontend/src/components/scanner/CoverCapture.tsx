"use client";

import { useRef, useState } from "react";
import { Camera, Upload, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { aiApi } from "@/lib/api/locations";

interface CoverRecognitionResult {
  title: string | null;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  confidence: number;
}

interface CoverCaptureProps {
  onResult: (result: CoverRecognitionResult) => void;
  onClose: () => void;
}

export default function CoverCapture({ onResult, onClose }: CoverCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<CoverRecognitionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Convert to base64 and send to API
    const base64Reader = new FileReader();
    base64Reader.onloadend = async () => {
      const base64 = (base64Reader.result as string).split(",")[1]; // Strip data URI prefix
      setIsAnalyzing(true);
      setError(null);
      setResult(null);

      try {
        const recognition = await aiApi.recognizeCover(base64, file.type);
        setResult(recognition);
      } catch {
        setError("Error al analizar la imagen. Intenta con otra foto.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    base64Reader.readAsDataURL(file);
  };

  const handleUseResult = () => {
    if (result) {
      onResult(result);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Reconocimiento de Portada con IA</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 mx-auto rounded-lg object-contain"
              />
            ) : (
              <div className="space-y-3">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Upload className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Toca para seleccionar una imagen
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    JPG, PNG o WebP — máx. 10MB
                  </p>
                </div>
              </div>
            )}

            {/* Analysis overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center rounded-xl gap-3">
                <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
                <p className="text-sm font-medium text-gray-700">Analizando con Gemini AI...</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>
                  Confianza: {Math.round(result.confidence * 100)}%
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {result.title && (
                  <div>
                    <span className="font-medium text-gray-600">Título: </span>
                    <span className="text-gray-900">{result.title}</span>
                  </div>
                )}
                {result.author && (
                  <div>
                    <span className="font-medium text-gray-600">Autor: </span>
                    <span className="text-gray-900">{result.author}</span>
                  </div>
                )}
                {result.publisher && (
                  <div>
                    <span className="font-medium text-gray-600">Editorial: </span>
                    <span className="text-gray-900">{result.publisher}</span>
                  </div>
                )}
                {result.isbn && (
                  <div>
                    <span className="font-medium text-gray-600">ISBN: </span>
                    <span className="font-mono text-gray-900">{result.isbn}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleUseResult}
                className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Usar estos datos
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
