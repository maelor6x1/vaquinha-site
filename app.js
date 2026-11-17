const GOAL = 1000;
const $ = (id) => document.getElementById(id);
const campaignScreen = $("campaignScreen");
const donationScreen = $("donationScreen");
const amountInput = $("amountInput");
const donationForm = $("donationForm");
const paymentResult = $("paymentResult");
const generatePixButton = $("generatePixButton");
let selectedAmount = 50;
let unresolvedPayment = false;
let paymentReady = false;
let toastTimer;
const PENDING_PAYMENT_KEY = "thor_pending_external_id";
const PENDING_PAYMENT_AMOUNT_KEY = "thor_pending_amount";

function money(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseAmount(value) {
  const cleaned = String(value || "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!cleaned) return NaN;
  let normalized;
  if (cleaned.includes(",")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else normalized = cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN;
}
function formatInput(value) {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}
function showCampaign() {
  donationScreen.hidden = true;
  donationScreen.classList.remove("active");
  campaignScreen.hidden = false;
  campaignScreen.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showDonation() {
  campaignScreen.hidden = true;
  campaignScreen.classList.remove("active");
  donationScreen.hidden = false;
  donationScreen.classList.add("active");
  paymentResult.replaceChildren();
  window.scrollTo({ top: 0, behavior: "smooth" });
  amountInput.focus({ preventScroll: true });
  recoverPendingPayment();
}
function chooseAmount(amount) {
  selectedAmount = amount;
  amountInput.value = formatInput(amount);
  document.querySelectorAll(".amount-option").forEach((button) => {
    const active = Number(button.dataset.amount) === amount;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function updateProgress(raised = 0, supporters = 0) {
  const percent = Math.min((raised / GOAL) * 100, 100);
  $("raisedAmount").textContent = money(raised);
  $("progressBar").style.width = `${percent}%`;
  $("progressPercent").textContent = `${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  $("supporterCount").textContent = supporters.toLocaleString("pt-BR");
  const remaining = Math.max(GOAL - raised, 0);
  $("remainingText").textContent = raised >= GOAL ? "Meta mensal alcançada! Obrigado!" : `Faltam ${money(remaining)} para a meta deste mês`;
}

async function loadCampaignSummary() {
  try {
    const response = await fetch("/api/resumo", { cache: "no-store" });
    if (!response.ok) return;
    const summary = await response.json();
    if (Number.isFinite(summary.arrecadado_centavos) && Number.isFinite(summary.apoiadores)) {
      updateProgress(summary.arrecadado_centavos / 100, summary.apoiadores);
    }
    if (summary.meta_centavos === 100000) $("goalAmount").textContent = money(summary.meta_centavos / 100);
    if (summary.mes_referencia) $("monthLabel").textContent = summary.mes_referencia;
    const list = $("supportersList");
    list.replaceChildren();
    if (Array.isArray(summary.doacoes) && summary.doacoes.length) {
      summary.doacoes.slice(0, 10).forEach((donation) => {
        const li = document.createElement("li");
        const avatar = document.createElement("span");
        avatar.className = "supporter-avatar";
        avatar.textContent = String(donation.nome || "A").trim().charAt(0).toUpperCase() || "A";
        const name = document.createElement("span");
        name.className = "supporter-name";
        name.textContent = donation.nome || "Apoiador anônimo";
        const details = document.createElement("div");
        details.className = "supporter-details";
        details.appendChild(name);
        if (donation.mensagem) {
          const message = document.createElement("p");
          message.className = "supporter-message";
          message.textContent = donation.mensagem;
          details.appendChild(message);
        }
        const amount = document.createElement("strong");
        amount.textContent = money(Number(donation.valor_centavos || 0) / 100);
        li.append(avatar, details, amount);
        list.appendChild(li);
      });
    } else {
      const empty = document.createElement("li");
      empty.className = "empty-supporters";
      empty.textContent = "Ainda não há contribuições confirmadas neste mês. Seja a primeira pessoa a ajudar!";
      list.appendChild(empty);
    }
  } catch (error) {
    console.warn("Não foi possível atualizar o resumo da campanha.");
  }
}
async function shareCampaign() {
  const shareData = {
    title: "Vaquinha do Thor — juntos pelo tratamento",
    text: "Ajude o Thor a continuar o tratamento contra o câncer. Qualquer contribuição ou compartilhamento faz diferença. ❤️",
    url: window.location.origin + window.location.pathname
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareData.url);
      showToast("Link da campanha copiado!");
    } else {
      const temporary = document.createElement("textarea");
      temporary.value = shareData.url;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();
      const copied = document.execCommand("copy");
      temporary.remove();
      showToast(copied ? "Link da campanha copiado!" : shareData.url);
    }
  } catch (error) {
    if (error && error.name !== "AbortError") showToast("Não foi possível abrir o compartilhamento.");
  }
}
function safeText(element, value) {
  element.textContent = value == null ? "" : String(value);
}
function showUnresolvedPayment() {
  unresolvedPayment = true;
  generatePixButton.disabled = true;
  generatePixButton.textContent = "Aguardando confirmação";
  const warning = document.createElement("p");
  warning.className = "error-message";
  warning.textContent = "Não foi possível confirmar se o PIX foi criado. Por segurança, não gere outro agora. Aguarde a confirmação ou entre em contato com a campanha antes de tentar novamente.";
  paymentResult.replaceChildren(warning);
}
async function recoverPendingPayment() {
  let externalId = "";
  try {
    externalId = localStorage.getItem(PENDING_PAYMENT_KEY) || "";
    const savedAmount = Number(localStorage.getItem(PENDING_PAYMENT_AMOUNT_KEY));
    if (externalId && Number.isFinite(savedAmount) && savedAmount >= 1) {
      amountInput.value = formatInput(savedAmount);
    }
  } catch {
    return;
  }
  if (!externalId) {
    unresolvedPayment = false;
    paymentReady = false;
    generatePixButton.disabled = false;
    generatePixButton.innerHTML = 'Gerar PIX <span aria-hidden="true">→</span>';
    return;
  }

  unresolvedPayment = false;
  paymentReady = false;
  generatePixButton.disabled = true;
  generatePixButton.textContent = "Verificando PIX…";
  const loading = document.createElement("p");
  loading.className = "field-hint";
  loading.textContent = "Verificando se sua contribuição já foi gerada ou confirmada…";
  paymentResult.replaceChildren(loading);

  try {
    const response = await fetch("/api/consultar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ external_id: externalId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || "Não foi possível consultar o PIX.");
    if (data.status === "paid" || data.confirmado === true) {
      unresolvedPayment = false;
      paymentReady = true;
      localStorage.removeItem(PENDING_PAYMENT_KEY);
      localStorage.removeItem(PENDING_PAYMENT_AMOUNT_KEY);
      paymentResult.replaceChildren();
      const confirmed = document.createElement("p");
      confirmed.className = "success-message";
      confirmed.textContent = "Pagamento confirmado! Obrigado por ajudar o Thor.";
      paymentResult.appendChild(confirmed);
      generatePixButton.disabled = true;
      generatePixButton.textContent = "Pagamento confirmado";
      loadCampaignSummary();
      return;
    }
    if (data.status === "pending" && (data.pix || data.qr)) {
      unresolvedPayment = false;
      paymentReady = true;
      renderPayment(data, Number(data.amount) || parseAmount(amountInput.value) || 0);
      generatePixButton.disabled = true;
      generatePixButton.textContent = "PIX já gerado";
      return;
    }
    if (data.status === "expired" || data.status === "cancelled" || data.status === "cancelado") {
      localStorage.removeItem(PENDING_PAYMENT_KEY);
      localStorage.removeItem(PENDING_PAYMENT_AMOUNT_KEY);
      unresolvedPayment = false;
      paymentReady = false;
      paymentResult.replaceChildren();
      const expired = document.createElement("p");
      expired.className = "field-hint";
      expired.textContent = "A solicitação anterior expirou ou foi cancelada. Você pode gerar um novo PIX.";
      paymentResult.appendChild(expired);
      generatePixButton.disabled = false;
      generatePixButton.innerHTML = 'Gerar PIX <span aria-hidden="true">→</span>';
      return;
    }
    if (data.status === "not_found") {
      unresolvedPayment = false;
      paymentReady = false;
      const retry = document.createElement("p");
      retry.className = "field-hint";
      retry.textContent = "Não encontramos uma cobrança criada para esta solicitação. Você pode tentar novamente; usaremos o mesmo identificador para evitar duplicidade.";
      paymentResult.replaceChildren(retry);
      generatePixButton.disabled = false;
      generatePixButton.textContent = "Tentar novamente";
      return;
    }
    unresolvedPayment = true;
    showUnresolvedPayment();
  } catch (error) {
    unresolvedPayment = true;
    showUnresolvedPayment();
  }
}
function renderPayment(data, amount) {
  paymentResult.replaceChildren();
  const panel = document.createElement("section");
  panel.className = "pix-result-card";
  const title = document.createElement("h2");
  title.textContent = "PIX gerado";
  const description = document.createElement("p");
  description.textContent = `Contribuição de ${money(amount)}. Abra o aplicativo do seu banco para pagar.`;
  panel.append(title, description);

  if (data.qr) {
    const img = document.createElement("img");
    img.className = "pix-qr";
    img.alt = "QR Code para pagamento PIX";
    if (data.qr.startsWith("data:image/")) {
      img.src = data.qr;
    } else if (/^https?:\/\//i.test(data.qr)) {
      img.src = data.qr;
    } else {
      img.src = `data:image/png;base64,${data.qr}`;
    }
    panel.appendChild(img);
  }

  if (data.pix) {
    const pixLabel = document.createElement("label");
    pixLabel.className = "field-label";
    pixLabel.textContent = "PIX copia e cola";
    const code = document.createElement("textarea");
    code.className = "pix-code";
    code.readOnly = true;
    code.value = data.pix;
    code.setAttribute("aria-label", "Código PIX copia e cola");
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "button button-primary copy-button";
    copy.textContent = "Copiar código PIX";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(data.pix);
        copy.textContent = "Código copiado!";
      } catch {
        code.focus();
        code.select();
        showToast("Selecione e copie o código PIX.");
      }
    });
    panel.append(pixLabel, code, copy);
  } else {
    const warning = document.createElement("p");
    warning.className = "error-message";
    warning.textContent = "O provedor não retornou o código PIX esperado. Nenhum valor foi somado à arrecadação.";
    panel.appendChild(warning);
  }
  const verify = document.createElement("button");
  verify.type = "button";
  verify.className = "button button-secondary";
  verify.textContent = "Já paguei — verificar pagamento";
  verify.addEventListener("click", async () => {
    verify.disabled = true;
    verify.textContent = "Verificando pagamento…";
    await recoverPendingPayment();
  });

  const reminder = document.createElement("p");
  reminder.className = "field-hint";
  reminder.textContent = "A arrecadação só deve ser atualizada depois que o pagamento for confirmado.";
  panel.append(verify, reminder);
  paymentResult.appendChild(panel);
}
$("contributeButton").addEventListener("click", showDonation);
$("backButton").addEventListener("click", showCampaign);
$("shareButton").addEventListener("click", shareCampaign);
$("headerShare").addEventListener("click", shareCampaign);
document.querySelectorAll(".amount-option").forEach((button) => {
  button.addEventListener("click", () => chooseAmount(Number(button.dataset.amount)));
});
amountInput.addEventListener("input", () => {
  document.querySelectorAll(".amount-option").forEach((button) => {
    const active = parseAmount(amountInput.value) === Number(button.dataset.amount);
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
});
amountInput.addEventListener("blur", () => {
  const amount = parseAmount(amountInput.value);
  if (Number.isFinite(amount) && amount >= 1) amountInput.value = formatInput(amount);
});

donationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amount = parseAmount(amountInput.value);
  const name = $("donorName").value.trim();
  const message = $("donorMessage").value.trim();

  if (name.length > 100) {
    showToast("O nome deve ter no máximo 100 caracteres.");
    $("donorName").focus();
    return;
  }
  if (message.length > 300) {
    showToast("A mensagem deve ter no máximo 300 caracteres.");
    $("donorMessage").focus();
    return;
  }

  if (!Number.isFinite(amount) || amount < 1) {
    showToast("O valor mínimo para doar é R$ 1,00.");
    amountInput.focus();
    return;
  }
  if (amount > 1000000) {
    showToast("Confira o valor informado.");
    amountInput.focus();
    return;
  }

  let externalId;
  try {
    externalId = localStorage.getItem(PENDING_PAYMENT_KEY) || "";
    const savedAmount = Number(localStorage.getItem(PENDING_PAYMENT_AMOUNT_KEY));
    if (externalId && Number.isFinite(savedAmount) && savedAmount >= 1) {
      if (Math.round(savedAmount * 100) !== Math.round(amount * 100)) {
        amountInput.value = formatInput(savedAmount);
        showToast("Já existe uma solicitação em recuperação. Mantivemos o valor original para evitar cobrança duplicada.");
        return;
      }
    } else {
      const randomPart = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().replaceAll("-", "")
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      externalId = `thor_${Date.now()}_${randomPart.slice(0, 24)}`;
      localStorage.setItem(PENDING_PAYMENT_KEY, externalId);
      localStorage.setItem(PENDING_PAYMENT_AMOUNT_KEY, amount.toFixed(2));
    }
  } catch {
    showToast("Não foi possível salvar a solicitação neste navegador. Tente novamente.");
    return;
  }

  paymentReady = false;
  generatePixButton.disabled = true;
  generatePixButton.textContent = "Gerando PIX…";
  paymentResult.replaceChildren();
  try {
    const response = await fetch("/api/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: amount.toFixed(2), nome: name, mensagem: message, external_id: externalId })
    });
    const data = await response.json().catch(() => ({}));
    if (data.resultado_indefinido === true) {
      unresolvedPayment = true;
      if (data.external_id) localStorage.setItem(PENDING_PAYMENT_KEY, data.external_id);
      showUnresolvedPayment();
      return;
    }
    if (!response.ok || data.erro) {
      const error = document.createElement("p");
      error.className = "error-message";
      error.textContent = typeof data.erro === "string" ? data.erro : "Não foi possível gerar o PIX agora. Tente novamente.";
      paymentResult.appendChild(error);
      return;
    }
    unresolvedPayment = false;
    paymentReady = true;
    if (data.external_id) localStorage.setItem(PENDING_PAYMENT_KEY, data.external_id);
    renderPayment(data, amount);
    generatePixButton.disabled = true;
    generatePixButton.textContent = "PIX já gerado";
  } catch {
    // A conexão pode cair depois que o servidor já encaminhou a cobrança ao gateway.
    unresolvedPayment = true;
    showUnresolvedPayment();
  } finally {
    if (!unresolvedPayment && !paymentReady) {
      generatePixButton.disabled = false;
      generatePixButton.innerHTML = 'Gerar PIX <span aria-hidden="true">→</span>';
    }
  }
});

chooseAmount(50);
updateProgress();
loadCampaignSummary();
