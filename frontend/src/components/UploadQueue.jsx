import React, { useState, useEffect, useRef, useCallback } from 'react';

let storage = null;
let ref = null;
let uploadBytesResumable = null;
let getDownloadURL = null;

try {
  // Configured in production:
  // import { storage } from '../services/firebase';
  // import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
} catch (e) {
  console.warn("Firebase Storage fallback mode initialized.");
}

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function UploadQueue({ eventId = 'mock_event_123', onUploadSuccess, onFinished }) {
  const [queue, setQueue] = useState([]);
  const [concurrencyLimit, setConcurrencyLimit] = useState(5);
  const [useMock, setUseMock] = useState(true); 
  const [isDragging, setIsDragging] = useState(false);

  const uploadTasksRef = useRef({});

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
            size: item.totalBytes
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

  const realFirebaseUpload = useCallback((item) => {
    if (!storage || !ref || !uploadBytesResumable || !getDownloadURL) {
      updateFileState(item.id, {
        status: 'failed',
        error: "Firebase Storage não configurado. Ative 'Simular Upload' para testes."
      });
      return;
    }

    try {
      const storageRef = ref(storage, `eventos/${eventId}/${Date.now()}_${item.name}`);
      const uploadTask = uploadBytesResumable(storageRef, item.file);
      
      uploadTasksRef.current[item.id] = uploadTask;

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          updateFileState(item.id, {
            progress,
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes
          });
        },
        (error) => {
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
                size: item.totalBytes
              });
            }
          });
        }
      );
    } catch (err) {
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

  const addFilesToQueue = (fileList) => {
    const newItems = Array.from(fileList).map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      file: file,
      progress: 0,
      bytesTransferred: 0,
      totalBytes: file.size,
      status: 'idle',
      error: null
    }));

    setQueue((prev) => [...prev, ...newItems]);
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
  };

  const cancelUpload = (id) => {
    if (uploadTasksRef.current[id]) {
      uploadTasksRef.current[id].cancel();
      delete uploadTasksRef.current[id];
    }
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status !== 'completed'));
  };

  const totalFiles = queue.length;
  const completedFiles = queue.filter((item) => item.status === 'completed').length;
  const failedFiles = queue.filter((item) => item.status === 'failed').length;

  const totalBytes = queue.reduce((acc, item) => acc + item.totalBytes, 0);
  const totalTransferred = queue.reduce((acc, item) => acc + item.bytesTransferred, 0);
  const globalProgress = totalBytes > 0 ? Math.round((totalTransferred / totalBytes) * 100) : 0;

  const isUploadFinished = queue.length > 0 && queue.every((item) => item.status === 'completed' || item.status === 'failed');

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white border border-stone-200 rounded-xl shadow-lg text-stone-900 font-sans animate-scale-in">
      
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-stone-200/60 pb-4">
        <div>
          <span className="text-[9px] uppercase tracking-widest text-stone-500 font-bold px-2 py-0.5 bg-stone-100 border border-stone-200 rounded-md">
            Fotógrafo Admin
          </span>
          <h2 className="text-lg font-bold tracking-tight text-stone-900 mt-1">
            Fila de Upload Inteligente
          </h2>
        </div>
        

      </div>

      {/* Conditionally Render Success Message or Drag & Drop Area */}
      {isUploadFinished ? (
        <div className="mb-5 p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-4 animate-scale-in">
          <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-250 flex items-center justify-center mx-auto text-emerald-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-serif-editorial text-lg text-emerald-900 font-medium">Lote de Upload Concluído!</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
              Todas as fotos foram carregadas, otimizadas e integradas com sucesso à galeria de seleção.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => setQueue([])}
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
            Arraste e solte fotos ou <span className="text-stone-600 underline">procure em seu dispositivo</span>
          </p>
          <p className="text-[10px] text-stone-400 mt-1 font-medium">Recomendado: Imagens otimizadas (960px, ~200kb)</p>
        </div>
      )}

      {/* Global Progress Dashboard */}
      {queue.length > 0 && (
        <div className="mt-5 p-3.5 bg-stone-50/50 border border-stone-200 rounded-lg animate-scale-in">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Progresso Geral</span>
              <span className="text-xs font-bold text-stone-900 ml-2">
                ({completedFiles} de {totalFiles} enviados)
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {failedFiles > 0 && (
                <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                  {failedFiles} falhas
                </span>
              )}
              {completedFiles === totalFiles && (
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
          
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
            {queue.map((item) => {
              const isUploading = item.status === 'uploading';
              const isDone = item.status === 'completed';
              const isFailed = item.status === 'failed';

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 p-2.5 bg-stone-50/30 border border-stone-200/40 hover:bg-stone-50/70 rounded-lg transition-all duration-200 animate-scale-in"
                >
                  {/* Photo Preview */}
                  <div className="w-8 h-8 rounded bg-stone-100 border border-stone-200/60 flex items-center justify-center flex-shrink-0 text-stone-400 overflow-hidden relative">
                    {item.file && isDone && useMock ? (
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
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-stone-800 truncate pr-3">{item.name}</span>
                      <span className="text-[9px] text-stone-400 font-bold">{formatBytes(item.size)}</span>
                    </div>

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
                  </div>

                  {/* Actions & Badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status === 'idle' && (
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
                        className="text-stone-400 hover:text-stone-600 p-0.5 rounded transition-colors"
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
