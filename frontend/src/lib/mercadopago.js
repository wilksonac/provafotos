/**
 * Serviço de Integração Mercado Pago - PIX Instantâneo
 * WILKSON FOTOGRAFIAS
 */

const DEFAULT_ACCESS_TOKEN = import.meta.env.VITE_MERCADO_PAGO_ACCESS_TOKEN || "";

/**
 * Retorna a base URL da API Mercado Pago (usando proxy local ou direto)
 */
function getApiBaseUrl() {
  // Em desenvolvimento ou ambientes com proxy do Vite
  return "/api-mercadopago";
}

/**
 * Cria uma cobrança PIX no Mercado Pago
 * @param {Object} params
 * @param {number} params.amount - Valor da transação em Reais (ex: 50.00)
 * @param {string} params.description - Descrição do pagamento (ex: "Fotos Extras - Galeria Casamento")
 * @param {string} params.payerEmail - E-mail do pagador
 * @param {string} [params.payerName] - Nome completo do pagador
 * @param {string} [params.accessToken] - Token de acesso do Mercado Pago (se omitido, usa o padrão do .env)
 * @param {string} [params.externalReference] - Referência externa (ex: id_evento_id_cliente)
 */
export async function createPixPayment({
  amount,
  description,
  payerEmail,
  payerName = "Cliente",
  payerCpf = "",
  accessToken = DEFAULT_ACCESS_TOKEN,
  externalReference = ""
}) {
  const token = (accessToken || "").trim();
  if (!token) {
    return {
      success: false,
      error: "Token de Acesso do Mercado Pago não configurado. Por favor, configure o Access Token nas configurações do sistema."
    };
  }

  // Validação mínima do valor
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return {
      success: false,
      error: `Valor de cobrança inválido: R$ ${amount}`
    };
  }

  // Divide nome e sobrenome
  const nameParts = (payerName || "Cliente").trim().split(" ");
  const firstName = nameParts[0] || "Cliente";
  const lastName = nameParts.slice(1).join(" ") || "Fotos";

  // Limpa o e-mail (Mercado Pago exige formato válido e rejeita e-mails fictícios com domínios desconhecidos)
  let cleanEmail = (payerEmail || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@") || cleanEmail.includes("@fotografia.com") || cleanEmail.includes("@exemplo.com")) {
    cleanEmail = "cliente.pagador@gmail.com";
  }

  const payload = {
    transaction_amount: Number(numericAmount.toFixed(2)),
    description: (description || "Fotos Extras").substring(0, 100),
    payment_method_id: "pix",
    payer: {
      email: cleanEmail,
      first_name: firstName,
      last_name: lastName,
      identification: {
        type: "CPF",
        number: (payerCpf || "").replace(/\D/g, '') || "19119119100"
      }
    },
    external_reference: externalReference || `extra_${Date.now()}`
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": `pix_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  };

  try {
    let response;
    const proxyUrl = `${getApiBaseUrl()}/v1/payments`;

    try {
      response = await fetch(proxyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
    } catch (proxyErr) {
      console.warn("[MERCADO PAGO] Falha na rota proxy, tentando API direta...", proxyErr);
      response = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[MERCADO PAGO] Erro na criação do PIX:", errorData);
      let errorMsg =
        errorData.message ||
        (errorData.cause && errorData.cause[0] && errorData.cause[0].description) ||
        `Erro HTTP ${response.status} ao conectar com Mercado Pago.`;

      if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes("unauthorized use of live credentials")) {
        errorMsg = "As credenciais de produção (APP_USR-...) ainda não foram homologadas no Mercado Pago Developers. Acesse sua aplicação e preencha 'Ativar credenciais de produção', ou use o Access Token de teste (TEST-...) para simular pagamentos.";
      } else if (typeof errorMsg === 'string' && (errorMsg.toLowerCase().includes("collector user without key enabled") || errorMsg.toLowerCase().includes("without key enabled"))) {
        errorMsg = "Sua conta do Mercado Pago ainda não tem uma Chave PIX cadastrada. Abra o aplicativo do Mercado Pago no celular, vá em 'Área Pix' > 'Minhas chaves' e cadastre pelo menos uma chave (pode ser Chave Aleatória).";
      } else if (typeof errorMsg === 'string' && (errorMsg.toLowerCase().includes("collector_id cannot be the same as payer_id") || errorMsg.toLowerCase().includes("same as collector"))) {
        errorMsg = "O e-mail do cliente não pode ser o mesmo e-mail da sua conta Mercado Pago (o vendedor não pode pagar a si mesmo). Use um e-mail de cliente diferente para o teste.";
      }
      return { success: false, error: errorMsg, raw: errorData };
    }

    const data = await response.json();
    console.log("[MERCADO PAGO] Cobrança PIX gerada com sucesso:", data.id);

    const pointOfInteraction = data.point_of_interaction || {};
    const transactionData = pointOfInteraction.transaction_data || {};

    return {
      success: true,
      paymentId: data.id,
      status: data.status, // 'pending'
      statusDetail: data.status_detail,
      qrCodeBase64: transactionData.qr_code_base64 || null,
      qrCode: transactionData.qr_code || "",
      ticketUrl: transactionData.ticket_url || null,
      expirationDate: data.date_of_expiration || null,
      amount: data.transaction_amount,
      raw: data
    };
  } catch (err) {
    console.error("[MERCADO PAGO] Exceção na requisição PIX:", err);
    return {
      success: false,
      error: `Falha na conexão: ${err.message}`
    };
  }
}

/**
 * Consulta o status atualizado de uma cobrança no Mercado Pago
 * @param {Object} params
 * @param {string|number} params.paymentId - ID do pagamento no Mercado Pago
 * @param {string} [params.accessToken] - Token de acesso
 */
export async function checkPixPaymentStatus({ paymentId, accessToken = DEFAULT_ACCESS_TOKEN }) {
  const token = (accessToken || "").trim();
  if (!token || !paymentId) {
    return { success: false, error: "paymentId e accessToken são obrigatórios." };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  try {
    let response;
    const proxyUrl = `${getApiBaseUrl()}/v1/payments/${paymentId}`;

    try {
      response = await fetch(proxyUrl, { method: "GET", headers });
    } catch (proxyErr) {
      response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        method: "GET",
        headers
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `Erro HTTP ${response.status} ao consultar status.`,
        raw: errorData
      };
    }

    const data = await response.json();
    const isApproved = data.status === "approved";

    return {
      success: true,
      paymentId: data.id,
      status: data.status, // 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled'
      statusDetail: data.status_detail,
      isApproved,
      dateApproved: data.date_approved,
      amount: data.transaction_amount,
      raw: data
    };
  } catch (err) {
    console.error("[MERCADO PAGO] Erro ao consultar status do PIX:", err);
    return { success: false, error: err.message };
  }
}
