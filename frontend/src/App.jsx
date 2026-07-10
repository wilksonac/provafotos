import React, { useState, useEffect } from 'react';
import AdminDashboard from './pages/AdminDashboard';
import UploadQueue from './components/UploadQueue';
import PhotoVirtualGrid from './components/PhotoVirtualGrid';
import { sendClientCredentialsEmail, sendSelectionFinalizedEmails } from './lib/brevo';

// Dados iniciais de fallback
const defaultClientes = [
  { id: 'cli_1', nome: 'Rafaela & Augusto', email: 'rafaela.augusto@email.com', telefone: '(11) 98888-7777', senha: '123456' },
  { id: 'cli_2', nome: 'Beatriz Costa', email: 'beatriz@email.com', telefone: '(21) 97777-6666', senha: '123456' }
];

const defaultEventos = [
  {
    id: 'evt_1',
    id_cliente: 'cli_1',
    titulo: 'Casamento Rafaela & Augusto',
    data: '2026-06-18',
    limite_fotos: 25,
    status: 'ativa',
    token: 'casamento-rafaela-augusto',
    selecao_livre: false,
    permitir_extras: true,
    valor_foto_extra: 20.0,
    marca_dagua_ativa: true,
    marca_dagua_texto: 'WILKSON FOTOGRAFIAS',
    marca_dagua_opacidade: 30,
    marca_dagua_miniaturas: true,
    marca_dagua_expandida: true,
    tipo_galeria: 'casamento',
    permitir_download: true,
    pagamento_extras_confirmado: false,
    fotos: [] // Vazio inicialmente; aciona o gerador de 10.000 fotos na demo.
  }
];

