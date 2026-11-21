import React, { useState, useMemo } from 'react';
import { ACTIVITY_TYPES, ACTIVITY_META } from '../lib/activityLog';

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'agora mesmo';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `há ${diffHour}h`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'ontem';
  if (diffDays < 30) return `há ${diffDays} dias`;
  return new Date(timestamp).toLocaleDateString('pt-BR');
}

function formatHour(timestamp) {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDayGroupLabel(timestamp) {
  if (!timestamp) return 'Sem data';
  const date = new Date(timestamp);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const itemDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (itemDayStart === todayStart) return 'Hoje';
  if (itemDayStart === yesterdayStart) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function ActivityIcon({ type }) {
  const iconClass = 'w-4 h-4';
  switch (type) {
    case ACTIVITY_TYPES.GALLERY_ACCESS:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    case ACTIVITY_TYPES.CLIENT_REGISTER:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );
    case ACTIVITY_TYPES.SELECTION_STARTED:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case ACTIVITY_TYPES.GALLERY_FINALIZED:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case ACTIVITY_TYPES.PAYMENT_PIX:
    case ACTIVITY_TYPES.PAYMENT_MANUAL:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case ACTIVITY_TYPES.GALLERY_DOWNLOAD:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      );
    case ACTIVITY_TYPES.GALLERY_REOPENED:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
  }
}

