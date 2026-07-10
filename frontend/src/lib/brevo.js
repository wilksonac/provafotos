const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY;
const BREVO_SENDER_EMAIL = "wilksonfotografias@gmail.com";
const BREVO_SENDER_NAME = "WILKSON FOTOGRAFIAS";

/**
 * Sends a transactional email via Brevo.
 */
async function sendEmailRaw({ to, subject, htmlContent }) {
  try {
    const payload = {
      sender: {
        name: BREVO_SENDER_NAME,
        email: BREVO_SENDER_EMAIL,
      },
      to,
      subject,
      htmlContent,
    };

    const response = await fetch("/api-brevo", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brevo API Error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Failed to send email via Brevo:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends an email to the client with their access credentials.
 */
export async function sendClientCredentialsEmail({ email, name, galleryTitle, galleryToken, password }) {
  const subject = `Sua galeria de fotos já está disponível - Wilkson Fotografias`;
  const link = `${window.location.origin}/?gallery=${galleryToken}`;
  
  const htmlContent = `
    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 30px; border: 1px solid #e7e5e4; border-radius: 8px; color: #1c1917; background-color: #fafaf9;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-weight: 300; letter-spacing: 0.15em; margin: 0; font-size: 24px; color: #1c1917;">WILKSON FOTOGRAFIAS</h1>
        <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; color: #78716c; margin-top: 5px; font-family: sans-serif;">Plataforma de Seleção</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">Olá, <strong>${name}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">Tudo bem? A sua galeria de fotos <strong>${galleryTitle}</strong> já está pronta e disponível para escolha das suas fotos favoritas.</p>
      
      <div style="background-color: #ffffff; border: 1px solid #e7e5e4; padding: 25px; margin: 30px 0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <h4 style="margin: 0 0 15px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #78716c; font-family: sans-serif; border-bottom: 1px solid #f5f5f4; padding-bottom: 8px;">Credenciais de Acesso</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 120px; color: #78716c; font-family: sans-serif;">Link:</td>
            <td style="padding: 8px 0;"><a href="${link}" style="color: #1c1917; font-weight: bold; text-decoration: underline;">Clique aqui para acessar a galeria</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #78716c; font-family: sans-serif;">E-mail:</td>
            <td style="padding: 8px 0; font-family: monospace;">${email}</td>
          </tr>
          ${password ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #78716c; font-family: sans-serif;">Senha:</td>
            <td style="padding: 8px 0; font-family: monospace; background: #f5f5f4; padding: 4px 8px; border-radius: 4px; display: inline-block;">${password}</td>
          </tr>` : ''}
        </table>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">Caso tenha qualquer dúvida no processo de seleção, basta responder a este e-mail ou entrar em contato pelo e-mail: <a href="mailto:wilkson@gmail.com" style="color: #1c1917; text-decoration: none; border-bottom: 1px dashed #78716c;">wilkson@gmail.com</a>.</p>
      
      <p style="font-size: 15px; line-height: 1.6; color: #44403c; margin-top: 30px;">Um abraço,</p>
      <p style="font-size: 16px; font-weight: bold; color: #1c1917; margin: 0;">Wilkson Albuquerque Carvalho</p>
      
      <hr style="border: 0; border-top: 1px solid #e7e5e4; margin: 30px 0;" />
      <p style="font-size: 10px; color: #a8a29e; text-align: center; margin: 0; font-family: sans-serif; letter-spacing: 0.05em;">Wilkson Fotografias &copy; ${new Date().getFullYear()} &bull; Todos os direitos reservados.</p>
    </div>
  `;

  return sendEmailRaw({
    to: [{ email, name }],
    subject,
    htmlContent
  });
}

/**
 * Sends notification emails when a client finalizes their selection.
 */
export async function sendSelectionFinalizedEmails({ clientName, clientEmail, galleryTitle, selectedCount, totalCount }) {
  // 1. Email to the Photographer/Admin
  const adminSubject = `[FOTOS SELECIONADAS] ${clientName} finalizou a escolha - ${galleryTitle}`;
  const adminHtmlContent = `
    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 30px; border: 1px solid #e7e5e4; border-radius: 8px; color: #1c1917; background-color: #fafaf9;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-weight: 300; letter-spacing: 0.15em; margin: 0; font-size: 24px; color: #1c1917;">WILKSON FOTOGRAFIAS</h1>
        <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; color: #78716c; margin-top: 5px; font-family: sans-serif;">Aviso Administrativo</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">Olá, Wilkson,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">O cliente <strong>${clientName}</strong> (${clientEmail}) acabou de finalizar a seleção de fotos da galeria <strong>${galleryTitle}</strong>.</p>
      
      <div style="background-color: #ffffff; border: 1px solid #e7e5e4; padding: 25px; margin: 30px 0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <h4 style="margin: 0 0 15px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #78716c; font-family: sans-serif; border-bottom: 1px solid #f5f5f4; padding-bottom: 8px;">Resumo da Seleção</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 140px; color: #78716c; font-family: sans-serif;">Galeria:</td>
            <td style="padding: 8px 0; font-weight: bold;">${galleryTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #78716c; font-family: sans-serif;">Cliente:</td>
            <td style="padding: 8px 0;">${clientName} (${clientEmail})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #78716c; font-family: sans-serif;">Selecionadas:</td>
            <td style="padding: 8px 0; color: #15803d; font-weight: bold;">${selectedCount} fotos favoritadas</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #78716c; font-family: sans-serif;">Total da Galeria:</td>
            <td style="padding: 8px 0;">${totalCount} fotos no total</td>
          </tr>
        </table>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">Você já pode acessar o seu <a href="${window.location.origin}" style="color: #1c1917; font-weight: bold; text-decoration: underline;">Painel de Controle</a> para exportar a lista de arquivos para o Lightroom ou Windows e dar início à edição/entrega.</p>
      
      <hr style="border: 0; border-top: 1px solid #e7e5e4; margin: 30px 0;" />
      <p style="font-size: 10px; color: #a8a29e; text-align: center; margin: 0; font-family: sans-serif; letter-spacing: 0.05em;">Wilkson Fotografias &copy; ${new Date().getFullYear()} &bull; Todos os direitos reservados.</p>
    </div>
  `;

  // 2. Email to the Client
  const clientSubject = `Sua seleção de fotos foi finalizada! - Wilkson Fotografias`;
  const clientHtmlContent = `
    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 30px; border: 1px solid #e7e5e4; border-radius: 8px; color: #1c1917; background-color: #fafaf9;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-weight: 300; letter-spacing: 0.15em; margin: 0; font-size: 24px; color: #1c1917;">WILKSON FOTOGRAFIAS</h1>
        <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; color: #78716c; margin-top: 5px; font-family: sans-serif;">Confirmação de Seleção</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">Olá, <strong>${clientName}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">Confirmamos que a sua escolha de fotos para a galeria <strong>${galleryTitle}</strong> foi finalizada com sucesso!</p>
      
      <div style="background-color: #ebfbee; border: 1px solid #b2f2bb; padding: 20px; margin: 35px 0; border-radius: 6px; text-align: center; color: #2b8a3e;">
        <span style="font-size: 20px; display: block; margin-bottom: 8px;">✓</span>
        <h4 style="margin: 0; font-size: 16px; font-weight: bold;">Escolha Concluída</h4>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #40c057;">Selecionou um total de <strong>${selectedCount}</strong> fotos.</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">A partir de agora a sua seleção está fechada para que possamos dar início ao tratamento das imagens em alta resolução. Notificaremos você assim que o material final estiver disponível para entrega.</p>
      <p style="font-size: 15px; line-height: 1.6; color: #44403c;">Agradecemos a preferência e confiança!</p>
      
      <p style="font-size: 15px; line-height: 1.6; color: #44403c; margin-top: 30px;">Um abraço,</p>
      <p style="font-size: 16px; font-weight: bold; color: #1c1917; margin: 0;">Wilkson Albuquerque Carvalho</p>
      
      <hr style="border: 0; border-top: 1px solid #e7e5e4; margin: 30px 0;" />
      <p style="font-size: 10px; color: #a8a29e; text-align: center; margin: 0; font-family: sans-serif; letter-spacing: 0.05em;">Wilkson Fotografias &copy; ${new Date().getFullYear()} &bull; Todos os direitos reservados.</p>
    </div>
  `;

  // Send admin notification
  const adminPromise = sendEmailRaw({
    to: [{ email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME }],
    subject: adminSubject,
    htmlContent: adminHtmlContent
  });

  // Send client confirmation
  const clientPromise = sendEmailRaw({
    to: [{ email: clientEmail, name: clientName }],
    subject: clientSubject,
    htmlContent: clientHtmlContent
  });

  return Promise.all([adminPromise, clientPromise]);
}
