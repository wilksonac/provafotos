import React, { useState } from 'react';

const getEventStatus = (evento) => {
  if (evento.status === 'finalizada') return 'finalizada';
  if (evento.data) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (evento.data < todayStr) {
      return 'expirada';
    }
  }
  return 'ativa';
};

export default function AdminDashboard({
  clientes = [],
  eventos = [],
  portfolio = [],
  realWeddings = [],
  blogPosts = [],
  onAddCliente,
  onAddEvento,
  onSelectEventUpload,
  onSelectEventView,
  onConfirmPayment,
  onDeleteEvento,
  onReopenEvento,
  onAddPortfolioPhoto,
  onDeletePortfolioPhoto,
  onLogout,
  onSetEventCover,
  onDeleteEventPhoto,
  onSetPortfolioCover,
  onAddRealWedding,
  onDeleteRealWedding,
  onAddBlogPost,
  onDeleteBlogPost,
  onSetPortfolioBanner,
  contato,
  onSaveContato
}) {
  const [activeModule, setActiveModule] = useState('prova'); // 'prova' | 'site'
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'clients' | 'new-client' | 'new-gallery' | 'portfolio' | 'real-weddings' | 'blog'
  
  // Calcular métricas do Firebase (Cotas Gratuitas)
  const totalStorageBytes = eventos.reduce((sum, evt) => {
    return sum + (evt.fotos || []).reduce((fSum, f) => fSum + (f.size || 150 * 1024), 0);
  }, 0);
  
  const storagePercentage = Math.min(100, (totalStorageBytes / (5 * 1024 * 1024 * 1024)) * 100).toFixed(1);
  
  const totalBandwidthBytes = eventos.reduce((sum, evt) => {
    const eventPhotosSize = (evt.fotos || []).reduce((fSum, f) => fSum + (f.size || 150 * 1024), 0);
    return sum + (evt.views || 0) * eventPhotosSize;
  }, 0);
  
  const bandwidthPercentage = Math.min(100, (totalBandwidthBytes / (1 * 1024 * 1024 * 1024)) * 100).toFixed(1);
  
  // Form states
  const [clientForm, setClientForm] = useState({ nome: '', email: '', telefone: '', senha: '' });
  const [contatoForm, setContatoForm] = useState({
    telefone: contato?.telefone || '',
    whatsapp: contato?.whatsapp || '',
    instagram: contato?.instagram || '',
    email: contato?.email || '',
    endereco: contato?.endereco || ''
  });

  React.useEffect(() => {
    if (contato) {
      setContatoForm({
        telefone: contato.telefone || '',
        whatsapp: contato.whatsapp || '',
        instagram: contato.instagram || '',
        email: contato.email || '',
        endereco: contato.endereco || ''
      });
    }
  }, [contato]);
  const [galleryForm, setGalleryForm] = useState({ titulo: '', id_cliente: '', data: '', limite_fotos: 25 });
  
  // Configurações avançadas da galeria
  const [clientMode, setClientMode] = useState('existing'); // 'existing' | 'new'
  const [selectionType, setSelectionType] = useState('limited'); // 'limited' | 'free'
  const [permitirExtras, setPermitirExtras] = useState(false);
  const [valorFotoExtra, setValorFotoExtra] = useState('');

  // Marca d'água
  const [marcaDaguaAtiva, setMarcaDaguaAtiva] = useState(true);
  const [marcaDaguaTexto, setMarcaDaguaTexto] = useState('WILKSON FOTOGRAFIAS');
  const [marcaDaguaOpacidade, setMarcaDaguaOpacidade] = useState(30);
  const [marcaDaguaMiniaturas, setMarcaDaguaMiniaturas] = useState(true);
  const [marcaDaguaExpandida, setMarcaDaguaExpandida] = useState(true);
  const [marcaDaguaEstilo, setMarcaDaguaEstilo] = useState('leve'); // 'leve' | 'media' | 'pesada'

  // Categoria de Galeria & Download
  const [tipoGaleria, setTipoGaleria] = useState('ensaio');
  const [permitirDownload, setPermitirDownload] = useState(false);
  const [acessoRestrito, setAcessoRestrito] = useState(false);

  const [copySuccess, setCopySuccess] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [photosModalEventId, setPhotosModalEventId] = useState(null);

  // Estados e Handlers do Portfólio Admin
  const [portfolioCategoryAdmin, setPortfolioCategoryAdmin] = useState('casamentos');

  // Novos Estados para Casamentos Reais (Histórias)
  const [isAddingWedding, setIsAddingWedding] = useState(false);
  const [weddingForm, setWeddingForm] = useState({
    titulo: '',
    descricao: '',
    local: '',
    data: '',
    fornecedores: [{ funcao: '', nome: '', instagram: '' }]
  });
  const [weddingCoverFile, setWeddingCoverFile] = useState(null);
  const [weddingPhotosFiles, setWeddingPhotosFiles] = useState([]);
  const [uploadingWedding, setUploadingWedding] = useState(false);

  // Novos Estados para Blog / Dicas
  const [isAddingBlogPost, setIsAddingBlogPost] = useState(false);
  const [blogPostForm, setBlogPostForm] = useState({
    titulo: '',
    conteudo: '',
    categoria: 'Dicas de Planejamento'
  });
  const [blogPostCoverFile, setBlogPostCoverFile] = useState(null);
  const [uploadingBlogPost, setUploadingBlogPost] = useState(false);

  const handlePortfolioUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
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

          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

          if (onAddPortfolioPhoto) {
            onAddPortfolioPhoto({
              id: `port_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              name: file.name,
              url: dataUrl,
              category: portfolioCategoryAdmin,
              size: Math.round(dataUrl.length * 0.75) // Real size of the compressed Base64 string in bytes
            });
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = null;
  };

  // Handlers para Casamentos Reais
  const handleAddFornecedorField = () => {
    setWeddingForm({
      ...weddingForm,
      fornecedores: [...weddingForm.fornecedores, { funcao: '', nome: '', instagram: '' }]
    });
  };

  const handleRemoveFornecedorField = (index) => {
    const updated = weddingForm.fornecedores.filter((_, i) => i !== index);
    setWeddingForm({ ...weddingForm, fornecedores: updated });
  };

  const handleFornecedorChange = (index, field, value) => {
    const updated = weddingForm.fornecedores.map((forn, i) => {
      if (i === index) {
        return { ...forn, [field]: value };
      }
      return forn;
    });
    setWeddingForm({ ...weddingForm, fornecedores: updated });
  };

  const handleSaveWedding = async (e) => {
    e.preventDefault();
    if (!weddingCoverFile) {
      alert("Por favor, selecione uma foto de capa para a história!");
      return;
    }
    if (weddingPhotosFiles.length === 0) {
      alert("Por favor, selecione as fotos que compõem o casamento real!");
      return;
    }

    setUploadingWedding(true);
    try {
      if (onAddRealWedding) {
        // Filtra fornecedores vazios
        const cleanFornecedores = weddingForm.fornecedores.filter(
          f => f.funcao.trim() || f.nome.trim()
        );
        
        await onAddRealWedding({
          titulo: weddingForm.titulo,
          descricao: weddingForm.descricao,
          local: weddingForm.local,
          data: weddingForm.data,
          fornecedores: cleanFornecedores
        }, weddingCoverFile, weddingPhotosFiles);
      }
      setIsAddingWedding(false);
      alert("Casamento Real publicado com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao publicar casamento real: " + err.message);
    } finally {
      setUploadingWedding(false);
    }
  };

  const handleSaveBlogPost = async (e) => {
    e.preventDefault();
    if (!blogPostCoverFile) {
      alert("Por favor, selecione uma foto de capa para o artigo!");
      return;
    }

    setUploadingBlogPost(true);
    try {
      if (onAddBlogPost) {
        await onAddBlogPost({
          titulo: blogPostForm.titulo,
          conteudo: blogPostForm.conteudo,
          categoria: blogPostForm.categoria
        }, blogPostCoverFile);
      }
      setIsAddingBlogPost(false);
      alert("Artigo publicado com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao publicar artigo: " + err.message);
    } finally {
      setUploadingBlogPost(false);
    }
  };

  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'aberta' | 'expirada' | 'concluida'

  // Handlers
  const handleClientSubmit = (e) => {
    e.preventDefault();
    if (!clientForm.nome || !clientForm.email || !clientForm.telefone) return;
    
    onAddCliente({
      id: editingClientId || undefined,
      ...clientForm
    });
    
    setClientForm({ nome: '', email: '', telefone: '', senha: '' });
    setEditingClientId(null);
    setActiveSubTab('clients'); // Redireciona para a lista de clientes para ver o cadastro!
  };

  const handleGallerySubmit = (e) => {
    e.preventDefault();
    if (!galleryForm.titulo || !galleryForm.data) return;

    let targetClientId = galleryForm.id_cliente;
    let clientObj = null;

    // Se for Novo Cliente cadastrado na hora
    if (clientMode === 'new') {
      if (!clientForm.nome || !clientForm.email || !clientForm.telefone) return;
      
      // Valida se senha foi fornecida quando o acesso restrito é ativado
      if (acessoRestrito && !clientForm.senha.trim()) {
        alert("Acesso restrito habilitado! Defina uma senha de login para o novo cliente.");
        return;
      }

      clientObj = onAddCliente(clientForm);
      targetClientId = clientObj.id;
      setClientForm({ nome: '', email: '', telefone: '', senha: '' });
    } else {
      // Se for Cliente Existente selecionado no dropdown
      if (!targetClientId) {
        alert("Por favor, selecione um cliente cadastrado.");
        return;
      }

      clientObj = clientes.find((c) => c.id === targetClientId);
      const effectivePassword = clientObj?.senha || clientForm.senha;

      // Valida se senha está disponível no cadastro existente ou se foi inserida na hora
      if (acessoRestrito && !effectivePassword?.trim()) {
        alert("Acesso restrito habilitado! Informe uma senha de login para este cliente.");
        return;
      }

      // Se inseriu uma senha nova para o cliente existente, salva no banco de dados dele
      if (clientObj && clientForm.senha.trim() && clientObj.senha !== clientForm.senha) {
        clientObj = {
          ...clientObj,
          senha: clientForm.senha
        };
        onAddCliente(clientObj);
        setClientForm({ nome: '', email: '', telefone: '', senha: '' });
      }
    }

    const newEvent = {
      titulo: galleryForm.titulo,
      id_cliente: targetClientId,
      data: galleryForm.data,
      limite_fotos: selectionType === 'limited' ? galleryForm.limite_fotos : null,
      selecao_livre: selectionType === 'free',
      permitir_extras: selectionType === 'limited' ? permitirExtras : false,
      valor_foto_extra: selectionType === 'limited' && permitirExtras && valorFotoExtra ? parseFloat(valorFotoExtra) : null,
      marca_dagua_ativa: marcaDaguaAtiva,
      marca_dagua_texto: marcaDaguaTexto,
      marca_dagua_opacidade: parseInt(marcaDaguaOpacidade),
      marca_dagua_miniaturas: marcaDaguaMiniaturas,
      marca_dagua_expandida: marcaDaguaExpandida,
      marca_dagua_estilo: marcaDaguaEstilo,
      tipo_galeria: tipoGaleria,
      permitir_download: permitirDownload,
      pagamento_extras_confirmado: false,
      acesso_restrito: acessoRestrito
    };

    onAddEvento(newEvent, clientObj);
    
    setGalleryForm({ titulo: '', id_cliente: '', data: '', limite_fotos: 25 });
    setClientMode('existing');
    setSelectionType('limited');
    setPermitirExtras(false);
    setValorFotoExtra('');
    setMarcaDaguaAtiva(true);
    setMarcaDaguaTexto('WILKSON FOTOGRAFIAS');
    setMarcaDaguaOpacidade(30);
    setMarcaDaguaMiniaturas(true);
    setMarcaDaguaExpandida(true);
    setMarcaDaguaEstilo('leve');
    setTipoGaleria('ensaio');
    setPermitirDownload(true);
    setAcessoRestrito(false);
    setActiveSubTab('overview');
  };

  const copyToClipboard = (token) => {
    const link = `${window.location.origin}/?gallery=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(token);
      setTimeout(() => setCopySuccess(null), 2500);
    });
  };

  // Share Modal States
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingEvent, setSharingEvent] = useState(null);
  const [shareForm, setShareForm] = useState({
    observacoes: 'As fotos da apresentação serão enviadas separadas posteriormente.',
    emailSuporte: 'wilkson@gmail.com',
    nomeFotografo: 'Wilkson Albuquerque Carvalho',
    prazo: '',
    customMessage: ''
  });
  const [isCustomMessageEdited, setIsCustomMessageEdited] = useState(false);

  const formatEventDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${parseInt(day, 10)} de ${monthName} de ${year}`;
  };

  const getShareLink = (token) => {
    return `${window.location.origin}/?gallery=${token}`;
  };

  const getCompiledMessage = (event, client, form) => {
    if (!event || !client) return '';
    const link = getShareLink(event.token);
    const dateFormatted = formatEventDate(form.prazo || event.data);
    const senhaText = event.acesso_restrito ? (client.senha || '123456') : '(Acesso direto por link)';
    
    return `Oi, ${client.nome}. Tudo bem?

