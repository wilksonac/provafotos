import React, { useState, useEffect } from 'react';
import AdminDashboard from './pages/AdminDashboard';
import UploadQueue from './components/UploadQueue';
import PhotoVirtualGrid from './components/PhotoVirtualGrid';
import { sendClientCredentialsEmail, sendSelectionFinalizedEmails } from './lib/brevo';
import { db, auth, storage } from './lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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
  // Firestore é a única fonte de dados — estados iniciam vazios
  const [clientes, setClientes] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [realWeddings, setRealWeddings] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);

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

  // Estados de Exibição de Blog e Histórias
  const [selectedWeddingId, setSelectedWeddingId] = useState(null);
  const [selectedBlogPostId, setSelectedBlogPostId] = useState(null);

  // Estados de Autenticação do Administrador (Firebase Auth)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

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
      setClientes(docs);
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar clientes:", error);
    });

    const unsubscribeEventos = onSnapshot(collection(db, "eventos"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setEventos(docs);
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar eventos:", error);
    });

    const unsubscribePortfolio = onSnapshot(collection(db, "portfolio"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setPortfolio(docs);
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar portfólio:", error);
    });

    const unsubscribeRealWeddings = onSnapshot(collection(db, "real_weddings"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setRealWeddings(docs);
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar casamentos reais:", error);
    });

    const unsubscribeBlogPosts = onSnapshot(collection(db, "blog_posts"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setBlogPosts(docs);
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar blog posts:", error);
    });

    return () => {
      unsubscribeClientes();
      unsubscribeEventos();
      unsubscribePortfolio();
      unsubscribeRealWeddings();
      unsubscribeBlogPosts();
    };
  }, []);

  // localStorage removido — dados vêm exclusivamente do Firestore em tempo real

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
      updateDoc(doc(db, "eventos", activeEventId), { fotos: arrayUnion(newPhoto) })
        .then(() => console.log("[FIREBASE] Foto vinculada ao evento via arrayUnion:", activeEventId))
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
    console.log("[PORTFOLIO] Tentando excluir foto do banco de dados com ID:", photoId);
    if (db) {
      deleteDoc(doc(db, "portfolio", photoId))
        .then(() => {
          console.log("[FIREBASE] Foto do portfólio deletada do Firestore:", photoId);
        })
        .catch(err => {
          console.error("[FIREBASE] Erro ao deletar foto do portfólio no Firestore:", err);
          alert(`Erro ao excluir foto do Firestore: ${err.message}`);
        });
    } else {
      setPortfolio((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  // Definir foto como destaque/capa do portfólio na página principal
  const handleSetPortfolioCover = (photoId) => {
    console.log("[PORTFOLIO] Definindo foto como destaque:", photoId);
    const updatedPortfolio = portfolio.map(p => ({
      ...p,
      destaque: p.id === photoId
    }));

    if (db) {
      portfolio.forEach((photo) => {
        const isTarget = photo.id === photoId;
        // Só atualiza se o estado do destaque for mudar para evitar escritas desnecessárias
        if (photo.destaque !== isTarget) {
          updateDoc(doc(db, "portfolio", photo.id), { destaque: isTarget })
            .then(() => console.log(`[FIREBASE] Foto do portfólio ${photo.id} destaque = ${isTarget}`))
            .catch(err => console.error("[FIREBASE] Erro ao atualizar destaque no Firestore:", err));
        }
      });
    } else {
      setPortfolio(updatedPortfolio);
    }
  };

  // Helper de compressão de imagens para Casamentos e Blog
  const compressImageToBlob = (file, maxDimension = 1200, quality = 0.75) => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          }, 'image/jpeg', quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // Callback para adicionar Casamento Real (História)
  const handleAddRealWedding = async (weddingData, coverFile, photosFiles) => {
    console.log("[FIREBASE] Iniciando publicação de Casamento Real:", weddingData.titulo);
    
    let coverUrl = "";
    if (coverFile) {
      const compressedCover = await compressImageToBlob(coverFile, 1200, 0.7);
      const coverRef = ref(storage, `casamentos_reais/wed_${Date.now()}_capa_${coverFile.name}`);
      await uploadBytesResumable(coverRef, compressedCover);
      coverUrl = await getDownloadURL(coverRef);
    }

    const photosUrls = [];
    for (let i = 0; i < photosFiles.length; i++) {
      const file = photosFiles[i];
      const compressedPhoto = await compressImageToBlob(file, 1200, 0.7);
      const photoRef = ref(storage, `casamentos_reais/wed_${Date.now()}_photo_${i}_${file.name}`);
      await uploadBytesResumable(photoRef, compressedPhoto);
      const url = await getDownloadURL(photoRef);
      photosUrls.push(url);
    }

    const newWedding = {
      id: `wed_${Date.now()}`,
      titulo: weddingData.titulo,
      descricao: weddingData.descricao,
      local: weddingData.local,
      data: weddingData.data,
      fornecedores: weddingData.fornecedores,
      capa: coverUrl,
      fotos: photosUrls,
      createdAt: new Date().toISOString()
    };

    if (db) {
      await setDoc(doc(db, "real_weddings", newWedding.id), newWedding);
    } else {
      setRealWeddings((prev) => [...prev, newWedding]);
    }
    console.log("[FIREBASE] Casamento Real publicado com sucesso!");
  };

  // Callback para excluir Casamento Real
  const handleDeleteRealWedding = async (weddingId) => {
    console.log("[FIREBASE] Deletando Casamento Real:", weddingId);
    if (db) {
      await deleteDoc(doc(db, "real_weddings", weddingId));
    } else {
      setRealWeddings((prev) => prev.filter(w => w.id !== weddingId));
    }
  };

  // Callback para adicionar Post no Blog/Dicas
  const handleAddBlogPost = async (postData, coverFile) => {
    console.log("[FIREBASE] Iniciando publicação de Artigo de Blog:", postData.titulo);

    let coverUrl = "";
    if (coverFile) {
      const compressedCover = await compressImageToBlob(coverFile, 1200, 0.7);
      const coverRef = ref(storage, `blog_posts/post_${Date.now()}_capa_${coverFile.name}`);
      await uploadBytesResumable(coverRef, compressedCover);
      coverUrl = await getDownloadURL(coverRef);
    }

    const newPost = {
      id: `post_${Date.now()}`,
      titulo: postData.titulo,
      conteudo: postData.conteudo,
      categoria: postData.categoria,
      capa: coverUrl,
      createdAt: new Date().toISOString()
    };

    if (db) {
      await setDoc(doc(db, "blog_posts", newPost.id), newPost);
    } else {
      setBlogPosts((prev) => [...prev, newPost]);
    }
    console.log("[FIREBASE] Artigo de blog publicado com sucesso!");
  };

  // Callback para excluir Post no Blog
  const handleDeleteBlogPost = async (postId) => {
    console.log("[FIREBASE] Deletando Artigo de Blog:", postId);
    if (db) {
      await deleteDoc(doc(db, "blog_posts", postId));
    } else {
      setBlogPosts((prev) => prev.filter(p => p.id !== postId));
    }
  };

  // Definir foto como capa/destaque da galeria do cliente
  const handleSetEventCover = (eventId, photoId) => {
    const targetEvent = eventos.find(e => e.id === eventId);
    if (!targetEvent) return;

    const updatedPhotos = (targetEvent.fotos || []).map(p => ({
      ...p,
      destaque: p.id === photoId
    }));

    if (db) {
      updateDoc(doc(db, "eventos", eventId), { fotos: updatedPhotos })
        .then(() => console.log("[FIREBASE] Foto de destaque definida para o evento:", eventId))
        .catch(err => console.error("[FIREBASE] Erro ao definir foto de destaque:", err));
    } else {
      setEventos((prev) => prev.map(evt => evt.id === eventId ? { ...evt, fotos: updatedPhotos } : evt));
    }
  };

  // Excluir foto individual de uma galeria do cliente
  const handleDeleteEventPhoto = (eventId, photoId) => {
    const targetEvent = eventos.find(e => e.id === eventId);
    if (!targetEvent) return;

    const updatedPhotos = (targetEvent.fotos || []).filter(p => p.id !== photoId);

    if (db) {
      updateDoc(doc(db, "eventos", eventId), { fotos: updatedPhotos })
        .then(() => console.log("[FIREBASE] Foto removida do evento:", eventId))
        .catch(err => console.error("[FIREBASE] Erro ao remover foto:", err));
    } else {
      setEventos((prev) => prev.map(evt => evt.id === eventId ? { ...evt, fotos: updatedPhotos } : evt));
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

  // Autenticação do Administrador via Firebase Auth
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    setAdminLoginError('');
    if (!auth) {
      setAdminLoginError('Firebase Auth não configurado.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword.trim());
      setAdminEmail('');
      setAdminPassword('');
    } catch (err) {
      console.error('[AUTH] Erro ao fazer login:', err.code);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAdminLoginError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setAdminLoginError('Muitas tentativas. Aguarde alguns minutos.');
      } else {
        setAdminLoginError('Erro ao autenticar. Tente novamente.');
      }
    }
  };

  const handleAdminLogout = async () => {
    if (auth) await signOut(auth);
    setActiveTab('client');
  };

  const activeEvent = eventos.find((e) => e.id === activeEventId);

  // Filtrar fotos do portfólio pela categoria
  const filteredPortfolio = portfolioCategory === 'todos'
    ? portfolio
    : portfolio.filter((p) => p.category === portfolioCategory);

  const coverPortfolioPhoto = portfolio.find((p) => p.destaque === true);
  const coverPortfolioUrl = coverPortfolioPhoto ? coverPortfolioPhoto.url : 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1920&q=80';

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
      
      {/* Cabeçalho Fixo Translúcido (Sticky Glassmorphic) */}
      <header className="sticky top-0 z-[50] bg-[#FAF9F6]/80 backdrop-blur-md border-b border-stone-200/60 px-4 sm:px-6 py-3.5 flex flex-row items-center justify-between gap-2 shadow-[0_2px_15px_-3px_rgba(28,25,23,0.02)]">
        <div className="flex items-center gap-2">
          <div className="w-6.5 h-6.5 bg-stone-900 rounded flex items-center justify-center font-serif text-white font-light text-xs tracking-widest shadow-xs flex-shrink-0">
            W
          </div>
          <div className="min-w-0">
            <h1 className="font-sans text-[10px] sm:text-[11px] font-light tracking-[0.3em] text-stone-900 uppercase truncate">
              WILKSON FOTOGRAFIAS
            </h1>
          </div>
        </div>

        {/* Abas Superiores de Controle */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200/50 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => {
                setActiveTab('client');
                setSelectedGalleryToken(null);
                setLightboxIndex(null);
                setSelectedWeddingId(null);
                setSelectedBlogPostId(null);
              }}
              className={`px-1.5 sm:px-2.5 py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'client'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Portfólio
            </button>
            <button
              onClick={() => {
                setActiveTab('real-weddings');
                setSelectedGalleryToken(null);
                setLightboxIndex(null);
                setSelectedWeddingId(null);
                setSelectedBlogPostId(null);
              }}
              className={`px-1.5 sm:px-2.5 py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'real-weddings'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Histórias
            </button>
            <button
              onClick={() => {
                setActiveTab('blog');
                setSelectedGalleryToken(null);
                setLightboxIndex(null);
                setSelectedWeddingId(null);
                setSelectedBlogPostId(null);
              }}
              className={`px-1.5 sm:px-2.5 py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'blog'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Blog
            </button>
            <button
              onClick={() => {
                setShowClientLogin(true);
              }}
              className={`px-1.5 sm:px-2.5 py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'magic-client' || showClientLogin
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Seleção
            </button>
            <button
              onClick={() => {
                setActiveTab('admin');
                setLightboxIndex(null);
                setSelectedWeddingId(null);
                setSelectedBlogPostId(null);
              }}
              className={`px-1.5 sm:px-2.5 py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'admin' || activeTab === 'uploader'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Render */}
      <main className="flex-grow flex flex-col p-6">
        
        {/* Aba 1: Área do Cliente - Portfólio de Fotos */}
        {activeTab === 'client' && (
          <div className="flex-grow flex flex-col space-y-8 animate-fade-in pb-12">
            
            {/* Seção de Destaque - Hero Portfolio */}
            <div className="text-center py-12 sm:py-16 px-4 sm:px-6 rounded-xl shadow-sm relative overflow-hidden bg-stone-950">
              <div 
                className="absolute inset-0 bg-cover bg-center animate-fade-in"
                style={{ backgroundImage: `url('${coverPortfolioUrl}')` }}
              />
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
              <div className="relative z-10 max-w-2xl mx-auto space-y-4">
                <h2 className="font-serif-editorial text-3xl sm:text-5xl text-white font-light tracking-wide px-2">
                  Wilkson Fotografias
                </h2>
                <div className="h-px w-12 bg-white/30 mx-auto"></div>
                <p className="text-stone-200 font-serif-editorial italic text-xs sm:text-sm max-w-lg mx-auto font-light leading-relaxed px-4">
                  "Capturando sentimentos sinceros, luzes naturais e momentos inesquecíveis que duram para sempre."
                </p>

              </div>
            </div>

            {/* Filtros de Categoria (Fluido e sem sobras laterais) */}
            <div className="flex justify-center border-b border-stone-200 pb-3">
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
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
                    className={`px-3 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all rounded ${
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
              <div className="columns-2 md:columns-3 gap-4 sm:gap-6 space-y-4 sm:space-y-6">
                {filteredPortfolio.map((photo, index) => (
                  <div
                    key={photo.id}
                    onClick={() => setLightboxIndex(index)}
                    className="break-inside-avoid inline-block w-full group cursor-pointer bg-white border border-stone-200/60 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 animate-reveal"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="w-full bg-stone-50 overflow-hidden relative">
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="w-full h-auto object-cover group-hover:scale-[1.02] transition-all duration-500 ease-out"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* Aba 1.2: Casamentos Reais (Público) */}
        {activeTab === 'real-weddings' && (
          <div className="flex-grow flex flex-col space-y-8 animate-fade-in pb-12">
            {selectedWeddingId ? (
              // Detalhes do Casamento Real Selecionado
              (() => {
                const wed = realWeddings.find(w => w.id === selectedWeddingId);
                if (!wed) return <p className="text-stone-450">Casamento não encontrado.</p>;
                return (
                  <div className="space-y-8 max-w-4xl mx-auto w-full">
                    {/* Header */}
                    <div className="text-center space-y-4">
                      <button
                        onClick={() => setSelectedWeddingId(null)}
                        className="px-3.5 py-1.5 border border-stone-200 text-stone-600 hover:text-stone-950 text-[9px] font-bold uppercase tracking-widest rounded bg-white transition-all shadow-2xs"
                      >
                        ← Voltar para Histórias
                      </button>
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 px-2 py-0.5 rounded">{wed.local}</span>
                        <span className="text-[9px] text-stone-400 font-mono">{wed.data}</span>
                      </div>
                      <h2 className="font-serif-editorial text-3xl sm:text-5xl text-stone-900 font-light tracking-wide px-2 leading-tight">
                        {wed.titulo}
                      </h2>
                      <div className="h-px w-12 bg-stone-300 mx-auto"></div>
                    </div>

                    {/* Imagem de Capa */}
                    <div className="w-full aspect-[16/9] rounded-xl overflow-hidden shadow-md">
                      <img src={wed.capa} alt={wed.titulo} className="w-full h-full object-cover" />
                    </div>

                    {/* Descrição / História do Casal */}
                    <div className="bg-white border border-stone-200/60 p-6 sm:p-8 rounded-xl shadow-xs">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 block">A História do Dia</h3>
                      <p className="text-stone-750 font-serif-editorial italic text-sm sm:text-base leading-relaxed whitespace-pre-line font-light">
                        "{wed.descricao}"
                      </p>
                    </div>

                    {/* Galeria de Fotos em Mosaico */}
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Galeria de Fotos</h3>
                      <div className="columns-2 gap-4 space-y-4">
                        {wed.fotos?.map((photoUrl, idx) => (
                          <div
                            key={idx}
                            className="break-inside-avoid inline-block w-full bg-white border border-stone-200/50 rounded-xl overflow-hidden shadow-2xs hover:shadow-xs transition-all duration-300"
                          >
                            <img src={photoUrl} alt={`Foto ${idx}`} className="w-full h-auto object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ficha Técnica / Fornecedores */}
                    {wed.fornecedores && wed.fornecedores.length > 0 && (
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 shadow-2xs">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-4 pb-2 border-b border-stone-200 block">Ficha Técnica / Fornecedores Parceiros</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {wed.fornecedores.map((forn, idx) => (
                            <div key={idx} className="space-y-0.5">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block">{forn.funcao}</span>
                              <span className="text-[11px] font-semibold text-stone-850 block">{forn.nome}</span>
                              {forn.instagram && (
                                <a
                                  href={`https://instagram.com/${forn.instagram.replace('@', '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-amber-700 hover:text-amber-800 font-medium tracking-wide inline-flex items-center gap-0.5 mt-0.5"
                                >
                                  📷 {forn.instagram}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              // Listagem de Casamentos Reais
              <div className="space-y-8">
                <div className="text-center py-6">
                  <span className="text-[9px] font-extrabold tracking-widest uppercase text-stone-400">Amor e Inspiração</span>
                  <h2 className="font-serif-editorial text-3xl sm:text-5xl text-stone-900 font-light tracking-wide mt-1">Histórias de Casamentos</h2>
                  <p className="text-xs text-stone-400 mt-2 uppercase tracking-wider font-semibold">Ensaios e Casamentos Reais com Detalhes e Fornecedores</p>
                </div>

                {realWeddings.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-stone-200 rounded-xl bg-white text-stone-450 font-serif-editorial">
                    <p className="text-sm">Nenhuma história de casamento cadastrada ainda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {realWeddings.map((wed) => (
                      <div
                        key={wed.id}
                        onClick={() => setSelectedWeddingId(wed.id)}
                        className="group cursor-pointer bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col h-full"
                      >
                        <div className="aspect-[16/10] w-full bg-stone-50 overflow-hidden relative">
                          <img
                            src={wed.capa}
                            alt={wed.titulo}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-all duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-[8px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 px-2 py-0.5 rounded">{wed.local}</span>
                              <span className="text-[8px] text-stone-400 font-mono">{wed.data}</span>
                            </div>
                            <h3 className="font-serif-editorial text-lg text-stone-900 mt-3 font-light leading-snug group-hover:text-stone-700 transition-colors">
                              {wed.titulo}
                            </h3>
                            <p className="text-stone-450 text-xs line-clamp-2 mt-2 leading-relaxed font-light">{wed.descricao}</p>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-stone-900 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 pt-2">
                            Ver História Completa →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Aba 1.3: Blog / Dicas (Público) */}
        {activeTab === 'blog' && (
          <div className="flex-grow flex flex-col space-y-8 animate-fade-in pb-12">
            {selectedBlogPostId ? (
              // Detalhes do Artigo Selecionado
              (() => {
                const post = blogPosts.find(p => p.id === selectedBlogPostId);
                if (!post) return <p className="text-stone-450">Artigo não encontrado.</p>;
                return (
                  <div className="space-y-6 max-w-2xl mx-auto w-full">
                    {/* Header */}
                    <div className="text-center space-y-3">
                      <button
                        onClick={() => setSelectedBlogPostId(null)}
                        className="px-3.5 py-1.5 border border-stone-200 text-stone-600 hover:text-stone-950 text-[9px] font-bold uppercase tracking-widest rounded bg-white transition-all shadow-2xs"
                      >
                        ← Voltar para Artigos
                      </button>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/50 px-2.5 py-0.5 rounded inline-block">{post.categoria}</span>
                      </div>
                      <h2 className="font-serif-editorial text-2xl sm:text-4xl text-stone-900 font-light tracking-wide px-2 leading-tight">
                        {post.titulo}
                      </h2>
                      <p className="text-[9px] text-stone-400 font-mono">
                        Publicado em {post.createdAt ? new Date(post.createdAt).toLocaleDateString('pt-BR') : 'Sem data'}
                      </p>
                    </div>

                    {/* Imagem de Capa */}
                    <div className="w-full aspect-[16/10] rounded-xl overflow-hidden shadow-sm">
                      <img src={post.capa} alt={post.titulo} className="w-full h-full object-cover" />
                    </div>

                    {/* Conteúdo do Artigo */}
                    <div className="bg-white border border-stone-200/60 p-6 sm:p-8 rounded-xl shadow-xs">
                      <p className="text-stone-750 font-sans text-xs sm:text-sm leading-relaxed whitespace-pre-line font-light">
                        {post.conteudo}
                      </p>
                    </div>
                  </div>
                );
              })()
            ) : (
              // Listagem de Artigos do Blog
              <div className="space-y-8">
                <div className="text-center py-6">
                  <span className="text-[9px] font-extrabold tracking-widest uppercase text-stone-400 font-sans">Guia e Dicas para Noivos</span>
                  <h2 className="font-serif-editorial text-3xl sm:text-5xl text-stone-900 font-light tracking-wide mt-1">Dicas & Inspirações</h2>
                  <p className="text-xs text-stone-400 mt-2 uppercase tracking-wider font-semibold">Tudo o que você precisa saber para planejar o ensaio perfeito</p>
                </div>

                {blogPosts.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-stone-200 rounded-xl bg-white text-stone-450 font-serif-editorial">
                    <p className="text-sm">Nenhum artigo de dicas cadastrado ainda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {blogPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => setSelectedBlogPostId(post.id)}
                        className="group cursor-pointer bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col h-full"
                      >
                        <div className="aspect-[16/10] w-full bg-stone-50 overflow-hidden relative">
                          <img
                            src={post.capa}
                            alt={post.titulo}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-all duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                          <div>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded inline-block">{post.categoria}</span>
                            <h3 className="font-serif-editorial text-lg text-stone-900 mt-3 font-light leading-snug group-hover:text-stone-700 transition-colors">
                              {post.titulo}
                            </h3>
                            <p className="text-stone-450 text-xs line-clamp-2 mt-2 leading-relaxed font-light">{post.conteudo}</p>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-stone-900 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 pt-2">
                            Ler Artigo Completo →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Aba 2: Admin Dashboard */}
        {activeTab === 'admin' && (
          !isAdminAuthenticated ? (
            <div className="flex-grow flex items-center justify-center py-12 px-4 animate-scale-in">
              <div className="bg-stone-900 border border-stone-850 text-white rounded-xl shadow-2xl max-w-sm w-full p-8 relative overflow-hidden">
                {/* Visual decoration overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:20px_20px] opacity-25"></div>
                
                <div className="relative z-10 space-y-6">
                  <div className="text-center">
                    <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center font-serif text-white font-light text-sm tracking-widest shadow-sm mx-auto mb-3">
                      W
                    </div>
                    <span className="text-[9px] font-bold tracking-widest uppercase text-stone-400">Acesso Restrito</span>
                    <h3 className="font-serif-editorial text-2xl text-white font-light mt-1">Painel do Fotógrafo</h3>
                    <p className="text-[10px] text-stone-400 mt-1 uppercase tracking-widest">Identifique-se para gerenciar galerias</p>
                  </div>

                  {adminLoginError && (
                    <div className="bg-red-950/80 border border-red-800 text-red-300 text-[10px] px-3.5 py-2.5 rounded-lg text-center font-semibold">
                      {adminLoginError}
                    </div>
                  )}

                  <form onSubmit={handleAdminLoginSubmit} className="space-y-4 pt-1">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">E-mail do Admin</label>
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@wilksonfotografias.com.br"
                        className="w-full px-3.5 py-2.5 border border-stone-800 rounded-lg text-xs font-sans focus:outline-none focus:border-white bg-stone-950/80 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">Senha Administrativa</label>
                      <input
                        type="password"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full px-3.5 py-2.5 border border-stone-800 rounded-lg text-xs font-sans focus:outline-none focus:border-white bg-stone-950/80 text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-white hover:bg-stone-100 text-stone-900 font-sans text-xs font-bold uppercase tracking-widest rounded transition-all shadow-md mt-2"
                    >
                      Acessar Painel
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <AdminDashboard
              clientes={clientes}
              eventos={eventos}
              portfolio={portfolio}
              realWeddings={realWeddings}
              blogPosts={blogPosts}
              onAddCliente={handleAddCliente}
              onAddEvento={handleAddEvento}
              onSelectEventUpload={triggerEventUpload}
              onSelectEventView={triggerEventView}
              onConfirmPayment={handleConfirmPayment}
              onDeleteEvento={handleDeleteEvento}
              onReopenEvento={handleReopenEvento}
              onAddPortfolioPhoto={handleAddPortfolioPhoto}
              onDeletePortfolioPhoto={handleDeletePortfolioPhoto}
              onLogout={handleAdminLogout}
              onSetEventCover={handleSetEventCover}
              onDeleteEventPhoto={handleDeleteEventPhoto}
              onSetPortfolioCover={handleSetPortfolioCover}
              onAddRealWedding={handleAddRealWedding}
              onDeleteRealWedding={handleDeleteRealWedding}
              onAddBlogPost={handleAddBlogPost}
              onDeleteBlogPost={handleDeleteBlogPost}
            />
          )
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

      {/* Modals rendered at root to avoid stacking context/scrolling issues */}
      {lightboxIndex !== null && filteredPortfolio[lightboxIndex] && (
        <div 
          className="fixed inset-0 bg-stone-950/95 z-[99999] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Botão Fechar */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 text-white hover:text-stone-300 focus:outline-none p-1.5 sm:p-2 bg-stone-900/30 hover:bg-stone-900/60 rounded-full transition-all z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>

          {/* Imagem Principal */}
          <div className="relative max-w-4xl max-h-[80vh] flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
            <img
              src={filteredPortfolio[lightboxIndex].url}
              alt={filteredPortfolio[lightboxIndex].name}
              className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl"
            />
            
            {/* Botão Anterior */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev > 0 ? prev - 1 : filteredPortfolio.length - 1));
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white hover:text-stone-300 focus:outline-none p-1.5 sm:p-2 bg-stone-900/30 hover:bg-stone-900/70 rounded-full transition-all"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>

            {/* Botão Próximo */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev < filteredPortfolio.length - 1 ? prev + 1 : 0));
              }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white hover:text-stone-300 focus:outline-none p-1.5 sm:p-2 bg-stone-900/30 hover:bg-stone-900/70 rounded-full transition-all"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      )}

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
