import React, { useState, useEffect, useRef } from 'react';
import { createPixPayment, checkPixPaymentStatus } from '../lib/mercadopago';

/**
 * PaymentModal - Modal de Pagamento Automático via PIX do Mercado Pago
 */
export default function PaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  evento,
  cliente,
  limiteFotos,
  selectedCount,
  valorFotoExtra,
  mercadoPagoToken = ''
}) {
  const extraCount = Math.max(0, selectedCount - (limiteFotos || 0));
  const valorUnitario = parseFloat(valorFotoExtra) || 0;
  const totalAmount = extraCount * valorUnitario;
  const effectiveToken = (mercadoPagoToken || (typeof window !== 'undefined' ? localStorage.getItem('mercado_pago_token') : '') || '').trim();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pixData, setPixData] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [checkingManual, setCheckingManual] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutos em segundos

  const pollingRef = useRef(null);

  // Inicializa o pagamento ao abrir o modal
  useEffect(() => {
    if (!isOpen) {
      setPixData(null);
      setIsApproved(false);
      setError(null);
      return;
    }

    if (totalAmount <= 0) {
      setPixData(null);
      setIsApproved(false);
      setLoading(false);
      if (extraCount > 0 && valorUnitario <= 0) {
        setError('O valor por foto adicional não foi definido na galeria. Acesse o Painel do Fotógrafo > Galerias, edite esta galeria e preencha o campo "Valor por foto extra" (ex: R$ 5,00).');
      } else if (extraCount <= 0) {
        setError('Nenhuma foto excedente ao limite do pacote foi selecionada.');
      } else {
        setError('Valor total de extras inválido (R$ 0,00).');
      }
      return;
    }

    if (!effectiveToken) {
      setPixData(null);
      setIsApproved(false);
      setLoading(false);
      setError('Token de Acesso do Mercado Pago não configurado. Por favor, acesse o Painel > aba 💳 Pagamento PIX, cole o seu Access Token e clique em Salvar.');
      return;
    }

    let isMounted = true;

    async function generatePix() {
      setLoading(true);
      setError(null);

      const res = await createPixPayment({
        amount: totalAmount,
        description: `Fotos Extras (${extraCount} fotos) - ${evento?.titulo || 'Galeria'}`,
        payerEmail: cliente?.email || 'cliente.pagador@gmail.com',
        payerName: cliente?.nome || 'Cliente',
        accessToken: effectiveToken,
        externalReference: `${evento?.id || 'evt'}_${cliente?.id || 'cli'}_${Date.now()}`
      });

      if (!isMounted) return;

      if (res.success) {
        setPixData(res);
        setTimeLeft(900); // 15 minutos
      } else {
        setError(res.error || 'Não foi possível gerar a cobrança PIX no momento.');
      }
      setLoading(false);
    }

    generatePix();

    return () => {
      isMounted = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen, totalAmount, extraCount, valorUnitario, effectiveToken, evento?.id, cliente?.id]);

  // Polling automático para verificar se o PIX foi pago (a cada 3.5 segundos)
  useEffect(() => {
    if (!isOpen || !pixData?.paymentId || isApproved) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      const res = await checkPixPaymentStatus({
        paymentId: pixData.paymentId,
        accessToken: mercadoPagoToken
      });

      if (res.success && res.isApproved) {
        setIsApproved(true);
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (onPaymentSuccess) {
          onPaymentSuccess(res);
        }
      }
    }, 3500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen, pixData?.paymentId, isApproved, mercadoPagoToken, onPaymentSuccess]);

  // Temporizador regressivo
  useEffect(() => {
    if (!isOpen || !pixData || isApproved || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, pixData, isApproved, timeLeft]);

  // Formata o tempo restante (MM:SS)
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleCopyPix = () => {
    if (!pixData?.qrCode) return;
    navigator.clipboard.writeText(pixData.qrCode).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    });
  };

  const handleManualCheck = async () => {
    if (!pixData?.paymentId || checkingManual) return;
    setCheckingManual(true);
    const res = await checkPixPaymentStatus({
      paymentId: pixData.paymentId,
      accessToken: mercadoPagoToken
    });
    setCheckingManual(false);

    if (res.success && res.isApproved) {
      setIsApproved(true);
      if (onPaymentSuccess) {
        onPaymentSuccess(res);
      }
    } else {
      alert("O banco ainda não confirmou o pagamento. Se você já transferiu, aguarde alguns segundos que a confirmação é automática!");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-scale-in">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-stone-150 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2">
            <span className="text-xl">💳</span>
            <div>
              <h3 className="font-serif-editorial text-lg text-stone-900 leading-tight">
                Pagamento de Fotos Extras
              </h3>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mt-0.5">
                PIX Instantâneo Mercado Pago
              </p>
            </div>
          </div>

          {!isApproved && (
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-700 text-2xl font-light w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 transition-colors"
              title="Fechar"
            >
              &times;
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-stone-800">
          
          {/* Tela de Sucesso */}
          {isApproved ? (
            <div className="py-6 text-center space-y-4 animate-scale-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-sm">
                ✓
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-serif-editorial text-emerald-900">
                  Pagamento Confirmado!
                </h4>
                <p className="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
                  Recebemos a confirmação do seu PIX de{' '}
                  <strong className="text-stone-900">
                    R$ {totalAmount.toFixed(2).replace('.', ',')}
                  </strong>
                  . Sua seleção de fotos foi finalizada e liberada com sucesso!
                </p>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md"
                >
                  Continuar na Galeria
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Resumo do Pedido / Fotos Extras */}
              <div className="p-3.5 bg-stone-50 border border-stone-200/80 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-stone-500">
                  <span>Fotos do Pacote (Contratadas):</span>
                  <span className="font-semibold text-stone-800">{limiteFotos} fotos</span>
                </div>
                <div className="flex items-center justify-between text-stone-500">
                  <span>Total de Fotos Escolhidas:</span>
                  <span className="font-semibold text-stone-800">{selectedCount} fotos</span>
                </div>
                <div className="flex items-center justify-between text-amber-700 font-medium border-t border-stone-200/60 pt-1.5">
                  <span>Fotos Extras ({extraCount} × R$ {parseFloat(valorFotoExtra).toFixed(2).replace('.', ',')}):</span>
                  <span className="font-bold">+{extraCount} extras</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-stone-900 border-t border-stone-200 pt-2">
                  <span>Valor Total a Pagar:</span>
                  <span className="text-base text-emerald-800 font-extrabold">
                    R$ {totalAmount.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Estado: Carregando geração do PIX */}
              {loading && (
                <div className="py-8 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-stone-500 font-medium">
                    Gerando QR Code PIX com o Banco Central...
                  </p>
                </div>
              )}

              {/* Estado: Erro ao gerar PIX */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs text-red-800">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>⚠️</span> Não foi possível gerar a chave PIX
                  </div>
                  <p className="text-[11px] leading-relaxed text-red-700">
                    {error}
                  </p>
                  <p className="text-[10px] text-stone-500 pt-1 border-t border-red-200/60">
                    Você pode tentar novamente ou entrar em contato com o fotógrafo para acertar os extras diretamente.
                  </p>
                </div>
              )}

              {/* Estado: QR Code gerado com sucesso */}
              {pixData && !loading && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Bloco QR Code e Temporizador */}
                  <div className="flex flex-col items-center justify-center p-4 bg-white border border-stone-200 rounded-xl shadow-2xs space-y-3">
                    {pixData.qrCodeBase64 ? (
                      <div className="p-2 bg-white rounded-lg border border-stone-200 shadow-xs">
                        <img
                          src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                          alt="QR Code PIX Mercado Pago"
                          className="w-48 h-48 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-stone-100 flex items-center justify-center text-xs text-stone-400 text-center p-3 rounded-lg border">
                        Utilize o código Copia e Cola abaixo no seu banco
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                      <span>⏱️ Expira em:</span>
                      <span className="font-mono font-bold text-stone-800">{formatTime(timeLeft)}</span>
                    </div>

                    <p className="text-[11px] text-stone-500 text-center max-w-xs leading-normal">
                      Abra o aplicativo do seu banco, escolha <strong>Pagar via PIX</strong> e aponte a câmera para o QR Code acima.
                    </p>
                  </div>

                  {/* Campo PIX Copia e Cola */}
                  <div className="space-y-1.5">
                    <label className="block text-[9.5px] font-bold uppercase tracking-widest text-stone-500">
                      Ou utilize o PIX Copia e Cola:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={pixData.qrCode}
                        onClick={(e) => e.target.select()}
                        className="flex-grow px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-mono text-stone-700 truncate select-all focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-2xs flex-shrink-0 flex items-center gap-1 cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-stone-900 hover:bg-stone-850 text-white'
                        }`}
                      >
                        <span>{isCopied ? '✓ Copiado!' : '📋 Copiar Código'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Monitoramento de Pagamento */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-[11px] text-emerald-900 font-medium">
                        Aguardando confirmação bancária em tempo real...
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={checkingManual}
                      onClick={handleManualCheck}
                      className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 hover:text-emerald-950 underline cursor-pointer disabled:opacity-50"
                    >
                      {checkingManual ? 'Checando...' : 'Já paguei'}
                    </button>
                  </div>

                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-stone-150 bg-stone-50/60 flex items-center justify-between text-xs">
          <span className="text-[10px] text-stone-400">
            🔒 Ambiente seguro com compensação instantânea
          </span>

          {!isApproved && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-stone-250 text-stone-600 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-stone-100 transition-colors"
            >
              Pagar Depois
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
