import React, { useState, useEffect, useMemo } from 'react';
import AdminDashboard from './pages/AdminDashboard';
import UploadQueue from './components/UploadQueue';
import PhotoVirtualGrid from './components/PhotoVirtualGrid';
import { sendClientCredentialsEmail, sendSelectionFinalizedEmails } from './lib/brevo';
import { db, auth, storage } from './lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, arrayUnion, deleteField, query, where, getDocs } from 'firebase/firestore';
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
  const [categoriasFornecedores, setCategoriasFornecedores] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  // Derivar selecoes de eventos em tempo real
  const selecoes = useMemo(() => {
    const list = [];
    (eventos || []).forEach(evt => {
      if (evt.selecoes_clientes) {
        Object.entries(evt.selecoes_clientes).forEach(([clientId, selData]) => {
          list.push({
            id: `${evt.id}_${clientId}`,
            id_evento: evt.id,
            id_cliente: clientId,
            ...selData
          });
        });
      }
    });
    return list;
  }, [eventos]);
  const [activeClient, setActiveClient] = useState(null);

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
  const [selectedVendorCategory, setSelectedVendorCategory] = useState('aliancas');
  const [showAllPortfolio, setShowAllPortfolio] = useState(false);
  const [magicEvent, setMagicEvent] = useState(null);
  const [magicClient, setMagicClient] = useState(null);
  const [contato, setContato] = useState({
    telefone: '(11) 98888-7777',
    whatsapp: '5511988887777',
    instagram: '@wilksonfotografia',
    email: 'contato@wilksonfotografias.com.br',
    endereco: 'São Paulo - SP'
  });
  const [templateMensagem, setTemplateMensagem] = useState(
    "Oi, {nome}. Tudo bem?\n\nA galeria {titulo} já está disponível.\nO prazo para a seleção das fotos é dia {prazo}.\n\n{observacoes}Para acessar a galeria use os dados abaixo:\n\nLink de acesso: {link}\nE-mail: {email}\nSenha: {senha}\n\nQualquer dúvida estou à disposição!"
  );

  // Estados de Autenticação do Administrador (Firebase Auth)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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

  // Sincronizar dados públicos do Firestore em tempo real com controle de Loading inicial leve
  useEffect(() => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    console.log("[FIREBASE] Ativando ouvintes públicos em tempo real...");

    let loadedCollections = {
      portfolio: false,
      realWeddings: false,
      blogPosts: false
    };

    const checkAllLoaded = (collectionName) => {
      loadedCollections[collectionName] = true;
      if (Object.values(loadedCollections).every(val => val === true)) {
        setIsLoading(false);
      }
    };

    const defaultCats = [
      { id: 'aliancas', nome: 'Alianças', explicacao: 'As alianças são o símbolo material da união. Ao escolher, considerem o conforto para o dia a dia, a qualidade do metal (geralmente ouro 18k) e o estilo que combine com a personalidade de ambos. É recomendável encomendar com pelo menos 3 meses de antecedência.' },
      { id: 'buffet', nome: 'Buffet', explicacao: 'O buffet é um dos pilares do casamento. Avaliem o estilo do serviço (americano, franco-americano ou empratado) de acordo com o perfil dos convidados. Lembrem-se de realizar degustações completas e atentar para restrições alimentares (vegetarianos, intolerantes, etc.).' },
      { id: 'local', nome: 'Espaço / Local', explicacao: 'A escolha do espaço define toda a logística do evento. Considerem a capacidade de convidados, plano B para casamentos ao ar livre (em caso de chuva), restrições de horário e ruído, e se a infraestrutura de banheiros e cozinha atende aos fornecedores contratados.' },
      { id: 'decoracao', nome: 'Decoração', explicacao: 'A decoração expressa a identidade visual e o clima do casamento. Reúnam referências de paletas de cores e estilos (clássico, boho, rústico ou minimalista). Definam prioridades de destaque, como o altar e a mesa de doces.' },
      { id: 'vestido', nome: 'Vestido de Noiva', explicacao: 'O vestido ideal é aquele que faz você se sentir confiante e confortável. Comecem a busca com 8 a 10 meses de antecedência. Considerem o local e o horário da cerimônia na escolha do tecido e corte.' },
      { id: 'cerimonial', nome: 'Cerimonial', explicacao: 'O cerimonial é o anjo da guarda do casal. Eles organizam o cronograma, coordenam os fornecedores no dia e garantem que tudo corra perfeitamente. Contratar uma assessoria completa desde o início economiza tempo e previne surpresas.' },
      { id: 'musica', nome: 'DJ & Banda', explicacao: 'A música dita a energia da festa. Escolham profissionais que saibam ler a pista e adaptar o repertório em tempo real. Alinhem previamente a lista de músicas indispensáveis e aquelas que não devem tocar de jeito nenhum.' },
      { id: 'foto_video', nome: 'Foto & Vídeo', explicacao: 'A fotografia e o vídeo são as lembranças eternas do seu dia. Analisem o portfólio completo dos profissionais para entender seu estilo (documental, posado, fine art). A sintonia pessoal com a equipe é essencial, pois eles estarão ao seu lado o dia todo.' }
    ];

    const unsubscribeFornecedoresDoc = onSnapshot(doc(db, "eventos", "config_fornecedores"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCategoriasFornecedores(data.categorias || defaultCats);
        setFornecedores(data.fornecedores || []);
      } else {
        console.log("[FIREBASE] Inicializando documento config_fornecedores no Firestore...");
        setDoc(doc(db, "eventos", "config_fornecedores"), {
          categorias: defaultCats,
          fornecedores: []
        }).catch(err => console.error("[FIREBASE] Erro ao criar config_fornecedores:", err));

        setCategoriasFornecedores(defaultCats);
        setFornecedores([]);
      }
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar config_fornecedores:", error);
    });

    const unsubscribePortfolio = onSnapshot(collection(db, "portfolio"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setPortfolio(docs);
      checkAllLoaded('portfolio');
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar portfólio:", error);
      checkAllLoaded('portfolio');
    });

    const unsubscribeRealWeddings = onSnapshot(collection(db, "real_weddings"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setRealWeddings(docs);
      checkAllLoaded('realWeddings');
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar casamentos reais:", error);
      checkAllLoaded('realWeddings');
    });

    const unsubscribeBlogPosts = onSnapshot(collection(db, "blog_posts"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setBlogPosts(docs);
      checkAllLoaded('blogPosts');
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar blog posts:", error);
      checkAllLoaded('blogPosts');
    });

    const unsubscribeContato = onSnapshot(doc(db, "configuracoes", "contato"), (docSnap) => {
      if (docSnap.exists()) {
        setContato(docSnap.data());
      }
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar contatos:", error);
    });

    const unsubscribeTemplate = onSnapshot(doc(db, "configuracoes", "template_mensagem"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().texto) {
        setTemplateMensagem(docSnap.data().texto);
      }
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar template de mensagem:", error);
    });

    return () => {
      unsubscribeFornecedoresDoc();
      unsubscribePortfolio();
      unsubscribeRealWeddings();
      unsubscribeBlogPosts();
      unsubscribeContato();
      unsubscribeTemplate();
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

  // Sincroniza Clientes e Eventos de forma "Lazy" apenas para Administradores
  useEffect(() => {
    if (!db || !isAdminAuthenticated) {
      setClientes([]);
      setEventos([]);
      return;
    }

    console.log("[FIREBASE] Administrador autenticado: Iniciando carregamento completo de clientes e eventos...");

    const unsubscribeClientes = onSnapshot(collection(db, "clientes"), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setClientes(docs);
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar clientes para o admin:", error);
    });

    const defaultCats = [
      { id: 'aliancas', nome: 'Alianças', explicacao: 'As alianças são o símbolo material da união. Ao escolher, considerem o conforto para o dia a dia, a qualidade do metal (geralmente ouro 18k) e o estilo que combine com a personalidade de ambos. É recomendável encomendar com pelo menos 3 meses de antecedência.' },
      { id: 'buffet', nome: 'Buffet', explicacao: 'O buffet é um dos pilares do casamento. Avaliem o estilo do serviço (americano, franco-americano ou empratado) de acordo com o perfil dos convidados. Lembrem-se de realizar degustações completas e atentar para restrições alimentares (vegetarianos, intolerantes, etc.).' },
      { id: 'local', nome: 'Espaço / Local', explicacao: 'A escolha do espaço define toda a logística do evento. Considerem a capacidade de convidados, plano B para casamentos ao ar livre (em caso de chuva), restrições de horário e ruído, e se a infraestrutura de banheiros e cozinha atende aos fornecedores contratados.' },
      { id: 'decoracao', nome: 'Decoração', explicacao: 'A decoração expressa a identidade visual e o clima do casamento. Reúnam referências de paletas de cores e estilos (clássico, boho, rústico ou minimalista). Definam prioridades de destaque, como o altar e a mesa de doces.' },
      { id: 'vestido', nome: 'Vestido de Noiva', explicacao: 'O vestido ideal é aquele que faz você se sentir confiante e confortável. Comecem a busca com 8 a 10 meses de antecedência. Considerem o local e o horário da cerimônia na escolha do tecido e corte.' },
      { id: 'cerimonial', nome: 'Cerimonial', explicacao: 'O cerimonial é o anjo da guarda do casal. Eles organizam o cronograma, coordenam os fornecedores no dia e garantem que tudo corra perfeitamente. Contratar uma assessoria completa desde o início economiza tempo e previne surpresas.' },
      { id: 'musica', nome: 'DJ & Banda', explicacao: 'A música dita a energia da festa. Escolham profissionais que saibam ler a pista e adaptar o repertório em tempo real. Alinhem previamente a lista de músicas indispensáveis e aquelas que não devem tocar de jeito nenhum.' },
      { id: 'foto_video', nome: 'Foto & Vídeo', explicacao: 'A fotografia e o vídeo são as lembranças eternas do seu dia. Analisem o portfólio completo dos profissionais para entender seu estilo (documental, posado, fine art). A sintonia pessoal com a equipe é essencial, pois eles estarão ao seu lado o dia todo.' }
    ];

    const unsubscribeEventos = onSnapshot(collection(db, "eventos"), (snapshot) => {
      const docs = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id !== "config_fornecedores") {
          const data = docSnap.data();
          const normalizedPhotos = (data.fotos || []).map((p, idx) => {
            if (typeof p === 'string') {
              return {
                id: p,
                url_storage: p,
                name: `Foto ${idx + 1}`,
                selecionada: false,
                destaque: false
              };
            }
            return {
              id: p.id || p.url_storage || `photo_${idx}`,
              url_storage: p.url_storage || p.url || '',
              name: p.name || `Foto ${idx + 1}`,
              selecionada: !!p.selecionada,
              destaque: !!p.destaque
            };
          });
          docs.push({ id: docSnap.id, ...data, fotos: normalizedPhotos });
        }
      });
      setEventos(docs);
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar eventos para o admin:", error);
    });

    return () => {
      unsubscribeClientes();
      unsubscribeEventos();
    };
  }, [db, isAdminAuthenticated]);

  // Sincroniza activeClient com sessionStorage de acordo com a galeria ativa
  useEffect(() => {
    if (selectedGalleryToken && magicEvent) {
      const savedClientId = sessionStorage.getItem(`active_client_${magicEvent.id}`);
      if (savedClientId && magicClient) {
        setActiveClient(magicClient);
        return;
      }
    }
    setActiveClient(null);
  }, [selectedGalleryToken, magicEvent, magicClient]);
  // Sincroniza dados da Galeria e Cliente ativos via Link Mágico (?gallery=token)
  useEffect(() => {
    if (!selectedGalleryToken || !db) {
      setMagicEvent(null);
      setMagicClient(null);
      return;
    }

    console.log(`[FIREBASE] Buscando galeria do link mágico: ${selectedGalleryToken}`);
    const q = query(collection(db, "eventos"), where("token", "==", selectedGalleryToken));
    
    const unsubscribeEvent = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        const normalizedPhotos = (data.fotos || []).map((p, idx) => {
          if (typeof p === 'string') {
            return {
              id: p,
              url_storage: p,
              name: `Foto ${idx + 1}`,
              selecionada: false,
              destaque: false
            };
          }
          return {
            id: p.id || p.url_storage || `photo_${idx}`,
            url_storage: p.url_storage || p.url || '',
            name: p.name || `Foto ${idx + 1}`,
            selecionada: !!p.selecionada,
            destaque: !!p.destaque
          };
        });
        
        const eventObj = { id: docSnap.id, ...data, fotos: normalizedPhotos };
        setMagicEvent(eventObj);
      } else {
        setMagicEvent(null);
      }
    }, (error) => {
      console.error("[FIREBASE] Erro ao sincronizar galeria mágica:", error);
    });

    return () => unsubscribeEvent();
  }, [selectedGalleryToken, db]);

  // Sincroniza o cliente da galeria ativa caso ele já tenha se identificado anteriormente
  useEffect(() => {
    if (!magicEvent || !db) {
      setMagicClient(null);
      return;
    }

    const savedClientId = sessionStorage.getItem(`active_client_${magicEvent.id}`);
    const clientIdToFetch = savedClientId || magicEvent.id_cliente;

    if (!clientIdToFetch) {
      setMagicClient(null);
      return;
    }

    console.log(`[FIREBASE] Buscando dados do cliente da galeria: ${clientIdToFetch}`);
    const unsubscribeClient = onSnapshot(doc(db, "clientes", clientIdToFetch), (docSnap) => {
      if (docSnap.exists()) {
        setMagicClient({ id: docSnap.id, ...docSnap.data() });
      } else {
        setMagicClient(null);
      }
    }, (error) => {
      console.error("[FIREBASE] Erro ao carregar cliente da galeria:", error);
    });

    return () => unsubscribeClient();
  }, [magicEvent, db]);

  // Controla contagem de visualizações do evento para estimativa de banda de tráfego
  useEffect(() => {
    if (activeTab === 'magic-client' && selectedGalleryToken && magicEvent) {
      // Se acesso for restrito, conta apenas quando estiver autenticado
      const isAuth = !magicEvent.acesso_restrito || authenticatedGalleries[magicEvent.id];
      if (isAuth) {
        const viewedSessionKey = `viewed_${magicEvent.id}`;
        if (!sessionStorage.getItem(viewedSessionKey)) {
          sessionStorage.setItem(viewedSessionKey, 'true');
          if (db) {
            const todayStr = new Date().toISOString().split('T')[0];
            const currentViews = magicEvent.views || 0;
            let currentViewsDiarias = magicEvent.views_diarias || 0;
            if (magicEvent.ultima_visualizacao_data !== todayStr) {
              currentViewsDiarias = 0;
            }
            updateDoc(doc(db, "eventos", magicEvent.id), { 
              views: currentViews + 1,
              views_diarias: currentViewsDiarias + 1,
              ultima_visualizacao_data: todayStr
            })
              .then(() => console.log("[FIREBASE] Visualização diária incrementada:", magicEvent.id))
              .catch(err => console.error("[FIREBASE] Erro ao incrementar views:", err));
          }
        }
      }
    }
  }, [activeTab, selectedGalleryToken, authenticatedGalleries, magicEvent, db]);

  // Função auxiliar para verificar o e-mail de um cliente de forma lazy no Firestore
  const handleCheckClientEmail = async (email) => {
    if (!db) return null;
    try {
      console.log(`[FIREBASE] Verificando e-mail do cliente: ${email}`);
      const q = query(collection(db, "clientes"), where("email", "==", email.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        return { id: docSnap.id, ...docSnap.data() };
      }
    } catch (err) {
      console.error("[FIREBASE] Erro ao buscar e-mail de cliente:", err);
    }
    return null;
  };

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

  const handleUpdateEvento = (eventId, updatedEventData) => {
    if (db) {
      updateDoc(doc(db, "eventos", eventId), updatedEventData)
        .then(() => console.log("[FIREBASE] Evento atualizado com sucesso:", eventId))
        .catch(err => console.error("[FIREBASE] Erro ao atualizar evento no Firebase:", err));
    } else {
      setEventos((prev) =>
        prev.map((evt) => (evt.id === eventId ? { ...evt, ...updatedEventData } : evt))
      );
    }
    console.log("[ADMIN] Galeria de evento atualizada:", eventId, updatedEventData);
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
  const handleToggleSelection = (eventId, photoId, isSelected, clientId) => {
    if (!clientId) return;
    const targetEvent = eventos.find(e => e.id === eventId);
    if (!targetEvent) return;

    const eventSelections = targetEvent.selecoes_clientes || {};
    const clientSelection = eventSelections[clientId] || {
      fotos_selecionadas: [],
      status: 'em_progresso',
      data_finalizacao: null
    };

    let currentSelected = clientSelection.fotos_selecionadas || [];
    let updatedSelected = [];
    if (isSelected) {
      if (!currentSelected.includes(photoId)) {
        updatedSelected = [...currentSelected, photoId];
      } else {
        updatedSelected = currentSelected;
      }
    } else {
      updatedSelected = currentSelected.filter(id => id !== photoId);
    }

    const updatedClientSelection = {
      ...clientSelection,
      fotos_selecionadas: updatedSelected,
      status: clientSelection.status || 'em_progresso',
      data_finalizacao: clientSelection.data_finalizacao || null
    };

    if (db) {
      updateDoc(doc(db, "eventos", eventId), {
        [`selecoes_clientes.${clientId}`]: updatedClientSelection
      })
        .then(() => console.log("[FIREBASE] Seleção individual atualizada para o cliente:", clientId))
        .catch(err => console.error("[FIREBASE] Erro ao atualizar seleção:", err));
    } else {
      setEventos(prev => prev.map(e => {
        if (e.id === eventId) {
          return {
            ...e,
            selecoes_clientes: {
              ...(e.selecoes_clientes || {}),
              [clientId]: updatedClientSelection
            }
          };
        }
        return e;
      }));
    }
  };

  // Finalizar evento / seleção
  const handleFinalizeEvent = (eventId, clientId) => {
    if (!clientId) return;
    const targetEvent = eventos.find(e => e.id === eventId);
    if (!targetEvent) return;

    const eventSelections = targetEvent.selecoes_clientes || {};
    const clientSelection = eventSelections[clientId] || {
      fotos_selecionadas: [],
      status: 'em_progresso',
      data_finalizacao: null
    };
    const dateStr = new Date().toISOString();

    const updatedClientSelection = {
      ...clientSelection,
      status: "finalizada",
      data_finalizacao: dateStr
    };

    if (db) {
      updateDoc(doc(db, "eventos", eventId), {
        [`selecoes_clientes.${clientId}`]: updatedClientSelection
      })
        .then(() => {
          console.log("[FIREBASE] Seleção finalizada para o cliente:", clientId);
          const client = clientes.find((c) => c.id === clientId);
          if (client && targetEvent) {
            const selectedCount = updatedClientSelection.fotos_selecionadas.length;
            const totalCount = (targetEvent.fotos || []).length;

            sendSelectionFinalizedEmails({
              clientName: client.nome,
              clientEmail: client.email,
              galleryTitle: targetEvent.titulo,
              selectedCount: selectedCount,
              totalCount: totalCount
            }).then((res) => {
              console.log(`[EMAIL] Notificações de finalização enviadas para ${client.email}`);
            });
          }
        })
        .catch((err) => console.error("[FIREBASE] Erro ao finalizar seleção:", err));
    } else {
      setEventos(prev => prev.map(e => {
        if (e.id === eventId) {
          return {
            ...e,
            selecoes_clientes: {
              ...(e.selecoes_clientes || {}),
              [clientId]: updatedClientSelection
            }
          };
        }
        return e;
      }));

      const client = clientes.find((c) => c.id === clientId);
      if (client && targetEvent) {
        const selectedCount = updatedClientSelection.fotos_selecionadas.length;
        const totalCount = (targetEvent.fotos || []).length;
        sendSelectionFinalizedEmails({
          clientName: client.nome,
          clientEmail: client.email,
          galleryTitle: targetEvent.titulo,
          selectedCount: selectedCount,
          totalCount: totalCount
        });
      }
    }
    console.log(`[EVENT] Seleção do cliente ${clientId} finalizada e travada.`);
  };

  // Reabrir evento / seleção
  const handleReopenEvento = (eventId, clientId = null) => {
    if (clientId) {
      const targetEvent = eventos.find(e => e.id === eventId);
      if (!targetEvent) return;

      const eventSelections = targetEvent.selecoes_clientes || {};
      const clientSelection = eventSelections[clientId] || {
        fotos_selecionadas: [],
        status: 'em_progresso',
        data_finalizacao: null
      };

      const updatedClientSelection = {
        ...clientSelection,
        status: "em_progresso",
        data_finalizacao: null
      };

      if (db) {
        updateDoc(doc(db, "eventos", eventId), {
          [`selecoes_clientes.${clientId}`]: updatedClientSelection
        })
          .then(() => console.log("[FIREBASE] Seleção reaberta para cliente:", clientId))
          .catch(err => console.error("[FIREBASE] Erro ao reabrir seleção:", err));
      } else {
        setEventos(prev => prev.map(e => {
          if (e.id === eventId) {
            return {
              ...e,
              selecoes_clientes: {
                ...(e.selecoes_clientes || {}),
                [clientId]: updatedClientSelection
              }
            };
          }
          return e;
        }));
      }
    } else {
      if (db) {
        updateDoc(doc(db, "eventos", eventId), { status: "ativa" })
          .then(() => console.log("[FIREBASE] Evento reaberto globalmente:", eventId))
          .catch(err => console.error("[FIREBASE] Erro ao reabrir evento:", err));
      } else {
        setEventos((prev) =>
          prev.map(evt => evt.id === eventId ? { ...evt, status: 'ativa' } : evt)
        );
      }
    }
  };

  // Vincular cliente à lista de clientes_permitidos do evento
  const handleAssociateClientToEvent = (eventId, clientId) => {
    const targetEvent = eventos.find(e => e.id === eventId);
    if (!targetEvent) return;
    const currentPermitted = targetEvent.clientes_permitidos || [];
    if (!currentPermitted.includes(clientId)) {
      const updatedPermitted = [...currentPermitted, clientId];
      if (db) {
        updateDoc(doc(db, "eventos", eventId), { clientes_permitidos: updatedPermitted })
          .then(() => console.log("[FIREBASE] Cliente associado ao evento:", clientId))
          .catch(err => console.error("[FIREBASE] Erro ao associar cliente ao evento:", err));
      } else {
        setEventos(prev => prev.map(e => e.id === eventId ? { ...e, clientes_permitidos: updatedPermitted } : e));
      }
    }
  };

  // Desvincular cliente da lista de clientes_permitidos do evento e remover a seleção correspondente
  const handleUnassociateClient = (eventId, clientId) => {
    const targetEvent = eventos.find(e => e.id === eventId);
    if (!targetEvent) return;

    const updatedPermitted = (targetEvent.clientes_permitidos || []).filter(id => id !== clientId);
    const updatedIdCliente = targetEvent.id_cliente === clientId ? null : targetEvent.id_cliente;

    if (db) {
      updateDoc(doc(db, "eventos", eventId), {
        clientes_permitidos: updatedPermitted,
        id_cliente: updatedIdCliente,
        [`selecoes_clientes.${clientId}`]: deleteField()
      })
        .then(() => console.log(`[FIREBASE] Cliente ${clientId} desvinculado do evento ${eventId}`))
        .catch(err => console.error("[FIREBASE] Erro ao desvincular cliente:", err));
    } else {
      setEventos(prev => prev.map(e => {
        if (e.id === eventId) {
          const updatedSelections = { ...(e.selecoes_clientes || {}) };
          delete updatedSelections[clientId];
          return {
            ...e,
            clientes_permitidos: updatedPermitted,
            id_cliente: updatedIdCliente,
            selecoes_clientes: updatedSelections
          };
        }
        return e;
      }));
    }
  };

  // Atualizar o limite de fotos individual de um cliente na coleção de seleções
  const handleUpdateClientSelectionLimit = (eventId, clientId, limit) => {
    const targetEvent = eventos.find(e => e.id === eventId);
    if (!targetEvent) return;

    const eventSelections = targetEvent.selecoes_clientes || {};
    const clientSelection = eventSelections[clientId] || {
      fotos_selecionadas: [],
      status: 'em_progresso',
      data_finalizacao: null
    };
    const numericLimit = limit === '' || limit === null ? null : parseInt(limit, 10);

    const updatedClientSelection = {
      ...clientSelection,
      limite_fotos: numericLimit
    };

    if (db) {
      updateDoc(doc(db, "eventos", eventId), {
        [`selecoes_clientes.${clientId}`]: updatedClientSelection
      })
        .then(() => console.log(`[FIREBASE] Limite de fotos atualizado para o cliente ${clientId}`))
        .catch(err => console.error("[FIREBASE] Erro ao atualizar limite:", err));
    } else {
      setEventos(prev => prev.map(e => {
        if (e.id === eventId) {
          return {
            ...e,
            selecoes_clientes: {
              ...(e.selecoes_clientes || {}),
              [clientId]: updatedClientSelection
            }
          };
        }
        return e;
      }));
    }
  };

  // Atualizar a permissão de fotos extras individual de um cliente na coleção de seleções
  const handleUpdateClientSelectionExtras = (eventId, clientId, permitirExtrasVal) => {
    const targetEvent = eventos.find(e => e.id === eventId);
    if (!targetEvent) return;

    const eventSelections = targetEvent.selecoes_clientes || {};
    const clientSelection = eventSelections[clientId] || {
      fotos_selecionadas: [],
      status: 'em_progresso',
      data_finalizacao: null
    };

    const updatedClientSelection = {
      ...clientSelection,
      permitir_extras: permitirExtrasVal
    };

    if (db) {
      updateDoc(doc(db, "eventos", eventId), {
        [`selecoes_clientes.${clientId}`]: updatedClientSelection
      })
        .then(() => console.log(`[FIREBASE] Fotos extras atualizadas para o cliente ${clientId}:`, permitirExtrasVal))
        .catch(err => console.error("[FIREBASE] Erro ao atualizar permitir_extras:", err));
    } else {
      setEventos(prev => prev.map(e => {
        if (e.id === eventId) {
          return {
            ...e,
            selecoes_clientes: {
              ...(e.selecoes_clientes || {}),
              [clientId]: updatedClientSelection
            }
          };
        }
        return e;
      }));
    }
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

  // Alternar destaque da foto do portfólio na página principal (Toggle)
  const handleSetPortfolioCover = (photoId) => {
    console.log("[PORTFOLIO] Alternando destaque da foto:", photoId);
    const targetPhoto = portfolio.find(p => p.id === photoId);
    if (!targetPhoto) return;

    const newDestaque = !targetPhoto.destaque;

    if (db) {
      updateDoc(doc(db, "portfolio", photoId), { destaque: newDestaque })
        .then(() => console.log(`[FIREBASE] Foto do portfólio ${photoId} destaque = ${newDestaque}`))
        .catch(err => console.error("[FIREBASE] Erro ao alternar destaque no Firestore:", err));
    } else {
      setPortfolio((prev) => prev.map(p => p.id === photoId ? { ...p, destaque: newDestaque } : p));
    }
  };

  // Definir foto como banner principal do topo (Hero)
  const handleSetPortfolioBanner = (photoId) => {
    console.log("[PORTFOLIO] Definindo foto de banner principal:", photoId);
    if (db) {
      portfolio.forEach((photo) => {
        const isTarget = photo.id === photoId;
        if (photo.banner !== isTarget) {
          updateDoc(doc(db, "portfolio", photo.id), { banner: isTarget })
            .then(() => console.log(`[FIREBASE] Foto do portfólio ${photo.id} banner = ${isTarget}`))
            .catch(err => console.error("[FIREBASE] Erro ao atualizar banner no Firestore:", err));
        }
      });
    } else {
      setPortfolio((prev) => prev.map(p => ({ ...p, banner: p.id === photoId })));
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

  // Salvar/Editar texto explicativo da Categoria
  const handleSaveCategoryExplanation = async (categoryId, explanationText) => {
    console.log("[FIREBASE] Salvando explicação da categoria:", categoryId);
    const updatedCats = categoriasFornecedores.map(c => {
      if (c.id === categoryId) {
        return { ...c, explicacao: explanationText };
      }
      return c;
    });

    if (db) {
      await setDoc(doc(db, "eventos", "config_fornecedores"), {
        categorias: updatedCats,
        fornecedores: fornecedores
      }, { merge: true });
    } else {
      setCategoriasFornecedores(updatedCats);
    }
  };

  // Cadastrar/Adicionar Fornecedor
  const handleAddVendor = async (vendorData) => {
    const newVendor = {
      id: `forn_${Date.now()}`,
      ...vendorData
    };
    console.log("[FIREBASE] Cadastrando novo fornecedor:", newVendor.nome);
    const updatedFornecedores = [...fornecedores, newVendor];

    if (db) {
      await setDoc(doc(db, "eventos", "config_fornecedores"), {
        categorias: categoriasFornecedores,
        fornecedores: updatedFornecedores
      }, { merge: true });
    } else {
      setFornecedores(updatedFornecedores);
    }
  };

  // Editar/Atualizar Fornecedor
  const handleUpdateVendor = async (vendorId, vendorData) => {
    console.log("[FIREBASE] Atualizando fornecedor:", vendorId);
    const updatedVendor = {
      id: vendorId,
      ...vendorData
    };
    const updatedFornecedores = fornecedores.map(f => f.id === vendorId ? updatedVendor : f);

    if (db) {
      await setDoc(doc(db, "eventos", "config_fornecedores"), {
        categorias: categoriasFornecedores,
        fornecedores: updatedFornecedores
      }, { merge: true });
    } else {
      setFornecedores(updatedFornecedores);
    }
  };

  // Excluir/Deletar Fornecedor
  const handleDeleteVendor = async (vendorId) => {
    console.log("[FIREBASE] Excluindo fornecedor:", vendorId);
    const updatedFornecedores = fornecedores.filter(f => f.id !== vendorId);

    if (db) {
      await setDoc(doc(db, "eventos", "config_fornecedores"), {
        categorias: categoriasFornecedores,
        fornecedores: updatedFornecedores
      }, { merge: true });
    } else {
      setFornecedores(updatedFornecedores);
    }
  };

  // Callback para salvar dados de Contato
  const handleSaveContato = async (contatoData) => {
    console.log("[FIREBASE] Salvando informações de contato:", contatoData);
    if (db) {
      await setDoc(doc(db, "configuracoes", "contato"), contatoData);
    } else {
      setContato(contatoData);
    }
  };

  // Callback para salvar o template de mensagem personalizada para clientes
  const handleSaveTemplateMensagem = async (novoTexto) => {
    console.log("[FIREBASE] Salvando template de mensagem:", novoTexto);
    if (db) {
      await setDoc(doc(db, "configuracoes", "template_mensagem"), { texto: novoTexto });
    } else {
      setTemplateMensagem(novoTexto);
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
  const handleGeneralLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      // 1. Procurar o cliente pelo e-mail usando uma query no Firestore
      const clientQuery = query(
        collection(db, "clientes"), 
        where("email", "==", loginEmail.toLowerCase().trim())
      );
      const clientSnap = await getDocs(clientQuery);
      
      if (clientSnap.empty) {
        setLoginError('E-mail ou senha incorretos.');
        return;
      }
      
      const clientDoc = clientSnap.docs[0];
      const client = { id: clientDoc.id, ...clientDoc.data() };
      
      // 2. Verificar a senha
      if (String(client.senha || '').trim() !== String(loginPassword || '').trim()) {
        setLoginError('E-mail ou senha incorretos.');
        return;
      }
      
      // 3. Procurar a galeria vinculada a este cliente usando uma query no Firestore
      const eventQuery = query(
        collection(db, "eventos"),
        where("id_cliente", "==", client.id)
      );
      const eventSnap = await getDocs(eventQuery);
      
      if (eventSnap.empty) {
        setLoginError('Nenhuma galeria ativa vinculada a este cliente.');
        return;
      }
      
      const eventDoc = eventSnap.docs[0];
      const matchedEvent = { id: eventDoc.id, ...eventDoc.data() };
      
      // 4. Autenticar e redirecionar
      setAuthenticatedGalleries((prev) => ({ ...prev, [matchedEvent.id]: true }));
      
      // Salva o ID do cliente logado no sessionStorage para persistência
      sessionStorage.setItem(`active_client_${matchedEvent.id}`, client.id);
      
      // Preencher os estados locais de visualização mágica
      setMagicEvent({
        ...matchedEvent,
        fotos: (matchedEvent.fotos || []).map((p, idx) => {
          if (typeof p === 'string') {
            return {
              id: p,
              url_storage: p,
              name: `Foto ${idx + 1}`,
              selecionada: false,
              destaque: false
            };
          }
          return {
            id: p.id || p.url_storage || `photo_${idx}`,
            url_storage: p.url_storage || p.url || '',
            name: p.name || `Foto ${idx + 1}`,
            selecionada: !!p.selecionada,
            destaque: !!p.destaque
          };
        })
      });
      setMagicClient(client);
      
      setSelectedGalleryToken(matchedEvent.token);
      setActiveTab('magic-client');
      setShowClientLogin(false);
      setLoginEmail('');
      setLoginPassword('');
      console.log(`[CLIENT LOGIN] Sucesso para o cliente ${client.nome}. Acessando galeria: ${matchedEvent.titulo}`);
    } catch (err) {
      console.error("[CLIENT LOGIN ERROR]", err);
      setLoginError('Erro ao realizar o acesso: ' + err.message);
    }
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
    ? (showAllPortfolio ? portfolio : (portfolio.filter(p => p.destaque === true).length > 0 ? portfolio.filter(p => p.destaque === true) : portfolio.slice(0, 6)))
    : portfolio.filter((p) => p.category === portfolioCategory);

  const coverPortfolioPhoto = portfolio.find((p) => p.banner === true) || portfolio.find((p) => p.destaque === true);
  const coverPortfolioUrl = coverPortfolioPhoto ? coverPortfolioPhoto.url : 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1920&q=80';

  // Renderização do Estado de Carregamento Editorial (Spinner)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center font-sans text-stone-900 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-stone-900 text-white rounded flex items-center justify-center font-serif text-lg tracking-widest shadow-sm mx-auto animate-spin" style={{ animationDuration: '3s' }}>
            W
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">Wilkson Fotografias</p>
          <div className="flex justify-center items-center gap-1.5 pt-2">
            <span className="w-1.5 h-1.5 bg-stone-900 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-stone-900 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-stone-900 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // Renderização específica para link mágico (?gallery=token)
  if (activeTab === 'magic-client' && selectedGalleryToken) {
    if (!magicEvent) {
      return (
        <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center font-sans text-stone-900 animate-fade-in">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-stone-900 text-white rounded flex items-center justify-center font-serif text-lg tracking-widest shadow-sm mx-auto animate-spin" style={{ animationDuration: '3s' }}>
              W
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">Wilkson Fotografias</p>
            <p className="text-[9px] text-stone-400">Carregando galeria...</p>
          </div>
        </div>
      );
    }

    const matchedEvent = magicEvent;
    const currentClient = magicClient;

    // Se o cliente ainda não se identificou para esta galeria, exibimos a tela de identificação/auto-cadastro
    if (!currentClient) {
      return (
        <ClientAccessPortal
          event={matchedEvent}
          onCheckEmail={handleCheckClientEmail}
          onAccessSuccess={(client) => {
            setMagicClient(client);
            sessionStorage.setItem(`active_client_${matchedEvent.id}`, client.id);
            if (matchedEvent.acesso_restrito) {
              setAuthenticatedGalleries((prev) => ({ ...prev, [matchedEvent.id]: true }));
            }
          }}
          onBack={handleBackToWorkspace}
          onAddCliente={handleAddCliente}
          onAssociateClientToEvent={handleAssociateClientToEvent}
        />
      );
    }

    // Portão de segurança extra: se for acesso restrito e por algum motivo não estiver autenticado na sessão
    if (matchedEvent.acesso_restrito && !authenticatedGalleries[matchedEvent.id]) {
      return (
        <ClientAccessPortal
          event={matchedEvent}
          onCheckEmail={handleCheckClientEmail}
          onAccessSuccess={(client) => {
            setMagicClient(client);
            sessionStorage.setItem(`active_client_${matchedEvent.id}`, client.id);
            setAuthenticatedGalleries((prev) => ({ ...prev, [matchedEvent.id]: true }));
          }}
          onBack={handleBackToWorkspace}
          onAddCliente={handleAddCliente}
          onAssociateClientToEvent={handleAssociateClientToEvent}
        />
      );
    }

    // Buscar a seleção deste cliente para este evento
    const selectionId = `${matchedEvent.id}_${currentClient.id}`;
    const activeSelection = selecoes.find(s => s.id === selectionId);
    const selectedPhotoIds = activeSelection ? (activeSelection.fotos_selecionadas || []) : [];

    // Mesclar a propriedade selecionada para cada foto a partir das escolhas deste cliente específico
    const photosWithClientSelection = (matchedEvent.fotos || []).map((p, idx) => {
      let photoObj = typeof p === 'string' ? {
        id: p,
        url_storage: p,
        name: `Foto ${idx + 1}`,
        destaque: false
      } : {
        id: p.id || p.url_storage || `photo_${idx}`,
        url_storage: p.url_storage || p.url || '',
        name: p.name || `Foto ${idx + 1}`,
        destaque: !!p.destaque
      };
      return {
        ...photoObj,
        selecionada: selectedPhotoIds.includes(photoObj.id)
      };
    });

    const isFinalized = activeSelection && activeSelection.status === 'finalizada';
    const effectiveLimit = (activeSelection && activeSelection.limite_fotos !== undefined && activeSelection.limite_fotos !== null)
      ? activeSelection.limite_fotos
      : matchedEvent.limite_fotos;

    const effectivePermitirExtras = (activeSelection && activeSelection.permitir_extras !== undefined && activeSelection.permitir_extras !== null)
      ? activeSelection.permitir_extras
      : matchedEvent.permitir_extras;

    console.log("[DEBUG CLIENT LIMIT]", {
      selectionId,
      activeSelectionExists: !!activeSelection,
      activeSelectionLimit: activeSelection?.limite_fotos,
      eventLimit: matchedEvent.limite_fotos,
      effectiveLimit,
      effectivePermitirExtras
    });

    return (
      <div className="h-screen overflow-hidden flex flex-col bg-[#FAF9F6]">
        <div className="flex bg-stone-100 border-b border-stone-200 px-6 py-2 flex items-center justify-between text-xs text-stone-500 font-sans flex-shrink-0">
          <span>Identificado como: <strong className="text-stone-850">{currentClient.nome}</strong> ({currentClient.email})</span>
          <button 
            onClick={() => {
              setActiveClient(null);
              sessionStorage.removeItem(`active_client_${matchedEvent.id}`);
            }} 
            className="underline hover:text-stone-900 font-bold uppercase tracking-wider text-[9px]"
          >
            [ Trocar de Cliente / Sair ]
          </button>
        </div>
        <div className="flex-grow flex flex-col min-h-0 relative">
          <PhotoVirtualGrid
            key={`${matchedEvent.id}_${currentClient.id}_${photosWithClientSelection.length}_${isFinalized ? 'finalizada' : 'ativa'}_lim_${effectiveLimit}_ext_${effectivePermitirExtras}`}
            eventId={matchedEvent.id}
            initialPhotos={photosWithClientSelection}
            limiteFotos={effectiveLimit}
            statusEvento={isFinalized ? 'finalizada' : matchedEvent.status}
            permitirExtras={effectivePermitirExtras}
            selecaoLivre={matchedEvent.selecao_livre}
            valorFotoExtra={matchedEvent.valor_foto_extra}
            marcaDaguaAtiva={matchedEvent.marca_dagua_ativa}
            marcaDaguaTexto={matchedEvent.marca_dagua_texto}
            marcaDaguaOpacidade={matchedEvent.marca_dagua_opacidade}
            marcaDaguaMiniaturas={matchedEvent.marca_dagua_miniaturas}
            marcaDaguaExpandida={matchedEvent.marca_dagua_expandida}
            marcaDaguaEstilo={matchedEvent.marca_dagua_estilo || 'leve'}
            tipoGaleria={matchedEvent.tipo_galeria}
            permitirDownload={matchedEvent.permitir_download}
            pagamentoExtrasConfirmado={matchedEvent.pagamento_extras_confirmado}
            tituloEvent={matchedEvent.titulo}
            dataEvent={matchedEvent.data}
            onToggleSelection={(photoId, isSelected) => handleToggleSelection(matchedEvent.id, photoId, isSelected, currentClient.id)}
            onFinalizeEvent={(eventId) => handleFinalizeEvent(eventId, currentClient.id)}
            isDemo={!matchedEvent.fotos || matchedEvent.fotos.length === 0}
            isAdmin={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-800 flex flex-col font-sans selection:bg-stone-200">
      
      {/* Cabeçalho Fixo Translúcido (Sticky Glassmorphic) */}
      <header className="sticky top-0 z-[50] bg-[#FAF9F6]/80 backdrop-blur-md border-b border-stone-200/60 px-4 sm:px-6 py-2.5 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-2 shadow-[0_2px_15px_-3px_rgba(28,25,23,0.02)]">
        <div 
          onClick={() => {
            setActiveTab('client');
            setSelectedGalleryToken(null);
            setSelectedWeddingId(null);
            setSelectedBlogPostId(null);
            setLightboxIndex(null);
            setPortfolioCategory('todos');
            setShowAllPortfolio(false);
          }}
          className="flex items-center gap-2 justify-center sm:justify-start w-full sm:w-auto cursor-pointer hover:opacity-80 transition-opacity select-none"
        >
          <div className="w-6 h-6 bg-stone-900 rounded flex items-center justify-center font-serif text-white font-light text-xs tracking-widest shadow-xs flex-shrink-0">
            W
          </div>
          <div className="min-w-0">
            <h1 className="font-sans text-[10px] sm:text-[11px] font-light tracking-[0.3em] text-stone-900 uppercase truncate">
              WILKSON FOTOGRAFIAS
            </h1>
          </div>
        </div>

        {/* Abas Superiores de Controle */}
        <div className="flex items-center w-full sm:w-auto flex-shrink-0 justify-center">
          <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200/50 w-full sm:w-auto justify-between sm:justify-start flex-nowrap gap-0.5">
            <button
              onClick={() => {
                setActiveTab('client');
                setSelectedGalleryToken(null);
                setLightboxIndex(null);
                setSelectedWeddingId(null);
                setSelectedBlogPostId(null);
              }}
              className={`flex-grow sm:flex-grow-0 text-center px-1.5 sm:px-2.5 py-1.5 sm:py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
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
              className={`flex-grow sm:flex-grow-0 text-center px-1.5 sm:px-2.5 py-1.5 sm:py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
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
              className={`flex-grow sm:flex-grow-0 text-center px-1.5 sm:px-2.5 py-1.5 sm:py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'blog'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Blog
            </button>
            <button
              onClick={() => {
                setActiveTab('fornecedores');
                setSelectedGalleryToken(null);
                setLightboxIndex(null);
                setSelectedWeddingId(null);
                setSelectedBlogPostId(null);
              }}
              className={`flex-grow sm:flex-grow-0 text-center px-1.5 sm:px-2.5 py-1.5 sm:py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'fornecedores'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Fornecedores
            </button>
            <button
              onClick={() => {
                setShowClientLogin(true);
              }}
              className={`flex-grow sm:flex-grow-0 text-center px-1.5 sm:px-2.5 py-1.5 sm:py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
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
              className={`flex-grow sm:flex-grow-0 text-center px-1.5 sm:px-2.5 py-1.5 sm:py-1 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest transition-all ${
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
      <main className="flex-grow flex flex-col p-3 sm:p-6 max-w-full overflow-x-hidden">
        
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
                  { id: 'ensaios', label: 'Ensaios' },
                  { id: 'infantil', label: 'Infantil' },
                  { id: 'formatura', label: 'Formaturas' },
                  { id: 'corporativo', label: 'Corporativo' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setPortfolioCategory(cat.id);
                      setLightboxIndex(null);
                      setShowAllPortfolio(false);
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

            {/* Botão Ver Mais Fotos (Apenas na aba Todos e se não estiver mostrando tudo) */}
            {portfolioCategory === 'todos' && !showAllPortfolio && portfolio.length > filteredPortfolio.length && (
              <div className="text-center pt-6 pb-2 animate-reveal">
                <button
                  onClick={() => setShowAllPortfolio(true)}
                  className="px-6 py-2.5 border border-stone-900 text-stone-900 font-sans text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded hover:bg-stone-900 hover:text-white transition-all shadow-2xs"
                >
                  Ver Mais Fotos
                </button>
              </div>
            )}

            {/* Seção de Casamentos Reais na Página Principal (abaixo do portfólio) */}
            {realWeddings.length > 0 && (
              <div className="pt-12 border-t border-stone-200/60 mt-12 space-y-8 animate-reveal">
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-extrabold tracking-widest uppercase text-stone-400">Histórias de Amor</span>
                  <h3 className="font-serif-editorial text-2xl sm:text-4xl text-stone-900 font-light tracking-wide mt-1">Casamentos & Ensaios Reais</h3>
                  <p className="text-[10px] text-stone-450 uppercase tracking-widest leading-relaxed">Nossos últimos trabalhos contados em histórias e fotos</p>
                </div>
                
                <div className="columns-1 md:columns-3 gap-6 space-y-6">
                  {realWeddings.slice(0, 3).map((wed) => (
                    <div
                      key={wed.id}
                      onClick={() => {
                        setSelectedWeddingId(wed.id);
                        setActiveTab('real-weddings');
                      }}
                      className="break-inside-avoid inline-block w-full group cursor-pointer bg-white border border-stone-200/80 rounded-xl overflow-hidden shadow-2xs hover:shadow-sm transition-all duration-300 flex flex-col mb-4"
                    >
                      <div className="w-full bg-stone-50 overflow-hidden relative">
                        <img
                          src={wed.capa}
                          alt={wed.titulo}
                          className="w-full h-auto object-cover group-hover:scale-[1.02] transition-all duration-500"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-5 space-y-3 flex-grow flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{wed.local}</span>
                            <span className="text-[8px] text-stone-400 font-mono">{wed.data}</span>
                          </div>
                          <h4 className="font-serif-editorial text-base text-stone-900 mt-2 font-light leading-snug group-hover:text-stone-700 transition-colors line-clamp-2">
                            {wed.titulo}
                          </h4>
                          <p className="text-stone-450 text-[11px] line-clamp-2 mt-1 leading-relaxed font-light">{wed.descricao}</p>
                        </div>
                        <span className="text-[8.5px] font-bold uppercase tracking-widest text-stone-900 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 pt-3 border-t border-stone-100 mt-2">
                          Ler História Completa →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seção de Blog/Dicas na Página Principal (Home Feed) */}
            {blogPosts.length > 0 && (
              <div className="pt-12 border-t border-stone-200/60 mt-12 space-y-8 animate-reveal">
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-extrabold tracking-widest uppercase text-stone-400">Dicas & Conteúdo</span>
                  <h3 className="font-serif-editorial text-2xl sm:text-4xl text-stone-900 font-light tracking-wide mt-1">Dicas & Inspirações Recentes</h3>
                  <p className="text-[10px] text-stone-450 uppercase tracking-widest leading-relaxed">Guia completo para ajudar no planejamento do seu grande dia</p>
                </div>

                <div className="columns-1 md:columns-3 gap-6 space-y-6">
                  {blogPosts.slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      onClick={() => {
                        setSelectedBlogPostId(post.id);
                        setActiveTab('blog');
                      }}
                      className="break-inside-avoid inline-block w-full group cursor-pointer bg-white border border-stone-200/80 rounded-xl overflow-hidden shadow-2xs hover:shadow-sm transition-all duration-300 flex flex-col justify-between mb-4"
                    >
                      <div className="w-full bg-stone-50 overflow-hidden relative">
                        <img
                          src={post.capa}
                          alt={post.titulo}
                          className="w-full h-auto object-cover group-hover:scale-[1.02] transition-all duration-500"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-5 space-y-3 flex-grow flex flex-col justify-between">
                        <div>
                          <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded inline-block">{post.categoria}</span>
                          <h4 className="font-serif-editorial text-base text-stone-900 mt-2.5 font-light leading-snug group-hover:text-stone-700 transition-colors line-clamp-2">
                            {post.titulo}
                          </h4>
                          <p className="text-stone-450 text-[11px] line-clamp-2 mt-1 leading-relaxed font-light">{post.conteudo}</p>
                        </div>
                        <span className="text-[8.5px] font-bold uppercase tracking-widest text-stone-900 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 pt-3 border-t border-stone-100 mt-2">
                          Ler Artigo Completo →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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
                    <div className="w-full rounded-xl overflow-hidden shadow-md">
                      <img src={wed.capa} alt={wed.titulo} className="w-full h-auto object-cover" />
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
                  <div className="columns-1 sm:columns-2 gap-6 space-y-6">
                    {realWeddings.map((wed) => (
                      <div
                        key={wed.id}
                        onClick={() => setSelectedWeddingId(wed.id)}
                        className="break-inside-avoid inline-block w-full group cursor-pointer bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col mb-6"
                      >
                        <div className="w-full bg-stone-50 overflow-hidden relative">
                          <img
                            src={wed.capa}
                            alt={wed.titulo}
                            className="w-full h-auto object-cover group-hover:scale-[1.02] transition-all duration-500"
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
                    <div className="w-full rounded-xl overflow-hidden shadow-sm">
                      <img src={post.capa} alt={post.titulo} className="w-full h-auto object-cover" />
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
                  <div className="columns-1 sm:columns-2 gap-6 space-y-6">
                    {blogPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => setSelectedBlogPostId(post.id)}
                        className="break-inside-avoid inline-block w-full group cursor-pointer bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col mb-6"
                      >
                        <div className="w-full bg-stone-50 overflow-hidden relative">
                          <img
                            src={post.capa}
                            alt={post.titulo}
                            className="w-full h-auto object-cover group-hover:scale-[1.02] transition-all duration-500"
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

        {/* Aba 1.4: Guia de Fornecedores (Público) */}
        {activeTab === 'fornecedores' && (
          <div className="flex-grow flex flex-col space-y-8 animate-fade-in pb-12">
            {/* Header */}
            <div className="text-center py-6">
              <span className="text-[9px] font-extrabold tracking-widest uppercase text-stone-400 font-sans">Arsenal de Recomendações</span>
              <h2 className="font-serif-editorial text-3xl sm:text-5xl text-stone-900 font-light tracking-wide mt-1">Guia de Fornecedores</h2>
              <p className="text-xs text-stone-450 mt-2 uppercase tracking-wider font-semibold">Dicas essenciais e os melhores parceiros da cidade para realizar seu sonho</p>
            </div>

            {/* Categoria Selector */}
            {(() => {
              const catsList = categoriasFornecedores.length > 0 ? categoriasFornecedores : [
                { id: 'aliancas', nome: 'Alianças' },
                { id: 'buffet', nome: 'Buffet' },
                { id: 'local', nome: 'Espaço / Local' },
                { id: 'decoracao', nome: 'Decoração' },
                { id: 'vestido', nome: 'Vestido de Noiva' },
                { id: 'cerimonial', nome: 'Cerimonial' },
                { id: 'musica', nome: 'DJ & Banda' },
                { id: 'foto_video', nome: 'Foto & Vídeo' }
              ];
              return (
                <>
                  <div className="flex justify-center border-b border-stone-200 pb-3">
                    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                      {catsList.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedVendorCategory(cat.id)}
                          className={`px-3.5 py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all rounded ${
                            selectedVendorCategory === cat.id
                              ? 'bg-stone-900 text-white shadow-sm'
                              : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {cat.nome}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dicas / Explicação Card */}
                  {(() => {
                    const activeCat = catsList.find(c => c.id === selectedVendorCategory);
                    const explanation = activeCat?.explicacao || 'Carregando dicas de planejamento...';
                    return (
                      <div className="max-w-3xl mx-auto w-full bg-white border border-stone-200/60 p-6 sm:p-8 rounded-xl shadow-xs space-y-4">
                        <div className="flex items-center gap-2 text-stone-450 border-b border-stone-100 pb-3">
                          <span className="text-[9px] font-extrabold tracking-widest uppercase font-sans">Como Escolher & Planejar</span>
                          <span className="text-stone-300">•</span>
                          <span className="font-serif-editorial italic text-xs capitalize text-stone-600">{activeCat?.nome || selectedVendorCategory}</span>
                        </div>
                        <p className="text-stone-750 font-sans text-xs sm:text-sm leading-relaxed whitespace-pre-line font-light">
                          {explanation}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Fornecedores Recomendados List */}
                  <div className="space-y-6 max-w-4xl mx-auto w-full">
                    <div className="text-center sm:text-left border-b border-stone-200 pb-2">
                      <h3 className="font-serif-editorial text-xl sm:text-2xl text-stone-900 font-light tracking-wide">
                        Fornecedores Recomendados
                      </h3>
                    </div>

                    {(() => {
                      const filteredVendors = fornecedores.filter(f => f.categoriaId === selectedVendorCategory);
                      if (filteredVendors.length === 0) {
                        return (
                          <div className="text-center py-16 border border-dashed border-stone-200 rounded-xl bg-stone-50/50 text-stone-450 font-serif-editorial">
                            <p className="text-sm">Nenhum fornecedor cadastrado nesta categoria ainda.</p>
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {filteredVendors.map((vendor) => (
                            <div 
                              key={vendor.id}
                              className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all duration-300"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-serif-editorial text-lg text-stone-900 font-medium tracking-wide">
                                    {vendor.nome}
                                  </h4>
                                  {vendor.destaque && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded">
                                      ★ Recomendado
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] font-mono tracking-widest text-stone-400 block uppercase">
                                  Cidade: {vendor.cidade || 'Não informada'}
                                </span>
                                <p className="text-stone-550 text-xs leading-relaxed font-light whitespace-pre-line">
                                  {vendor.descricao}
                                </p>
                              </div>

                              <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 font-sans">
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">Contato</span>
                                  <span className="font-mono text-stone-850 font-medium text-[11px] mt-0.5">{vendor.contato}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  {vendor.link_instagram && (
                                    <a 
                                      href={vendor.link_instagram.startsWith('http') ? vendor.link_instagram : `https://instagram.com/${vendor.link_instagram.replace('@', '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-7 h-7 bg-stone-50 hover:bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-full flex items-center justify-center transition-all"
                                      title="Instagram"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01" />
                                      </svg>
                                    </a>
                                  )}
                                  {vendor.link_web && (
                                    <a 
                                      href={vendor.link_web.startsWith('http') ? vendor.link_web : `https://${vendor.link_web}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-7 h-7 bg-stone-50 hover:bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-full flex items-center justify-center transition-all"
                                      title="Website"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
                                      </svg>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              );
            })()}
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
              selecoes={selecoes}
              portfolio={portfolio}
              realWeddings={realWeddings}
              blogPosts={blogPosts}
              onAddCliente={handleAddCliente}
              onAddEvento={handleAddEvento}
              onUpdateEvento={handleUpdateEvento}
              onAssociateClientToEvent={handleAssociateClientToEvent}
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
              onSetPortfolioBanner={handleSetPortfolioBanner}
              onUnassociateClient={handleUnassociateClient}
              onUpdateClientSelectionLimit={handleUpdateClientSelectionLimit}
              onUpdateClientSelectionExtras={handleUpdateClientSelectionExtras}
              contato={contato}
              onSaveContato={handleSaveContato}
              templateMensagem={templateMensagem}
              onSaveTemplateMensagem={handleSaveTemplateMensagem}
              categoriasFornecedores={categoriasFornecedores}
              fornecedores={fornecedores}
              onSaveCategoryExplanation={handleSaveCategoryExplanation}
              onAddVendor={handleAddVendor}
              onUpdateVendor={handleUpdateVendor}
              onDeleteVendor={handleDeleteVendor}
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

      {/* Footer Fale Conosco Dinâmico (Estilo Revista) */}
      {activeTab !== 'admin' && activeTab !== 'uploader' && (
        <footer className="bg-stone-950 text-stone-300 py-12 px-6 border-t border-stone-850">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Coluna 1: Sobre */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white text-stone-950 rounded flex items-center justify-center font-serif text-xs font-bold tracking-widest">
                  W
                </div>
                <span className="font-sans text-xs font-light tracking-[0.3em] text-white uppercase">WILKSON FOTOGRAFIAS</span>
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed font-light">
                Especializado em registrar a essência, o amor e os momentos mais felizes de casamentos, ensaios e momentos marcantes.
              </p>
            </div>

            {/* Coluna 2: Navegação Rápida */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white">Navegação</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-400 font-light">
                <button onClick={() => { setActiveTab('client'); window.scrollTo(0,0); }} className="text-left hover:text-white transition-colors">Portfólio</button>
                <button onClick={() => { setActiveTab('real-weddings'); window.scrollTo(0,0); }} className="text-left hover:text-white transition-colors">Histórias</button>
                <button onClick={() => { setActiveTab('blog'); window.scrollTo(0,0); }} className="text-left hover:text-white transition-colors">Blog</button>
                <button onClick={() => { setShowClientLogin(true); }} className="text-left hover:text-white transition-colors">Área do Cliente</button>
              </div>
            </div>

            {/* Coluna 3: Fale Conosco */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white">Fale Conosco</h4>
              <ul className="space-y-2.5 text-[11px] text-stone-400 font-light">
                {contato.telefone && <li>📞 {contato.telefone}</li>}
                {contato.email && <li>✉️ <a href={`mailto:${contato.email}`} className="hover:text-white transition-colors">{contato.email}</a></li>}
                {contato.endereco && <li>📍 {contato.endereco}</li>}
                <li className="flex gap-2 pt-2.5">
                  {contato.whatsapp && (
                    <a 
                      href={`https://wa.me/${contato.whatsapp.replace(/\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-900 transition-colors inline-flex items-center gap-1"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                  {contato.instagram && (
                    <a 
                      href={`https://instagram.com/${contato.instagram.replace('@', '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-stone-900 text-stone-200 border border-stone-850 rounded text-[9px] font-bold uppercase tracking-wider hover:bg-stone-800 transition-colors inline-flex items-center gap-1"
                    >
                      📷 Instagram
                    </a>
                  )}
                </li>
              </ul>
            </div>
          </div>

          <div className="max-w-6xl mx-auto border-t border-stone-900 mt-8 pt-6 text-center text-[9px] text-stone-500 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Wilkson Fotografias. Todos os direitos reservados.
          </div>
        </footer>
      )}
    </div>
  );
}

function ClientAccessPortal({ event, onCheckEmail, onAccessSuccess, onBack, onAddCliente, onAssociateClientToEvent }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'password' | 'register'
  const [matchedClient, setMatchedClient] = useState(null);
  const [error, setError] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim()) return;

    const trimmedEmail = email.trim().toLowerCase();
    setIsCheckingEmail(true);

    try {
      const foundClient = await onCheckEmail(trimmedEmail);

      if (foundClient) {
        setMatchedClient(foundClient);
        const isPermitted = (event.clientes_permitidos || []).includes(foundClient.id) || event.id_cliente === foundClient.id;
        
        // Se já está associado ou se a galeria permite auto-cadastro (o que significa que podemos apenas associá-lo se for existente)
        if (isPermitted || event.permitir_auto_cadastro) {
          // Se a associação não existia, cria agora
          if (!isPermitted) {
            onAssociateClientToEvent(event.id, foundClient.id);
          }

          if (event.acesso_restrito) {
            setStep('password');
          } else {
            onAccessSuccess(foundClient);
          }
        } else {
          setError('Este e-mail não tem permissão para acessar esta galeria. Solicite acesso ao fotógrafo.');
        }
      } else {
        // Cliente não encontrado
        if (event.permitir_auto_cadastro) {
          setStep('register');
        } else {
          setError('E-mail não cadastrado para esta galeria. Entre em contato com o fotógrafo.');
        }
      }
    } catch (err) {
      console.error("[PORTAL EMAIL SUBMIT ERROR]", err);
      setError('Erro ao validar acesso. Tente novamente.');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim()) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (event.acesso_restrito && !password.trim()) {
      setError('Por favor, defina uma senha de acesso.');
      return;
    }

    // Criar novo cliente
    const newClient = onAddCliente({
      nome: name.trim(),
      email: email.trim().toLowerCase(),
      telefone: phone.trim(),
      senha: event.acesso_restrito ? password.trim() : ''
    });

    if (newClient && newClient.id) {
      // Associar ao evento
      onAssociateClientToEvent(event.id, newClient.id);
      // Fazer login
      onAccessSuccess(newClient);
    } else {
      setError('Erro ao realizar o cadastro. Tente novamente.');
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!matchedClient) return;

    const passwordMatch = String(matchedClient.senha || '').trim() === String(password || '').trim();

    if (passwordMatch) {
      onAccessSuccess(matchedClient);
    } else {
      setError('Senha de acesso incorreta.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-between text-stone-900 font-sans selection:bg-stone-200">
      {/* Top Header Mode indicator */}
      <div className="bg-stone-100 border-b border-stone-200 px-8 py-2 flex items-center justify-between text-xs text-stone-500">
        <span>Acesso à Galeria &bull; Identifique-se para continuar</span>
        <button onClick={onBack} className="underline hover:text-stone-900 font-bold uppercase tracking-wider text-[10px]">
          [ Voltar para Portfólio ]
        </button>
      </div>

      <div className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-stone-200 shadow-xl rounded-xl overflow-hidden animate-scale-in">
          {/* Decorative Cover Header */}
          <div className="relative h-24 bg-stone-900 flex items-center justify-center text-center px-4">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600')] bg-cover bg-center brightness-[0.4]" />
            <span className="relative z-10 font-serif-editorial text-sm tracking-widest text-white uppercase">{event.titulo}</span>
          </div>

          {/* Passo 1: Inserir E-mail */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="p-8 space-y-5">
              <div className="text-center mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Acesso Restrito</span>
                <h3 className="font-serif-editorial text-xl font-normal text-stone-850 mt-1">Identifique-se</h3>
                <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                  Digite seu e-mail para visualizar a galeria e iniciar a seleção das fotos.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded text-xs font-bold text-red-650 animate-pulse text-center">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                  E-mail de Acesso
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

              <button
                type="submit"
                disabled={isCheckingEmail}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-850 disabled:bg-stone-400 text-white rounded text-xs font-bold uppercase tracking-widest transition-all mt-3 shadow flex items-center justify-center gap-2"
              >
                {isCheckingEmail ? 'Verificando...' : 'Continuar →'}
              </button>
            </form>
          )}

          {/* Passo 2: Inserir Senha */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="p-8 space-y-5">
              <div className="text-center mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Senha Requerida</span>
                <h3 className="font-serif-editorial text-xl font-normal text-stone-850 mt-1">Galeria Restrita</h3>
                <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                  Olá, <strong>{matchedClient?.nome}</strong>. Esta galeria exige uma senha de segurança para acesso.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded text-xs font-bold text-red-650 animate-pulse text-center">
                  {error}
                </div>
              )}

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
                  className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20 animate-reveal"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setPassword(''); setError(''); }}
                  className="w-1/3 py-2.5 border border-stone-200 hover:bg-stone-50 text-stone-550 rounded text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 bg-stone-900 hover:bg-stone-850 text-white rounded text-xs font-bold uppercase tracking-widest transition-all shadow"
                >
                  Acessar Galeria
                </button>
              </div>
            </form>
          )}

          {/* Passo 3: Auto-cadastro */}
          {step === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="p-8 space-y-4">
              <div className="text-center mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Novo Cadastro</span>
                <h3 className="font-serif-editorial text-xl font-normal text-stone-850 mt-1">Criar Acesso</h3>
                <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                  Seu e-mail não está cadastrado. Preencha seus dados rápidos para acessar e salvar sua seleção de fotos.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded text-xs font-bold text-red-650 animate-pulse text-center">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-4 py-2 border border-stone-200 rounded text-xs bg-stone-100 text-stone-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(99) 99999-9999"
                    className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20"
                  />
                </div>

                {event.acesso_restrito && (
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                      Definir Senha de Acesso
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Crie uma senha"
                      className="w-full px-4 py-2 border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900 bg-stone-50/20"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setName(''); setPhone(''); setPassword(''); setError(''); }}
                  className="w-1/3 py-2.5 border border-stone-200 hover:bg-stone-50 text-stone-550 rounded text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 bg-stone-900 hover:bg-stone-850 text-white rounded text-xs font-bold uppercase tracking-widest transition-all shadow"
                >
                  Cadastrar e Entrar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="py-4 text-center text-[10px] text-stone-400 font-sans border-t border-stone-200/50">
        Wilkson Fotografias &copy; {new Date().getFullYear()} &bull; Todos os direitos reservados.
      </div>
    </div>
  );
}
