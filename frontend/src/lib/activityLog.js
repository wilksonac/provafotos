import { doc, setDoc, deleteDoc } from 'firebase/firestore';

export const ACTIVITY_TYPES = {
  GALLERY_ACCESS: 'gallery_access',
  CLIENT_REGISTER: 'client_register',
  SELECTION_STARTED: 'selection_started',
  GALLERY_FINALIZED: 'gallery_finalized',
  PAYMENT_PIX: 'payment_pix',
  PAYMENT_MANUAL: 'payment_manual',
  GALLERY_DOWNLOAD: 'gallery_download',
  GALLERY_REOPENED: 'gallery_reopened',
  GALLERY_CREATED: 'gallery_created'
};

export const ACTIVITY_META = {
  [ACTIVITY_TYPES.GALLERY_ACCESS]: {
    label: 'Acesso à Galeria',
    shortLabel: 'Acessos',
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
    dotColor: 'bg-sky-500',
    icon: 'eye'
  },
  [ACTIVITY_TYPES.CLIENT_REGISTER]: {
    label: 'Autocadastro',
    shortLabel: 'Cadastros',
    badgeBg: 'bg-violet-50 text-violet-700 border-violet-200',
    dotColor: 'bg-violet-500',
    icon: 'user-plus'
  },
  [ACTIVITY_TYPES.SELECTION_STARTED]: {
    label: 'Seleção Iniciada',
    shortLabel: 'Seleções',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
    icon: 'heart'
  },
  [ACTIVITY_TYPES.GALLERY_FINALIZED]: {
    label: 'Galeria Finalizada',
    shortLabel: 'Finalizações',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500',
    icon: 'check'
  },
  [ACTIVITY_TYPES.PAYMENT_PIX]: {
    label: 'Pagamento PIX',
    shortLabel: 'Pagamentos',
    badgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
    dotColor: 'bg-teal-500',
    icon: 'pix'
  },
  [ACTIVITY_TYPES.PAYMENT_MANUAL]: {
    label: 'Pagamento Confirmado',
    shortLabel: 'Pagamentos',
    badgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
    dotColor: 'bg-teal-600',
    icon: 'cash'
  },
  [ACTIVITY_TYPES.GALLERY_DOWNLOAD]: {
    label: 'Download de Fotos',
    shortLabel: 'Downloads',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotColor: 'bg-indigo-500',
    icon: 'download'
  },
  [ACTIVITY_TYPES.GALLERY_REOPENED]: {
    label: 'Galeria Reaberta',
    shortLabel: 'Admin',
    badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
    dotColor: 'bg-orange-500',
    icon: 'reopen'
  },
  [ACTIVITY_TYPES.GALLERY_CREATED]: {
    label: 'Nova Galeria',
    shortLabel: 'Admin',
    badgeBg: 'bg-stone-100 text-stone-700 border-stone-200',
    dotColor: 'bg-stone-500',
    icon: 'folder'
  }
};

/**
 * Registra uma atividade na coleção `activity_logs` do Firestore.
 * Falhas são capturadas silenciosamente para nunca interromper o fluxo do usuário.
 */
export async function logActivity(db, {
  type,
  actorType = 'client',
  clientId = null,
  clientName = null,
  clientEmail = null,
  eventId = null,
  eventTitle = null,
  message = '',
  details = '',
  meta = null
}) {
  const now = Date.now();
  const id = `log_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    type,
    actorType,
    clientId: clientId || null,
    clientName: clientName || null,
    clientEmail: clientEmail || null,
    eventId: eventId || null,
    eventTitle: eventTitle || null,
    message,
    details: details || '',
    meta: meta || null,
    createdAt: new Date(now).toISOString(),
    timestamp: now
  };

  if (!db) {
    console.log('[ACTIVITY LOG - OFFLINE]', entry);
    return entry;
  }

  try {
    await setDoc(doc(db, 'activity_logs', id), entry);
    console.log(`[ACTIVITY LOG] Registrado (${type}):`, message);
  } catch (err) {
    console.warn('[ACTIVITY LOG] Não foi possível salvar no Firestore:', err?.message || err);
  }

  return entry;
}

/**
 * Remove um item de log específico do Firestore.
 */
export async function deleteActivityLog(db, logId) {
  if (!db || !logId) return;
  try {
    await deleteDoc(doc(db, 'activity_logs', logId));
  } catch (err) {
    console.error('[ACTIVITY LOG] Erro ao excluir log:', err);
    throw err;
  }
}
