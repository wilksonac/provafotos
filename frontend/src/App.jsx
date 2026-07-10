import React, { useState, useEffect } from 'react';
import AdminDashboard from './pages/AdminDashboard';
import UploadQueue from './components/UploadQueue';
import PhotoVirtualGrid from './components/PhotoVirtualGrid';
import { sendClientCredentialsEmail, sendSelectionFinalizedEmails } from './lib/brevo';
import { db } from './lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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

const defaultPortfolio = [
  // Casamentos
  { id: 'p1', name: 'Casamento 1', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80', category: 'casamentos', size: 180 * 1024 },
  { id: 'p2', name: 'Casamento 2', url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80', category: 'casamentos', size: 190 * 1024 },
  { id: 'p3', name: 'Casamento 3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80', category: 'casamentos', size: 210 * 1024 },
  
  // Infantil
  { id: 'p4', name: 'Infantil 1', url: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&auto=format&fit=crop&q=80', category: 'infantil', size: 150 * 1024 },
  { id: 'p5', name: 'Infantil 2', url: 'https://images.unsplash.com/photo-1519689680058-324335c77ebe?w=800&auto=format&fit=crop&q=80', category: 'infantil', size: 170 * 1024 },
  
  // Formatura
  { id: 'p6', name: 'Formatura 1', url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80', category: 'formatura', size: 220 * 1024 },
  { id: 'p7', name: 'Formatura 2', url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80', category: 'formatura', size: 200 * 1024 },
  
  // Corporativo
  { id: 'p8', name: 'Corporativo 1', url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&auto=format&fit=crop&q=80', category: 'corporativo', size: 160 * 1024 },
  { id: 'p9', name: 'Corporativo 2', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80', category: 'corporativo', size: 180 * 1024 }
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

  // Inicialização do Portfólio via localStorage
  const [portfolio, setPortfolio] = useState(() => {
    try {
      const saved = localStorage.getItem('wilkson_portfolio');
      return saved ? JSON.parse(saved) : defaultPortfolio;
    } catch (e) {
      console.error("Erro ao carregar portfólio do localStorage", e);
      return defaultPortfolio;
    }
  });

  // Navegação e Controle de Rotas
  const [activeTab, setActiveTab] = useState('client'); // 'client' | 'admin' | 'uploader' | 'magic-client'
  const [activeEventId, setActiveEventId] = useState(null);
  const [selectedGalleryToken, setSelectedGalleryToken] = useState(null);

  // Estados do Portfólio Público
  const [portfolioCategory, setPortfolioCategory] = useState('todos');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showClientLogin, setShowClientLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

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

  // Sincronizar clientes, eventos e portfólio do Firestore em tempo real
  useEffect(() => {
    if (!db) return;

    console.log("[FIREBASE] Ativando ouvintes em tempo real do Firestore...");
    
    const unsubscribeClientes = onSnapshot(collection(db, "clientes"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      if (docs.length === 0) {
        // Inicializar com dados padrão se estiver vazio
        defaultClientes.forEach(async (c) => {
          await setDoc(doc(db, "clientes", c.id), c);
        });
      } else {
        setClientes(docs);
      }
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar clientes:", error);
    });

    const unsubscribeEventos = onSnapshot(collection(db, "eventos"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      if (docs.length === 0) {
        // Inicializar com dados padrão se estiver vazio
        defaultEventos.forEach(async (e) => {
          await setDoc(doc(db, "eventos", e.id), e);
        });
      } else {
        setEventos(docs);
      }
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar eventos:", error);
    });

    const unsubscribePortfolio = onSnapshot(collection(db, "portfolio"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      if (docs.length === 0) {
        // Inicializar com dados padrão se estiver vazio
        defaultPortfolio.forEach(async (p) => {
          await setDoc(doc(db, "portfolio", p.id), p);
        });
      } else {
        setPortfolio(docs);
      }
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar portfólio:", error);
    });

    return () => {
      unsubscribeClientes();
      unsubscribeEventos();
      unsubscribePortfolio();
    };
  }, []);

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

  // Monitora alterações no Portfólio e persiste no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wilkson_portfolio', JSON.stringify(portfolio));
    } catch (e) {
      console.warn("Quota do LocalStorage excedida para portfólio", e);
    }
  }, [portfolio]);

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

  // Controla contagem de visualizações do evento para estimativa de banda de tráfego
  useEffect(() => {
    if (activeTab === 'magic-client' && selectedGalleryToken) {
      const matchedEvent = eventos.find((e) => e.token === selectedGalleryToken);
      if (matchedEvent) {
        // Se acesso for restrito, conta apenas quando estiver autenticado
        const isAuth = !matchedEvent.acesso_restrito || authenticatedGalleries[matchedEvent.id];
        if (isAuth) {
          const viewedSessionKey = `viewed_${matchedEvent.id}`;
          if (!sessionStorage.getItem(viewedSessionKey)) {
            sessionStorage.setItem(viewedSessionKey, 'true');
            if (db) {
              const currentViews = matchedEvent.views || 0;
              updateDoc(doc(db, "eventos", matchedEvent.id), { views: currentViews + 1 })
                .then(() => console.log("[FIREBASE] Visualização incrementada:", matchedEvent.id))
                .catch(err => console.error("[FIREBASE] Erro ao incrementar views:", err));
            } else {
              setEventos(prev => prev.map(e => e.id === matchedEvent.id ? { ...e, views: (e.views || 0) + 1 } : e));
            }
          }
        }
      }
    }
  }, [activeTab, selectedGalleryToken, authenticatedGalleries, eventos]);

  // Handlers para Clientes (Retorna o cliente recém criado para vinculação síncrona inline)
  const handleAddCliente = (newClientData) => {
    const newClient = {
      id: newClientData.id || `cli_${Date.now()}`,
      ...newClientData
    };
    
    if (db) {
      setDoc(doc(db, "clientes", newClient.id), newClient)
        .then(() => console.log("[FIREBASE] Cliente salvo:", newClient.id))
        .catch(err => console.error("[FIREBASE] Erro ao salvar cliente:", err));
    } else {
      setClientes((prev) => {
        const exists = prev.some((c) => c.id === newClient.id);
        if (exists) {
          return prev.map((c) => (c.id === newClient.id ? newClient : c));
        }
        return [...prev, newClient];
      });
    }
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
    
    if (db) {
      setDoc(doc(db, "eventos", newEvent.id), newEvent)
        .then(() => console.log("[FIREBASE] Evento salvo:", newEvent.id))
        .catch(err => console.error("[FIREBASE] Erro ao salvar evento:", err));
    } else {
      setEventos((prev) => [...prev, newEvent]);
    }
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
    
    const targetEvent = eventos.find(e => e.id === activeEventId);
    if (!targetEvent) return;

    const newPhoto = {
      id: uploadedFileData.id,
      name: uploadedFileData.name,
      url_storage: uploadedFileData.url,
      size: uploadedFileData.size || 150 * 1024, // 150KB default fallback
      selecionada: false
    };

    if (db) {
      const updatedPhotos = [...(targetEvent.fotos || []), newPhoto];
      updateDoc(doc(db, "eventos", activeEventId), { fotos: updatedPhotos })
        .then(() => console.log("[FIREBASE] Foto vinculada ao evento:", activeEventId))
        .catch(err => console.error("[FIREBASE] Erro ao vincular foto:", err));
    } else {
      setEventos((prevEventos) =>
        prevEventos.map((evt) => {
          if (evt.id === activeEventId) {
            return {
              ...evt,
              fotos: [...(evt.fotos || []), newPhoto]
            };
          }
          return evt;
        })
      );
    }
  };

  // Toggles de seleção na galeria do cliente
  const handleToggleSelection = (eventId, photoId, isSelected) => {
    const targetEvent = eventos.find(e => e.id === eventId);
    if (!targetEvent) return;

    const updatedPhotos = (targetEvent.fotos || []).map((photo) =>
      photo.id === photoId ? { ...photo, selecionada: isSelected } : photo
    );

    if (db) {
      updateDoc(doc(db, "eventos", eventId), { fotos: updatedPhotos })
        .then(() => console.log("[FIREBASE] Seleção de foto atualizada:", photoId))
        .catch(err => console.error("[FIREBASE] Erro ao atualizar seleção de foto:", err));
    } else {
      setEventos((prevEventos) =>
        prevEventos.map((evt) => {
          if (evt.id === eventId) {
            return {
              ...evt,
              fotos: updatedPhotos
            };
          }
          return evt;
        })
      );
    }
  };

  // Finalizar evento
  const handleFinalizeEvent = (eventId) => {
    if (db) {
      const targetEvent = eventos.find((e) => e.id === eventId);
      if (targetEvent) {
        updateDoc(doc(db, "eventos", eventId), { status: "finalizada" })
          .then(() => {
            console.log("[FIREBASE] Evento finalizado:", eventId);
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
          })
          .catch((err) => console.error("[FIREBASE] Erro ao finalizar evento:", err));
      }
    } else {
      setEventos((prevEventos) => {
        const updated = prevEventos.map((evt) =>
          evt.id === eventId ? { ...evt, status: 'finalizada' } : evt
        );

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
    }
    console.log(`[EVENT] Evento ${eventId} finalizado e travado.`);
  };

  // Reabrir evento
  const handleReopenEvento = (eventId) => {
    if (db) {
      updateDoc(doc(db, "eventos", eventId), { status: "ativa" })
        .then(() => console.log("[FIREBASE] Evento reaberto:", eventId))
        .catch(err => console.error("[FIREBASE] Erro ao reabrir evento:", err));
    } else {
      setEventos((prevEventos) =>
        prevEventos.map((evt) =>
          evt.id === eventId ? { ...evt, status: 'ativa' } : evt
        )
      );
    }
    console.log(`[EVENT] Evento ${eventId} reaberto com sucesso.`);
  };

  // Confirmar pagamento das fotos extras
  const handleConfirmPayment = (eventId) => {
    if (db) {
      updateDoc(doc(db, "eventos", eventId), { pagamento_extras_confirmado: true })
        .then(() => console.log("[FIREBASE] Pagamento extras confirmado:", eventId))
        .catch(err => console.error("[FIREBASE] Erro ao confirmar pagamento:", err));
    } else {
      setEventos((prevEventos) =>
        prevEventos.map((evt) =>
          evt.id === eventId ? { ...evt, pagamento_extras_confirmado: true } : evt
        )
      );
    }
    console.log(`[PAYMENT] Pagamento das fotos extras confirmado para o evento: ${eventId}`);
  };

  // Excluir galeria/evento
  const handleDeleteEvento = (eventId) => {
    if (db) {
      deleteDoc(doc(db, "eventos", eventId))
        .then(() => console.log("[FIREBASE] Evento deletado:", eventId))
        .catch(err => console.error("[FIREBASE] Erro ao deletar evento:", err));
    } else {
      setEventos((prevEventos) => prevEventos.filter((evt) => evt.id !== eventId));
    }
    console.log(`[EVENT] Evento ${eventId} excluído com sucesso.`);
  };

  // Adicionar foto ao portfólio
  const handleAddPortfolioPhoto = (photoData) => {
    const newPhoto = {
      id: photoData.id || `port_${Date.now()}`,
      name: photoData.name,
      url: photoData.url,
      category: photoData.category,
      size: photoData.size || 150 * 1024
    };

    if (db) {
      setDoc(doc(db, "portfolio", newPhoto.id), newPhoto)
        .then(() => console.log("[FIREBASE] Foto do portfólio salva:", newPhoto.id))
        .catch(err => console.error("[FIREBASE] Erro ao salvar foto no portfólio:", err));
    } else {
      setPortfolio((prev) => [...prev, newPhoto]);
    }
  };

  // Excluir foto do portfólio
  const handleDeletePortfolioPhoto = (photoId) => {
    if (db) {
      deleteDoc(doc(db, "portfolio", photoId))
        .then(() => console.log("[FIREBASE] Foto do portfólio deletada:", photoId))
        .catch(err => console.error("[FIREBASE] Erro ao deletar foto do portfólio:", err));
    } else {
      setPortfolio((prev) => prev.filter((p) => p.id !== photoId));
    }
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

  // Autenticação geral na área do cliente (quando não usam link mágico)
  const handleGeneralLogin = (e) => {
    e.preventDefault();
    setLoginError('');

    // Achar cliente pelo email e senha (com conversão segura para string e trim)
    const client = clientes.find(
      (c) => c.email.toLowerCase() === loginEmail.toLowerCase().trim() && 
             String(c.senha || '').trim() === String(loginPassword || '').trim()
    );

    if (!client) {
      setLoginError('E-mail ou senha incorretos.');
      return;
    }

    // Achar evento vinculado a este cliente
    const matchedEvent = eventos.find((evt) => evt.id_cliente === client.id);
    if (!matchedEvent) {
      setLoginError('Nenhuma galeria ativa vinculada a este cliente.');
      return;
    }

    // Autenticar e redirecionar
    setAuthenticatedGalleries((prev) => ({ ...prev, [matchedEvent.id]: true }));
    setSelectedGalleryToken(matchedEvent.token);
    setActiveTab('magic-client');
    setShowClientLogin(false);
    setLoginEmail('');
    setLoginPassword('');
    console.log(`[CLIENT LOGIN] Sucesso para o cliente ${client.nome}. Acessando galeria: ${matchedEvent.titulo}`);
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
      
      {/* Cabeçalho */}
      <header className="bg-white border-b border-stone-200 px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-stone-900 rounded flex items-center justify-center font-serif text-white font-light text-xs tracking-widest shadow-xs">
            W
          </div>
          <div>
            <h1 className="font-serif-editorial text-sm font-semibold tracking-widest text-stone-900 uppercase">WILKSON FOTOGRAFIAS</h1>
          </div>
        </div>

        {/* Abas Superiores de Controle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200/50">
            <button
              onClick={() => {
                setActiveTab('client');
                setSelectedGalleryToken(null);
              }}
              className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'client'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Ver Portfólio
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'admin' || activeTab === 'uploader'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Painel Admin
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Render */}
      <main className="flex-grow flex flex-col p-6">
        
        {/* Aba 1: Área do Cliente - Portfólio de Fotos */}
        {activeTab === 'client' && (() => {
          // Filtrar fotos do portfólio pela categoria
          const filteredPortfolio = portfolioCategory === 'todos'
            ? portfolio
            : portfolio.filter((p) => p.category === portfolioCategory);

          return (
            <div className="flex-grow flex flex-col space-y-8 animate-fade-in pb-12">
              
              {/* Seção de Destaque - Hero Portfolio */}
              <div className="text-center py-12 px-4 border border-stone-200 bg-white rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] [background-size:16px_16px] opacity-35"></div>
                <div className="relative z-10 max-w-2xl mx-auto space-y-4">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-stone-400">Fotografia Profissional</span>
                  <h2 className="font-serif-editorial text-4xl sm:text-5xl text-stone-900 font-light tracking-wide">
                    Wilkson Fotografias
                  </h2>
                  <div className="h-px w-16 bg-stone-300 mx-auto"></div>
                  <p className="text-stone-500 font-serif-editorial italic text-sm max-w-lg mx-auto font-light leading-relaxed">
                    "Capturando sentimentos sinceros, luzes naturais e momentos inesquecíveis que duram para sempre."
                  </p>
                  
                  {/* Botões de Acesso Rápido */}
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setShowClientLogin(true)}
                      className="px-6 py-2.5 bg-stone-900 hover:bg-stone-850 text-white font-sans text-xs font-bold uppercase tracking-widest rounded transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      Área do Cliente (Acessar Seleção)
                    </button>
                  </div>
                </div>
              </div>

              {/* Filtros de Categoria */}
              <div className="flex justify-center border-b border-stone-200 pb-2">
                <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'casamentos', label: 'Casamentos' },
                    { id: 'infantil', label: 'Infantil' },
                    { id: 'formatura', label: 'Formaturas' },
                    { id: 'corporativo', label: 'Corporativo' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setPortfolioCategory(cat.id);
                        setLightboxIndex(null);
                      }}
                      className={`px-4 py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all rounded ${
                        portfolioCategory === cat.id
                          ? 'bg-stone-900 text-white shadow-sm'
                          : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid de Portfólio */}
              {filteredPortfolio.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-stone-200 rounded-xl bg-white text-stone-450 font-serif-editorial">
                  <p className="text-sm">Nenhuma foto cadastrada nesta categoria de portfólio.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {filteredPortfolio.map((photo, index) => (
                    <div
                      key={photo.id}
                      onClick={() => setLightboxIndex(index)}
                      className="group cursor-pointer bg-white border border-stone-205 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300"
                    >
                      <div className="aspect-[4/3] w-full bg-stone-50 overflow-hidden relative">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ease-out"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                          <span className="text-[9px] text-white uppercase tracking-widest font-bold">Zoom da Imagem</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Modal Lightbox */}
              {lightboxIndex !== null && filteredPortfolio[lightboxIndex] && (
                <div 
                  className="fixed inset-0 bg-stone-950/95 z-50 flex items-center justify-center p-4 backdrop-blur-md"
                  onClick={() => setLightboxIndex(null)}
                >
                  {/* Botão Fechar */}
                  <button
                    onClick={() => setLightboxIndex(null)}
                    className="absolute top-4 right-4 text-white hover:text-stone-300 focus:outline-none p-2 bg-stone-900/40 hover:bg-stone-900/60 rounded-full transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>

                  {/* Imagem Principal */}
                  <div className="relative max-w-4xl max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <img
                      src={filteredPortfolio[lightboxIndex].url}
                      alt={filteredPortfolio[lightboxIndex].name}
                      className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl"
                    />
                    
                    {/* Botão Anterior */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : filteredPortfolio.length - 1));
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-stone-300 focus:outline-none p-2 bg-stone-900/40 hover:bg-stone-900/70 rounded-full transition-all"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                      </svg>
                    </button>

                    {/* Botão Próximo */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex((prev) => (prev < filteredPortfolio.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-stone-300 focus:outline-none p-2 bg-stone-900/40 hover:bg-stone-900/70 rounded-full transition-all"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Modal de Login (Área do Cliente) */}
              {showClientLogin && (
                <div 
                  className="fixed inset-0 bg-stone-950/70 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm"
                  onClick={() => {
                    setShowClientLogin(false);
                    setLoginError('');
                  }}
                >
                  <div 
                    className="bg-white border border-stone-200 rounded-xl shadow-xl max-w-sm w-full p-6 animate-scale-in relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Botão Fechar */}
                    <button
                      onClick={() => {
                        setShowClientLogin(false);
                        setLoginError('');
                      }}
                      className="absolute top-4 right-4 text-stone-400 hover:text-stone-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>

                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-stone-400">Acesso Restrito</span>
                        <h3 className="font-serif-editorial text-xl text-stone-900 mt-1">Área do Cliente</h3>
                        <p className="text-[11px] text-stone-400 mt-1">Digite seu e-mail e senha de acesso enviados pelo fotógrafo.</p>
                      </div>

                      {loginError && (
                        <div className="bg-red-50 border border-red-250 text-red-650 text-[10px] px-3 py-2 rounded-lg text-center font-semibold">
                          {loginError}
                        </div>
                      )}

                      <form onSubmit={handleGeneralLogin} className="space-y-3.5 pt-2">
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">E-mail de Acesso</label>
                          <input
                            type="email"
                            required
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="cliente@email.com"
                            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs font-sans focus:outline-none focus:border-stone-900 bg-stone-50/50"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Senha de Acesso</label>
                          <input
                            type="password"
                            required
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••"
                            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs font-sans focus:outline-none focus:border-stone-900 bg-stone-50/50"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2.5 bg-stone-900 hover:bg-stone-850 text-white font-sans text-xs font-bold uppercase tracking-widest rounded transition-all shadow mt-2"
                        >
                          Entrar na Seleção
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* Aba 2: Admin Dashboard */}
        {activeTab === 'admin' && (
          <AdminDashboard
            clientes={clientes}
            eventos={eventos}
            portfolio={portfolio}
            onAddCliente={handleAddCliente}
            onAddEvento={handleAddEvento}
            onSelectEventUpload={triggerEventUpload}
            onSelectEventView={triggerEventView}
            onConfirmPayment={handleConfirmPayment}
            onDeleteEvento={handleDeleteEvento}
            onReopenEvento={handleReopenEvento}
            onAddPortfolioPhoto={handleAddPortfolioPhoto}
            onDeletePortfolioPhoto={handleDeletePortfolioPhoto}
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
    const passwordMatch = String(client.senha || '').trim() === String(password || '').trim();

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