export default function App() {
  // Inicialização de Clientes via localStorage
  const [clientes, setClientes] = useState(() => {
    try {
      const saved = localStorage.getItem('wilkson_clientes');
      return saved ? JSON.parse(saved) : defaultClientes;
    } catch (e) {
      console.error("Erro ao carregar clientes do localStorage", e);
      return defaultClientes;
    }
  });

  // Inicialização de Eventos via localStorage
  const [eventos, setEventos] = useState(() => {
    try {
      const saved = localStorage.getItem('wilkson_eventos');
      return saved ? JSON.parse(saved) : defaultEventos;
    } catch (e) {
      console.error("Erro ao carregar eventos do localStorage", e);
      return defaultEventos;
    }
  });

  // Navegação e Controle de Rotas
  const [activeTab, setActiveTab] = useState('client'); // 'client' | 'admin' | 'uploader' | 'magic-client'
  const [activeEventId, setActiveEventId] = useState(null);
  const [selectedGalleryToken, setSelectedGalleryToken] = useState(null);

  // Controle de autenticação para galerias restritas (Login + Senha)
  const [authenticatedGalleries, setAuthenticatedGalleries] = useState(() => {
    try {
      const saved = sessionStorage.getItem('wilkson_auth_galleries');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('wilkson_auth_galleries', JSON.stringify(authenticatedGalleries));
    } catch (e) {}
  }, [authenticatedGalleries]);

  // Monitora alterações nos Clientes e persiste no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wilkson_clientes', JSON.stringify(clientes));
    } catch (e) {
      console.error("Quota do LocalStorage excedida para clientes", e);
    }
  }, [clientes]);

  // Monitora alterações nos Eventos e persiste no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wilkson_eventos', JSON.stringify(eventos));
    } catch (e) {
      console.warn("Quota do LocalStorage excedida para eventos", e);
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        alert("Atenção: O limite de armazenamento do navegador foi excedido pelas fotos salvas. \n\nPara evitar que fotos novas sumam ao recarregar, exclua algumas fotos ou use arquivos mais leves de teste (até 200kb).");
      }
    }
  }, [eventos]);

  // Monitora a URL para simular Links Mágicos (?gallery=token)
  useEffect(() => {
    const handleUrlRoute = () => {
      const params = new URLSearchParams(window.location.search);
      const galleryToken = params.get('gallery');
      if (galleryToken) {
        console.log(`[ROUTE] Link mágico detectado para a galeria: ${galleryToken}`);
        setSelectedGalleryToken(galleryToken);
        setActiveTab('magic-client');
      }
    };

    handleUrlRoute();
    
    // Escuta eventos de navegação interna (popstate)
    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, []);

  // Handlers para Clientes (Retorna o cliente recém criado para vinculação síncrona inline)
  const handleAddCliente = (newClientData) => {
    const newClient = {
      id: newClientData.id || `cli_${Date.now()}`,
      ...newClientData
    };
    setClientes((prev) => {
      const exists = prev.some((c) => c.id === newClient.id);
      if (exists) {
        return prev.map((c) => (c.id === newClient.id ? newClient : c));
      }
      return [...prev, newClient];
    });
    console.log("[ADMIN] Cadastro de cliente processado:", newClient);
    return newClient;
  };

  // Handlers para Eventos/Galerias
  const handleAddEvento = (newEventData, clientObj = null) => {
    const slug = newEventData.titulo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // remove caracteres especiais
      .replace(/\s+/g, '-') // substitui espaços por hifens
      .replace(/-+/g, '-'); // colapsa hifens repetidos

    const newEvent = {
      id: `evt_${Date.now()}`,
      status: 'ativa',
      token: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`, // token único de URL
      fotos: [],
      ...newEventData
    };
    
    setEventos((prev) => [...prev, newEvent]);
    console.log("[ADMIN] Nova galeria de evento criada:", newEvent);

    // Enviar e-mail de credenciais ao cliente
    const client = clientObj || clientes.find((c) => c.id === newEvent.id_cliente);
    if (client) {
      sendClientCredentialsEmail({
        email: client.email,
        name: client.nome,
        galleryTitle: newEvent.titulo,
        galleryToken: newEvent.token,
        password: client.senha
      }).then((res) => {
        if (res.success) {
          console.log(`[EMAIL] E-mail de credenciais enviado com sucesso para ${client.email}`);
        } else {
          console.error(`[EMAIL] Falha ao enviar e-mail de credenciais: ${res.error}`);
        }
      });
    }
  };

  // Vincular upload de fotos ao evento selecionado no painel
  const handleUploadSuccess = (uploadedFileData) => {
    console.log(`[UPLOAD] Vinculando foto enviada (${uploadedFileData.name}) ao evento: ${activeEventId}`);
    setEventos((prevEventos) =>
      prevEventos.map((evt) => {
        if (evt.id === activeEventId) {
          return {
            ...evt,
            fotos: [
              ...evt.fotos,
              {
                id: uploadedFileData.id,
                name: uploadedFileData.name,
                url_storage: uploadedFileData.url,
                selecionada: false
              }
            ]
          };
        }
        return evt;
      })
    );
  };

  // Toggles de seleção na galeria do cliente
  const handleToggleSelection = (eventId, photoId, isSelected) => {
    setEventos((prevEventos) =>
      prevEventos.map((evt) => {
        if (evt.id === eventId) {
          return {
            ...evt,
            fotos: (evt.fotos || []).map((photo) =>
              photo.id === photoId ? { ...photo, selecionada: isSelected } : photo
            )
          };
        }
        return evt;
      })
    );
  };

  // Finalizar evento
  const handleFinalizeEvent = (eventId) => {
    setEventos((prevEventos) => {
      const updated = prevEventos.map((evt) =>
        evt.id === eventId ? { ...evt, status: 'finalizada' } : evt
      );

      // Disparar e-mails de finalização de seleção
      const targetEvent = updated.find((e) => e.id === eventId);
      if (targetEvent) {
        const client = clientes.find((c) => c.id === targetEvent.id_cliente);
        if (client) {
          const selectedPhotos = (targetEvent.fotos || []).filter((f) => f.selecionada).length;
          const totalPhotos = (targetEvent.fotos || []).length;

          sendSelectionFinalizedEmails({
            clientName: client.nome,
            clientEmail: client.email,
            galleryTitle: targetEvent.titulo,
            selectedCount: selectedPhotos,
            totalCount: totalPhotos
          }).then((res) => {
            console.log(`[EMAIL] Notificações de finalização enviadas.`);
          });
        }
      }

      return updated;
    });
    console.log(`[EVENT] Evento ${eventId} finalizado e travado.`);
  };

  // Reabrir evento
  const handleReopenEvento = (eventId) => {
    setEventos((prevEventos) =>
      prevEventos.map((evt) =>
        evt.id === eventId ? { ...evt, status: 'ativa' } : evt
      )
    );
    console.log(`[EVENT] Evento ${eventId} reaberto com sucesso.`);
  };

  // Confirmar pagamento das fotos extras
  const handleConfirmPayment = (eventId) => {
    setEventos((prevEventos) =>
      prevEventos.map((evt) =>
        evt.id === eventId ? { ...evt, pagamento_extras_confirmado: true } : evt
      )
    );
    console.log(`[PAYMENT] Pagamento das fotos extras confirmado para o evento: ${eventId}`);
  };

  // Excluir galeria/evento
  const handleDeleteEvento = (eventId) => {
    setEventos((prevEventos) => prevEventos.filter((evt) => evt.id !== eventId));
    console.log(`[EVENT] Evento ${eventId} excluído com sucesso.`);
  };

  // Redirecionamento da ação "Fazer Upload" no Dashboard
  const triggerEventUpload = (eventId) => {
    setActiveEventId(eventId);
    setActiveTab('uploader');
  };

  // Redirecionamento da ação "Ver Galeria" no Dashboard (Simula clique no link)
  const triggerEventView = (token) => {
    setSelectedGalleryToken(token);
    setActiveTab('magic-client');
    window.history.pushState({}, '', `/?gallery=${token}`);
  };

  // Reseta a rota de volta para o ambiente de testes
  const handleBackToWorkspace = () => {
    setSelectedGalleryToken(null);
    setActiveTab('admin');
    window.history.pushState({}, '', '/');
  };

  const activeEvent = eventos.find((e) => e.id === activeEventId);

  // Renderização específica para link mágico (?gallery=token)
  if (activeTab === 'magic-client' && selectedGalleryToken) {
    const matchedEvent = eventos.find((e) => e.token === selectedGalleryToken);
    
    if (!matchedEvent) {
      return (
        <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-stone-500 font-serif-editorial">
          <h2 className="text-2xl mb-2 font-light">Link Inválido ou Galeria Removida</h2>
          <button
            onClick={handleBackToWorkspace}
            className="mt-4 px-4 py-2 border border-stone-200 text-stone-900 rounded font-sans text-xs font-bold uppercase tracking-widest bg-white"
          >
            Voltar ao Início
          </button>
        </div>
      );
    }

    // Portão de segurança: se a galeria exige login e o cliente ainda não se autenticou nesta sessão
    if (matchedEvent.acesso_restrito && !authenticatedGalleries[matchedEvent.id]) {
      return (
        <ClientLoginForm
          event={matchedEvent}
          clientes={clientes}
          onLoginSuccess={() => setAuthenticatedGalleries((prev) => ({ ...prev, [matchedEvent.id]: true }))}
          onBack={handleBackToWorkspace}
        />
      );
    }

    return (
      <div className="min-h-screen flex flex-col">
        {/* Link para voltar ao painel de testes (Apenas visível em modo sandbox) */}
        <div className="bg-stone-100 border-b border-stone-200 px-8 py-2 flex items-center justify-between text-xs text-stone-500">
          <span>Modo Link Mágico Ativo &bull; Dados persistidos no LocalStorage</span>
          <button onClick={handleBackToWorkspace} className="underline hover:text-stone-900 font-bold uppercase tracking-wider text-[10px]">
            [ Voltar para Painel Admin ]
          </button>
        </div>
        
        <div className="flex-grow">
          <PhotoVirtualGrid
            key={`${matchedEvent.id}_${(matchedEvent.fotos || []).length}_${matchedEvent.status}`} // Força re-renderização/montagem se mudar fotos ou status
            eventId={matchedEvent.id}
            initialPhotos={matchedEvent.fotos || []}
            limiteFotos={matchedEvent.limite_fotos}
            statusEvento={matchedEvent.status}
            permitirExtras={matchedEvent.permitir_extras}
            selecaoLivre={matchedEvent.selecao_livre}
            valorFotoExtra={matchedEvent.valor_foto_extra}
            marcaDaguaAtiva={matchedEvent.marca_dagua_ativa}
            marcaDaguaTexto={matchedEvent.marca_dagua_texto}
            marcaDaguaOpacidade={matchedEvent.marca_dagua_opacidade}
            marcaDaguaMiniaturas={matchedEvent.marca_dagua_miniaturas}
            marcaDaguaExpandida={matchedEvent.marca_dagua_expandida}
            tipoGaleria={matchedEvent.tipo_galeria}
            permitirDownload={matchedEvent.permitir_download}
            pagamentoExtrasConfirmado={matchedEvent.pagamento_extras_confirmado}
            tituloEvent={matchedEvent.titulo}
            dataEvent={matchedEvent.data}
            onToggleSelection={(photoId, isSelected) => handleToggleSelection(matchedEvent.id, photoId, isSelected)}
            onFinalizeEvent={handleFinalizeEvent}
            isDemo={!matchedEvent.fotos || matchedEvent.fotos.length === 0}
            isAdmin={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-800 flex flex-col font-sans selection:bg-stone-200">
      
      {/* Cabeçalho do Workspace Sandbox */}
      <header className="bg-white border-b border-stone-200 px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-stone-900 rounded flex items-center justify-center font-serif text-white font-light text-base tracking-widest shadow-sm">
            W
          </div>
          <div>
            <h1 className="font-serif-editorial text-lg font-normal tracking-widest text-stone-900">WILKSON FOTOGRAFIAS</h1>
            <p className="text-[9px] text-stone-400 uppercase tracking-widest font-semibold mt-0.5">Plataforma de Seleção &bull; Banco de Dados LocalStorage</p>
          </div>
        </div>

        {/* Abas Superiores de Controle & Botão de Reset de Testes */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200/60">
            <button
              onClick={() => {
                setActiveTab('client');
                setSelectedGalleryToken(null);
              }}
              className={`px-5 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'client'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Área do Cliente (Demo 10k)
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-5 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'admin' || activeTab === 'uploader'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Painel Admin
            </button>
          </div>

          <button
            onClick={() => {
              if (confirm("Atenção: Isso apagará permanentemente todas as galerias de fotos, cadastros de clientes e seleções salvas no LocalStorage do seu navegador. Deseja prosseguir?")) {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }
            }}
            className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-650 hover:text-red-700 rounded text-[10px] font-bold uppercase tracking-widest transition-all"
            title="Apagar todos os dados locais do sandbox e recomeçar do zero"
          >
            Resetar Banco
          </button>
        </div>
      </header>

      {/* Main Content Render */}
      <main className="flex-grow flex flex-col p-6">
        
        {/* Aba 1: Área do Cliente - Visualização Padrão */}
        {activeTab === 'client' && (
          <div className="flex-grow border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <PhotoVirtualGrid
              eventId="event_demo_default"
              limiteFotos={25}
              statusEvento="ativa"
              permitirExtras={true}
              selecaoLivre={false}
              valorFotoExtra={25.0}
              isDemo={true} 
            />
          </div>
        )}

        {/* Aba 2: Admin Dashboard */}
        {activeTab === 'admin' && (
          <AdminDashboard
            clientes={clientes}
            eventos={eventos}
            onAddCliente={handleAddCliente}
            onAddEvento={handleAddEvento}
            onSelectEventUpload={triggerEventUpload}
            onSelectEventView={triggerEventView}
            onConfirmPayment={handleConfirmPayment}
            onDeleteEvento={handleDeleteEvento}
            onReopenEvento={handleReopenEvento}
          />
        )}

        {/* Aba 3: Upload Queue Uploader Específico */}
        {activeTab === 'uploader' && activeEvent && (
          <div className="w-full flex flex-col items-center justify-center py-6 animate-scale-in">
            <div className="w-full max-w-2xl bg-white border border-stone-200 border-b-0 rounded-t-xl px-6 py-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Upload Ativo</span>
                <h3 className="font-serif-editorial text-lg text-stone-900 mt-0.5">{activeEvent.titulo}</h3>
              </div>
              <button
                onClick={() => setActiveTab('admin')}
                className="px-4 py-1.5 border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-950 rounded text-[9px] font-bold uppercase tracking-widest transition-all"
              >
                Voltar ao Painel
              </button>
            </div>
            
            <UploadQueue
              eventId={activeEvent.id}
              onUploadSuccess={handleUploadSuccess}
              onFinished={() => setActiveTab('admin')}
            />
          </div>
        )}

      </main>
    </div>
  );
}

function ClientLoginForm({ event, clientes, onLoginSuccess, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const client = clientes.find((c) => c.id === event.id_cliente);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!client) {
      setError('Cliente não cadastrado ou não encontrado.');
      return;
    }

    const emailMatch = client.email.trim().toLowerCase() === email.trim().toLowerCase();
    const passwordMatch = (client.senha || '') === password;

    if (emailMatch && passwordMatch) {
      onLoginSuccess();
    } else {
      setError('E-mail ou senha de acesso incorretos.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-between text-stone-900 font-sans selection:bg-stone-200">
      {/* Top Header Mode indicator */}
      <div className="bg-stone-100 border-b border-stone-200 px-8 py-2 flex items-center justify-between text-xs text-stone-500">
        <span>Acesso Restrito &bull; Identifique-se para continuar</span>
        <button onClick={onBack} className="underline hover:text-stone-900 font-bold uppercase tracking-wider text-[10px]">
          [ Voltar para Painel Admin ]
        </button>
      </div>

      <div className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-stone-200 shadow-xl rounded-xl overflow-hidden animate-scale-in">
          {/* Decorative Cover Header */}
          <div className="relative h-24 bg-stone-900 flex items-center justify-center text-center px-4">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600')] bg-cover bg-center brightness-[0.4]" />
            <span className="relative z-10 font-serif-editorial text-sm tracking-widest text-white uppercase">{event.titulo}</span>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div className="text-center mb-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Identificação Requerida</span>
              <h3 className="font-serif-editorial text-xl font-normal text-stone-850 mt-1">Acessar Galeria</h3>
              <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                Esta galeria é restrita. Faça login usando seu e-mail cadastrado e a senha de acesso.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded text-xs font-bold text-red-600 animate-pulse text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                  E-mail do Cliente
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu-email@exemplo.com"
                  className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                  Senha de Acesso
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-850 text-white rounded text-xs font-bold uppercase tracking-widest transition-all mt-3 shadow"
            >
              Entrar na Galeria
            </button>
          </form>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="py-4 text-center text-[10px] text-stone-400 font-sans border-t border-stone-200/50">
        Wilkson Fotografias &copy; {new Date().getFullYear()} &bull; Todos os direitos reservados.
      </div>
    </div>
  );
}
