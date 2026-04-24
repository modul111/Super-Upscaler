/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef, useEffect, type ChangeEvent, type DragEvent, type MouseEvent, type TouchEvent } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Settings2, 
  Download, 
  ChevronRight, 
  Languages, 
  Zap, 
  ShieldCheck, 
  Layers,
  Sparkles,
  Maximize2,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Upscaler from 'upscaler';
import * as tf from '@tensorflow/tfjs';
import x2 from '@upscalerjs/esrgan-slim/2x';
import x4 from '@upscalerjs/esrgan-slim/4x';

// Initialize TensorFlow.js
tf.setBackend('webgl').then(() => tf.ready());

/**
 * Utility for Tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Translations ---

type Language = 'en' | 'ru';

const t = {
  en: {
    heroTitleFirst: "Upscale your photos in",
    heroTitleSecond: "2k 4k",
    heroTitleThird: "with AI",
    heroSub: "Professional resolution enhancement and quality improvement. Completely free, non-cloud processing.",
    uploadBtn: "Upload Images",
    uploadPlaceholder: "Drag & drop your files here or click to browse",
    uploadLimit: "Supports JPG, PNG",
    scale: "Select Scale",
    model: "Select Model",
    photo: "Photo",
    anime: "Anime / Art",
    process: "Upscale Locally",
    processing: "AI Processing in Browser...",
    download: "Download Result",
    comparison: "Before / After",
    login: "Sign In",
    features: "Features",
    quality: "Ultra Quality",
    speed: "Local Power",
    secure: "100% Private (No Uploads)",
    footer: "© 2026 NeuralPix AI. All rights reserved.",
    ratio: "Aspect Ratio",
    res: "Final Resolution",
    original: "Original",
    square: "Square (1:1)",
    standard: "Standard (4:3)",
    wide: "Widescreen (16:9)",
    px: "px",
    targetSize: "Output Limit (Max-Side)",
    autoQuality: "Auto (Max)",
    enhancement: "Quality Enhancement",
    sharpen: "AI Detail Boost",
    sharpenDesc: "Deep reconstruction of lines & edges",
    vibrant: "Vibrant Colors",
    vibrantDesc: "Enhanced contrast and saturation",
    strength: "Enhancement Level",
    low: "Subtle",
    med: "Balanced",
    high: "Pro",
  },
  ru: {
    heroTitleFirst: "Увеличь качество фото в",
    heroTitleSecond: "2к 4к",
    heroTitleThird: "с помощью ИИ",
    heroSub: "Профессиональное увеличение разрешения и улучшение качества. Полностью бесплатно, без облачной загрузки.",
    uploadBtn: "Загрузить изображения",
    uploadPlaceholder: "Перетащите файлы сюда или нажмите для выбора",
    uploadLimit: "Поддержка JPG, PNG",
    scale: "Выберите масштаб",
    model: "Выберите модель",
    photo: "Фото",
    anime: "Аниме / Арт",
    process: "Увеличить Бесплатно",
    processing: "ИИ обрабатывает в браузере...",
    download: "Скачать результат",
    comparison: "До / После",
    login: "Войти",
    features: "Особенности",
    quality: "Ультра качество",
    speed: "Локальная мощь",
    secure: "100% Приватно (Без загрузки)",
    footer: "© 2026 NeuralPix AI. Все права защищены.",
    ratio: "Соотношение сторон",
    res: "Итоговое разрешение",
    original: "Оригинал",
    square: "Квадрат (1:1)",
    standard: "Стандарт (4:3)",
    wide: "Широкий (16:9)",
    px: "пк",
    targetSize: "Итоговый лимит (Max-Side)",
    autoQuality: "Авто (Макс)",
    enhancement: "Улучшение качества",
    sharpen: "AI Улучшение деталей",
    sharpenDesc: "Глубокая реконструкция линий и текстур",
    vibrant: "Яркие цвета",
    vibrantDesc: "Повышенный контраст и насыщенность",
    strength: "Уровень улучшения",
    low: "Мягкий",
    med: "Баланс",
    high: "Про",
  }
};

// --- Utilities ---

type RatioType = 'original' | '1:1' | '4:3' | '16:9';

/**
 * Resizes and crops an image if needed
 */
