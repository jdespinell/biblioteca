"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, AlertCircle } from "lucide-react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

interface BarcodeScannerProps {
  onScan: (isbn: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const startScanning = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();

        if (devices.length === 0) {
          setError("No se encontró cámara en este dispositivo");
          return;
        }

        // Prefer rear camera on mobile
        const rearCamera = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("trasera")
        );
        const deviceId = rearCamera?.deviceId ?? devices[0].deviceId;

        if (!videoRef.current) return;

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            if (result && scanning) {
              const text = result.getText();
              // ISBN-10 or ISBN-13 pattern
              if (/^(\d{10}|\d{13})$/.test(text.replace(/-/g, ""))) {
                setScanning(false);
                onScan(text);
              }
            }
            if (err && !(err instanceof NotFoundException)) {
              // NotFoundException is normal (no barcode in frame)
              console.warn("Scanner error:", err);
            }
          }
        );
      } catch (e) {
        if ((e as Error).name === "NotAllowedError") {
          setError("Permiso de cámara denegado. Habilita el acceso en la configuración de tu navegador.");
        } else {
          setError("Error al iniciar la cámara. Intenta de nuevo.");
        }
      }
    };

    startScanning();

    return () => {
      reader.reset();
    };
  }, [onScan, scanning]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Escanear ISBN</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black aspect-square">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Scanning overlay */}
          {!error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-32 border-2 border-primary-400 rounded-lg relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary-400 rounded-tl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary-400 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary-400 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary-400 rounded-br" />
                {/* Scanning line animation */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary-400/60 animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="p-4 text-center">
          {error ? (
            <div className="flex items-start gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Apunta la cámara hacia el código de barras del libro
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
