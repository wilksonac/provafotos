import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';

// Gerador de fotos fictícias com semente única baseada no ID do evento.
// Isso garante que cada galeria nova tenha fotos totalmente distintas e exclusivas.
const generateMockPhotos = (count, eventId) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `photo_${i}`,
    name: `FOTO_${(i + 1).toString().padStart(4, '0')}.jpg`,
    url_storage: `https://picsum.photos/seed/${eventId}_img_${i}/800/600`,
    selecionada: false
  }));
};

const GridCell = React.memo(({ columnIndex, rowIndex, style, data }) => {
  const { 
    photos, 
    columns, 
    columnWidth, 
    gap, 
    currentStatus, 
    handlePhotoClick, 
    handleImageClick,
    marcaDaguaAtiva,
    marcaDaguaTexto,
    marcaDaguaOpacidade,
    marcaDaguaMiniaturas,
    marcaDaguaEstilo
  } = data;
  
  const index = rowIndex * columns + columnIndex;
  
  if (index >= photos.length) return null;
  const photo = photos[index];

  const isFirstCol = columnIndex === 0;
  
  const adjustedStyle = {
    ...style,
    left: style.left + (isFirstCol ? 0 : gap / 2),
    width: columnWidth,
    paddingBottom: gap,
    boxSizing: 'border-box'
  };

  const isSelected = photo.selecionada;
  const isLocked = currentStatus !== 'ativa';

  const handleHeartClick = (e) => {
    e.stopPropagation(); // Impede de abrir a foto no Lightbox
    handlePhotoClick(photo.id);
  };

  return (
    <div 
      style={adjustedStyle} 
      className="p-1"
      onClick={() => {
        console.log(`[GRID_CELL] Célula clicada no índice ${index}, abrindo Lightbox.`);
        handleImageClick(index); // Abre a foto no Lightbox
      }}
    >
      <div
        className={`group relative flex flex-col h-full bg-[#F5F4EE] overflow-hidden transition-all duration-350 cursor-pointer ${
          isSelected
            ? 'ring-1 ring-stone-900'
            : 'hover:opacity-95'
        }`}
      >
        {/* Imagem */}
        <div className="relative w-full aspect-[4/3] flex-grow bg-stone-100 overflow-hidden">
          <img
            src={photo.url_storage}
            alt={photo.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
          
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Marca D'água nas Miniaturas */}
          {marcaDaguaAtiva && marcaDaguaMiniaturas && (
            <div 
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-10"
              style={{ opacity: marcaDaguaOpacidade / 100 }}
            >
              {/* Linhas Cruzadas (SVG de acordo com o estilo selecionado) */}
              {marcaDaguaEstilo === 'media' ? (
                <svg className="absolute inset-0 w-full h-full text-white/35" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.4" />
                  <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.4" />
                  <line x1="0" y1="30" x2="70" y2="100" stroke="currentColor" strokeWidth="0.35" strokeDasharray="2, 2" />
                  <line x1="30" y1="0" x2="100" y2="70" stroke="currentColor" strokeWidth="0.35" strokeDasharray="2, 2" />
                  <line x1="100" y1="30" x2="30" y2="100" stroke="currentColor" strokeWidth="0.35" strokeDasharray="2, 2" />
                  <line x1="70" y1="0" x2="0" y2="70" stroke="currentColor" strokeWidth="0.35" strokeDasharray="2, 2" />
                </svg>
              ) : marcaDaguaEstilo === 'pesada' ? (
                <svg className="absolute inset-0 w-full h-full text-white/35" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.4" />
                  <line x1="0" y1="25" x2="75" y2="100" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="0" y1="50" x2="50" y2="100" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="0" y1="75" x2="25" y2="100" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="25" y1="0" x2="100" y2="75" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="50" y1="0" x2="100" y2="50" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="75" y1="0" x2="100" y2="25" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.4" />
                  <line x1="100" y1="25" x2="25" y2="100" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="100" y1="50" x2="50" y2="100" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="100" y1="75" x2="75" y2="100" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="75" y1="0" x2="0" y2="75" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="50" y1="0" x2="0" y2="50" stroke="currentColor" strokeWidth="0.3" />
                  <line x1="25" y1="0" x2="0" y2="25" stroke="currentColor" strokeWidth="0.3" />
                </svg>
              ) : (
                <svg className="absolute inset-0 w-full h-full text-white/35" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.4" />
                  <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.4" />
                </svg>
              )}
              
              {/* Texto Central */}
              <div className="relative font-serif-editorial text-[9px] sm:text-[10px] tracking-[0.15em] uppercase text-white font-normal bg-black/25 px-2.5 py-1 border border-white/10 rotate-12 whitespace-nowrap shadow-sm z-20">
                {marcaDaguaTexto}
              </div>
            </div>
          )}

          {/* Indicador de Seleção / Coração no Canto */}
          {!isLocked && (
            <div className="absolute top-3 right-3 transition-opacity duration-300 z-10">
              <button
                type="button"
                onClick={handleHeartClick}
                className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-md'
                    : 'bg-white/75 hover:bg-white text-stone-600 hover:text-stone-900 opacity-0 group-hover:opacity-100'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill={isSelected ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          )}

          {/* Número Identificador */}
          <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-black/40 backdrop-blur-sm rounded text-[9px] font-medium text-white tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            {(index + 1).toString().padStart(4, '0')}
          </span>
        </div>

        {/* Rodapé minimalista */}
        <div className="px-2.5 py-2 flex items-center justify-between bg-white border-t border-stone-100 z-10">
          <span className="text-[10px] font-medium tracking-widest text-stone-500 uppercase truncate">
            {photo.name}
          </span>
          {isSelected && (
            <span className="text-[9px] font-bold text-stone-900 uppercase tracking-widest animate-pulse">
              Selecionada
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default function PhotoVirtualGrid({
  eventId = 'event_abc',
  initialPhotos = [],
  limiteFotos = 25,
  statusEvento = 'ativa',
  permitirExtras = false,
  selecaoLivre = false,
  valorFotoExtra = null,
  marcaDaguaAtiva = true,
  marcaDaguaTexto = 'WILKSON FOTOGRAFIAS',
  marcaDaguaOpacidade = 30,
  marcaDaguaMiniaturas = true,
  marcaDaguaExpandida = true,
  marcaDaguaEstilo = 'leve',
  tipoGaleria = 'ensaio',
  permitirDownload = true,
  pagamentoExtrasConfirmado = false,
  tituloEvent = 'Casamento Rafaela & Augusto',
  dataEvent = '18 de Junho de 2026',
  onToggleSelection,
  onFinalizeEvent,
  isDemo = true,
  isAdmin = false
}) {
  const [photos, setPhotos] = useState(() => {
    if (isDemo && initialPhotos.length === 0) {
      return generateMockPhotos(10000, eventId);
    }
    return initialPhotos;
  });

  const selectedCount = useMemo(() => {
    return photos.filter((p) => p.selecionada).length;
  }, [photos]);

  const [currentStatus, setCurrentStatus] = useState(statusEvento);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeScene, setActiveScene] = useState('Todas');
  
  // Estado para visualização de Lightbox
  const [activeLightboxIndex, setActiveLightboxIndex] = useState(null);

  const [scrollTop, setScrollTop] = useState(0);

  // Estados para simulação de download
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownloadZIP = useCallback(() => {
    setIsDownloading(true);
    setDownloadProgress(0);
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDownloading(false);
            alert(`Sucesso! Suas ${selectedCount} fotos favoritas foram baixadas em alta resolução (Arquivo .ZIP).`);
          }, 600);
          return 100;
        }
        return prev + Math.floor(Math.random() * 25) + 15;
      });
    }, 150);
  }, [selectedCount]);

  // Mapeamento dinâmico de imagem de capa premium baseado no tipo de galeria
  const coverImage = useMemo(() => {
    // Se o fotógrafo definiu uma imagem de destaque para a capa, use ela!
    const highlightedPhoto = (photos || []).find(p => p.destaque === true);
    if (highlightedPhoto) {
      return highlightedPhoto.url_storage;
    }

    switch (tipoGaleria) {
      case 'casamento':
        return 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1600&auto=format&fit=crop';
      case 'festa_infantil':
        return 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=1600&auto=format&fit=crop';
      case 'evento_corporativo':
        return 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1600&auto=format&fit=crop';
      case 'outros':
        return 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=1600&auto=format&fit=crop';
      case 'ensaio':
      default:
        return 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1600&auto=format&fit=crop';
    }
  }, [tipoGaleria, photos]);

  // Formata o rótulo legível da categoria
  const formattedCategory = useMemo(() => {
    switch (tipoGaleria) {
      case 'casamento': return 'Casamento';
      case 'festa_infantil': return 'Festa Infantil';
      case 'evento_corporativo': return 'Evento Corporativo';
      case 'outros': return 'Galeria Exclusiva';
      case 'ensaio':
      default:
        return 'Ensaio Fotográfico';
    }
  }, [tipoGaleria]);

  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: window.innerHeight
        });
      }
    };

    const observer = new ResizeObserver(() => handleResize());
    observer.observe(containerRef.current);
    handleResize();

    return () => observer.disconnect();
  }, []);

  const gridLayout = useMemo(() => {
    const gap = 16; 
    const minCardWidth = 240; 
    const containerWidth = dimensions.width;
    
    const columns = Math.max(1, Math.floor((containerWidth + gap) / (minCardWidth + gap)));
    const columnWidth = Math.floor((containerWidth - (columns - 1) * gap) / columns);
    const rowHeight = columnWidth * 0.75 + 38; 
    const rowCount = Math.ceil(photos.length / columns);

    return {
      columns,
      columnWidth,
      rowHeight,
      rowCount,
      gap
    };
  }, [dimensions.width, photos.length]);

  const handlePhotoClick = useCallback((photoId) => {
    console.log(`[PHOTO_CLICK] Favoritar foto ID: ${photoId}`);
    
    if (currentStatus !== 'ativa') {
      return;
    }

    setPhotos((prevPhotos) => {
      const currentSelectedCount = prevPhotos.filter((p) => p.selecionada).length;
      const targetPhoto = prevPhotos.find((p) => p.id === photoId);
      
      if (!targetPhoto) return prevPhotos;
      
      const nextState = !targetPhoto.selecionada;
      
      // Validação de Limite
      if (nextState && !selecaoLivre && limiteFotos && currentSelectedCount >= limiteFotos) {
        if (!permitirExtras) {
          alert(`Você atingiu o limite de seleção de ${limiteFotos} fotos.`);
          return prevPhotos;
        }
      }

      if (onToggleSelection) {
        onToggleSelection(photoId, nextState);
      }

      return prevPhotos.map((photo) => 
        photo.id === photoId ? { ...photo, selecionada: nextState } : photo
      );
    });
  }, [currentStatus, limiteFotos, selecaoLivre, permitirExtras, onToggleSelection]);

  const handleFinalize = () => {
    setCurrentStatus('finalizada');
    setShowConfirmModal(false);
    if (onFinalizeEvent) {
      onFinalizeEvent(eventId);
    }
  };

  // Keyboard navigation para o Lightbox
  useEffect(() => {
    if (activeLightboxIndex === null) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        setActiveLightboxIndex((prev) => (prev < photos.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft') {
        setActiveLightboxIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxIndex, photos.length]);

  const itemData = useMemo(() => ({
    photos,
    columns: gridLayout.columns,
    columnWidth: gridLayout.columnWidth,
    gap: gridLayout.gap,
    currentStatus,
    handlePhotoClick,
    handleImageClick: (index) => setActiveLightboxIndex(index),
    marcaDaguaAtiva,
    marcaDaguaTexto,
    marcaDaguaOpacidade,
    marcaDaguaMiniaturas,
    marcaDaguaEstilo
  }), [
    photos, 
    gridLayout.columns, 
    gridLayout.columnWidth, 
    gridLayout.gap, 
    currentStatus, 
    handlePhotoClick, 
    marcaDaguaAtiva, 
    marcaDaguaTexto, 
    marcaDaguaOpacidade, 
    marcaDaguaMiniaturas,
    marcaDaguaEstilo
  ]);

  const isLimitReached = !selecaoLivre && limiteFotos && selectedCount >= limiteFotos;
  const isDownloadBlocked = permitirDownload && !selecaoLivre && limiteFotos !== null && selectedCount > limiteFotos && !pagamentoExtrasConfirmado;

  // Formata data do padrão americano AAAA-MM-DD para o padrão brasileiro DD/MM/AAAA
  const formattedDate = useMemo(() => {
    if (!dataEvent) return '';
    const parts = dataEvent.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dataEvent;
  }, [dataEvent]);

  const activeLightboxPhoto = activeLightboxIndex !== null ? photos[activeLightboxIndex] : null;

  // Cálculos dinâmicos para colapso do cabeçalho cinematográfico no scroll
  const isMobile = dimensions.width < 640;
  const scrollFactor = Math.min(180, scrollTop);
  const maxCoverHeight = isMobile ? 180 : 320; // Começa menor no mobile para dar mais espaço
  const minCoverHeight = 60;
  const coverHeight = maxCoverHeight - (scrollFactor / 180) * (maxCoverHeight - minCoverHeight);
  const shrinkProgress = scrollFactor / 180;

  // Altura dinâmica do Grid descontando cabeçalho, abas e rodapé minimalista no celular
  const gridHeight = dimensions.height - coverHeight - (isMobile ? 107 : 78);

  return (
    <div className="w-full h-full flex flex-col bg-[#FAF9F6] text-stone-900 font-sans">
      
      {/* 1. Cinematic Gallery Cover (Título Dinâmico do Evento com Efeito Colapsável) */}
      <div 
        className="relative w-full overflow-hidden flex items-center justify-center flex-shrink-0 transition-all duration-75 ease-out border-b border-stone-200/40"
        style={{ height: `${coverHeight}px` }}
      >
        <img 
          src={coverImage} 
          alt="Cover" 
          className="absolute inset-0 w-full h-full object-cover" 
          style={{ 
            filter: `brightness(${0.72 - shrinkProgress * 0.2}) blur(${shrinkProgress * 6}px)`,
            transform: `scale(${1 + shrinkProgress * 0.05})`
          }} 
        />
        <div className="absolute inset-0 bg-stone-950/20" />
        <div className="relative z-10 text-center px-4 text-white flex flex-col items-center justify-center h-full w-full">
          {shrinkProgress < 0.65 ? (
            <div className="animate-fade-in space-y-1">
              <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.3em] font-medium opacity-90 mb-1 sm:mb-2">Wilkson Fotografias</p>
              <h1 className="font-serif-editorial text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.15em] mb-1 sm:mb-3 uppercase">
                {tituloEvent}
              </h1>
              <div className="w-8 h-[1px] bg-white/60 mx-auto my-2" />
              <p className="text-[9px] sm:text-xs uppercase tracking-[0.2em] font-light opacity-80">
                {formattedDate} &bull; {formattedCategory}
              </p>
            </div>
          ) : (
            <div className="animate-fade-in flex items-center justify-center gap-3 py-1">
              <span className="font-sans text-[8.5px] uppercase tracking-[0.2em] font-light opacity-80 border-r border-white/30 pr-3">Wilkson</span>
              <span className="font-serif-editorial text-xs sm:text-base tracking-[0.2em] font-light uppercase truncate max-w-[70vw]">
                {tituloEvent}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Scene Navigation Bar */}
      <div className="w-full bg-white border-b border-stone-200/80 px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none py-1 w-full sm:w-auto justify-start sm:justify-start">
          {['Todas', 'Destaques', 'Preparativos', 'Cerimônia', 'Recepção'].map((scene) => (
            <button
              key={scene}
              onClick={() => setActiveScene(scene)}
              className={`text-xs font-semibold uppercase tracking-widest pb-1 transition-all border-b-2 whitespace-nowrap ${
                activeScene === scene
                  ? 'border-stone-900 text-stone-950'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              {scene}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
            currentStatus === 'ativa'
              ? 'bg-stone-50 border-stone-200 text-stone-600'
              : 'bg-stone-900 border-stone-900 text-white'
          }`}>
            {currentStatus === 'ativa' ? 'Seleção aberta' : 'Seleção finalizada'}
          </span>
        </div>
      </div>

      {/* 3. Grid de Fotos Principal */}
      <div ref={containerRef} className="flex-grow px-2 sm:px-8 py-3 sm:py-6 overflow-hidden bg-[#FAF9F6]">
        {gridLayout.columns > 0 && photos.length > 0 ? (
          <Grid
            columnCount={gridLayout.columns}
            columnWidth={gridLayout.columnWidth}
            height={gridHeight}
            onScroll={({ scrollTop }) => setScrollTop(scrollTop)}
            rowCount={gridLayout.rowCount}
            rowHeight={gridLayout.rowHeight}
            width={dimensions.width}
            itemData={itemData}
            className="scrollbar-thin"
          >
            {GridCell}
          </Grid>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16 text-stone-400 font-serif-editorial">
            <p className="text-xl">Nenhuma imagem nesta seção.</p>
          </div>
        )}
      </div>

      {/* 4. Barra de Ação Flutuante Editorial (Jateada e Compacta no Mobile) */}
      <div className="fixed bottom-0 sm:bottom-6 left-0 sm:left-1/2 sm:-translate-x-1/2 w-full sm:w-[90%] sm:max-w-xl bg-white/85 backdrop-blur-md border-t sm:border border-stone-200/50 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] sm:shadow-xl sm:rounded-xl rounded-t-xl py-2.5 sm:py-4 px-4 sm:px-6 z-20 flex flex-row sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 animate-slide-up sm:animate-scale-in">
        <div className="flex-grow min-w-0">
          {isMobile ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 whitespace-nowrap">
                {currentStatus === 'ativa' ? 'Favoritas' : 'Escolhidas'}
              </span>
              <span className="text-sm font-extrabold text-stone-900 whitespace-nowrap">
                {selectedCount}<span className="text-stone-300 font-medium px-0.5">/</span>{limiteFotos || '∞'}
                {currentStatus === 'ativa' && permitirExtras && limiteFotos && selectedCount > limiteFotos && (
                  <span className="text-amber-600 font-bold ml-1 text-[10px]">
                    (+{selectedCount - limiteFotos})
                  </span>
                )}
              </span>
            </div>
          ) : (
            selecaoLivre ? (
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-455">Fotos Escolhidas</span>
                <span className="text-xs font-bold text-stone-950 uppercase tracking-wider">{selectedCount} selecionadas</span>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Favoritas</span>
                  <span className="text-xs font-bold text-stone-950 whitespace-nowrap">
                    {selectedCount} <span className="text-stone-400 font-medium">de</span> {limiteFotos}
                    {permitirExtras && selectedCount > limiteFotos && (
                      <span className="text-amber-600 font-extrabold ml-1">
                        {' '}
                        (+{selectedCount - limiteFotos} extras
                        {valorFotoExtra && valorFotoExtra > 0 && ` : R$ ${((selectedCount - limiteFotos) * valorFotoExtra).toFixed(2).replace('.', ',')}`}
                        )
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="w-full bg-stone-100 rounded-full h-1 overflow-hidden border border-stone-200/50">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isLimitReached && !permitirExtras ? 'bg-amber-600' : 'bg-stone-900'
                    }`}
                    style={{ width: `${Math.min(100, (selectedCount / (limiteFotos || 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )
          )}
        </div>

        {currentStatus === 'ativa' ? (
          <button
            onClick={() => selectedCount > 0 && setShowConfirmModal(true)}
            disabled={selectedCount === 0}
            className={`w-auto flex-shrink-0 px-5 py-2 sm:py-2.5 rounded text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
              selectedCount > 0
                ? 'bg-stone-900 hover:bg-stone-850 text-white hover:scale-[1.01] active:scale-95'
                : 'bg-stone-100 text-stone-300 cursor-not-allowed border border-stone-200'
            }`}
          >
            Enviar Seleção
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Botão de Avisar WhatsApp */}
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Oi! Finalizei a seleção das fotos da galeria "${tituloEvent}". Foram selecionadas ${selectedCount} fotos.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-1.5 shadow-sm active:scale-95 text-center justify-center flex-shrink-0"
            >
              💬 WhatsApp
            </a>

            {/* Download Button (If permitted) */}
            {permitirDownload && (
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <button
                  onClick={() => !isDownloadBlocked && !isDownloading && handleDownloadZIP()}
                  disabled={isDownloadBlocked || isDownloading}
                  className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                    isDownloadBlocked
                      ? 'bg-red-50 text-red-405 border border-red-150 cursor-not-allowed shadow-none'
                      : isDownloading
                      ? 'bg-stone-100 text-stone-500 border border-stone-200 cursor-not-allowed'
                      : 'bg-stone-900 hover:bg-stone-850 text-white hover:scale-[1.01] active:scale-95 shadow-sm'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {isDownloading ? `Baixando ${downloadProgress}%` : 'Baixar ZIP'}
                </button>
                {isDownloadBlocked && (
                  <span className="text-[7.5px] font-extrabold text-red-600 bg-red-50/50 px-2 py-0.5 rounded uppercase tracking-wider block max-w-[200px] text-right leading-tight border border-red-100/30">
                    Pgto pendente
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Modal de Confirmação Minimalista */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-xl max-w-sm w-full p-6 text-center shadow-2xl animate-scale-in">
            <h3 className="font-serif-editorial text-2xl font-light tracking-wide text-stone-900 mb-2">Finalizar Escolha</h3>
            <p className="text-xs text-stone-500 leading-relaxed uppercase tracking-wider mb-6">
              {selecaoLivre ? (
                <>Você selecionou <span className="text-stone-900 font-bold">{selectedCount}</span> fotos.</>
              ) : (
                <>
                  Você escolheu <span className="text-stone-900 font-bold">{selectedCount}</span> de <span className="text-stone-900 font-bold">{limiteFotos}</span> fotos.
                  {permitirExtras && selectedCount > limiteFotos && (
                    <span className="block mt-1.5 text-amber-600 font-bold">
                      Você escolheu {selectedCount - limiteFotos} fotos adicionais.
                      {valorFotoExtra && valorFotoExtra > 0 && ` Valor extra a pagar: R$ ${((selectedCount - limiteFotos) * valorFotoExtra).toFixed(2).replace('.', ',')}`}
                    </span>
                  )}
                </>
              )}
              <span className="block mt-2">Após enviar, a seleção não poderá ser alterada.</span>
            </p>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-stone-200 hover:bg-stone-50 rounded text-[10px] font-bold uppercase tracking-widest text-stone-500 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleFinalize}
                className="px-5 py-2 bg-stone-900 hover:bg-stone-850 text-white rounded text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                Confirmar e Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Lightbox Premium de Visualização Ampliada */}
      {activeLightboxIndex !== null && activeLightboxPhoto && (
        <div className="fixed inset-0 z-50 bg-stone-950/98 backdrop-blur-md flex flex-col justify-between text-white animate-fade-in select-none">
          
          {/* Top Header */}
          <div className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Visualização Ampliada</span>
              <h4 className="text-xs font-semibold tracking-wider text-stone-200 mt-0.5">{activeLightboxPhoto.name}</h4>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-stone-450 font-medium">
                {activeLightboxIndex + 1} de {photos.length}
              </span>
              <button
                onClick={() => setActiveLightboxIndex(null)}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                title="Fechar (ESC)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Central Image Container with Watermark */}
          <div className="relative flex-grow flex items-center justify-center p-4">
            {/* Left Arrow Button */}
            <button
              onClick={() => setActiveLightboxIndex((prev) => (prev > 0 ? prev - 1 : prev))}
              disabled={activeLightboxIndex === 0}
              className={`absolute left-4 p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-20 ${
                activeLightboxIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-100'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Image Wrapper */}
            <div className="relative max-w-full max-h-[70vh] flex items-center justify-center select-none overflow-hidden bg-stone-900 rounded-lg shadow-2xl border border-white/5">
              <img
                src={activeLightboxPhoto.url_storage}
                alt={activeLightboxPhoto.name}
                className="max-w-full max-h-[70vh] object-contain pointer-events-none"
              />

              {/* Watermark in Lightbox */}
              {marcaDaguaAtiva && marcaDaguaExpandida && (
                <div 
                  className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none z-10"
                  style={{ opacity: marcaDaguaOpacidade / 100 }}
                >
                  {/* Linhas Cruzadas (SVG de acordo com o estilo selecionado) */}
                  {marcaDaguaEstilo === 'media' ? (
                    <svg className="absolute inset-0 w-full h-full text-white/30" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.4" />
                      <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.4" />
                      <line x1="0" y1="30" x2="70" y2="100" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2, 2" />
                      <line x1="30" y1="0" x2="100" y2="70" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2, 2" />
                      <line x1="100" y1="30" x2="30" y2="100" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2, 2" />
                      <line x1="70" y1="0" x2="0" y2="70" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2, 2" />
                    </svg>
                  ) : marcaDaguaEstilo === 'pesada' ? (
                    <svg className="absolute inset-0 w-full h-full text-white/30" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.4" />
                      <line x1="0" y1="25" x2="75" y2="100" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="0" y1="50" x2="50" y2="100" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="0" y1="75" x2="25" y2="100" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="25" y1="0" x2="100" y2="75" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="50" y1="0" x2="100" y2="50" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="75" y1="0" x2="100" y2="25" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.4" />
                      <line x1="100" y1="25" x2="25" y2="100" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="100" y1="50" x2="50" y2="100" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="100" y1="75" x2="75" y2="100" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="75" y1="0" x2="0" y2="75" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="50" y1="0" x2="0" y2="50" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="25" y1="0" x2="0" y2="25" stroke="currentColor" strokeWidth="0.3" />
                    </svg>
                  ) : (
                    <svg className="absolute inset-0 w-full h-full text-white/30" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.3" />
                      <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.3" />
                    </svg>
                  )}
                  
                  {/* Texto Central */}
                  <div className="relative font-serif-editorial text-lg md:text-2xl lg:text-3xl tracking-[0.2em] uppercase text-white font-light border border-white/15 px-6 py-3 bg-black/20 shadow-md rotate-12 whitespace-nowrap z-20">
                    {marcaDaguaTexto}
                  </div>
                </div>
              )}
            </div>

            {/* Right Arrow Button */}
            <button
              onClick={() => setActiveLightboxIndex((prev) => (prev < photos.length - 1 ? prev + 1 : prev))}
              disabled={activeLightboxIndex === photos.length - 1}
              className={`absolute right-4 p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-20 ${
                activeLightboxIndex === photos.length - 1 ? 'opacity-20 cursor-not-allowed' : 'opacity-100'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Bottom Bar: Heart Selection Toggle & Key Help */}
          <div className="w-full px-6 py-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handlePhotoClick(activeLightboxPhoto.id)}
                disabled={currentStatus !== 'ativa'}
                className={`px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2.5 shadow-lg transition-all duration-300 ${
                  activeLightboxPhoto.selecionada
                    ? 'bg-stone-1050 hover:bg-stone-900 border border-stone-800 text-stone-100'
                    : 'bg-white hover:bg-stone-100 text-stone-900'
                }`}
              >
                <svg className="w-4 h-4" fill={activeLightboxPhoto.selecionada ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {activeLightboxPhoto.selecionada ? 'Favoritada' : 'Adicionar aos Favoritos'}
              </button>
            </div>
            
            <p className="text-[9px] text-stone-500 uppercase tracking-widest font-semibold mt-1">
              Pressione as setas &larr; &rarr; ou toque nas laterais para navegar. ESC para fechar.
            </p>
          </div>

        </div>
      )}

    </div>
  );
}