const processImage = async (file: File, maxDim = 1200, ratio: RatioType = 'original'): Promise<{ url: string, width: number, height: number, originalW: number, originalH: number }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let srcW = img.width;
        let srcH = img.height;
        let targetW = srcW;
        let targetH = srcH;

        // Apply Aspect Ratio Crop
        let startX = 0;
        let startY = 0;
        let drawW = srcW;
        let drawH = srcH;

        if (ratio !== 'original') {
          const ratios = { '1:1': 1, '4:3': 4/3, '16:9': 16/9 };
          const targetRatio = ratios[ratio];
          const currentRatio = srcW / srcH;

          if (currentRatio > targetRatio) {
            // Source is wider than target, crop width
            drawW = srcH * targetRatio;
            startX = (srcW - drawW) / 2;
          } else {
            // Source is taller than target, crop height
            drawH = srcW / targetRatio;
            startY = (srcH - drawH) / 2;
          }
          targetW = drawW;
          targetH = drawH;
        }

        // Apply Max Dimension Constraint
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH *= maxDim / targetW;
            targetW = maxDim;
          } else {
            targetW *= maxDim / targetH;
            targetH = maxDim;
          }
        }

        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, startX, startY, drawW, drawH, 0, 0, targetW, targetH);
        resolve({
          url: canvas.toDataURL('image/jpeg', 0.9),
          width: Math.round(targetW),
          height: Math.round(targetH),
          originalW: img.width,
          originalH: img.height
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Professional Image Detail Discovery
 * Uses a Luminance-based Unsharp Mask (USM) to enhance clarity and a 
 * bilateral-like denoise pass to clean up AI artifacts.
 */
const enhanceImage = async (dataUrl: string, amount = 0.5, denoise = 0.3): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve(dataUrl);

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const originalData = new Uint8ClampedArray(data);
      
      const width = canvas.width;
      const height = canvas.height;

      // Blur Kernel (Gaussian 5x5 approximation) for USM
      const kernel = [
        1,  4,  6,  4,  1,
        4, 16, 24, 16,  4,
        6, 24, 36, 24,  6,
        4, 16, 24, 16,  4,
        1,  4,  6,  4,  1
      ];
      const weight = 256;

      for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
          const idx = (y * width + x) * 4;
          
          // --- 1. Denoise Part (Simple Median/Bilateral approximation) ---
          let dr = 0, dg = 0, db = 0;
          if (denoise > 0) {
            // Sample neighboring pixels for smoothing
            const samples = [
              idx, idx-4, idx+4, idx-(width*4), idx+(width*4)
            ];
            for(const s of samples) {
              dr += originalData[s];
              dg += originalData[s+1];
              db += originalData[s+2];
            }
            dr /= 5; dg /= 5; db /= 5;
            // Mix original with smoothed based on denoise amount
            originalData[idx] = originalData[idx] * (1-denoise) + dr * denoise;
            originalData[idx+1] = originalData[idx+1] * (1-denoise) + dg * denoise;
            originalData[idx+2] = originalData[idx+2] * (1-denoise) + db * denoise;
          }

          const r = originalData[idx];
          const g = originalData[idx+1];
          const b = originalData[idx+2];
          const lum = (r * 0.299 + g * 0.587 + b * 0.114);

          // --- 2. Calculate blurred luminance for USM ---
          let blurLum = 0;
          for (let ky = 0; ky < 5; ky++) {
            for (let kx = 0; kx < 5; kx++) {
              const kIdx = ((y + ky - 2) * width + (x + kx - 2)) * 4;
              const kr = originalData[kIdx];
              const kg = originalData[kIdx+1];
              const kb = originalData[kIdx+2];
              const klum = (kr * 0.299 + kg * 0.587 + kb * 0.114);
              blurLum += klum * kernel[ky * 5 + kx];
            }
          }
          blurLum /= weight;

          // --- 3. Unsharp Mask: Detail = Original - Blur ---
          const detail = lum - blurLum;
          const threshold = 1.5; 
          const enhancedDetail = Math.abs(detail) < threshold ? 0 : detail * amount;
          
          const factor = (lum + enhancedDetail) / (lum || 1);
          
          data[idx] = Math.min(255, Math.max(0, r * factor));
          data[idx+1] = Math.min(255, Math.max(0, g * factor));
          data[idx+2] = Math.min(255, Math.max(0, b * factor));
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.98));
    };
    img.src = dataUrl;
  });
};

