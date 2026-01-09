
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';

interface AvatarPickerProps {
  currentAvatar: string;
  onAvatarChange: (base64: string) => void;
  className?: string;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ currentAvatar, onAvatarChange, className = "" }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentAvatar);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewUrl(currentAvatar);
  }, [currentAvatar]);

  const startCamera = async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 400, height: 400 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Impossible d'accéder à la caméra. Vérifiez les permissions.");
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  };

  const processImage = (source: HTMLVideoElement | HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // On force un carré 200x200 pour l'avatar
    canvas.width = 200;
    canvas.height = 200;

    let sourceX = 0, sourceY = 0, sourceWidth, sourceHeight;

    if (source instanceof HTMLVideoElement) {
      sourceWidth = source.videoWidth;
      sourceHeight = source.videoHeight;
    } else {
      sourceWidth = source.width;
      sourceHeight = source.height;
    }

    const size = Math.min(sourceWidth, sourceHeight);
    sourceX = (sourceWidth - size) / 2;
    sourceY = (sourceHeight - size) / 2;

    ctx.drawImage(source, sourceX, sourceY, size, size, 0, 0, 200, 200);
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    setPreviewUrl(base64);
    onAvatarChange(base64);
    stopCamera();
  };

  const takePhoto = () => {
    if (videoRef.current) {
      processImage(videoRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => processImage(img);
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <div className="relative group">
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl bg-slate-100">
          {isCapturing ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <img 
              src={previewUrl} 
              className="w-full h-full object-cover transition-transform group-hover:scale-105" 
              alt="Avatar" 
            />
          )}
        </div>
        
        {!isCapturing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]">
             <p className="text-white text-[10px] font-black uppercase tracking-widest">Changer photo</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {isCapturing ? (
          <>
            <Button size="sm" onClick={takePhoto} className="rounded-xl px-4 h-10 font-black uppercase text-[10px]">
              📸 Capturer
            </Button>
            <Button size="sm" variant="outline" onClick={stopCamera} className="rounded-xl px-4 h-10 font-black uppercase text-[10px] bg-white">
              Annuler
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={startCamera} className="rounded-xl px-4 h-10 font-black uppercase text-[10px] bg-white border-slate-200">
              📷 Caméra
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-xl px-4 h-10 font-black uppercase text-[10px] bg-white border-slate-200">
              📁 Fichier
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload} 
            />
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