A galeria ${event.titulo} já está disponível.
O prazo para a seleção das fotos é dia ${dateFormatted}.

${form.observacoes ? `${form.observacoes}\n` : ''}
Para acessar a galeria use os dados abaixo:

Link de acesso: ${link}
E-mail: ${client.email}
Senha: ${senhaText}


Em caso de dúvidas, por favor, entre em contato pelo e-mail ${form.emailSuporte}

Um abraço,

${form.nomeFotografo}`;
  };

  const handleOpenShareModal = (evento) => {
    const client = clientes.find((c) => c.id === evento.id_cliente);
    setSharingEvent(evento);
    setIsCustomMessageEdited(false);
    
    const initialForm = {
      observacoes: 'As fotos da apresentação serão enviadas separadas posteriormente.',
      emailSuporte: 'wilkson@gmail.com',
      nomeFotografo: 'Wilkson Albuquerque Carvalho',
      prazo: evento.data || '',
      customMessage: ''
    };
    
    initialForm.customMessage = getCompiledMessage(evento, client, initialForm);
    setShareForm(initialForm);
    setIsShareModalOpen(true);
  };

  const handleShareFormChange = (field, value) => {
    const newForm = { ...shareForm, [field]: value };
    
    if (!isCustomMessageEdited) {
      const client = clientes.find((c) => c.id === sharingEvent.id_cliente);
      newForm.customMessage = getCompiledMessage(sharingEvent, client, newForm);
    }
    
    setShareForm(newForm);
  };

  const handleCustomMessageChange = (e) => {
    setIsCustomMessageEdited(true);
    setShareForm({ ...shareForm, customMessage: e.target.value });
  };

  const handleResetMessage = () => {
    const client = clientes.find((c) => c.id === sharingEvent.id_cliente);
    setIsCustomMessageEdited(false);
    setShareForm({
      ...shareForm,
      customMessage: getCompiledMessage(sharingEvent, client, shareForm)
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 bg-white border border-stone-200 rounded-xl shadow-sm text-stone-900 font-sans animate-scale-in">
      
      {/* Dashboard Sub Header com Seletor de Módulos */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between border-b border-stone-150 pb-5 mb-6 gap-4">
        <div>
          <h2 className="font-serif-editorial text-2xl font-light tracking-wide text-stone-900">
            {activeModule === 'prova' ? '📷 Módulo Prova de Fotos' : '✍️ Conteúdo do Site & Blog'}
          </h2>
          <p className="text-xs text-stone-400 mt-1 uppercase tracking-wider font-semibold">
            {activeModule === 'prova' 
              ? 'Gerencie seus clientes, crie novas galerias de fotos e acompanhe as seleções'
              : 'Gerencie o portfólio, publique casamentos reais e escreva artigos de dicas'}
          </p>
        </div>

        {/* Seletor de Módulos (Tabs) */}
        <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200/50 flex-wrap sm:flex-nowrap gap-0.5">
          <button
            onClick={() => {
              setActiveModule('prova');
              setActiveSubTab('overview');
            }}
            className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
              activeModule === 'prova'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            Prova de Fotos
          </button>
          <button
            onClick={() => {
              setActiveModule('site');
              setActiveSubTab('portfolio');
            }}
            className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
              activeModule === 'site'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            Conteúdo do Site
          </button>
        </div>
      </div>

      {/* Sub-tab Switchers baseados no Módulo Ativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-150 pb-4 mb-6">
        <div className="flex flex-wrap gap-1.5">
          {activeModule === 'prova' ? (
            <>
              <button
                onClick={() => setActiveSubTab('overview')}
                className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded ${
                  activeSubTab === 'overview'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
                }`}
              >
                Galerias
              </button>
              <button
                onClick={() => setActiveSubTab('clients')}
                className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded ${
                  activeSubTab === 'clients'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
                }`}
              >
                Clientes
              </button>
              <button
                onClick={() => {
                  setClientForm({ nome: '', email: '', telefone: '', senha: '' });
                  setEditingClientId(null);
                  setActiveSubTab('new-client');
                }}
                className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded ${
                  activeSubTab === 'new-client'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
                }`}
              >
                + Novo Cliente
              </button>
              <button
                onClick={() => setActiveSubTab('new-gallery')}
                className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded ${
                  activeSubTab === 'new-gallery'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
                }`}
              >
                + Nova Galeria
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveSubTab('portfolio')}
                className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded ${
                  activeSubTab === 'portfolio'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
                }`}
              >
                Portfólio Geral
              </button>
              <button
                onClick={() => setActiveSubTab('real-weddings')}
                className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded ${
                  activeSubTab === 'real-weddings'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
                }`}
              >
                Casamentos Reais (Histórias)
              </button>
              <button
                onClick={() => setActiveSubTab('blog')}
                className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded ${
                  activeSubTab === 'blog'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
                }`}
              >
                Dicas / Blog
              </button>
              <button
                onClick={() => setActiveSubTab('contato')}
                className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded ${
                  activeSubTab === 'contato'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
                }`}
              >
                Fale Conosco
              </button>
            </>
          )}
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded bg-red-50 hover:bg-red-100/80 text-red-650 hover:text-red-700 border border-red-200 self-start sm:self-auto"
          >
            Sair do Painel
          </button>
        )}
      </div>
      {/* Sub-tab 1: Overview (Galerias) */}
      {activeSubTab === 'overview' && (
        <div className="animate-scale-in">
          {/* Dashboard de Monitoramento do Firebase (Cotas Gratuitas) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Card 1: Storage */}
            <div className="bg-white border border-stone-200/80 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Armazenamento (Storage)</h4>
                  <p className="text-xl font-serif-editorial text-stone-900 mt-1 font-light">
                    {totalStorageBytes < 1024 * 1024
                      ? `${(totalStorageBytes / 1024).toFixed(1)} KB`
                      : totalStorageBytes < 1024 * 1024 * 1024
                        ? `${(totalStorageBytes / (1024 * 1024)).toFixed(1)} MB`
                        : `${(totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`}
                    <span className="text-xs text-stone-450 font-sans ml-1.5 font-normal">de 5.0 GB</span>
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-stone-900 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded">
                  {storagePercentage}%
                </span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden border border-stone-200/30">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    parseFloat(storagePercentage) > 80 ? 'bg-red-500' : parseFloat(storagePercentage) > 50 ? 'bg-amber-500' : 'bg-stone-900'
                  }`}
                  style={{ width: `${storagePercentage}%` }}
                ></div>
              </div>
              <p className="text-[8px] text-stone-400 uppercase tracking-wider mt-2.5">
                Espaço em disco ocupado pelas miniaturas no Firebase Storage.
              </p>
            </div>

            {/* Card 2: Bandwidth */}
            <div className="bg-white border border-stone-200/80 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Tráfego Estimado (Banda Diária)</h4>
                  <p className="text-xl font-serif-editorial text-stone-900 mt-1 font-light">
                    {totalBandwidthBytes < 1024 * 1024
                      ? `${(totalBandwidthBytes / 1024).toFixed(1)} KB`
                      : totalBandwidthBytes < 1024 * 1024 * 1024
                        ? `${(totalBandwidthBytes / (1024 * 1024)).toFixed(1)} MB`
                        : `${(totalBandwidthBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`}
                    <span className="text-xs text-stone-450 font-sans ml-1.5 font-normal">de 1.0 GB/dia</span>
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-stone-900 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded">
                  {bandwidthPercentage}%
                </span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden border border-stone-200/30">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    parseFloat(bandwidthPercentage) > 80 ? 'bg-red-500' : parseFloat(bandwidthPercentage) > 50 ? 'bg-amber-500' : 'bg-stone-900'
                  }`}
                  style={{ width: `${bandwidthPercentage}%` }}
                ></div>
              </div>
              <p className="text-[8px] text-stone-400 uppercase tracking-wider mt-2.5">
                Banda consumida pelos clientes ao acessar e carregar as galerias.
              </p>
            </div>
          </div>

          {eventos.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-stone-200 rounded-xl bg-stone-50/20 text-stone-400 font-serif-editorial">
              <p className="text-lg">Nenhuma galeria cadastrada.</p>
              <button
                onClick={() => setActiveSubTab('new-gallery')}
                className="mt-4 px-5 py-2 bg-stone-900 text-white font-sans text-xs font-bold uppercase tracking-widest rounded hover:bg-stone-800"
              >
                Criar Primeira Galeria
              </button>
            </div>
          ) : (() => {
            const filteredEventos = eventos.filter((evento) => {
              const computedStatus = getEventStatus(evento);
              if (statusFilter === 'all') return true;
              if (statusFilter === 'aberta') return computedStatus === 'ativa';
              if (statusFilter === 'concluida') return computedStatus === 'finalizada';
              if (statusFilter === 'expirada') return computedStatus === 'expirada';
              return true;
            });

            return (
              <div className="space-y-4">
                {/* Filtros de Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-stone-50/50 border border-stone-200/80 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Filtrar por Status:</span>
                  
                  <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200/60 text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1 rounded transition-all uppercase ${
                        statusFilter === 'all' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'
                      }`}
                    >
                      Todas ({eventos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('aberta')}
                      className={`px-3 py-1 rounded transition-all uppercase ${
                        statusFilter === 'aberta' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'
                      }`}
                    >
                      Abertas ({eventos.filter(e => getEventStatus(e) === 'ativa').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('expirada')}
                      className={`px-3 py-1 rounded transition-all uppercase ${
                        statusFilter === 'expirada' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'
                      }`}
                    >
                      Expiradas ({eventos.filter(e => getEventStatus(e) === 'expirada').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('concluida')}
                      className={`px-3 py-1 rounded transition-all uppercase ${
                        statusFilter === 'concluida' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'
                      }`}
                    >
                      Concluídas ({eventos.filter(e => getEventStatus(e) === 'finalizada').length})
                    </button>
                  </div>
                </div>

                {filteredEventos.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-stone-200 rounded-xl bg-stone-50/20 text-stone-400 font-serif-editorial">
                    <p className="text-sm">Nenhuma galeria encontrada para este filtro.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-stone-150 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-150 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                          <th className="py-4.5 px-6">Título da Galeria</th>
                          <th className="py-4.5 px-6">Cliente Vinculado</th>
                          <th className="py-4.5 px-6">Fotos</th>
                          <th className="py-4.5 px-6">Limite / Regra</th>
                          <th className="py-4.5 px-6">Status</th>
                          <th className="py-4.5 px-6 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-sm">
                        {filteredEventos.map((evento) => {
                          const client = clientes.find((c) => c.id === evento.id_cliente);
                          const computedStatus = getEventStatus(evento);
                          
                          return (
                            <tr key={evento.id} className="hover:bg-stone-50/50 transition-colors">
                              <td className="py-4 px-6 font-medium text-stone-900">
                                <div>
                                  <div className="flex items-center flex-wrap gap-2">
                                    <span className="block">{evento.titulo}</span>
                                    <span className="inline-block text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200/50">
                                      {evento.tipo_galeria === 'festa_infantil' ? 'Festa Infantil' :
                                       evento.tipo_galeria === 'evento_corporativo' ? 'Corporativo' :
                                       evento.tipo_galeria === 'ensaio' ? 'Ensaio' :
                                       evento.tipo_galeria === 'casamento' ? 'Casamento' :
                                       evento.tipo_galeria || 'Ensaio'}
                                    </span>
                                    <span className={`inline-block text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                      evento.acesso_restrito
                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                        : 'bg-stone-50 border-stone-250 text-stone-600'
                                    }`}>
                                      {evento.acesso_restrito ? 'Login + Senha' : 'Link Direto'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-stone-400 font-sans uppercase font-semibold">{evento.data}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-stone-500">
                                {client ? (
                                  <div>
                                    <span className="block text-stone-800 font-medium">{client.nome}</span>
                                    <span className="text-xs text-stone-400">{client.email}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-red-500">Cliente Desconectado</span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-stone-700">
                                <span className="block font-semibold">{(evento.fotos || []).length} fotos</span>
                                {(() => {
                                  const selecionadas = (evento.fotos || []).filter(f => f.selecionada);
                                  if (selecionadas.length === 0) return null;
                                  
                                  // Lightroom: DSC_0001, DSC_0002
                                  const lrNames = selecionadas.map(f => f.name.replace(/\.[^/.]+$/, "")).join(', ');
                                  // Windows: DSC_0001.jpg OR DSC_0002.jpg
                                  const winNames = selecionadas.map(f => f.name).join(' OR ');

                                  return (
                                    <div className="mt-2 space-y-1 animate-fade-in">
                                      <span className="block text-[9px] font-bold text-stone-400 uppercase tracking-widest">
                                        {selecionadas.length} selecionadas
                                      </span>
                                      <div className="flex flex-col gap-1">
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(lrNames);
                                            alert("Nomes copiados no padrão Lightroom!");
                                          }}
                                          className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 border border-stone-250 rounded text-[8px] font-bold text-stone-600 hover:text-stone-800 uppercase tracking-wider text-left transition-colors truncate max-w-[120px]"
                                          title={`Copiar no padrão Lightroom (com vírgulas):\n${lrNames}`}
                                        >
                                          &bull; Copiar Lightroom
                                        </button>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(winNames);
                                            alert("Nomes copiados no padrão Windows!");
                                          }}
                                          className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 border border-stone-250 rounded text-[8px] font-bold text-stone-600 hover:text-stone-800 uppercase tracking-wider text-left transition-colors truncate max-w-[120px]"
                                          title={`Copiar no padrão Windows (separado por OR):\n${winNames}`}
                                        >
                                          &bull; Copiar Windows
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-4 px-6 text-stone-600 font-medium">
                                {evento.selecao_livre ? (
                                  <span className="text-stone-500 text-xs italic">Seleção Livre</span>
                                ) : (
                                  <div>
                                    <span>{evento.limite_fotos} fotos</span>
                                    {evento.permitir_extras && (
                                      <span className="block text-[10px] text-amber-600 font-semibold uppercase tracking-wider mt-0.5">
                                        Permite Extras {evento.valor_foto_extra && `(R$ ${evento.valor_foto_extra.toFixed(2).replace('.', ',')}/cada)`}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                {(() => {
                                  const selectedCount = (evento.fotos || []).filter((p) => p.selecionada).length;
                                  const hasExtras = !evento.selecao_livre && evento.limite_fotos !== null && selectedCount > evento.limite_fotos;
                                  
                                  return (
                                    <div className="flex flex-col items-start gap-1">
                                      <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                        computedStatus === 'finalizada'
                                          ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                                          : computedStatus === 'expirada'
                                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                                          : 'bg-amber-50 border-amber-250 text-amber-700'
                                      }`}>
                                        {computedStatus === 'finalizada' ? 'Finalizada' :
                                         computedStatus === 'expirada' ? 'Expirada' : 'Em Aberto'}
                                      </span>
                                      
                                      {computedStatus === 'finalizada' && hasExtras && (
                                        <div className="mt-1 flex flex-col items-start gap-1.5">
                                          {evento.pagamento_extras_confirmado ? (
                                            <span className="text-[8px] font-extrabold uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                              Extras Pagas
                                            </span>
                                          ) : (
                                            <>
                                              <span className="text-[8px] font-extrabold uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-250 px-2 py-0.5 rounded-md animate-pulse">
                                                Aguardando Pgto
                                              </span>
                                              <button
                                                onClick={() => onConfirmPayment(evento.id)}
                                                className="px-2 py-0.5 border border-stone-300 hover:border-stone-900 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 rounded text-[8px] font-bold uppercase tracking-widest transition-all"
                                              >
                                                Confirmar
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="flex justify-end gap-2.5">
                                  {computedStatus === 'finalizada' && (
                                    <button
                                      onClick={() => {
                                        if (confirm(`Deseja realmente reabrir a galeria "${evento.titulo}"? O cliente poderá editar a escolha de fotos.`)) {
                                          onReopenEvento(evento.id);
                                        }
                                      }}
                                      className="px-3 py-1.5 border border-amber-250 hover:border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 rounded text-xs font-bold uppercase tracking-wider transition-all"
                                    >
                                      Reabrir
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setPhotosModalEventId(evento.id)}
                                    className="px-3 py-1.5 border border-stone-250 text-stone-600 rounded text-xs font-bold uppercase tracking-wider hover:bg-stone-50 hover:text-stone-900 transition-colors"
                                  >
                                    Fotos
                                  </button>
                                  <button
                                    onClick={() => handleOpenShareModal(evento)}
                                    className="px-3 py-1.5 border border-stone-250 text-stone-600 rounded text-xs font-bold uppercase tracking-wider hover:bg-stone-50 hover:text-stone-900 transition-colors"
                                  >
                                    Compartilhar
                                  </button>
                                  <button
                                    onClick={() => onSelectEventUpload(evento.id)}
                                    className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded text-xs font-bold uppercase tracking-wider hover:bg-stone-200/80 transition-colors"
                                  >
                                    Upload
                                  </button>
                                  <button
                                    onClick={() => onSelectEventView(evento.token)}
                                    className="px-3 py-1.5 bg-stone-900 text-white rounded text-xs font-bold uppercase tracking-wider hover:bg-stone-800 transition-colors"
                                  >
                                    Ver
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Deseja realmente excluir a galeria "${evento.titulo}"? Esta ação apagará todas as fotos e seleções associadas.`)) {
                                        onDeleteEvento(evento.id);
                                      }
                                    }}
                                    className="px-2.5 py-1.5 border border-red-200 hover:border-red-500 hover:bg-red-50 text-red-650 hover:text-red-700 rounded text-xs font-bold uppercase tracking-wider transition-all"
                                    title="Excluir Galeria"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Sub-tab 2: Clientes */}
      {activeSubTab === 'clients' && (
        <div className="animate-scale-in">
          {clientes.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-stone-200 rounded-xl bg-stone-50/20 text-stone-400 font-serif-editorial">
              <p className="text-lg">Nenhum cliente cadastrado.</p>
              <button
                onClick={() => setActiveSubTab('new-client')}
                className="mt-4 px-5 py-2 bg-stone-900 text-white font-sans text-xs font-bold uppercase tracking-widest rounded hover:bg-stone-800"
              >
                Cadastrar Primeiro Cliente
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-150 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-150 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                    <th className="py-4.5 px-6">Nome do Cliente</th>
                    <th className="py-4.5 px-6">E-mail</th>
                    <th className="py-4.5 px-6">Telefone</th>
                    <th className="py-4.5 px-6">Galerias Vinculadas</th>
                    <th className="py-4.5 px-6">Senha de Login</th>
                    <th className="py-4.5 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {clientes.map((cliente) => {
                    const linkedGalleries = eventos.filter((e) => e.id_cliente === cliente.id);
                    return (
                      <tr key={cliente.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="py-4 px-6 font-semibold text-stone-900">{cliente.nome}</td>
                        <td className="py-4 px-6 text-stone-600">{cliente.email}</td>
                        <td className="py-4 px-6 text-stone-600">{cliente.telefone}</td>
                        <td className="py-4 px-6 font-medium text-stone-500">
                          {linkedGalleries.length === 0 ? (
                            <span className="text-stone-400 italic text-xs">Nenhuma galeria</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {linkedGalleries.map((gal) => (
                                <span key={gal.id} className="text-xs text-stone-700 font-medium">
                                  &bull; {gal.titulo}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-stone-600 font-mono text-xs">
                          {cliente.senha ? (
                            <span className="bg-stone-100 px-2 py-1 rounded text-stone-700 border border-stone-200">{cliente.senha}</span>
                          ) : (
                            <span className="text-stone-300 italic">Nenhuma</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => {
                              setClientForm({
                                nome: cliente.nome,
                                email: cliente.email,
                                telefone: cliente.telefone,
                                senha: cliente.senha || ''
                              });
                              setEditingClientId(cliente.id);
                              setActiveSubTab('new-client');
                            }}
                            className="px-3 py-1.5 border border-stone-250 text-stone-600 rounded text-xs font-bold uppercase tracking-wider hover:bg-stone-50 hover:text-stone-900 transition-colors"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 3: Register Client */}
      {activeSubTab === 'new-client' && (
        <form onSubmit={handleClientSubmit} className="max-w-md mx-auto space-y-4 animate-scale-in py-4">
          <h3 className="font-serif-editorial text-xl font-normal text-stone-900 mb-2 border-b border-stone-100 pb-2">
            {editingClientId ? 'Editar Cadastro de Cliente' : 'Cadastrar Novo Cliente'}
          </h3>
          
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
              Nome Completo
            </label>
            <input
              type="text"
              required
              value={clientForm.nome}
              onChange={(e) => setClientForm({ ...clientForm, nome: e.target.value })}
              placeholder="Ex: Carlos Silva"
              className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-stone-50/30"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
              E-mail do Cliente
            </label>
            <input
              type="email"
              required
              value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              placeholder="Ex: carlos@email.com"
              className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-stone-50/30"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
              Telefone / WhatsApp
            </label>
            <input
              type="text"
              required
              value={clientForm.telefone}
              onChange={(e) => setClientForm({ ...clientForm, telefone: e.target.value })}
              placeholder="Ex: (11) 99999-9999"
              className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-stone-50/30"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
              Senha de Login (Opcional)
            </label>
            <input
              type="text"
              value={clientForm.senha}
              onChange={(e) => setClientForm({ ...clientForm, senha: e.target.value })}
              placeholder="Digite uma senha para o cliente"
              className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-stone-50/30"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className="w-1/2 py-2 border border-stone-200 text-stone-500 rounded text-xs font-bold uppercase tracking-widest hover:bg-stone-50"
            >
              Cancelar
            </button>
             <button
              type="submit"
              className="w-1/2 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-bold uppercase tracking-widest transition-colors shadow-sm"
            >
              {editingClientId ? 'Atualizar Cliente' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      )}

      {/* Sub-tab 4: Create Gallery */}
      {activeSubTab === 'new-gallery' && (
        <form onSubmit={handleGallerySubmit} className="max-w-lg mx-auto space-y-4 animate-scale-in py-4">
          <h3 className="font-serif-editorial text-xl font-normal text-stone-900 mb-2 border-b border-stone-100 pb-2">
            Criar Nova Galeria de Seleção
          </h3>

          {/* Dados Gerais da Galeria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                Título da Galeria / Ensaio
              </label>
              <input
                type="text"
                required
                value={galleryForm.titulo}
                onChange={(e) => setGalleryForm({ ...galleryForm, titulo: e.target.value })}
                placeholder="Ex: Ensaio de Família - Silva"
                className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-stone-50/30"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                Tipo de Galeria
              </label>
              <select
                required
                value={tipoGaleria}
                onChange={(e) => setTipoGaleria(e.target.value)}
                className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-white cursor-pointer"
              >
                <option value="ensaio">Ensaio</option>
                <option value="casamento">Casamento</option>
                <option value="festa_infantil">Festa Infantil</option>
                <option value="evento_corporativo">Evento Corporativo</option>
                <option value="outros">Outros</option>
              </select>
            </div>
          </div>

          {/* Vínculo de Cliente Inline */}
          <div className="p-4 border border-stone-200 rounded-lg bg-stone-50/30 space-y-3.5">
            <div className="flex items-center justify-between border-b border-stone-150 pb-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Vincular Cliente</span>
              
              {/* Toggle de Modo Cliente */}
              <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200/60 text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => setClientMode('existing')}
                  className={`px-3 py-1 rounded transition-all uppercase ${
                    clientMode === 'existing' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  Existente
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode('new')}
                  className={`px-3 py-1 rounded transition-all uppercase ${
                    clientMode === 'new' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  Novo Cadastro
                </button>
              </div>
            </div>

            {/* Modo 1: Cliente Existente (Dropdown) */}
            {clientMode === 'existing' && (
              <div className="space-y-3">
                {clientes.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded border border-amber-200">
                    Nenhum cliente cadastrado. Selecione "Novo Cadastro" para criar na hora!
                  </p>
                ) : (
                  <select
                    required={clientMode === 'existing'}
                    value={galleryForm.id_cliente}
                    onChange={(e) => setGalleryForm({ ...galleryForm, id_cliente: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-white cursor-pointer"
                  >
                    <option value="">Selecione o Cliente...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.email})
                      </option>
                    ))}
                  </select>
                )}

                {(() => {
                  const selectedClientObject = clientes.find((c) => c.id === galleryForm.id_cliente);
                  const showPasswordInput = acessoRestrito && selectedClientObject && !selectedClientObject.senha;
                  
                  if (!showPasswordInput) return null;
                  
                  return (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in space-y-2">
                      <span className="text-[9px] font-bold text-blue-700 uppercase tracking-widest block">Definir Senha Requerida</span>
                      <p className="text-[10px] text-stone-500 leading-normal">
                        Este cliente existente não possui senha cadastrada. Insira uma senha para habilitar o login restrito.
                      </p>
                      <input
                        type="text"
                        required
                        value={clientForm.senha}
                        onChange={(e) => setClientForm({ ...clientForm, senha: e.target.value })}
                        placeholder="Crie uma senha de acesso"
                        className="w-full px-3 py-1.5 border border-stone-250 rounded text-xs focus:outline-none focus:border-stone-900 bg-white"
                      />
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Modo 2: Criar Cliente Inline */}
            {clientMode === 'new' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 animate-fade-in">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">Nome</label>
                  <input
                    type="text"
                    required={clientMode === 'new'}
                    value={clientForm.nome}
                    onChange={(e) => setClientForm({ ...clientForm, nome: e.target.value })}
                    placeholder="Nome"
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">E-mail</label>
                  <input
                    type="email"
                    required={clientMode === 'new'}
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    placeholder="E-mail"
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">Telefone</label>
                  <input
                    type="text"
                    required={clientMode === 'new'}
                    value={clientForm.telefone}
                    onChange={(e) => setClientForm({ ...clientForm, telefone: e.target.value })}
                    placeholder="WhatsApp"
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">
                    Senha {acessoRestrito && <span className="text-red-500 font-bold">*</span>}
                  </label>
                  <input
                    type="text"
                    required={clientMode === 'new' && acessoRestrito}
                    value={clientForm.senha}
                    onChange={(e) => setClientForm({ ...clientForm, senha: e.target.value })}
                    placeholder={acessoRestrito ? "Senha (Obrigatória)" : "Senha (Opcional)"}
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Configurações de Regra de Seleção */}
          <div className="p-4 border border-stone-200 rounded-lg bg-stone-50/30 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-150 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Regra de Escolha</span>
              
              {/* Toggle de Tipo de Seleção */}
              <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200/60 text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => setSelectionType('limited')}
                  className={`px-3 py-1 rounded transition-all uppercase ${
                    selectionType === 'limited' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  Limitada
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionType('free')}
                  className={`px-3 py-1 rounded transition-all uppercase ${
                    selectionType === 'free' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  Seleção Livre
                </button>
              </div>
            </div>

            {/* Modo Limitado */}
            {selectionType === 'limited' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                      Limite de Fotos
                    </label>
                    <input
                      type="number"
                      min="1"
                      required={selectionType === 'limited'}
                      value={galleryForm.limite_fotos}
                      onChange={(e) => setGalleryForm({ ...galleryForm, limite_fotos: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-white"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permitirExtras}
                        onChange={(e) => setPermitirExtras(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-stone-200 border border-stone-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-stone-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-stone-900 peer-checked:after:bg-white"></div>
                      <span className="ml-2 text-xs font-bold text-stone-750 uppercase tracking-widest">Permitir Fotos Extras</span>
                    </label>
                  </div>
                </div>

                {permitirExtras && (
                  <div className="max-w-xs animate-fade-in">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                      Valor por Foto Extra (R$ - Opcional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valorFotoExtra}
                      onChange={(e) => setValorFotoExtra(e.target.value)}
                      placeholder="Ex: 15.00"
                      className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Modo Seleção Livre */}
            {selectionType === 'free' && (
              <p className="text-xs text-stone-500 italic animate-fade-in leading-relaxed">
                * O cliente poderá selecionar quantas fotos quiser da galeria, sem barreiras de limite ou avisos de excedentes.
              </p>
            )}

            {/* Permissão de Downloads e Regras de Segurança */}
            <div className="border-t border-stone-150 pt-3.5 mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={permitirDownload}
                  onChange={(e) => setPermitirDownload(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-stone-200 border border-stone-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-stone-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-stone-900 peer-checked:after:bg-white"></div>
                <span className="ml-2 text-xs font-bold text-stone-750 uppercase tracking-widest">Permitir Download das Selecionadas</span>
              </label>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={acessoRestrito}
                  onChange={(e) => setAcessoRestrito(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-stone-200 border border-stone-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-stone-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-stone-900 peer-checked:after:bg-white"></div>
                <span className="ml-2 text-xs font-bold text-stone-750 uppercase tracking-widest">Exigir Login e Senha para Acesso</span>
              </label>
            </div>
          </div>

          {/* Configurações de Marca D'água */}
          <div className="p-4 border border-stone-200 rounded-lg bg-stone-50/30 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-150 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Proteção de Imagem</span>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={marcaDaguaAtiva}
                  onChange={(e) => setMarcaDaguaAtiva(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-stone-200 border border-stone-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-stone-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-stone-900 peer-checked:after:bg-white"></div>
                <span className="ml-2 text-xs font-bold text-stone-750 uppercase tracking-widest">Marca D'água</span>
              </label>
            </div>

            {marcaDaguaAtiva && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                      Texto da Marca D'água
                    </label>
                    <input
                      type="text"
                      required={marcaDaguaAtiva}
                      value={marcaDaguaTexto}
                      onChange={(e) => setMarcaDaguaTexto(e.target.value)}
                      placeholder="Ex: WILKSON FOTOGRAFIAS"
                      className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400">
                        Opacidade
                      </label>
                      <span className="text-xs font-bold text-stone-800">{marcaDaguaOpacidade}%</span>
                    </div>
                    <div className="flex items-center gap-3 pt-1.5">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={marcaDaguaOpacidade}
                        onChange={(e) => setMarcaDaguaOpacidade(parseInt(e.target.value))}
                        className="w-full accent-stone-900 h-1 bg-stone-200 border border-stone-300 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Seletor do Estilo da Marca D'água */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">
                    Cobertura da Marca D'água
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'leve', label: '🟢 Leve (Padrão)', desc: 'Linhas em X central + texto' },
                      { id: 'media', label: '🟡 Média', desc: 'X central + pontilhados adicionais' },
                      { id: 'pesada', label: '🔴 Pesada', desc: 'Grade em losangos (segurança máxima)' }
                    ].map((style) => (
                      <button
                        type="button"
                        key={style.id}
                        onClick={() => setMarcaDaguaEstilo(style.id)}
                        className={`p-2 border rounded-lg text-left transition-all ${
                          marcaDaguaEstilo === style.id
                            ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                            : 'border-stone-200 bg-white hover:bg-stone-50/50'
                        }`}
                      >
                        <div className="text-[10px] font-bold text-stone-850">{style.label}</div>
                        <div className="text-[8.5px] text-stone-400 font-medium leading-tight mt-0.5">{style.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marcaDaguaMiniaturas}
                      onChange={(e) => setMarcaDaguaMiniaturas(e.target.checked)}
                      className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                    />
                    <span className="text-xs text-stone-700 font-semibold uppercase tracking-wider">Aplicar nas Miniaturas</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marcaDaguaExpandida}
                      onChange={(e) => setMarcaDaguaExpandida(e.target.checked)}
                      className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                    />
                    <span className="text-xs text-stone-700 font-semibold uppercase tracking-wider">Aplicar na Foto Expandida</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Prazo Limite */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
              Prazo Limite
            </label>
            <input
              type="date"
              required
              value={galleryForm.data}
              onChange={(e) => setGalleryForm({ ...galleryForm, data: e.target.value })}
              className="w-full px-4 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-900 bg-stone-50/30 cursor-pointer"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className="w-1/2 py-2 border border-stone-200 text-stone-500 rounded text-xs font-bold uppercase tracking-widest hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={clientMode === 'existing' && clientes.length === 0}
              className={`w-1/2 py-2 text-white rounded text-xs font-bold uppercase tracking-widest transition-all shadow-sm ${
                clientMode === 'existing' && clientes.length === 0
                  ? 'bg-stone-350 cursor-not-allowed border border-stone-300'
                  : 'bg-stone-900 hover:bg-stone-850'
              }`}
            >
              Criar Galeria
            </button>
          </div>
        </form>
      )}

      {/* Sub-tab 5: Portfólio */}
      {activeSubTab === 'portfolio' && (
        <div className="animate-scale-in space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-stone-150 pb-4 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Banco de Imagens</span>
              <h3 className="font-serif-editorial text-lg text-stone-900 mt-0.5">Gerenciar Portfólio</h3>
              <p className="text-[11px] text-stone-500 mt-1">Selecione uma categoria, suba novas fotos (serão otimizadas) ou remova as existentes.</p>
            </div>

            {/* Categorias Selector */}
            <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200/60 text-[9px] font-bold">
              {[
                { id: 'casamentos', label: 'Casamentos' },
                { id: 'infantil', label: 'Infantil' },
                { id: 'formatura', label: 'Formaturas' },
                { id: 'corporativo', label: 'Corporativo' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setPortfolioCategoryAdmin(cat.id)}
                  className={`px-3 py-1.5 rounded transition-all uppercase ${
                    portfolioCategoryAdmin === cat.id ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Upload de Fotos de Portfólio */}
          <div className="p-5 border border-dashed border-stone-200 rounded-xl bg-stone-50/20 text-center relative group hover:bg-stone-50/50 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handlePortfolioUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="py-6 space-y-3">
              <div className="w-10 h-10 bg-white border border-stone-200 rounded-full flex items-center justify-center mx-auto shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">Arraste ou clique para enviar fotos de Portfólio</p>
                <p className="text-[10px] text-stone-400 mt-1 uppercase tracking-widest">Categoria selecionada: {portfolioCategoryAdmin.toUpperCase()}</p>
              </div>
              <p className="text-[9px] text-stone-400/80 max-w-xs mx-auto uppercase tracking-wide">
                As fotos originais serão redimensionadas e comprimidas automaticamente no envio para manter o carregamento instantâneo.
              </p>
            </div>
          </div>

          {/* Listagem de fotos cadastradas */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-3">
              Imagens Cadastradas ({portfolio.filter(p => p.category === portfolioCategoryAdmin).length})
            </span>

            {portfolio.filter(p => p.category === portfolioCategoryAdmin).length === 0 ? (
              <div className="text-center py-12 border border-stone-150 rounded-xl bg-stone-50/10 text-stone-450 font-serif-editorial">
                <p className="text-sm">Nenhuma foto cadastrada nesta categoria ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {portfolio
                  .filter((p) => p.category === portfolioCategoryAdmin)
                  .map((photo) => (
                    <div 
                      key={photo.id}
                      className="group relative bg-white border border-stone-200 rounded-lg overflow-hidden shadow-xs hover:shadow-sm transition-all"
                    >
                      <div className="aspect-[4/3] w-full bg-stone-50 overflow-hidden">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      
                      {/* Botão de Destaque / Exibir na Vitrine da Home */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onSetPortfolioCover) {
                            onSetPortfolioCover(photo.id);
                          }
                        }}
                        className={`absolute top-2 left-2 border rounded p-1.5 transition-all shadow-xs z-10 ${
                          photo.destaque
                            ? 'bg-amber-500 border-amber-600 text-white'
                            : 'bg-white/90 border-stone-200 text-stone-450 hover:text-amber-650'
                        }`}
                        title="Exibir esta foto na Vitrine de Destaques da Página Inicial"
                      >
                        <svg className="w-3.5 h-3.5" fill={photo.destaque ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.969 0 1.371 1.24.588 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.17 0l-3.971 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118l-3.97-2.883c-.783-.57-.38-1.81.588-1.81h4.907a1 1 0 00.95-.69l1.519-4.674z"/>
                        </svg>
                      </button>

                      {/* Botão de Banner / Capa do Topo (Hero) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onSetPortfolioBanner) {
                            onSetPortfolioBanner(photo.id);
                          }
                        }}
                        className={`absolute top-10 left-2 border rounded p-1.5 transition-all shadow-xs z-10 ${
                          photo.banner
                            ? 'bg-blue-600 border-blue-700 text-white'
                            : 'bg-white/90 border-stone-200 text-stone-450 hover:text-blue-650'
                        }`}
                        title="Definir como Imagem de Fundo (Banner) do Topo do Site"
                      >
                        <svg className="w-3.5 h-3.5" fill={photo.banner ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                      </button>

                      {/* Botão de Excluir */}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Excluir "${photo.name}" do portfólio?`)) {
                            onDeletePortfolioPhoto(photo.id);
                          }
                        }}
                        className="absolute top-2 right-2 bg-white/90 hover:bg-red-500 hover:text-white border border-stone-200 text-stone-500 rounded p-1.5 transition-all shadow-xs"
                        title="Remover foto do portfólio"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                      
                      <div className="p-2 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between">
                        <span className="text-[9px] font-semibold text-stone-500 truncate max-w-[120px]">{photo.name}</span>
                        <span className="text-[8px] font-mono text-stone-400 uppercase">{(photo.size / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 6: Casamentos Reais (Histórias) */}
      {activeSubTab === 'real-weddings' && (
        <div className="animate-scale-in space-y-6">
          {isAddingWedding ? (
            <div className="bg-stone-50/45 p-6 rounded-xl border border-stone-200/60 space-y-5">
              <div className="flex items-center justify-between border-b border-stone-200/50 pb-3">
                <h3 className="font-serif-editorial text-lg text-stone-900">Novo Casamento Real</h3>
                <button
                  onClick={() => setIsAddingWedding(false)}
                  className="px-3 py-1.5 border border-stone-200 text-stone-600 hover:text-stone-950 text-[9px] font-bold uppercase tracking-widest rounded bg-white transition-all shadow-2xs"
                >
                  Voltar para Lista
                </button>
              </div>

              <form onSubmit={handleSaveWedding} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Título da História</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Casamento no Campo de Amanda & Roberto"
                      value={weddingForm.titulo}
                      onChange={(e) => setWeddingForm({ ...weddingForm, titulo: e.target.value })}
                      className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Local</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Fazenda Vila Rica, SP"
                        value={weddingForm.local}
                        onChange={(e) => setWeddingForm({ ...weddingForm, local: e.target.value })}
                        className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Data</label>
                      <input
                        type="date"
                        required
                        value={weddingForm.data}
                        onChange={(e) => setWeddingForm({ ...weddingForm, data: e.target.value })}
                        className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">A História do Casal / Detalhes</label>
                  <textarea
                    required
                    rows="4"
                    placeholder="Conte um pouco sobre como foi o dia, a vibe do casal ou depoimentos..."
                    value={weddingForm.descricao}
                    onChange={(e) => setWeddingForm({ ...weddingForm, descricao: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 p-4 border border-stone-200 rounded-lg bg-white">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">Foto de Capa do Post (1 foto)</label>
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={(e) => setWeddingCoverFile(e.target.files[0])}
                      className="text-xs text-stone-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-stone-200 file:text-[9px] file:font-bold file:uppercase file:tracking-widest file:bg-stone-50 file:text-stone-700 hover:file:bg-stone-100"
                    />
                    {weddingCoverFile && (
                      <p className="text-[9px] text-emerald-600 font-mono uppercase mt-1">Capa Selecionada: {weddingCoverFile.name}</p>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 p-4 border border-stone-200 rounded-lg bg-white">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">Fotos da Galeria (Múltiplas)</label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      required
                      onChange={(e) => setWeddingPhotosFiles(Array.from(e.target.files || []))}
                      className="text-xs text-stone-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-stone-200 file:text-[9px] file:font-bold file:uppercase file:tracking-widest file:bg-stone-50 file:text-stone-700 hover:file:bg-stone-100"
                    />
                    {weddingPhotosFiles.length > 0 && (
                      <p className="text-[9px] text-emerald-600 font-mono uppercase mt-1">{weddingPhotosFiles.length} fotos selecionadas</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 p-4 border border-stone-200 rounded-lg bg-white">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Ficha Técnica / Fornecedores Parceiros</span>
                    <button
                      type="button"
                      onClick={handleAddFornecedorField}
                      className="px-2 py-1 border border-stone-200 text-stone-600 hover:text-stone-900 text-[8px] font-bold uppercase tracking-widest rounded hover:bg-stone-50 transition-all"
                    >
                      + Adicionar Fornecedor
                    </button>
                  </div>

                  <div className="space-y-2">
                    {weddingForm.fornecedores.map((forn, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Função (ex: Vestido)"
                          value={forn.funcao}
                          onChange={(e) => handleFornecedorChange(index, 'funcao', e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-stone-200 rounded text-[11px] focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Nome / Empresa"
                          value={forn.nome}
                          onChange={(e) => handleFornecedorChange(index, 'nome', e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-stone-200 rounded text-[11px] focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Instagram (ex: @atelie)"
                          value={forn.instagram}
                          onChange={(e) => handleFornecedorChange(index, 'instagram', e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-stone-200 rounded text-[11px] focus:outline-none"
                        />
                        {weddingForm.fornecedores.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFornecedorField(index)}
                            className="p-1.5 border border-red-200 hover:bg-red-50 text-red-500 rounded transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={uploadingWedding}
                    className="px-6 py-2.5 bg-stone-900 hover:bg-stone-850 text-white font-sans text-xs font-bold uppercase tracking-widest rounded transition-all shadow-md disabled:bg-stone-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {uploadingWedding ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Publicando no Site...
                      </>
                    ) : (
                      'Salvar Casamento Real'
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200/50 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">
                  Histórias Publicadas ({realWeddings.length})
                </span>
                <button
                  onClick={() => {
                    setWeddingForm({
                      titulo: '',
                      descricao: '',
                      local: '',
                      data: '',
                      fornecedores: [{ funcao: '', nome: '', instagram: '' }]
                    });
                    setWeddingCoverFile(null);
                    setWeddingPhotosFiles([]);
                    setIsAddingWedding(true);
                  }}
                  className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-850 text-white text-[9px] font-bold uppercase tracking-widest rounded transition-all shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/>
                  </svg>
                  Adicionar História
                </button>
              </div>

              {realWeddings.length === 0 ? (
                <div className="text-center py-16 border border-stone-200 rounded-xl bg-stone-50/15 text-stone-450 font-serif-editorial">
                  <p className="text-sm">Nenhum casamento real publicado ainda.</p>
                  <p className="text-xs text-stone-400 mt-1">Publique histórias inspiradoras com a ficha técnica dos parceiros!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {realWeddings.map((wed) => (
                    <div key={wed.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all flex flex-col md:flex-row h-auto md:h-40">
                      <div className="w-full md:w-40 h-32 md:h-full bg-stone-50 flex-shrink-0 overflow-hidden relative">
                        <img src={wed.capa} alt={wed.titulo} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-4 flex-grow flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{wed.local}</span>
                            <span className="text-[8px] text-stone-400 font-mono">{wed.data}</span>
                          </div>
                          <h4 className="font-serif-editorial text-sm text-stone-900 mt-1.5 font-light truncate" title={wed.titulo}>{wed.titulo}</h4>
                          <p className="text-[10px] text-stone-400 line-clamp-2 mt-1">{wed.descricao}</p>
                        </div>
                        <div className="flex items-center justify-between border-t border-stone-100 pt-2.5 mt-2">
                          <span className="text-[8px] font-mono uppercase text-stone-400 tracking-wider">
                            {wed.fotos?.length || 0} Fotos • {wed.fornecedores?.length || 0} Parceiros
                          </span>
                          <button
                            onClick={() => {
                              if (confirm(`Deseja excluir permanentemente a história "${wed.titulo}"?`)) {
                                if (onDeleteRealWedding) onDeleteRealWedding(wed.id);
                              }
                            }}
                            className="text-red-550 hover:text-red-700 text-[9px] font-bold uppercase tracking-widest transition-all"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 7: Blog / Dicas */}
      {activeSubTab === 'blog' && (
        <div className="animate-scale-in space-y-6">
          {isAddingBlogPost ? (
            <div className="bg-stone-50/45 p-6 rounded-xl border border-stone-200/60 space-y-5">
              <div className="flex items-center justify-between border-b border-stone-200/50 pb-3">
                <h3 className="font-serif-editorial text-lg text-stone-900">Novo Artigo de Dicas</h3>
                <button
                  onClick={() => setIsAddingBlogPost(false)}
                  className="px-3 py-1.5 border border-stone-200 text-stone-600 hover:text-stone-950 text-[9px] font-bold uppercase tracking-widest rounded bg-white transition-all shadow-2xs"
                >
                  Voltar para Lista
                </button>
              </div>

              <form onSubmit={handleSaveBlogPost} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Título do Artigo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Como escolher o look para o Ensaio Pré-Wedding"
                      value={blogPostForm.titulo}
                      onChange={(e) => setBlogPostForm({ ...blogPostForm, titulo: e.target.value })}
                      className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Categoria</label>
                    <select
                      value={blogPostForm.categoria}
                      onChange={(e) => setBlogPostForm({ ...blogPostForm, categoria: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none bg-white"
                    >
                      <option value="Dicas de Planejamento">Dicas de Planejamento</option>
                      <option value="Ideias de Looks">Ideias de Looks</option>
                      <option value="Escolha do Local">Escolha do Local</option>
                      <option value="Geral">Geral</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5 p-4 border border-stone-200 rounded-lg bg-white max-w-md">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">Foto de Capa do Artigo (1 foto)</label>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setBlogPostCoverFile(e.target.files[0])}
                    className="text-xs text-stone-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-stone-200 file:text-[9px] file:font-bold file:uppercase file:tracking-widest file:bg-stone-50 file:text-stone-700 hover:file:bg-stone-100"
                  />
                  {blogPostCoverFile && (
                    <p className="text-[9px] text-emerald-600 font-mono uppercase mt-1">Capa Selecionada: {blogPostCoverFile.name}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Conteúdo do Artigo</label>
                  <textarea
                    required
                    rows="8"
                    placeholder="Escreva aqui as dicas detalhadas para os noivos..."
                    value={blogPostForm.conteudo}
                    onChange={(e) => setBlogPostForm({ ...blogPostForm, conteudo: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={uploadingBlogPost}
                    className="px-6 py-2.5 bg-stone-900 hover:bg-stone-850 text-white font-sans text-xs font-bold uppercase tracking-widest rounded transition-all shadow-md disabled:bg-stone-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {uploadingBlogPost ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Publicando Artigo...
                      </>
                    ) : (
                      'Publicar Artigo'
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200/50 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">
                  Artigos Publicados ({blogPosts.length})
                </span>
                <button
                  onClick={() => {
                    setBlogPostForm({
                      titulo: '',
                      conteudo: '',
                      categoria: 'Dicas de Planejamento'
                    });
                    setBlogPostCoverFile(null);
                    setIsAddingBlogPost(true);
                  }}
                  className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-850 text-white text-[9px] font-bold uppercase tracking-widest rounded transition-all shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/>
                  </svg>
                  Escrever Artigo
                </button>
              </div>

              {blogPosts.length === 0 ? (
                <div className="text-center py-16 border border-stone-200 rounded-xl bg-stone-50/15 text-stone-450 font-serif-editorial">
                  <p className="text-sm">Nenhum artigo publicado no blog ainda.</p>
                  <p className="text-xs text-stone-400 mt-1">Compartilhe dicas interessantes e melhore seu posicionamento orgânico!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {blogPosts.map((post) => (
                    <div key={post.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all flex flex-col md:flex-row h-auto md:h-36">
                      <div className="w-full md:w-36 h-28 md:h-full bg-stone-50 flex-shrink-0 overflow-hidden relative">
                        <img src={post.capa} alt={post.titulo} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-4 flex-grow flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded">{post.categoria}</span>
                          </div>
                          <h4 className="font-serif-editorial text-sm text-stone-900 mt-2 font-light truncate" title={post.titulo}>{post.titulo}</h4>
                          <p className="text-[10px] text-stone-400 line-clamp-2 mt-1">{post.conteudo}</p>
                        </div>
                        <div className="flex items-center justify-between border-t border-stone-100 pt-2.5 mt-2">
                          <span className="text-[8px] font-mono uppercase text-stone-400">
                            {post.createdAt ? new Date(post.createdAt).toLocaleDateString('pt-BR') : 'Sem data'}
                          </span>
                          <button
                            onClick={() => {
                              if (confirm(`Deseja excluir permanentemente o artigo "${post.titulo}"?`)) {
                                if (onDeleteBlogPost) onDeleteBlogPost(post.id);
                              }
                            }}
                            className="text-red-550 hover:text-red-700 text-[9px] font-bold uppercase tracking-widest transition-all"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 8: Fale Conosco / Contato */}
      {activeSubTab === 'contato' && (
        <div className="animate-scale-in max-w-xl mx-auto space-y-6">
          <div className="bg-stone-50/45 p-6 rounded-xl border border-stone-200/60 space-y-5">
            <div className="border-b border-stone-200/50 pb-3">
              <h3 className="font-serif-editorial text-lg text-stone-900">Informações de Contato / Rodapé</h3>
              <p className="text-[10px] text-stone-450 uppercase tracking-widest leading-relaxed mt-0.5">
                Alimente as informações do Fale Conosco que aparecem no rodapé do seu site
              </p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (onSaveContato) {
                try {
                  await onSaveContato(contatoForm);
                  alert("Informações de contato salvas com sucesso!");
                } catch (err) {
                  console.error("[CONTACT SAVE ERROR]", err);
                  alert("Erro ao salvar informações de contato: " + err.message);
                }
              }
            }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Telefone de Exibição</label>
                <input
                  type="text"
                  placeholder="Ex: (11) 98888-7777"
                  value={contatoForm.telefone}
                  onChange={(e) => setContatoForm({ ...contatoForm, telefone: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">WhatsApp (Apenas números com DDD)</label>
                <input
                  type="text"
                  placeholder="Ex: 5511988887777"
                  value={contatoForm.whatsapp}
                  onChange={(e) => setContatoForm({ ...contatoForm, whatsapp: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                />
                <span className="text-[9px] text-stone-400 block mt-0.5">Importante: Comece com 55 (DDI do Brasil), seguido do DDD e do número (sem espaços, traços ou parênteses) para que o botão de link direto funcione!</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Instagram</label>
                <input
                  type="text"
                  placeholder="Ex: @wilksonfotografia"
                  value={contatoForm.instagram}
                  onChange={(e) => setContatoForm({ ...contatoForm, instagram: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">E-mail de Contato</label>
                <input
                  type="email"
                  placeholder="Ex: contato@wilksonfotografias.com.br"
                  value={contatoForm.email}
                  onChange={(e) => setContatoForm({ ...contatoForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Localização / Cidade</label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo - SP"
                  value={contatoForm.endereco}
                  onChange={(e) => setContatoForm({ ...contatoForm, endereco: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-stone-900 hover:bg-stone-850 text-white font-sans text-xs font-bold uppercase tracking-widest rounded transition-all shadow-md mt-4"
              >
                Salvar Informações de Contato
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && sharingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-150 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="font-serif-editorial text-lg text-stone-900">
                  Compartilhar Galeria
                </h3>
                <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mt-0.5">
                  Configure a mensagem e envie para o cliente
                </p>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-xl font-bold px-2 py-1"
              >
                &times;
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-grow p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Side: Parameters / Settings */}
              <div className="space-y-4 pr-0 md:pr-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-stone-500 block mb-2 border-b border-stone-100 pb-1">
                  Parâmetros da Mensagem
                </span>
                
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                    Prazo de Seleção
                  </label>
                  <input
                    type="date"
                    value={shareForm.prazo}
                    onChange={(e) => handleShareFormChange('prazo', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                    Observações / Notas Extras
                  </label>
                  <textarea
                    rows="3"
                    value={shareForm.observacoes}
                    onChange={(e) => handleShareFormChange('observacoes', e.target.value)}
                    placeholder="Ex: As fotos da apresentação serão enviadas separadas..."
                    className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20 resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                    E-mail para Contato/Suporte
                  </label>
                  <input
                    type="email"
                    value={shareForm.emailSuporte}
                    onChange={(e) => handleShareFormChange('emailSuporte', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                    Assinatura (Seu Nome)
                  </label>
                  <input
                    type="text"
                    value={shareForm.nomeFotografo}
                    onChange={(e) => handleShareFormChange('nomeFotografo', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20"
                  />
                </div>
                
                {isCustomMessageEdited && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleResetMessage}
                      className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded text-[9px] font-bold uppercase tracking-widest border border-stone-200 transition-all"
                    >
                      Resetar para o Modelo Padrão
                    </button>
                  </div>
                )}
              </div>
              
              {/* Right Side: Live Compiled Message (Editable) */}
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-1 mb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-stone-500">
                    Visualização da Mensagem
                  </span>
                  {isCustomMessageEdited && (
                    <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wide">
                      (Editado Manualmente)
                    </span>
                  )}
                </div>
                
                <div className="flex-grow flex flex-col">
                  <textarea
                    className="w-full flex-grow p-4 border border-stone-200 rounded-lg text-xs font-mono bg-stone-50/50 focus:outline-none focus:border-stone-900 resize-none min-h-[300px]"
                    value={shareForm.customMessage}
                    onChange={handleCustomMessageChange}
                    placeholder="A mensagem aparecerá aqui..."
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareForm.customMessage).then(() => {
                        alert("Mensagem copiada para a área de transferência!");
                      });
                    }}
                    className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-850 text-white rounded text-xs font-bold uppercase tracking-widest shadow transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Copiar Mensagem</span>
                  </button>
                  
                  {(() => {
                    const client = clientes.find(c => c.id === sharingEvent.id_cliente);
                    if (!client || !client.telefone) return null;
                    
                    const cleanPhone = client.telefone.replace(/\D/g, '');
                    const formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 ? '55' + cleanPhone : cleanPhone;
                    const waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(shareForm.customMessage)}`;
                    
                    return (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded text-xs font-bold uppercase tracking-widest shadow transition-colors flex items-center justify-center gap-2 text-center animate-pulse"
                      >
                        <span>Enviar WhatsApp</span>
                      </a>
                    );
                  })()}
                </div>
              </div>
              
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-stone-150 bg-stone-50 flex justify-end">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-5 py-2 border border-stone-200 text-stone-500 rounded text-xs font-bold uppercase tracking-widest hover:bg-stone-100 transition-colors"
              >
                Fechar
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Gerenciador de Fotos da Galeria Modal */}
      {photosModalEventId && (() => {
        const modalEvent = eventos.find(e => e.id === photosModalEventId);
        if (!modalEvent) return null;

        const photos = modalEvent.fotos || [];

        return (
          <div 
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setPhotosModalEventId(null)}
          >
            <div 
              className="bg-white border border-stone-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-stone-150 flex items-center justify-between bg-stone-50">
                <div>
                  <h3 className="font-serif-editorial text-lg text-stone-900">
                    Gerenciar Fotos da Galeria
                  </h3>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mt-0.5">
                    {modalEvent.titulo} &bull; {photos.length} fotos
                  </p>
                </div>
                <button
                  onClick={() => setPhotosModalEventId(null)}
                  className="text-stone-400 hover:text-stone-700 text-xl font-bold px-2 py-1"
                >
                  &times;
                </button>
              </div>

              {/* Photos List Grid */}
              <div className="flex-grow p-6 overflow-y-auto min-h-[300px]">
                {photos.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 font-serif-editorial">
                    <p className="text-base">Nenhuma foto enviada para esta galeria ainda.</p>
                    <p className="text-xs text-stone-400/80 mt-1">Utilize o botão "Upload" no painel principal para enviar as imagens.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {photos.map((photo) => (
                      <div 
                        key={photo.id}
                        className={`group relative bg-white border rounded-lg overflow-hidden shadow-xs hover:shadow-sm transition-all ${
                          photo.destaque ? 'border-amber-400 ring-1 ring-amber-400' : 'border-stone-200'
                        }`}
                      >
                        <div className="aspect-[4/3] w-full bg-stone-50 overflow-hidden relative">
                          <img
                            src={photo.url_storage}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          
                          {/* Destaque Badge */}
                          {photo.destaque && (
                            <div className="absolute top-2 left-2 bg-amber-400 text-stone-950 text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded shadow-sm z-10">
                              ★ Capa
                            </div>
                          )}
                        </div>

                        <div className="p-2 border-t border-stone-100 bg-stone-50/50 flex flex-col gap-1.5">
                          <span className="text-[9px] font-semibold text-stone-600 truncate">{photo.name}</span>
                          
                          <div className="flex gap-1 pt-1 border-t border-stone-100/80 justify-between items-center">
                            {/* Toggle Destaque Button */}
                            {photo.destaque ? (
                              <span className="text-[8px] text-amber-600 font-bold uppercase tracking-wider">Capa Ativa</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSetEventCover(modalEvent.id, photo.id)}
                                className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 rounded text-[8px] font-bold uppercase tracking-wider transition-colors border border-amber-250"
                              >
                                Definir Capa
                              </button>
                            )}

                            {/* Delete Photo Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir a foto "${photo.name}" desta galeria?`)) {
                                  onDeleteEventPhoto(modalEvent.id, photo.id);
                                }
                              }}
                              className="px-1.5 py-0.5 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-700 rounded text-[8px] font-bold uppercase tracking-wider transition-colors border border-red-200"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-stone-150 bg-stone-50 flex justify-end">
                <button
                  onClick={() => setPhotosModalEventId(null)}
                  className="px-5 py-2 border border-stone-200 text-stone-500 rounded text-xs font-bold uppercase tracking-widest hover:bg-stone-100 transition-colors"
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
