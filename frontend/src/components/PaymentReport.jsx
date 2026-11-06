import React, { useState, useMemo } from 'react';

/**
 * PaymentReport - Relatório e Log Completo de Pagamentos (Fotos Extras)
 * Visão financeira com métricas em tempo real, filtros, exportação e detalhes de transação.
 */
export default function PaymentReport({
  eventos = [],
  clientes = [],
  selecoes = [],
  contatoForm,
  setContatoForm,
  showMercadoPagoToken,
  setShowMercadoPagoToken,
  onSaveContato,
  onConfirmPayment
}) {
  const [activeTab, setActiveTab] = useState('report'); // 'report' | 'settings'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pix' | 'manual' | 'pendente'
  const [eventFilter, setEventFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxModal, setSelectedTxModal] = useState(null);

  // Consolidação de todos os pagamentos e pendências a partir dos eventos
  const paymentsList = useMemo(() => {
    const list = [];

    (eventos || []).forEach((evento) => {
      const selectionsMap = evento.selecoes_clientes || {};
      const clientIdsToCheck = Array.from(
        new Set([
          ...(evento.clientes_permitidos || []),
          ...(evento.id_cliente ? [evento.id_cliente] : []),
          ...Object.keys(selectionsMap)
        ])
      );

      clientIdsToCheck.forEach((cid) => {
        const clientObj = (clientes || []).find((c) => c.id === cid) || {
          id: cid,
          nome: 'Cliente',
          email: '',
          telefone: ''
        };

        let clientSel = selectionsMap[cid];
        if (!clientSel) {
          const s = (selecoes || []).find(
            (sel) => sel.id === `${evento.id}_${cid}` || (sel.id_evento === evento.id && sel.id_cliente === cid)
          );
          if (s) clientSel = s;
        }

        const selecionadasCount = (clientSel?.fotos_selecionadas || []).length;
        const clientLimit =
          clientSel?.limite_fotos !== undefined && clientSel?.limite_fotos !== null
            ? clientSel.limite_fotos
            : (evento.limite_fotos !== undefined && evento.limite_fotos !== null ? evento.limite_fotos : 0);

        const clientExtrasCount =
          !evento.selecao_livre && clientLimit !== null && clientLimit !== undefined
            ? Math.max(0, selecionadasCount - clientLimit)
            : 0;

        const isPaid =
          !!clientSel?.pagamento_extras_confirmado ||
          !!selectionsMap[cid]?.pagamento_extras_confirmado ||
          (evento.id_cliente === cid && !!evento.pagamento_extras_confirmado);

        const pixTx =
          clientSel?.transacao_pix ||
          selectionsMap[cid]?.transacao_pix ||
          (evento.id_cliente === cid ? evento.transacao_pix : null);

        // Se tem fotos extras selecionadas OU se houve pagamento confirmado
        if (clientExtrasCount > 0 || isPaid || pixTx) {
          const valorUnitario = parseFloat(evento.valor_foto_extra) || 0;
          const valorTotal =
            pixTx && pixTx.amount
              ? parseFloat(pixTx.amount)
              : clientExtrasCount * valorUnitario;

          let metodo = 'pendente';
          if (pixTx?.paymentId || pixTx?.metodo === 'pix') {
            metodo = 'pix';
          } else if (isPaid) {
            metodo = 'manual';
          }

          const rawDate =
            pixTx?.dateApproved ||
            clientSel?.data_finalizacao ||
            evento.data ||
            null;

          list.push({
            id: `${evento.id}_${cid}`,
            eventId: evento.id,
            clientId: cid,
            eventTitle: evento.titulo || 'Galeria sem título',
            eventDate: evento.data,
            eventToken: evento.token || '',
            clientName: clientObj.nome || 'Cliente',
            clientEmail: clientObj.email || '',
            clientPhone: clientObj.telefone || '',
            selectedCount: selecionadasCount,
            limit: clientLimit,
            extraCount: clientExtrasCount,
            unitPrice: valorUnitario,
            totalAmount: valorTotal,
            isPaid,
            metodo, // 'pix' | 'manual' | 'pendente'
            status: isPaid ? 'aprovado' : 'pendente',
            paymentId: pixTx?.paymentId || null,
            dateApproved: rawDate,
            rawTx: pixTx
          });
        }
      });
    });

    // Ordenação: mais recentes primeiro
    return list.sort((a, b) => {
      const dateA = a.dateApproved ? new Date(a.dateApproved).getTime() : 0;
      const dateB = b.dateApproved ? new Date(b.dateApproved).getTime() : 0;
      return dateB - dateA;
    });
  }, [eventos, clientes, selecoes]);

  // Cálculos de KPIs / Resumo Geral
  const metrics = useMemo(() => {
    let totalRecebido = 0;
    let totalPix = 0;
    let countPix = 0;
    let totalManual = 0;
    let countManual = 0;
    let extrasFaturadas = 0;
    let totalPendente = 0;
    let countPendente = 0;

    paymentsList.forEach((item) => {
      if (item.isPaid) {
        totalRecebido += item.totalAmount;
        extrasFaturadas += item.extraCount;
        if (item.metodo === 'pix') {
          totalPix += item.totalAmount;
          countPix += 1;
        } else {
          totalManual += item.totalAmount;
          countManual += 1;
        }
      } else {
        totalPendente += item.totalAmount;
        countPendente += 1;
      }
    });

    return {
      totalRecebido,
      totalPix,
      countPix,
      totalManual,
      countManual,
      extrasFaturadas,
      totalPendente,
      countPendente,
      totalCount: paymentsList.length
    };
  }, [paymentsList]);

  // Filtros aplicados
  const filteredPayments = useMemo(() => {
    return paymentsList.filter((item) => {
      // Filtro de status
      if (statusFilter === 'pix' && item.metodo !== 'pix') return false;
      if (statusFilter === 'manual' && item.metodo !== 'manual') return false;
      if (statusFilter === 'pendente' && item.isPaid) return false;
      if (statusFilter === 'aprovado' && !item.isPaid) return false;

      // Filtro de evento/galeria
      if (eventFilter !== 'all' && item.eventId !== eventFilter) return false;

      // Busca por texto
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesClient = item.clientName.toLowerCase().includes(query);
        const matchesEmail = item.clientEmail.toLowerCase().includes(query);
        const matchesPhone = item.clientPhone.includes(query);
        const matchesEvent = item.eventTitle.toLowerCase().includes(query);
        const matchesId = item.paymentId ? String(item.paymentId).includes(query) : false;
        return matchesClient || matchesEmail || matchesPhone || matchesEvent || matchesId;
      }

      return true;
    });
  }, [paymentsList, statusFilter, eventFilter, searchQuery]);

  // Exportar para CSV
  const handleExportCSV = () => {
    if (filteredPayments.length === 0) {
      alert('Nenhum registro para exportar.');
      return;
    }

    const headers = [
      'Data/Hora',
      'Cliente',
      'E-mail',
      'Telefone',
      'Galeria / Evento',
      'Fotos Escolhidas',
      'Limite do Pacote',
      'Fotos Extras',
      'Valor Unitário (R$)',
      'Valor Total (R$)',
      'Status',
      'Método de Pagamento',
      'ID Mercado Pago'
    ];

    const rows = filteredPayments.map((p) => [
      p.dateApproved ? new Date(p.dateApproved).toLocaleString('pt-BR') : 'N/A',
      `"${p.clientName.replace(/"/g, '""')}"`,
      `"${p.clientEmail.replace(/"/g, '""')}"`,
      `"${p.clientPhone.replace(/"/g, '""')}"`,
      `"${p.eventTitle.replace(/"/g, '""')}"`,
      p.selectedCount,
      p.limit,
      p.extraCount,
      p.unitPrice.toFixed(2).replace('.', ','),
      p.totalAmount.toFixed(2).replace('.', ','),
      p.isPaid ? 'Aprovado' : 'Pendente',
      p.metodo === 'pix' ? 'PIX Mercado Pago' : p.metodo === 'manual' ? 'Manual' : 'Pendente',
      p.paymentId || 'N/A'
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_pagamentos_fotos_extras_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Lembrar cliente via WhatsApp sobre pagamento pendente
  const handleSendWhatsAppReminder = (item) => {
    const cleanPhone = (item.clientPhone || '').replace(/\D/g, '');
    const galleryUrl = `${window.location.origin}/?gallery=${item.eventToken}`;
    const text = encodeURIComponent(
      `Olá, ${item.clientName}! Tudo bem?\n\n` +
      `Identificamos que você escolheu ${item.extraCount} foto(s) extra(s) na galeria "${item.eventTitle}".\n` +
      `O valor total das fotos extras é de R$ ${item.totalAmount.toFixed(2).replace('.', ',')}.\n\n` +
      `Para liberar o download em alta resolução das suas fotos, acesse o link abaixo e conclua o pagamento via PIX:\n` +
      `${galleryUrl}\n\n` +
      `Qualquer dúvida estou à disposição!`
    );
    const waUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, '_blank');
  };

  // Formatação de data amigável
  const formatDate = (rawDate) => {
    if (!rawDate) return 'Data não registrada';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return rawDate;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return rawDate;
    }
  };

  return (
    <div className="animate-scale-in max-w-6xl mx-auto space-y-6">
      {/* 1. Header com Navegação Interna: Relatório vs Configurações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💳</span>
            <h2 className="font-serif-editorial text-2xl font-light text-stone-900">
              Pagamentos & Relatório Financeiro
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Acompanhe o faturamento de fotos extras, transações PIX automáticas e clientes pendentes.
          </p>
        </div>

        {/* Abas Superiores */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl gap-1 w-fit border border-stone-200/70">
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'report'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <span>📊</span> Relatório de Pagamentos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <span>⚙️</span> Configurar Mercado Pago
            {contatoForm.mercado_pago_token ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Ativo" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Pendente" />
            )}
          </button>
        </div>
      </div>

      {/* AVISO SE TOKEN NÃO ESTÁ CONFIGURADO */}
      {!contatoForm.mercado_pago_token && activeTab === 'report' && (
        <div className="p-3.5 bg-amber-50/90 border border-amber-250 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⚠️</span>
            <span>
              <strong>Mercado Pago não conectado:</strong> O Access Token de PIX ainda não foi configurado. Seus clientes não conseguirão pagar com QR Code automático.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="px-3 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex-shrink-0"
          >
            Configurar Agora
          </button>
        </div>
      )}

      {/* ======================= ABA 1: RELATÓRIO DE PAGAMENTOS ======================= */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* CARDS DE RESUMO FINANCEIRO (KPIs) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* 1. Total Recebido */}
            <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs space-y-1">
              <span className="text-[9.5px] font-bold uppercase tracking-widest text-stone-400 block">
                Total Recebido
              </span>
              <div className="text-xl md:text-2xl font-extrabold text-emerald-800">
                R$ {metrics.totalRecebido.toFixed(2).replace('.', ',')}
              </div>
              <span className="text-[10px] text-stone-500 block">
                {metrics.countPix + metrics.countManual} pagamentos confirmados
              </span>
            </div>

            {/* 2. PIX Mercado Pago */}
            <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs space-y-1">
              <span className="text-[9.5px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1">
                <span>⚡</span> PIX Automático
              </span>
              <div className="text-xl md:text-2xl font-extrabold text-stone-900">
                R$ {metrics.totalPix.toFixed(2).replace('.', ',')}
              </div>
              <span className="text-[10px] text-emerald-700 font-medium block">
                {metrics.countPix} baixas instantâneas
              </span>
            </div>

            {/* 3. Fotos Extras Vendidas */}
            <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs space-y-1">
              <span className="text-[9.5px] font-bold uppercase tracking-widest text-stone-400 block">
                Fotos Extras Vendidas
              </span>
              <div className="text-xl md:text-2xl font-extrabold text-stone-900">
                {metrics.extrasFaturadas} <span className="text-xs font-normal text-stone-500">fotos</span>
              </div>
              <span className="text-[10px] text-stone-500 block">
                {metrics.countManual > 0 ? `(inclui ${metrics.countManual} baixas manuais)` : 'Todas via PIX'}
              </span>
            </div>

            {/* 4. Pagamentos Pendentes */}
            <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-2xs space-y-1">
              <span className="text-[9.5px] font-bold uppercase tracking-widest text-amber-700 block">
                Aguardando Pagamento
              </span>
              <div className="text-xl md:text-2xl font-extrabold text-amber-800">
                R$ {metrics.totalPendente.toFixed(2).replace('.', ',')}
              </div>
              <span className="text-[10px] text-amber-700/80 block">
                {metrics.countPendente} {metrics.countPendente === 1 ? 'cliente pendente' : 'clientes pendentes'}
              </span>
            </div>
          </div>

          {/* BARRA DE FERRAMENTAS: BUSCA, FILTROS E EXPORTAÇÃO */}
          <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Campo de Busca */}
              <div className="relative flex-grow max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar por cliente, e-mail, telefone, galeria ou ID PIX..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-stone-900 bg-stone-50/40"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Botões de Ação: Exportar CSV e Imprimir */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                  title="Exportar planilha Excel / CSV"
                >
                  <span>📥</span> Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                  title="Imprimir relatório ou salvar como PDF"
                >
                  <span>🖨️</span> Imprimir
                </button>
              </div>
            </div>

            {/* Filtros de Status & Galeria */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-100 flex-wrap">
              {/* Filtro por Status */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mr-1">Status:</span>
                {[
                  { key: 'all', label: `Todos (${paymentsList.length})` },
                  { key: 'pix', label: `⚡ PIX (${metrics.countPix})` },
                  { key: 'manual', label: `Manual (${metrics.countManual})` },
                  { key: 'pendente', label: `Pendentes (${metrics.countPendente})` }
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatusFilter(s.key)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                      statusFilter === s.key
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Filtro por Galeria */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Galeria:</span>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="px-2.5 py-1 border border-stone-200 rounded-md text-xs bg-white text-stone-800 focus:outline-none focus:border-stone-900"
                >
                  <option value="all">Todas as Galerias</option>
                  {(eventos || []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.titulo || 'Sem título'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TABELA DE REGISTROS DE PAGAMENTO */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-2xs overflow-hidden">
            {filteredPayments.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <span className="text-3xl block">📑</span>
                <p className="text-sm font-semibold text-stone-700">Nenhum registro encontrado</p>
                <p className="text-xs text-stone-400">
                  {paymentsList.length === 0
                    ? 'Nenhum cliente selecionou fotos extras ou realizou pagamentos ainda.'
                    : 'Nenhum pagamento corresponde aos filtros selecionados acima.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-600 font-sans">
                  <thead className="bg-stone-50 border-b border-stone-200 text-[10px] uppercase tracking-wider text-stone-400 font-bold select-none">
                    <tr>
                      <th className="py-3 px-4">Data / Horário</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Galeria</th>
                      <th className="py-3 px-4">Fotos Extras</th>
                      <th className="py-3 px-4">Valor Total</th>
                      <th className="py-3 px-4">Status & Método</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-150">
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                        {/* Data */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-medium text-stone-800 block">
                            {formatDate(p.dateApproved)}
                          </span>
                          {p.paymentId && (
                            <span className="text-[9px] font-mono text-stone-400 block mt-0.5">
                              ID: #{p.paymentId}
                            </span>
                          )}
                        </td>

                        {/* Cliente */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-stone-900">{p.clientName}</div>
                          <div className="text-[11px] text-stone-400 flex items-center gap-1.5 flex-wrap">
                            {p.clientEmail && <span>{p.clientEmail}</span>}
                            {p.clientPhone && (
                              <>
                                <span>&bull;</span>
                                <span>{p.clientPhone}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Galeria */}
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-stone-800 block truncate max-w-[200px]" title={p.eventTitle}>
                            {p.eventTitle}
                          </span>
                          {p.eventDate && (
                            <span className="text-[10px] text-stone-400">📅 {p.eventDate}</span>
                          )}
                        </td>

                        {/* Fotos Extras */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-stone-800">
                            +{p.extraCount} {p.extraCount === 1 ? 'extra' : 'extras'}
                          </span>
                          <span className="text-[10px] text-stone-400 block">
                            {p.selectedCount} escolhidas de {p.limit} inclusas
                          </span>
                        </td>

                        {/* Valor Total */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`text-sm font-extrabold ${p.isPaid ? 'text-emerald-800' : 'text-amber-800'}`}>
                            R$ {p.totalAmount.toFixed(2).replace('.', ',')}
                          </span>
                          {p.unitPrice > 0 && (
                            <span className="text-[9px] text-stone-400 block">
                              (R$ {p.unitPrice.toFixed(2).replace('.', ',')} / foto)
                            </span>
                          )}
                        </td>

                        {/* Status & Método */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {p.isPaid ? (
                            p.metodo === 'pix' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-250">
                                <span>⚡ PIX Aprovado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-250">
                                <span>✓ Baixa Manual</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-250">
                              <span>⏳ Aguardando Pgto</span>
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver Detalhes */}
                            <button
                              type="button"
                              onClick={() => setSelectedTxModal(p)}
                              className="px-2.5 py-1 border border-stone-250 hover:bg-stone-100 rounded text-[10px] font-bold text-stone-700 transition-colors uppercase tracking-wider"
                              title="Visualizar recibo completo"
                            >
                              Detalhes
                            </button>

                            {/* Se pendente: Lembrar via WhatsApp */}
                            {!p.isPaid && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsAppReminder(p)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                                  title="Enviar lembrete amigável no WhatsApp com link da galeria"
                                >
                                  <span>💬 Cobrar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Deseja confirmar manualmente o recebimento de R$ ${p.totalAmount.toFixed(2).replace('.', ',')} de "${p.clientName}"?`)) {
                                      onConfirmPayment(p.eventId, p.clientId);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  title="Confirmar pagamento manual"
                                >
                                  ✓ Dar Baixa
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================= ABA 2: CONFIGURAÇÃO DO MERCADO PAGO ======================= */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-xs space-y-6">
            <div className="border-b border-stone-150 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💳</span>
                  <h3 className="font-serif-editorial text-xl text-stone-900">Mercado Pago • PIX Automático</h3>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Receba os pagamentos de fotos extras automaticamente com baixa instantânea via PIX direto na sua conta.
                </p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border w-fit ${
                contatoForm.mercado_pago_token ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {contatoForm.mercado_pago_token ? '✓ Ativo / Configurado' : '⚠️ Token Pendente'}
              </span>
            </div>

            <div className="space-y-5">
              {/* Switch de Ativação */}
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-200/80">
                <div>
                  <span className="text-sm font-bold text-stone-900 block">Cobrança Automática via PIX</span>
                  <span className="text-xs text-stone-500 block mt-0.5">
                    Gera QR Code e chave Copia e Cola em tempo real quando o cliente selecionar fotos além do limite
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contatoForm.mercado_pago_ativo !== false}
                    onChange={(e) => setContatoForm({ ...contatoForm, mercado_pago_ativo: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Campo Access Token */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                    Access Token do Mercado Pago
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMercadoPagoToken(!showMercadoPagoToken)}
                    className="text-[10px] font-bold text-stone-500 hover:text-stone-900 uppercase tracking-wider cursor-pointer"
                  >
                    {showMercadoPagoToken ? '👁️ Ocultar' : '👁️ Exibir Token'}
                  </button>
                </div>
                <input
                  type={showMercadoPagoToken ? 'text' : 'password'}
                  placeholder="APP_USR-0000000000000000-000000-00000000000000000000000000000000-000000000"
                  value={contatoForm.mercado_pago_token || ''}
                  onChange={(e) => setContatoForm({ ...contatoForm, mercado_pago_token: e.target.value })}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-stone-50/50"
                />
                <p className="text-[11px] text-stone-500">
                  Insira o <strong>Access Token</strong> de Produção (para receber valores reais) ou de Teste do Mercado Pago.
                </p>
              </div>

              {/* Passo a passo ilustrado e link direto */}
              <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2 text-xs text-sky-950">
                <div className="flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider text-sky-900">
                  <span>📖</span> Como cadastrar e obter o Token no Mercado Pago Developers:
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-sky-900 leading-relaxed">
                  <li>
                    Acesse o portal:{' '}
                    <a
                      href="https://www.mercadopago.com.br/developers/panel/app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold text-sky-700 hover:text-sky-900"
                    >
                      mercadopago.com.br/developers/panel/app ↗
                    </a>
                  </li>
                  <li>Entre com a sua conta do Mercado Pago onde você recebe suas vendas;</li>
                  <li>Clique no botão azul <strong>"Criar aplicação"</strong> (ou escolha uma se já tiver);</li>
                  <li>Informe o nome (ex: <em>Galeria Prova Fotos</em>) e marque o tipo como <strong>"Pagamentos Online"</strong>;</li>
                  <li>No menu da aplicação criada, vá em <strong>"Credenciais de Produção"</strong> (ou Teste);</li>
                  <li>Copie o campo <strong>Access Token</strong> (começa com <code className="bg-sky-100 px-1 py-0.5 rounded text-[10px]">APP_USR-...</code>);</li>
                  <li>Cole no campo acima e clique no botão verde <strong>Salvar Configurações do PIX</strong> abaixo.</li>
                </ol>
              </div>

              {/* Botão Salvar */}
              <button
                type="button"
                onClick={async () => {
                  const cleanedToken = (contatoForm.mercado_pago_token || '').trim();
                  try {
                    localStorage.setItem('mercado_pago_token', cleanedToken);
                    localStorage.setItem('mercado_pago_ativo', JSON.stringify(contatoForm.mercado_pago_ativo !== false));
                  } catch (e) {}

                  if (onSaveContato) {
                    try {
                      await onSaveContato({ ...contatoForm, mercado_pago_token: cleanedToken });
                      alert('✓ Configurações do Mercado Pago salvas com sucesso!');
                    } catch (err) {
                      alert('Erro ao salvar configurações do Mercado Pago: ' + err.message);
                    }
                  } else {
                    alert('✓ Token salvo com sucesso localmente!');
                  }
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>💾</span> Salvar Configurações do PIX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: DETALHES DA TRANSAÇÃO / RECIBO ======================= */}
      {selectedTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in space-y-4">
            <div className="flex items-center justify-between border-b border-stone-150 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧾</span>
                <h3 className="font-serif-editorial text-lg text-stone-900">
                  Comprovante de Transação
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxModal(null)}
                className="text-stone-400 hover:text-stone-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Informações do Recibo */}
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/80 space-y-2.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span className="text-stone-400 uppercase text-[10px] font-bold">Status:</span>
                <span className={`font-bold uppercase tracking-wider text-[10px] ${selectedTxModal.isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {selectedTxModal.isPaid ? '✓ Pagamento Confirmado' : '⏳ Aguardando Pagamento'}
                </span>
              </div>
              {selectedTxModal.paymentId && (
                <div className="flex justify-between">
                  <span className="text-stone-400 uppercase text-[10px] font-bold">ID Mercado Pago:</span>
                  <span className="font-mono font-bold text-stone-800">#{selectedTxModal.paymentId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-400 uppercase text-[10px] font-bold">Método:</span>
                <span className="font-bold text-stone-800">
                  {selectedTxModal.metodo === 'pix' ? 'PIX Instantâneo' : selectedTxModal.metodo === 'manual' ? 'Baixa Manual (Fotógrafo)' : 'Pendente'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400 uppercase text-[10px] font-bold">Data / Horário:</span>
                <span className="font-medium text-stone-800">{formatDate(selectedTxModal.dateApproved)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200/60 pt-2">
                <span className="text-stone-400 uppercase text-[10px] font-bold">Cliente:</span>
                <span className="font-bold text-stone-900 text-right">{selectedTxModal.clientName}</span>
              </div>
              {selectedTxModal.clientEmail && (
                <div className="flex justify-between">
                  <span className="text-stone-400 uppercase text-[10px] font-bold">E-mail:</span>
                  <span className="text-stone-700">{selectedTxModal.clientEmail}</span>
                </div>
              )}
              {selectedTxModal.clientPhone && (
                <div className="flex justify-between">
                  <span className="text-stone-400 uppercase text-[10px] font-bold">Telefone:</span>
                  <span className="text-stone-700">{selectedTxModal.clientPhone}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-stone-200/60 pt-2">
                <span className="text-stone-400 uppercase text-[10px] font-bold">Galeria:</span>
                <span className="font-medium text-stone-800 text-right">{selectedTxModal.eventTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400 uppercase text-[10px] font-bold">Fotos Extras:</span>
                <span className="font-bold text-stone-800">
                  +{selectedTxModal.extraCount} fotos ({selectedTxModal.selectedCount} escolhidas de {selectedTxModal.limit} inclusas)
                </span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2.5 text-sm font-bold">
                <span className="text-stone-900">Valor Total:</span>
                <span className="text-emerald-800 font-extrabold text-base">
                  R$ {selectedTxModal.totalAmount.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            {/* Ações do Recibo */}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTxModal(null)}
                className="px-4 py-2 border border-stone-200 hover:bg-stone-50 rounded-xl text-xs font-bold uppercase tracking-wider text-stone-600 transition-colors"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                <span>🖨️</span> Imprimir Recibo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
