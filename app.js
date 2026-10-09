const INITIAL_RAISED = 467.51;
const GOAL = 30000;
const INITIAL_SUPPORTERS = 137;
const $ = (id) => document.getElementById(id);
const campaignScreen = $("campaignScreen");
const donationScreen = $("donationScreen");
const amountInput = $("amountInput");
const donationForm = $("donationForm");
const paymentResult = $("paymentResult");
const generatePixButton = $("generatePixButton");
let selectedAmount = 10;
let toastTimer;

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
function updateProgress(raised = INITIAL_RAISED, supporters = INITIAL_SUPPORTERS) {
  const percent = Math.min((raised / GOAL) * 100, 100);
  $("raisedAmount").textContent = money(raised);
  $("progressBar").style.width = `${percent}%`;
  $("progressPercent").textContent = `${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  $("remainingText").textContent = raised >= GOAL ? "Meta alcançada!" : "Cada ajuda faz diferença";
  $("supporterCount").textContent = supporters.toLocaleString("pt-BR");
}

async function loadCampaignSummary() {
  try {
    const response = await fetch("/api/resumo", { cache: "no-store" });
    if (!response.ok) return;
    const summary = await response.json();
    if (Number.isFinite(summary.arrecadado_centavos) && Number.isFinite(summary.apoiadores)) {
      updateProgress(summary.arrecadado_centavos / 100, summary.apoiadores);
    }
    if (Array.isArray(summary.doacoes) && summary.doacoes.length) {
      const list = $("supportersList");
      summary.doacoes.slice(0, 10).reverse().forEach((donation) => {
        const li = document.createElement("li");
        const avatar = document.createElement("span");
        avatar.className = "supporter-avatar";
        avatar.textContent = String(donation.nome || "A").trim().charAt(0).toUpperCase() || "A";
        const name = document.createElement("span");
        name.className = "supporter-name";
        name.textContent = donation.nome || "Apoiador anônimo";
        const amount = document.createElement("strong");
        amount.textContent = money(Number(donation.valor_centavos || 0) / 100);
        li.append(avatar, name, amount);
        list.prepend(li);
      });
    }
  } catch (error) {
    console.warn("Não foi possível atualizar o resumo da campanha.");
  }
}
async function shareCampaign() {
  const shareData = {
    title: "Ajude o Thor a vencer o câncer",
    text: "Ajude o Thor a custear o tratamento e a cirurgia contra o câncer. Qualquer contribuição ou compartilhamento faz diferença. ❤️",
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
    img.src = data.qr.startsWith("data:") ? data.qr : `data:image/png;base64,${data.qr}`;
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
  const reminder = document.createElement("p");
  reminder.className = "field-hint";
  reminder.textContent = "A arrecadação só deve ser atualizada depois que o pagamento for confirmado.";
  panel.appendChild(reminder);
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

  generatePixButton.disabled = true;
  generatePixButton.textContent = "Gerando PIX…";
  paymentResult.replaceChildren();
  try {
    const response = await fetch("/api/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: amount.toFixed(2), nome: name })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) {
      const error = document.createElement("p");
      error.className = "error-message";
      error.textContent = typeof data.erro === "string" ? data.erro : "Não foi possível gerar o PIX agora. Tente novamente.";
      paymentResult.appendChild(error);
      return;
    }
    renderPayment(data, amount);
  } catch {
    const error = document.createElement("p");
    error.className = "error-message";
    error.textContent = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
    paymentResult.appendChild(error);
  } finally {
    generatePixButton.disabled = false;
    generatePixButton.innerHTML = 'Gerar PIX <span aria-hidden="true">→</span>';
  }
});

updateProgress();
loadCampaignSummary();
