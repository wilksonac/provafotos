import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const normalizePhotoName = (name = '') => String(name).trim().toLowerCase();

const computeFileHash = async (file) => {
  try {
    if (!file || typeof crypto === 'undefined' || !crypto.subtle) return null;
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('[UPLOAD] Não foi possível calcular hash do arquivo:', file?.name, err);
    return null;
  }
};

export default function UploadQueue({
  eventId = 'mock_event_123',
  categories = [],
  existingPhotos = [],
  onUploadSuccess,
  onFinished
}) {
  const [queue, setQueue] = useState([]);
  const [concurrencyLimit, setConcurrencyLimit] = useState(5);
  const [useMock, setUseMock] = useState(!storage); 
  const [isDragging, setIsDragging] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const combinedCategories = useMemo(() => {
    const list = [...(categories || [])];
    if (!list.some(c => c.toLowerCase() === 'destaques' || c.toLowerCase() === 'destaque')) {
      list.unshift('Destaques');
    }
    if (!list.some(c => c.toLowerCase() === 'geral')) {
      list.push('Geral');
    }
    return list;
  }, [categories]);

  const [batchCategory, setBatchCategory] = useState(categories[0] || '');
  const [batchDestaque, setBatchDestaque] = useState(false);

  useEffect(() => {
    if (combinedCategories && combinedCategories.length > 0 && !batchCategory) {
      setBatchCategory(combinedCategories[0]);
    }
  }, [combinedCategories]);

  const uploadTasksRef = useRef({});
  const queueRef = useRef([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const updateFileState = useCallback((id, updates) => {
    setQueue((prevQueue) =>
      prevQueue.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const simulateUpload = useCallback((item) => {
    let progress = 0;
    const totalBytes = item.totalBytes;
    
    let localDataUrl = '';
    
    // Converte e comprime imagens reais para Base64 leve, protegendo o LocalStorage contra estouro de cota
    if (item.file && item.file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800; // Dimensão máxima recomendada para exibição web rápida
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Exporta em JPEG de qualidade 0.6. Um arquivo de 10MB cai para cerca de ~35KB!
          localDataUrl = canvas.toDataURL('image/jpeg', 0.6);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(item.file);
    }
    
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        updateFileState(item.id, {
          status: 'completed',
          progress: 100,
          bytesTransferred: totalBytes
        });
        
        if (onUploadSuccess) {
          // Se a conversão do leitor terminou, envia o Base64 real da foto arrastada.
          // Se falhar ou demorar, envia uma foto Picsum de fallback.
          const finalUrl = localDataUrl || `https://picsum.photos/seed/${item.id}/800/600`;
          onUploadSuccess({
            id: item.id,
            name: item.name,
            url: finalUrl,
            size: item.totalBytes,
            originalSize: item.size,
            hash: item.hash || null,
            forceDuplicate: !!item.forceDuplicate,
            cena: item.categoria || '',
            destaque: !!item.destaque
          });
        }
      } else {
        updateFileState(item.id, {
          progress,
          bytesTransferred: Math.floor((progress / 100) * totalBytes)
        });
      }
    }, 250); // Levemente mais rápido para uma melhor experiência de teste

    uploadTasksRef.current[item.id] = {
      cancel: () => {
        clearInterval(interval);
        updateFileState(item.id, { status: 'failed', error: 'Upload cancelado pelo fotógrafo' });
      }
    };
  }, [updateFileState, onUploadSuccess]);

const compressImage = (file) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 1200; // Resolução otimizada para visualização rápida no site
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                blob.name = file.name;
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.7
          );
        } catch (e) {
          console.error("Erro na compressão local da imagem:", e);
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

  const realFirebaseUpload = useCallback(async (item) => {
    if (!storage || !ref || !uploadBytesResumable || !getDownloadURL) {
      updateFileState(item.id, {
        status: 'failed',
        error: "Firebase Storage não configurado."
      });
      return;
    }

    try {
      // Mostra progresso inicial indicando compressão
      updateFileState(item.id, { status: 'uploading', progress: 5 });
      
      console.log(`[UPLOAD] Comprimindo imagem localmente: ${item.name}`);
      const fileToUpload = await compressImage(item.file);
      console.log(`[UPLOAD] Compressão concluída: ${formatBytes(item.file.size)} -> ${formatBytes(fileToUpload.size)}`);

      const storageRef = ref(storage, `eventos/${eventId}/${Date.now()}_${item.name}`);
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload);
      
      uploadTasksRef.current[item.id] = uploadTask;

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          updateFileState(item.id, {
            progress: Math.max(5, progress), // Garante que a barra ande
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes
          });
        },
        (error) => {
          console.error(`[UPLOAD] ❌ Falha no envio de ${item.name}:`, error);
          updateFileState(item.id, {
            status: 'failed',
            error: error.message
          });
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            updateFileState(item.id, {
              status: 'completed',
              progress: 100,
              url: downloadURL
            });
            if (onUploadSuccess) {
              onUploadSuccess({
                id: item.id,
                name: item.name,
                url: downloadURL,
                size: fileToUpload.size,
                originalSize: item.size,
                hash: item.hash || null,
                forceDuplicate: !!item.forceDuplicate,
                cena: item.categoria || '',
                destaque: !!item.destaque
              });
            }
          });
        }
      );
    } catch (err) {
      console.error(`[UPLOAD] ❌ Erro inesperado em ${item.name}:`, err);
      updateFileState(item.id, {
        status: 'failed',
        error: err.message
      });
    }
  }, [eventId, updateFileState, onUploadSuccess]);

  const startUpload = useCallback((item) => {
    updateFileState(item.id, { status: 'uploading' });
    if (useMock) {
      simulateUpload(item);
    } else {
      realFirebaseUpload(item);
    }
  }, [useMock, updateFileState, simulateUpload, realFirebaseUpload]);

  useEffect(() => {
    const activeUploads = queue.filter((item) => item.status === 'uploading');
    
    if (activeUploads.length >= concurrencyLimit) {
      return;
    }

    const nextIdleItem = queue.find((item) => item.status === 'idle');
    if (nextIdleItem) {
      startUpload(nextIdleItem);
    }
  }, [queue, concurrencyLimit, startUpload]);

  const addFilesToQueue = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setIsCheckingDuplicates(true);
    try {
      const existingNames = new Set(
        (existingPhotos || []).map((p) => normalizePhotoName(p?.name)).filter(Boolean)
      );
      const existingHashes = new Set(
        (existingPhotos || []).map((p) => p?.hash).filter(Boolean)
      );

      const currentActiveQueue = (queueRef.current || []).filter(
        (item) => item.status !== 'failed' && item.status !== 'duplicate'
      );
      const queuedNames = new Set(
        currentActiveQueue.map((item) => normalizePhotoName(item.name)).filter(Boolean)
      );
      const queuedHashes = new Set(
        currentActiveQueue.map((item) => item.hash).filter(Boolean)
      );

      const batchNames = new Set();
      const batchHashes = new Set();
      const newItems = [];

      for (const file of files) {
        const normalizedName = normalizePhotoName(file.name);
        const fileHash = await computeFileHash(file);

        let duplicateReason = null;
        if (fileHash && existingHashes.has(fileHash)) {
          duplicateReason = 'Arquivo idêntico já existe na galeria';
        } else if (normalizedName && existingNames.has(normalizedName)) {
          duplicateReason = 'Já existe na galeria (mesmo nome)';
        } else if (fileHash && (queuedHashes.has(fileHash) || batchHashes.has(fileHash))) {
          duplicateReason = 'Arquivo idêntico já está na fila';
        } else if (normalizedName && (queuedNames.has(normalizedName) || batchNames.has(normalizedName))) {
          duplicateReason = 'Já está na fila de upload';
        }

        if (!duplicateReason) {
          if (normalizedName) batchNames.add(normalizedName);
          if (fileHash) batchHashes.add(fileHash);
        }

        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          file: file,
          hash: fileHash,
          progress: 0,
          bytesTransferred: 0,
          totalBytes: file.size,
          status: duplicateReason ? 'duplicate' : 'idle',
          duplicateReason,
          forceDuplicate: false,
          error: null,
          categoria: batchCategory,
          destaque: batchDestaque
        });
      }

      setQueue((prev) => [...prev, ...newItems]);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
    }
    e.target.value = '';
  };

  const cancelUpload = (id) => {
    if (uploadTasksRef.current[id]) {
      uploadTasksRef.current[id].cancel();
      delete uploadTasksRef.current[id];
    }
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const forceUploadDuplicate = (id) => {
    updateFileState(id, {
      status: 'idle',
      duplicateReason: null,
      forceDuplicate: true
    });
  };

  const clearDuplicates = () => {
    setQueue((prev) => prev.filter((item) => item.status !== 'duplicate'));
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status !== 'completed'));
  };

  const duplicateFiles = queue.filter((item) => item.status === 'duplicate').length;
  const uploadableItems = queue.filter((item) => item.status !== 'duplicate');
  const totalFiles = uploadableItems.length;
  const completedFiles = uploadableItems.filter((item) => item.status === 'completed').length;
  const failedFiles = uploadableItems.filter((item) => item.status === 'failed').length;

  const totalBytes = uploadableItems.reduce((acc, item) => acc + item.totalBytes, 0);
  const totalTransferred = uploadableItems.reduce((acc, item) => acc + item.bytesTransferred, 0);
  const globalProgress = totalBytes > 0 ? Math.round((totalTransferred / totalBytes) * 100) : 0;

  const isUploadFinished =
    queue.length > 0 &&
    !isCheckingDuplicates &&
    queue.every((item) => item.status === 'completed' || item.status === 'failed' || item.status === 'duplicate');
  const onlyDuplicates = isUploadFinished && totalFiles === 0 && duplicateFiles > 0;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white border border-stone-200 rounded-xl shadow-lg text-stone-900 font-sans animate-scale-in">
      
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-stone-200/60 pb-4">
        <div>
          <span className="text-[9px] uppercase tracking-widest text-stone-500 font-bold px-2 py-0.5 bg-stone-100 border border-stone-200 rounded-md">
            Fotógrafo Admin
          </span>
          <h2 className="text-lg font-bold tracking-tight text-stone-900 mt-1">
            Fila de Upload Inteligente
          </h2>
        </div>
      </div>

      {/* Batch Controls */}
      {!isUploadFinished && (
        <div className="flex flex-wrap gap-4 p-3 bg-stone-50 border border-stone-200 rounded-lg mb-4 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500">
              Categoria do lote:
            </label>
            <select
              value={batchCategory}
              onChange={(e) => {
                const newCat = e.target.value;
                setBatchCategory(newCat);
                const isDest = newCat.toLowerCase() === 'destaques' || newCat.toLowerCase() === 'destaque';
                if (isDest && !batchDestaque) {
                  setBatchDestaque(true);
                }
                // Atualiza todos os arquivos ociosos na fila com esta categoria
                setQueue(prev => prev.map(item => item.status === 'idle' ? { 
                  ...item, 
                  categoria: newCat,
                  destaque: isDest ? true : item.destaque
                } : item));
              }}
              className="px-2.5 py-1 border border-stone-250 rounded bg-white text-xs focus:outline-none focus:border-stone-900 cursor-pointer"
            >
              <option value="">Sem categoria (Geral)</option>
              {combinedCategories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center pt-4">
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={batchDestaque}
                onChange={(e) => {
                  const newDest = e.target.checked;
                  setBatchDestaque(newDest);
                  // Atualiza todos os arquivos ociosos na fila com este destaque
                  setQueue(prev => prev.map(item => item.status === 'idle' ? { ...item, destaque: newDest } : item));
                }}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-stone-200 border border-stone-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-stone-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-stone-900 peer-checked:after:bg-white"></div>
              <span className="ml-2 text-[10px] font-bold text-stone-755 uppercase tracking-widest">Lote como Destaque (Capa)</span>
            </label>
          </div>
        </div>
      )}

      {/* Conditionally Render Success Message or Drag & Drop Area */}
      {isUploadFinished ? (
        onlyDuplicates ? (
          <div className="mb-5 p-5 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-250 flex items-center justify-center mx-auto text-amber-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif-editorial text-lg text-amber-900 font-medium">
                {duplicateFiles === 1 ? 'Foto duplicada ignorada' : `${duplicateFiles} fotos duplicadas ignoradas`}
              </h3>
              <p className="text-xs text-amber-800/80 mt-1 max-w-md mx-auto leading-relaxed">
                Todas as fotos selecionadas já existem nesta galeria e foram ignoradas automaticamente. Caso queira enviar alguma mesmo assim, clique em <strong>Enviar mesmo assim</strong> na lista abaixo.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  setQueue([]);
                  setBatchDestaque(false);
                }}
                className="px-4 py-2 border border-amber-300 text-amber-900 rounded text-xs font-bold uppercase tracking-widest hover:bg-amber-100/60 transition-colors"
              >
                Selecionar Outras Fotos
              </button>
              {onFinished && (
                <button
                  onClick={onFinished}
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-850 text-white rounded text-xs font-bold uppercase tracking-widest transition-all shadow"
                >
                  Finalizar Processo
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-5 p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-250 flex items-center justify-center mx-auto text-emerald-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif-editorial text-lg text-emerald-900 font-medium">Lote de Upload Concluído!</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
                {duplicateFiles > 0
                  ? `${completedFiles} foto(s) nova(s) enviada(s) com sucesso. ${duplicateFiles} duplicada(s) já existente(s) foram ignoradas automaticamente.`
                  : 'Todas as fotos foram carregadas, otimizadas e integradas com sucesso à galeria de seleção.'}
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  setQueue([]);
                  setBatchDestaque(false);
                }}
                className="px-4 py-2 border border-emerald-200 text-emerald-800 rounded text-xs font-bold uppercase tracking-widest hover:bg-emerald-100/50 transition-colors"
              >
                Subir Mais Fotos
              </button>
              {onFinished && (
                <button
                  onClick={onFinished}
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-850 text-white rounded text-xs font-bold uppercase tracking-widest transition-all shadow"
                >
                  Finalizar Processo
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all duration-350 cursor-pointer ${
            isDragging
              ? 'border-stone-900 bg-stone-50/80 scale-[0.99]'
              : 'border-stone-300 hover:border-stone-400 bg-stone-50/20'
          }`}
        >
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />

          <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200/60 flex items-center justify-center text-stone-600 mb-3">
            <svg className="w-5 h-5 text-stone-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          
          <p className="text-xs font-bold text-stone-800 tracking-wider text-center">
            {isCheckingDuplicates
              ? 'Verificando fotos duplicadas...'
              : (
                <>
                  Arraste e solte fotos ou <span className="text-stone-600 underline">procure em seu dispositivo</span>
                </>
              )}
          </p>
          <p className="text-[10px] text-stone-400 mt-1 font-medium">
            Fotos já existentes nesta galeria são detectadas e ignoradas automaticamente
          </p>
        </div>
      )}

      {/* Aviso de Duplicadas Detectadas */}
      {duplicateFiles > 0 && !onlyDuplicates && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-amber-900 font-medium">
            ⚠️ <strong>{duplicateFiles}</strong> {duplicateFiles === 1 ? 'foto duplicada foi ignorada' : 'fotos duplicadas foram ignoradas'} por já {duplicateFiles === 1 ? 'existir' : 'existirem'} na galeria ou na fila.
          </span>
          <button
            type="button"
            onClick={clearDuplicates}
            className="text-[10px] font-bold uppercase tracking-wider text-amber-800 hover:text-amber-950 underline"
          >
            Ocultar duplicadas
          </button>
        </div>
      )}

      {/* Global Progress Dashboard */}
      {queue.length > 0 && (
        <div className="mt-5 p-3.5 bg-stone-50/50 border border-stone-200 rounded-lg animate-scale-in">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Progresso Geral</span>
              <span className="text-xs font-bold text-stone-900 ml-2">
                ({completedFiles} de {totalFiles} {totalFiles === 1 ? 'enviado' : 'enviados'})
              </span>
            </div>
            
            <div className="flex items-center gap-2.5 flex-wrap">
              {duplicateFiles > 0 && (
                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  {duplicateFiles} {duplicateFiles === 1 ? 'duplicada ignorada' : 'duplicadas ignoradas'}
                </span>
              )}
              {failedFiles > 0 && (
                <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                  {failedFiles} falhas
                </span>
              )}
              {totalFiles > 0 && completedFiles === totalFiles && (
                <button
                  onClick={clearCompleted}
                  className="text-[10px] font-bold text-stone-900 hover:underline"
                >
                  Limpar Concluídos
                </button>
              )}
            </div>
          </div>
          
          <div className="w-full bg-stone-100 rounded-full h-1 overflow-hidden border border-stone-200/50">
            <div
              className="bg-stone-900 h-full transition-all duration-300"
              style={{ width: `${globalProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* File List */}
      {queue.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2.5">Fila de Arquivos</h3>
          
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
            {queue.map((item) => {
              const isUploading = item.status === 'uploading';
              const isDone = item.status === 'completed';
              const isFailed = item.status === 'failed';
              const isIdle = item.status === 'idle';
              const isDuplicate = item.status === 'duplicate';

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3.5 p-2.5 rounded-lg transition-all duration-200 animate-scale-in ${
                    isDuplicate
                      ? 'bg-amber-50/70 border border-amber-200/80'
                      : 'bg-stone-50/30 border border-stone-200/40 hover:bg-stone-50/70'
                  }`}
                >
                  {/* Photo Preview */}
                  <div className="w-10 h-10 rounded bg-stone-100 border border-stone-200/60 flex items-center justify-center flex-shrink-0 text-stone-400 overflow-hidden relative">
                    {item.file && useMock ? (
                      <img
                        src={URL.createObjectURL(item.file)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-stone-900/10 flex items-center justify-center">
                        <div className="w-3.5 h-3.5 border border-stone-900 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-stone-800 truncate pr-3">{item.name}</span>
                      <span className="text-[9px] text-stone-400 font-bold">{formatBytes(item.size)}</span>
                    </div>
                    {isFailed && item.error && (
                      <div className="text-[9px] text-red-500 font-medium mb-1 line-clamp-2">
                        Erro: {item.error}
                      </div>
                    )}
                    {isDuplicate && (
                      <div className="text-[9.5px] text-amber-800 font-medium mb-1 flex items-center gap-2 flex-wrap">
                        <span>⚠️ {item.duplicateReason || 'Foto já existe na galeria'}</span>
                        <button
                          type="button"
                          onClick={() => forceUploadDuplicate(item.id)}
                          className="text-[9px] font-bold uppercase tracking-wider text-amber-900 underline hover:text-stone-900"
                        >
                          Enviar mesmo assim
                        </button>
                      </div>
                    )}

                    {/* Controles de Categoria e Destaque Individuais para Itens na Fila */}
                    {isIdle && (
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-bold text-stone-400 uppercase tracking-wider">Aba:</span>
                          <select
                            value={item.categoria || ''}
                            onChange={(e) => updateFileState(item.id, { categoria: e.target.value })}
                            className="px-1.5 py-0.5 border border-stone-200 rounded bg-white text-[9px] focus:outline-none cursor-pointer"
                          >
                            <option value="">Sem categoria</option>
                            {categories.map((cat, idx) => (
                              <option key={idx} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        
                        <label className="flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!item.destaque}
                            onChange={(e) => updateFileState(item.id, { destaque: e.target.checked })}
                            className="w-3 h-3 text-stone-900 border-stone-300 rounded focus:ring-0 mr-1"
                          />
                          <span className="text-[9px] font-semibold text-stone-500 uppercase tracking-wider">Capa</span>
                        </label>
                      </div>
                    )}

                    {/* Visualização da categoria/destaque salvos durante e após o upload */}
                    {(isUploading || isDone) && (
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {item.categoria && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-stone-100 text-stone-600 rounded border border-stone-200/50">
                            📁 {item.categoria}
                          </span>
                        )}
                        {item.destaque && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded border border-amber-205">
                            ★ Capa
                          </span>
                        )}
                      </div>
                    )}

                    {!isDuplicate && (
                      <div className="flex items-center gap-2">
                        <div className="flex-grow bg-stone-100 rounded-full h-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isDone
                                ? 'bg-stone-900'
                                : isFailed
                                ? 'bg-red-500'
                                : 'bg-stone-600'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[9px] font-bold text-stone-400 min-w-[20px] text-right">
                          {item.progress}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isDuplicate && (
                      <span className="text-[8px] font-bold uppercase tracking-wider text-amber-800 px-1.5 py-0.5 bg-amber-100 border border-amber-200 rounded">
                        Duplicada
                      </span>
                    )}
                    {isIdle && (
                      <span className="text-[8px] font-bold uppercase tracking-wider text-stone-400 px-1.5 py-0.5 bg-stone-100 rounded">
                        Fila
                      </span>
                    )}
                    {isUploading && (
                      <span className="text-[8px] font-bold uppercase tracking-wider text-stone-600 px-1.5 py-0.5 bg-stone-100 rounded animate-pulse">
                        Enviando
                      </span>
                    )}
                    {isDone && (
                      <div className="text-stone-900">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    
                    {!isDone && (
                      <button
                        onClick={() => cancelUpload(item.id)}
                        className="text-stone-400 hover:text-stone-650 p-0.5 rounded transition-colors"
                        title="Cancelar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
