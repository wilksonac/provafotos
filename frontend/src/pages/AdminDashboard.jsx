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
  onAddCliente,
  onAddEvento,
  onSelectEventUpload,
  onSelectEventView,
  onConfirmPayment,
  onDeleteEvento,
  onReopenEvento
}) {
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'clients' | 'new-client' | 'new-gallery'
  
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

  // Categoria de Galeria & Download
  const [tipoGaleria, setTipoGaleria] = useState('ensaio');
  const [permitirDownload, setPermitirDownload] = useState(true);
  const [acessoRestrito, setAcessoRestrito] = useState(false);

  const [copySuccess, setCopySuccess] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
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
      
      {/* Dashboard Sub Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-stone-150 pb-5 mb-6 gap-4">
        <div>
          <h2 className="font-serif-editorial text-2xl font-light tracking-wide text-stone-900">
            Painel de Controle do Fotógrafo
          </h2>
          <p className="text-xs text-stone-400 mt-1 uppercase tracking-wider font-semibold">
            Gerencie seus clientes, crie novas galerias de fotos e envie links mágicos
          </p>
        </div>

        {/* Sub-tab Switchers */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded ${
              activeSubTab === 'overview'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
            }`}
          >
            Galerias
          </button>
          <button
            onClick={() => setActiveSubTab('clients')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded ${
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
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded ${
              activeSubTab === 'new-client'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
            }`}
          >
            + Novo Cliente
          </button>
          <button
            onClick={() => setActiveSubTab('new-gallery')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded ${
              activeSubTab === 'new-gallery'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 hover:bg-stone-200/70 text-stone-500 hover:text-stone-800'
            }`}
          >
            + Nova Galeria
          </button>
        </div>
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
                                          ? 'bg-stone-100 border-stone-250 text-stone-600'
                                          : computedStatus === 'expirada'
                                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                                          : 'bg-emerald-50 border-emerald-250 text-emerald-700'
                                      }`}>
                                        {computedStatus === 'finalizada' ? 'Finalizada' :
                                         computedStatus === 'expirada' ? 'Expirada' : 'Aberta'}
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

          {/* Data do Ensaio */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
              Data do Ensaio
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

    </div>
  );
}