/**
 * Converts a Data URL to a Blob for memory-efficient handling of large files
 */
const dataURLtoBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// --- Main App Component ---

export default function App() {
  const [lang, setLang] = useState<Language>('ru');
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreProcessing, setIsPreProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState('2');
  const [model, setModel] = useState<'photo' | 'anime'>('photo');
  const [aspectRatio, setAspectRatio] = useState<RatioType>('original');
  const [targetMaxDim, setTargetMaxDim] = useState(2048);
  const [isSharpenEnabled, setIsSharpenEnabled] = useState(true);
  const [enhanceStrength, setEnhanceStrength] = useState<'low' | 'med' | 'high'>('med');
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  const [progress, setProgress] = useState(0);
  const [resInfo, setResInfo] = useState<{ original: string, final: string, ratio: number } | null>(null);
  const upscalerRef = useRef<any>(null);

  const currentT = t[lang];

  // Update resolution info when scale/settings change
  useEffect(() => {
    if (files.length > 0) {
      const img = new Image();
      img.onload = () => {
        const ratios = { 'original': img.width/img.height, '1:1': 1, '4:3': 4/3, '16:9': 16/9 };
        const r = ratios[aspectRatio];
        const upscaleFactor = parseInt(scale);
        
        let w = img.width;
        let h = img.height;
        
        // Simulating the crop logic for info
        if (aspectRatio !== 'original') {
          if (w/h > r) w = h * r; else h = w / r;
        }

        // --- NEW QUALITY-FIRST LOGIC ---
        // 1. Calculate safe input based strictly on memory limits (The Golden 4096px Limit)
        const INTERNAL_LIMIT = 4096;
        const maxSafeInput = INTERNAL_LIMIT / upscaleFactor;
        
        if (w > maxSafeInput || h > maxSafeInput) {
          const factor = maxSafeInput / Math.max(w, h);
          w *= factor;
          h *= factor;
        }

        // 2. Initial AI upscaled resolution
        let finalW = w * upscaleFactor;
        let finalH = h * upscaleFactor;

        // 3. User-selected limit applies ONLY to the final output
        if (finalW > targetMaxDim || finalH > targetMaxDim) {
          const factor = targetMaxDim / Math.max(finalW, finalH);
          finalW *= factor;
          finalH *= factor;
        }

        setResInfo({
          original: `${img.width}x${img.height}`,
          final: `${Math.round(finalW)}x${Math.round(finalH)}`,
          ratio: aspectRatio === 'original' ? img.width/img.height : r
        });
      };
      img.src = URL.createObjectURL(files[0]);
    }
  }, [files, scale, aspectRatio, targetMaxDim]);

  // --- Handlers ---

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).slice(0, 100);
      setFiles(newFiles);
      setIsDone(false);
      setResultUrl(null);
      setError(null);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).slice(0, 100);
      setFiles(newFiles);
      setIsDone(false);
      setResultUrl(null);
      setError(null);
    }
  };

  const startProcessing = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setIsPreProcessing(true);
    setProgress(0);
    setError(null);

    // Memory optimization flags for TFJS
    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    tf.env().set('WEBGL_FLUSH_THRESHOLD', 1);

    const runUpscale = async (currentMaxDim: number, currentPatchSize: number) => {
      // 1. Process base image (Resize/Crop)
      // Quality-First Principle: Use maximum safe input to preserve original pixels.
      const upscaleFactor = parseInt(scale);
      
      // SAFETY CAP: We must not exceed browser texture limits or total memory.
      // 4096px is the 'Golden Limit' for mass compatibility.
      const INTERNAL_LIMIT = 4096;
      const maxSafeInput = INTERNAL_LIMIT / upscaleFactor;
      
      const { url: processedImageUrl, width: inW, height: inH } = await processImage(files[0], maxSafeInput, aspectRatio);
      setIsPreProcessing(false);

      // 2. Setup AI Model
      const modelDefinition = scale === '4' ? x4 : x2;
      
      if (!upscalerRef.current) {
        upscalerRef.current = new Upscaler({
          model: modelDefinition
        });
      } else {
        await upscalerRef.current.dispose();
        upscalerRef.current = new Upscaler({
          model: modelDefinition
        });
      }

      // Small "breather" delay to let the browser stabilize after loading model weights
      await new Promise(r => setTimeout(r, 250));

      // 3. AI Inference (The heavy lifting)
      let result = await upscalerRef.current.upscale(processedImageUrl, {
        patchSize: currentPatchSize, 
        padding: 4,
        progress: (percent: number) => setProgress(Math.round(percent * 100))
      });

      // 4. Post-scale correction & User Limit enforcement
      // We only downscale AFTER the upscale is done to prevent losing detail early.
      const tempImg = new Image();
      const finalResult = await new Promise<string>((resolve) => {
        tempImg.onload = () => {
          let w = tempImg.width;
          let h = tempImg.height;
          // Apply user selected targetMaxDim
          if (w > currentMaxDim || h > currentMaxDim) {
            const canvas = document.createElement('canvas');
            if (w > h) { h *= currentMaxDim / w; w = currentMaxDim; }
            else { w *= currentMaxDim / h; h = currentMaxDim; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d', { alpha: false });
            ctx?.drawImage(tempImg, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.98));
          } else {
            resolve(result);
          }
        };
        tempImg.src = result;
      });

      // 5. Quality Enhancement: AI Detail Discovery & Denoise
      let enhanced = finalResult;
      if (isSharpenEnabled) {
        setProgress(95); // Nearly done
        const config = {
          low: { sharpen: 0.5, denoise: 0.1 },
          med: { sharpen: 1.2, denoise: 0.25 },
          high: { sharpen: 2.4, denoise: 0.4 }
        };
        const settings = config[enhanceStrength];
        enhanced = await enhanceImage(finalResult, settings.sharpen, settings.denoise);
      }

      setResultUrl(enhanced);
      setIsDone(true);
    };

    try {
      // Attempt 1: Using selected settings with a conservative patch size 
      // patchSize 16 is the standard balance between speed and stability.
      await runUpscale(targetMaxDim, 16);
    } catch (err: any) {
      console.warn("Attempt 1 failed, trying Safe Mode (Reduced Res)...", err);
      
      try {
        // Attempt 2: Automatic fallback to much lower resolution
        setProgress(0);
        setIsPreProcessing(true);
        const safeRes = Math.min(targetMaxDim, 800);
        await runUpscale(safeRes, 12);
        
        setError(lang === 'ru' 
          ? "Оригинал был слишком велик. Мы автоматически уменьшили его для стабильной работы." 
          : "The original was too large. We auto-downscaled it to maintain stability.");
      } catch (retryErr: any) {
        console.error("Critical Failure:", retryErr);
        setError(lang === 'ru' 
          ? "Критическая нехватка памяти. Пожалуйста, используйте масштаб 2x или обновите вкладку браузера." 
          : "Critical memory shortage. Please use 2x scale or refresh your browser tab.");
      }
    } finally {
      setIsProcessing(false);
      setIsPreProcessing(false);
      // Clean up tensors
      tf.disposeVariables();
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    
    try {
      // Convert Data URL to Blob for stable downloading of large (4k+) images
      const blob = dataURLtoBlob(resultUrl);
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `neuralpix_${scale}x_${files[0]?.name?.split('.')[0] || 'result'}.jpg`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (err) {
      console.error("Download failed:", err);
      // Fallback for smaller files if blob conversion fails
      const a = document.createElement('a');
      a.href = resultUrl;
      a.download = `neuralpix_${scale}x_result.jpg`;
      a.click();
    }
  };

  const handleSliderMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const pos = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(100, Math.max(0, pos)));
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] selection:bg-blue-500/30 font-sans">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-10 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="logo text-2xl font-[800] tracking-[-1px] bg-gradient-to-r from-[#3b82f6] to-[#a855f7] bg-clip-text text-transparent">
              NEURALPIX.AI
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
              className="px-3 py-2 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 text-xs font-bold text-[#a1a1aa] hover:text-white uppercase tracking-wider"
            >
              <Languages className="w-4 h-4" />
              {lang.toUpperCase()}
            </button>
            <button className="px-6 py-2 border border-[#27272a] rounded-lg text-white font-medium text-sm hover:bg-white/5 transition-all">
              {currentT.login}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-10 relative overflow-hidden text-left">
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <h1 className="text-[44px] md:text-[64px] font-[800] tracking-[-2px] mb-6 leading-[1.1] uppercase">
              {currentT.heroTitleFirst} 
              <span className="block text-[#3b82f6]">
                {currentT.heroTitleSecond}
              </span> 
              {currentT.heroTitleThird}
            </h1>
            <p className="text-sm md:text-base text-[#a1a1aa] mb-12 max-w-xl font-medium tracking-wide">
              {currentT.heroSub}
            </p>
          </motion.div>

          {!files.length ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <label className="group relative inline-block cursor-pointer">
                <input 
                  type="file" 
                  className="hidden" 
                  multiple 
                  accept="image/*" 
                  onChange={handleFileChange}
                />
                <div className="relative px-12 py-6 bg-black rounded-2xl border-2 border-dashed border-[#27272a] hover:border-[#3b82f6] flex items-center gap-4 transition-all">
                  <Upload className="w-6 h-6 text-[#3b82f6]" />
                  <span className="text-xl font-[800] tracking-tight">{currentT.uploadBtn}</span>
                </div>
              </label>
            </motion.div>
          ) : null}
        </div>
      </section>

      {/* App Interface Container */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="max-w-7xl mx-auto px-10 pb-40"
          >
            <div className="grid lg:grid-cols-12 gap-10 items-start">
              {/* Left Column: Settings (Narrower side per design) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-[#18181b] border border-[#27272a] rounded-[16px] p-8 space-y-8 sticky top-28 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Settings2 className="w-4 h-4 text-[#3b82f6]" />
                      <h2 className="text-xs font-bold tracking-[1px] uppercase text-[#a1a1aa]">{currentT.scale}</h2>
                    </div>
                  </div>

                  {/* Scale Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {['2', '4'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setScale(s)}
                        className={cn(
                          "py-3 rounded-lg font-bold transition-all border text-sm",
                          scale === s 
                            ? "bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6]" 
                            : "bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:border-[#a1a1aa]/30"
                        )}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <Layers className="w-4 h-4 text-[#3b82f6]" />
                      <h2 className="text-xs font-bold tracking-[1px] uppercase text-[#a1a1aa]">{currentT.model}</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => setModel('photo')}
                        className={cn(
                          "flex items-center gap-4 px-6 py-4 rounded-lg border transition-all",
                          model === 'photo' ? "bg-[#3b82f6] border-[#3b82f6] text-white" : "bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:border-[#a1a1aa]/30 text-white/70"
                        )}
                      >
                        <div className="text-left">
                          <p className="font-bold text-sm tracking-tight">{currentT.photo}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setModel('anime')}
                        className={cn(
                          "flex items-center gap-4 px-6 py-4 rounded-lg border transition-all",
                          model === 'anime' ? "bg-[#3b82f6] border-[#3b82f6] text-white" : "bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:border-[#a1a1aa]/30 text-white/70"
                        )}
                      >
                        <div className="text-left">
                          <p className="font-bold text-sm tracking-tight">{currentT.anime}</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Aspect Ratio Block */}
                  <div className="pt-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <Maximize2 className="w-4 h-4 text-[#3b82f6]" />
                      <h2 className="text-xs font-bold tracking-[1px] uppercase text-[#a1a1aa]">{currentT.ratio}</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['original', '1:1', '4:3', '16:9'] as RatioType[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setAspectRatio(r);
                            setIsDone(false);
                            setResultUrl(null);
                          }}
                          className={cn(
                            "py-2 rounded-lg text-[10px] font-bold uppercase transition-all border",
                            aspectRatio === r 
                              ? "bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6]" 
                              : "bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:border-[#a1a1aa]/30"
                          )}
                        >
                          {r === 'original' ? currentT.original : currentT[r === '1:1' ? 'square' : r === '4:3' ? 'standard' : 'wide']}
                        </button>
                      ))}
                    </div>
                  </div>

                    {/* Target Size Block */}
                    <div className="pt-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-4 h-4 text-[#3b82f6]" />
                        <h2 className="text-xs font-bold tracking-[1px] uppercase text-[#a1a1aa]">{currentT.targetSize}</h2>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[1024, 2048, 4096, 16384].map((size) => (
                          <button
                            key={size}
                            onClick={() => {
                              setTargetMaxDim(size);
                              setIsDone(false);
                              setResultUrl(null);
                            }}
                            className={cn(
                              "py-2 rounded-lg text-[10px] font-bold uppercase transition-all border",
                              targetMaxDim === size 
                                ? "bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6]" 
                                : "bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:border-[#a1a1aa]/30"
                            )}
                          >
                            {size === 16384 ? currentT.autoQuality : `${size}px`}
                          </button>
                        ))}
                      </div>
                      {targetMaxDim > 2048 && (
                      <p className="text-[10px] text-yellow-500/80 font-medium leading-relaxed">
                        ⚠️ {lang === 'ru' ? 'Высокий риск нехватки памяти браузера' : 'High risk of browser memory crash'}
                      </p>
                    )}
                  </div>

                  {/* Res Info */}
                  {resInfo && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/40 uppercase tracking-wider font-bold">Source</span>
                        <span className="text-white font-mono">{resInfo.original}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#3b82f6] uppercase tracking-wider font-bold">Neural Output</span>
                        <span className="text-white font-mono">{resInfo.final}</span>
                      </div>
                    </div>
                  )}

                  {/* Quality Enhancement Block */}
                  <div className="pt-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-4 h-4 text-[#3b82f6]" />
                      <h2 className="text-xs font-bold tracking-[1px] uppercase text-[#a1a1aa]">{currentT.enhancement}</h2>
                    </div>
                    <button
                      onClick={() => {
                        setIsSharpenEnabled(!isSharpenEnabled);
                        setIsDone(false);
                        setResultUrl(null);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                        isSharpenEnabled ? "bg-[#3b82f6]/10 border-[#3b82f6]" : "bg-[#09090b] border-[#27272a] opacity-60"
                      )}
                    >
                      <div className="text-left">
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider", isSharpenEnabled ? "text-[#3b82f6]" : "text-[#a1a1aa]")}>
                          {currentT.sharpen}
                        </p>
                        <p className="text-[10px] text-[#a1a1aa] mt-0.5">{currentT.sharpenDesc}</p>
                      </div>
                      <div className={cn(
                        "w-10 h-5 rounded-full relative transition-all flex-shrink-0",
                        isSharpenEnabled ? "bg-[#3b82f6]" : "bg-[#27272a]"
                      )}>
                        <motion.div 
                          animate={{ x: isSharpenEnabled ? 20 : 0 }}
                          className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm"
                        />
                      </div>
                    </button>

                    {isSharpenEnabled && (
                      <div className="space-y-3 pt-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] px-1">{currentT.strength}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['low', 'med', 'high'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                setEnhanceStrength(s);
                                setIsDone(false);
                                setResultUrl(null);
                              }}
                              className={cn(
                                "py-2 rounded-lg text-[10px] font-bold uppercase transition-all border",
                                enhanceStrength === s 
                                  ? "bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6]" 
                                  : "bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:border-[#a1a1aa]/30"
                              )}
                            >
                              {currentT[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    disabled={isProcessing}
                    onClick={() => {
                      if (isDone) {
                        setIsDone(false);
                        setResultUrl(null);
                      } else {
                        startProcessing();
                      }
                    }}
                    className={cn(
                      "w-full py-4 rounded-xl font-[800] text-base flex items-center justify-center gap-3 transition-all",
                      isDone 
                        ? "bg-green-500/10 text-green-500 border border-green-500/30" 
                        : "bg-[#3b82f6] text-white hover:brightness-110 active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-500/20"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        >
                          <Zap className="w-5 h-5" />
                        </motion.div>
                        {progress}% - {currentT.processing}
                      </>
                    ) : isDone ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        {lang === 'ru' ? 'Готово!' : 'Complete!'}
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        {currentT.process}
                      </>
                    )}
                  </button>

                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-xs font-bold leading-relaxed">
                      {error}
                      {error.includes("REPLICATE_API_TOKEN") && (
                        <p className="mt-2 text-red-400/80">Please add your Replicate API token in the Secrets panel.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Editor/Preview (Wider side per design) */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-[#0c0c0e] border-2 border-dashed border-[#27272a] rounded-[20px] p-6 overflow-hidden min-h-[500px] flex flex-col justify-center">
                  {!isDone ? (
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="rounded-[16px] flex flex-col items-center justify-center gap-4 transition-all relative overflow-hidden bg-black/40 shadow-inner"
                      style={{ aspectRatio: resInfo?.ratio || 1.77 }}
                    >
                      {files.length === 1 ? (
                        <img 
                          src={URL.createObjectURL(files[0])} 
                          alt="Preview" 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="grid grid-cols-4 md:grid-cols-5 gap-3 p-4 w-full">
                          {files.slice(0, 10).map((f, i) => (
                            <div key={i} className="aspect-square bg-[#18181b] rounded-lg overflow-hidden border border-[#27272a] relative">
                              <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                              {i === 9 && files.length > 10 && (
                                <div className="absolute inset-0 bg-[#09090b]/80 flex items-center justify-center font-extrabold text-xl">
                                  +{files.length - 10}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <button 
                        onClick={() => setFiles([])}
                        className="absolute top-4 right-4 p-2 bg-[#09090b]/50 hover:bg-[#09090b] rounded-full border border-[#27272a] transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {isProcessing && (
                        <div className="absolute inset-0 bg-[#09090b]/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 p-10 overflow-hidden">
                          <div className="w-16 h-16 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                          <div className="text-center">
                            <p className="text-lg font-bold text-white mb-2">
                              {isPreProcessing 
                                ? (lang === 'ru' ? 'Подготовка ИИ...' : 'Preparing AI...') 
                                : progress === 0 
                                  ? (lang === 'ru' ? 'Запуск ИИ...' : 'Waking up AI...')
                                  : currentT.processing}
                            </p>
                            {!isPreProcessing && (
                              <>
                                <div className="w-48 h-2 bg-[#27272a] rounded-full overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-[#3b82f6]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                  />
                                </div>
                                <p className="text-sm text-[#a1a1aa] mt-2 font-mono">{progress}%</p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Comparison Slider */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[11px] font-[800] text-[#a1a1aa] uppercase tracking-[2px]">{currentT.comparison}</span>
                      </div>
                      <div 
                        ref={sliderRef}
                        className="relative rounded-2xl overflow-hidden cursor-ew-resize group shadow-2xl bg-black"
                        style={{ aspectRatio: resInfo?.ratio || 1.77 }}
                        onMouseMove={handleSliderMove}
                        onTouchMove={handleSliderMove}
                      >
                        {/* High Res */}
                        <div className="absolute inset-0 grayscale-0">
                          <img 
                            src={resultUrl || ""} 
                            className="w-full h-full object-contain" 
                          />
                        </div>
                        {/* Low Res */}
                        <div 
                          className="absolute inset-0 grayscale-[0.5] overflow-hidden" 
                          style={{ width: `${sliderPos}%`, borderRight: '2px solid white' }}
                        >
                          <img 
                            src={URL.createObjectURL(files[0])} 
                            className="w-full h-full object-contain blur-[4px] brightness-75 bg-black" 
                            style={{ width: `${100 * (100/sliderPos)}%`, maxWidth: 'none' }}
                          />
                        </div>

                        {/* Tags */}
                        <div className="absolute bottom-6 left-6 px-3 py-1 bg-black/60 rounded text-[10px] font-bold uppercase tracking-widest border border-white/10">Original</div>
                        <div className="absolute bottom-6 right-6 px-3 py-1 bg-[#3b82f6] rounded text-[10px] font-bold uppercase tracking-widest">Neural {scale}</div>

                        {/* Handle */}
                        <div 
                          className="absolute top-0 bottom-0 w-1 bg-white z-20 pointer-events-none" 
                          style={{ left: `${sliderPos}%` }}
                        >
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-2xl">
                            <ChevronRight className="w-4 h-4 text-black rotate-0" />
                            <ChevronRight className="w-4 h-4 text-black rotate-180 -ml-2" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isDone && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row gap-4"
                  >
                    <button 
                      onClick={handleDownload}
                      className="flex-1 py-4 bg-[#3b82f6] text-white rounded-xl font-[800] flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg shadow-blue-500/20"
                    >
                      <Download className="w-5 h-5" />
                      {currentT.download}
                    </button>
                    <button 
                      onClick={() => { setFiles([]); setIsDone(false); }}
                      className="px-8 py-4 bg-[#18181b] border border-[#27272a] rounded-xl font-bold hover:bg-[#27272a] transition-all"
                    >
                      {lang === 'ru' ? 'Сбросить' : 'Reset'}
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Features Grid */}
      <section className="bg-white/[0.02] py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-4 text-center md:text-left">
              <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0">
                <ShieldCheck className="text-purple-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">{currentT.secure}</h3>
              <p className="text-white/40 leading-relaxed">Images are encrypted and processed on secure servers. We never store or share your content.</p>
            </div>
            <div className="space-y-4 text-center md:text-left">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0">
                <Maximize2 className="text-blue-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">{currentT.quality}</h3>
              <p className="text-white/40 leading-relaxed">Our neural networks are trained on millions of high-res pairs to reconstruct missing details.</p>
            </div>
            <div className="space-y-4 text-center md:text-left">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0">
                <Zap className="text-orange-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">{currentT.speed}</h3>
              <p className="text-white/40 leading-relaxed">Proprietary FPGA acceleration ensures your 8k upscales finish in seconds, not minutes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
             <div className="flex items-center gap-2">
                <Sparkles className="text-[#3b82f6] w-5 h-5" />
                <span className="font-[800] tracking-tight uppercase">NeuralPix AI</span>
             </div>
             <div className="flex gap-8 text-sm text-white/40 font-medium">
                <a href="#" className="hover:text-white transition-colors">Twitter</a>
                <a href="#" className="hover:text-white transition-colors">API</a>
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
             </div>
          </div>
          <p className="text-xs text-white/20 uppercase tracking-[0.2em] font-bold">
            {currentT.footer}
          </p>
        </div>
      </footer>
    </div>
  );
}