export default function ActivityHistory({
  logs = [],
  eventos = [],
  onDeleteLog,
  onClearAllLogs
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'access' | 'finalized' | 'payment' | 'register' | 'selection' | 'download' | 'admin'
  const [eventFilter, setEventFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all'); // 'all' | 'today' | '7d' | '30d'
  const [confirmClear, setConfirmClear] = useState(false);

  const normalizedLogs = useMemo(() => {
    return (logs || [])
      .map((item) => {
        const ts =
          typeof item.timestamp === 'number'
            ? item.timestamp
            : item.createdAt
            ? Date.parse(item.createdAt) || 0
            : 0;
        return { ...item, timestamp: ts };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [logs]);

  // Métricas rápidas
  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let accessToday = 0;
    let finalizedTotal = 0;
    let paymentsTotal = 0;
    let clientActionsToday = 0;

    normalizedLogs.forEach((log) => {
      const isToday = log.timestamp >= todayStart;
      if (isToday && log.actorType === 'client') clientActionsToday++;
      if (isToday && log.type === ACTIVITY_TYPES.GALLERY_ACCESS) accessToday++;
      if (log.type === ACTIVITY_TYPES.GALLERY_FINALIZED) finalizedTotal++;
      if (log.type === ACTIVITY_TYPES.PAYMENT_PIX || log.type === ACTIVITY_TYPES.PAYMENT_MANUAL) {
        paymentsTotal++;
      }
    });

    return {
      total: normalizedLogs.length,
      accessToday,
      finalizedTotal,
      paymentsTotal,
      clientActionsToday
    };
  }, [normalizedLogs]);

  // Lista filtrada
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const q = searchQuery.trim().toLowerCase();

    return normalizedLogs.filter((log) => {
      if (typeFilter !== 'all') {
        if (typeFilter === 'access' && log.type !== ACTIVITY_TYPES.GALLERY_ACCESS) return false;
        if (typeFilter === 'finalized' && log.type !== ACTIVITY_TYPES.GALLERY_FINALIZED) return false;
        if (
          typeFilter === 'payment' &&
          log.type !== ACTIVITY_TYPES.PAYMENT_PIX &&
          log.type !== ACTIVITY_TYPES.PAYMENT_MANUAL
        )
          return false;
        if (typeFilter === 'register' && log.type !== ACTIVITY_TYPES.CLIENT_REGISTER) return false;
        if (typeFilter === 'selection' && log.type !== ACTIVITY_TYPES.SELECTION_STARTED) return false;
        if (typeFilter === 'download' && log.type !== ACTIVITY_TYPES.GALLERY_DOWNLOAD) return false;
        if (
          typeFilter === 'admin' &&
          log.type !== ACTIVITY_TYPES.GALLERY_REOPENED &&
          log.type !== ACTIVITY_TYPES.GALLERY_CREATED
        )
          return false;
      }

      if (eventFilter !== 'all' && log.eventId !== eventFilter) {
        return false;
      }

      if (periodFilter === 'today' && log.timestamp < todayStart) return false;
      if (periodFilter === '7d' && log.timestamp < Date.now() - 7 * 86400000) return false;
      if (periodFilter === '30d' && log.timestamp < Date.now() - 30 * 86400000) return false;

      if (q) {
        const haystack = [
          log.message,
          log.details,
          log.clientName,
          log.clientEmail,
          log.eventTitle
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [normalizedLogs, typeFilter, eventFilter, periodFilter, searchQuery]);

  // Agrupamento por dia
  const groupedLogs = useMemo(() => {
    const groups = [];
    const map = new Map();

    filteredLogs.forEach((log) => {
      const label = getDayGroupLabel(log.timestamp);
      if (!map.has(label)) {
        const group = { label, items: [] };
        map.set(label, group);
        groups.push(group);
      }
      map.get(label).items.push(log);
    });

    return groups;
  }, [filteredLogs]);

  // Exportar CSV
  const handleExportCSV = () => {
    const headers = ['Data/Hora', 'Tipo', 'Ator', 'Cliente', 'E-mail', 'Galeria', 'Mensagem', 'Detalhes'];
    const rows = filteredLogs.map((log) => {
      const meta = ACTIVITY_META[log.type] || { label: log.type };
      const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '';
      return [
        dateStr,
        meta.label,
        log.actorType === 'admin' ? 'Fotógrafo' : 'Cliente',
        log.clientName || '',
        log.clientEmail || '',
        log.eventTitle || '',
        log.message || '',
        log.details || ''
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';');
    });

    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_atividades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-scale-in space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Registro em Tempo Real
          </span>
          <h3 className="font-serif-editorial text-xl text-stone-900 mt-0.5">
            Histórico de Atividades
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Acompanhe acessos, seleções, finalizações, downloads e pagamentos das suas galerias.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
          >
            Exportar CSV
          </button>

          {onClearAllLogs && normalizedLogs.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                <span className="text-[10px] font-semibold text-red-700">Limpar tudo?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearAllLogs();
                    setConfirmClear(false);
                  }}
                  className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold uppercase hover:bg-red-700"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-0.5 bg-white text-stone-600 border border-stone-200 rounded text-[10px] font-bold uppercase hover:bg-stone-100"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50/60 hover:bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                Limpar Histórico
              </button>
            )
          )}
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-stone-200/80 rounded-xl p-4 shadow-xs">
          <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
            Total de Eventos
          </span>
          <div className="text-2xl font-serif-editorial text-stone-900 mt-1">
            {metrics.total}
          </div>
          <span className="text-[10px] text-stone-400">
            {metrics.clientActionsToday} ações de clientes hoje
          </span>
        </div>

        <div className="bg-white border border-sky-200/70 rounded-xl p-4 shadow-xs">
          <span className="text-[9px] font-bold uppercase tracking-widest text-sky-600">
            Acessos Hoje
          </span>
          <div className="text-2xl font-serif-editorial text-stone-900 mt-1">
            {metrics.accessToday}
          </div>
          <span className="text-[10px] text-stone-400">
            Visualizações de galerias
          </span>
        </div>

        <div className="bg-white border border-emerald-200/70 rounded-xl p-4 shadow-xs">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">
            Finalizações
          </span>
          <div className="text-2xl font-serif-editorial text-stone-900 mt-1">
            {metrics.finalizedTotal}
          </div>
          <span className="text-[10px] text-stone-400">
            Seleções concluídas
          </span>
        </div>

        <div className="bg-white border border-teal-200/70 rounded-xl p-4 shadow-xs">
          <span className="text-[9px] font-bold uppercase tracking-widest text-teal-600">
            Pagamentos
          </span>
          <div className="text-2xl font-serif-editorial text-stone-900 mt-1">
            {metrics.paymentsTotal}
          </div>
          <span className="text-[10px] text-stone-400">
            PIX e confirmações manuais
          </span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white border border-stone-200/80 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Busca */}
          <div className="md:col-span-5 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, galeria ou ação..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900"
            />
            <svg
              className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filtro Galeria */}
          <div className="md:col-span-4">
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900 text-stone-700"
            >
              <option value="all">Todas as Galerias</option>
              {eventos.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.titulo}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Período */}
          <div className="md:col-span-3">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900 text-stone-700"
            >
              <option value="all">Todo o período</option>
              <option value="today">Somente Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>
        </div>

        {/* Pills de Tipo */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'access', label: 'Acessos' },
            { id: 'finalized', label: 'Finalizações' },
            { id: 'selection', label: 'Início de Seleção' },
            { id: 'payment', label: 'Pagamentos' },
            { id: 'register', label: 'Autocadastros' },
            { id: 'download', label: 'Downloads' },
            { id: 'admin', label: 'Ações do Admin' }
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setTypeFilter(pill.id)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                typeFilter === pill.id
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-800'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / Timeline */}
      {groupedLogs.length === 0 ? (
        <div className="bg-white border border-stone-200/80 rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-serif-editorial text-base text-stone-800">
            Nenhuma atividade registrada ainda
          </p>
          <p className="text-xs text-stone-400 mt-1 max-w-md mx-auto">
            {normalizedLogs.length > 0
              ? 'Nenhum registro corresponde aos filtros selecionados.'
              : 'Assim que seus clientes acessarem galerias, iniciarem seleções, finalizarem ou efetuarem pagamentos, tudo aparecerá aqui automaticamente.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedLogs.map((group) => (
            <div key={group.label} className="space-y-2.5">
              {/* Divisor do Dia */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 bg-stone-100 px-3 py-1 rounded-full capitalize">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-stone-200/80" />
                <span className="text-[10px] text-stone-400 font-medium">
                  {group.items.length} {group.items.length === 1 ? 'evento' : 'eventos'}
                </span>
              </div>

              {/* Itens do Dia */}
              <div className="bg-white border border-stone-200/80 rounded-xl divide-y divide-stone-100 overflow-hidden shadow-xs">
                {group.items.map((log) => {
                  const meta = ACTIVITY_META[log.type] || {
                    label: 'Atividade',
                    badgeBg: 'bg-stone-100 text-stone-700 border-stone-200',
                    dotColor: 'bg-stone-400'
                  };

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 sm:p-4 hover:bg-stone-50/70 transition-colors flex items-start gap-3.5 group"
                    >
                      {/* Ícone */}
                      <div
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.badgeBg}`}
                      >
                        <ActivityIcon type={log.type} />
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${meta.badgeBg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                            {meta.label}
                          </span>
                          {log.eventTitle && (
                            <span className="text-[10px] font-semibold text-stone-500 truncate max-w-[240px]">
                              • {log.eventTitle}
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-stone-800 font-medium mt-1 leading-snug">
                          {log.message}
                        </p>

                        {(log.details || log.clientEmail) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-stone-400">
                            {log.details && <span className="text-stone-500">{log.details}</span>}
                            {log.clientEmail && <span>{log.clientEmail}</span>}
                          </div>
                        )}
                      </div>

                      {/* Horário e Excluir */}
                      <div className="flex flex-col items-end flex-shrink-0 gap-1">
                        <span className="text-xs font-semibold text-stone-700 tabular-nums">
                          {formatHour(log.timestamp)}
                        </span>
                        <span className="text-[10px] text-stone-400 whitespace-nowrap">
                          {formatRelativeTime(log.timestamp)}
                        </span>
                        {onDeleteLog && (
                          <button
                            type="button"
                            onClick={() => onDeleteLog(log.id)}
                            title="Remover este registro"
                            className="opacity-0 group-hover:opacity-100 text-[10px] text-stone-400 hover:text-red-600 transition-opacity mt-0.5"
                          >
                            remover
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
