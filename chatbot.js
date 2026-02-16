(() => {
  function mountChatbot() {
    const scriptTag =
      document.currentScript || document.querySelector('script[src$="chatbot.js"]');
    if (!scriptTag) return;

    if (document.querySelector(".chatbot-widget") || document.querySelector(".chatbot-standalone")) {
      return;
    }

    const globalConfig = window.ChatbotConfig || {};
    const apiBase = (scriptTag.dataset.apiBase || globalConfig.apiBase || "").trim();

    const config = {
      title: globalConfig.title || "Website Assistant",
      logoSrc: globalConfig.logoSrc || "",
      standalone:
        scriptTag.dataset.standalone === "true" || globalConfig.standalone === true,
      contactUrl: globalConfig.links?.contactUrl || "/contact.html",
      bookingUrl: globalConfig.links?.bookingUrl || "/booking.html",
      widgetButtonText: globalConfig.widgetButtonText || "Get a Quote",
      faqEntries: Array.isArray(globalConfig.faqEntries) ? globalConfig.faqEntries : [],
      quoteKeywords: Array.isArray(globalConfig.quoteKeywords)
        ? globalConfig.quoteKeywords
        : [
            "quote",
            "estimate",
            "pricing",
            "price",
            "cost",
            "rate",
            "how much",
            "presupuesto",
            "precio",
            "cuanto",
            "cuanto cuesta"
          ],
      serenadeKeywords: Array.isArray(globalConfig.serenadeKeywords)
        ? globalConfig.serenadeKeywords
        : ["serenade", "few songs", "small package"],
      strings: {
        greeting: {
          en: "Hi! Ask me a question or request a quote.",
          es: "Hola! Hazme una pregunta o solicita un estimado."
        },
        locationPrompt: {
          en: "What is the event location (city and state)?",
          es: "Cual es la ubicacion del evento (ciudad y estado)?"
        },
        serenadeLocationPrompt: {
          en: "What is the serenade location (city and state)?",
          es: "Cual es la ubicacion de la serenata (ciudad y estado)?"
        },
        hoursPrompt: {
          en: "How many hours do you need?",
          es: "Cuantas horas necesitas?"
        },
        startTimePrompt: {
          en: "What time does the performance start? Example: 7:30pm. If unsure, say 'not sure'.",
          es: "A que hora empieza? Ejemplo: 7:30pm. Si no sabes, escribe 'no se'."
        },
        calculating: {
          en: "Checking distance and preparing your estimate...",
          es: "Calculando distancia y preparando tu estimado..."
        },
        unavailable: {
          en: "I cannot reach the pricing service right now. Please contact us.",
          es: "No puedo acceder al servicio de precios ahora. Por favor contactanos."
        },
        fallback: {
          en: "I can help with booking, pricing, and common questions. Ask another question or request a quote.",
          es: "Puedo ayudar con reservas, precios y preguntas comunes. Haz otra pregunta o solicita un estimado."
        },
        noProblem: {
          en: "No problem. Ask me anything else.",
          es: "Sin problema. Preguntame algo mas."
        },
        thanks: {
          en: "You are welcome. Let me know if you need anything else.",
          es: "De nada. Dime si necesitas algo mas."
        },
        ...globalConfig.strings
      }
    };

    const state = {
      awaitingLocation: false,
      awaitingHours: false,
      awaitingStartTime: false,
      location: "",
      hours: "",
      startTime: "",
      serviceType: "standard",
      userLanguage: "en",
      forceLanguage: false
    };

    const isStandalone =
      document.body.classList.contains("chatbot-only-page") || config.standalone;
    const container = document.createElement("div");
    container.className = isStandalone ? "chatbot-standalone" : "chatbot-widget";

    const logoMarkup = config.logoSrc
      ? `<img class="chatbot-logo" src="${escapeHtml(config.logoSrc)}" alt="Chatbot logo" />`
      : `<span class="chatbot-logo-fallback" aria-hidden="true">AI</span>`;

    container.innerHTML = isStandalone
      ? `
      <div class="chatbot-panel standalone" aria-live="polite">
        <div class="chatbot-header">
          <div class="chatbot-title">
            ${logoMarkup}
            <h4>${escapeHtml(config.title)}</h4>
          </div>
          <div class="chatbot-actions">
            <button class="chatbot-lang-toggle" type="button" aria-label="Switch language">ES</button>
          </div>
        </div>
        <div class="chatbot-messages"></div>
        <form class="chatbot-form">
          <input class="chatbot-input" type="text" placeholder="Ask a question" aria-label="Chat input" required />
          <button class="chatbot-send" type="submit">Send</button>
        </form>
      </div>
    `
      : `
      <button class="chatbot-toggle" type="button" aria-label="Open chat">
        <span class="chatbot-toggle-icon">Chat</span>
        <span class="chatbot-toggle-text">${escapeHtml(config.widgetButtonText)}</span>
      </button>
      <div class="chatbot-backdrop" aria-hidden="true"></div>
      <div class="chatbot-panel" aria-live="polite">
        <div class="chatbot-header">
          <div class="chatbot-title">
            ${logoMarkup}
            <h4>${escapeHtml(config.title)}</h4>
          </div>
          <div class="chatbot-actions">
            <button class="chatbot-lang-toggle" type="button" aria-label="Switch language">ES</button>
            <button class="chatbot-close" type="button" aria-label="Close">x</button>
          </div>
        </div>
        <div class="chatbot-messages"></div>
        <form class="chatbot-form">
          <input class="chatbot-input" type="text" placeholder="Ask a question" aria-label="Chat input" required />
          <button class="chatbot-send" type="submit">Send</button>
        </form>
      </div>
    `;

    const mountTarget = isStandalone
      ? document.querySelector("#chatbot-mount") || document.querySelector("main") || document.body
      : document.body;
    mountTarget.appendChild(container);

    const panel = container.querySelector(".chatbot-panel");
    const messagesEl = container.querySelector(".chatbot-messages");
    const form = container.querySelector(".chatbot-form");
    const input = container.querySelector(".chatbot-input");
    const toggle = container.querySelector(".chatbot-toggle");
    const backdrop = container.querySelector(".chatbot-backdrop");
    const closeBtn = container.querySelector(".chatbot-close");
    const langToggle = container.querySelector(".chatbot-lang-toggle");

    if (!panel || !messagesEl || !form || !input) return;

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addMessage(text, sender = "bot", allowHtml = false) {
      const messageEl = document.createElement("div");
      messageEl.className = `chatbot-message ${sender}`;
      if (allowHtml && sender === "bot") {
        messageEl.innerHTML = text;
      } else {
        messageEl.textContent = text;
      }
      messagesEl.appendChild(messageEl);
      scrollToBottom();
    }

    function localize(value) {
      if (value && typeof value === "object") {
        return state.userLanguage === "es"
          ? value.es || value.en || ""
          : value.en || value.es || "";
      }
      return value || "";
    }

    async function addBotMessage(value, allowHtml = false) {
      addMessage(localize(value), "bot", allowHtml);
    }

    function resetQuoteState() {
      state.awaitingLocation = false;
      state.awaitingHours = false;
      state.awaitingStartTime = false;
      state.location = "";
      state.hours = "";
      state.startTime = "";
      state.serviceType = "standard";
    }

    function keywordMatches(text, keyword) {
      const needle = String(keyword || "").toLowerCase().trim();
      if (!needle) return false;
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const boundaryRegex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu");
      return boundaryRegex.test(text.toLowerCase());
    }

    function findFaqResponse(text) {
      const lowered = text.toLowerCase();
      return config.faqEntries.find((entry) =>
        (entry.keywords || []).some((keyword) => keywordMatches(lowered, keyword))
      );
    }

    function detectLanguage(text) {
      if (state.forceLanguage) return state.userLanguage;
      const lowered = text.toLowerCase();
      const spanishHints =
        /[áéíóúñü¿¡]/i.test(text) ||
        /\b(hola|gracias|por favor|precio|presupuesto|reserva|ubicacion|ciudad|estado|cuanto|cuantas|evento|quiero|necesito|cotizacion)\b/.test(
          lowered
        );
      if (spanishHints) {
        return "es";
      }
      return "en";
    }

    function parseHours(raw) {
      const match = String(raw || "").toLowerCase().match(/(\d+(?:\.\d+)?)\s*(hours|hour|hrs|hr|h|horas)?/);
      if (!match) return null;
      const value = Number.parseFloat(match[1]);
      return Number.isFinite(value) && value > 0 ? value : null;
    }

    function isGreeting(text) {
      return /^(hi|hello|hey|hola|buenas|buenos dias|buenas tardes|buenas noches)\b/.test(text);
    }

    function isThanks(text) {
      return /\b(thanks|thank you|gracias|thx)\b/.test(text);
    }

    function isNegative(text) {
      return /^(no|nope|nah|not now|no gracias)\b/.test(text);
    }

    function isNotSure(text) {
      return /\b(not sure|unsure|idk|i do not know|no se)\b/.test(text);
    }

    function isQuoteIntent(text) {
      return config.quoteKeywords.some((keyword) => keywordMatches(text, keyword));
    }

    function isSerenadeIntent(text) {
      return config.serenadeKeywords.some((keyword) => keywordMatches(text, keyword));
    }

    function makeContactLink() {
      return `<a class="chatbot-link" href="${escapeHtml(config.contactUrl)}">Contact page</a>`;
    }

    function makeBookingLink() {
      return `<a class="chatbot-link" href="${escapeHtml(config.bookingUrl)}">Booking page</a>`;
    }

    async function translateText(text, targetLang) {
      if (!apiBase || !text) return text;
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, "")}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            target_lang: targetLang,
            source_lang: "auto"
          })
        });
        const data = await response.json();
        if (!response.ok) return text;
        return data?.text || text;
      } catch (_error) {
        return text;
      }
    }

    async function localizeServerMessage(message) {
      if (state.userLanguage !== "es" || !message) return message;
      return translateText(message, "es");
    }

    async function fetchQuote() {
      if (!apiBase) {
        await addBotMessage(config.strings.unavailable);
        resetQuoteState();
        return;
      }

      await addBotMessage(config.strings.calculating);

      const payload = {
        location: state.location,
        hours: state.serviceType === "serenade" ? "1" : state.hours,
        start_time: state.startTime || "",
        service_type: state.serviceType === "serenade" ? "serenade" : ""
      };

      try {
        const response = await fetch(`${apiBase.replace(/\/$/, "")}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Quote request failed.");
        }

        if (data.routeTo === "contact") {
          const base = await localizeServerMessage(data.message || "");
          const defaultLine =
            state.userLanguage === "es"
              ? `Por favor usa la ${makeContactLink()}.`
              : `Please use the ${makeContactLink()}.`;
          const text = `${base} ${defaultLine}`.trim();
          await addBotMessage(text, true);
          resetQuoteState();
          return;
        }

        if (data.routeTo === "quote") {
          const message =
            (await localizeServerMessage(data.message || "")) ||
            (state.userLanguage === "es"
              ? "Solo es un estimado. La disponibilidad se confirma por correo."
              : "Estimate only. Availability is confirmed by email.");

          const labels =
            state.userLanguage === "es"
              ? {
                  estimated: "Estimado total",
                  rate: "Tarifa",
                  perHour: "hora",
                  distance: "Distancia",
                  minHours: "Horas minimas",
                  hoursBilled: "Horas cobradas"
                }
              : {
                  estimated: "Estimated total",
                  rate: "Rate",
                  perHour: "hour",
                  distance: "Distance",
                  minHours: "Minimum hours",
                  hoursBilled: "Hours billed"
                };

          const parts = [];
          if (data.estimate != null) {
            parts.push(`<strong>${labels.estimated}:</strong> $${data.estimate}`);
          }
          if (data.rate != null) {
            parts.push(`<strong>${labels.rate}:</strong> $${data.rate}/${labels.perHour}`);
          }
          if (data.distanceMiles != null) {
            parts.push(`<strong>${labels.distance}:</strong> ${data.distanceMiles} mi`);
          }
          if (data.minimumHours != null) {
            parts.push(`<strong>${labels.minHours}:</strong> ${data.minimumHours}`);
          }
          if (data.hoursBilled != null) {
            parts.push(`<strong>${labels.hoursBilled}:</strong> ${data.hoursBilled}`);
          }

          const cta =
            state.userLanguage === "es"
              ? `Si quieres confirmar disponibilidad, envia la ${makeBookingLink()}.`
              : `If you want to confirm availability, submit the ${makeBookingLink()}.`;

          const detail = parts.length ? `<br>${parts.join("<br>")}` : "";
          await addBotMessage(`${message}${detail}<br><br>${cta}`, true);
          resetQuoteState();
          return;
        }

        await addBotMessage(config.strings.noProblem);
        resetQuoteState();
      } catch (_error) {
        await addBotMessage({
          en: `Sorry, I could not calculate that. Please use the ${makeContactLink()}.`,
          es: `Lo siento, no pude calcularlo. Por favor usa la ${makeContactLink()}.`
        }, true);
        resetQuoteState();
      }
    }

    async function startQuoteFlow(serviceType) {
      resetQuoteState();
      state.serviceType = serviceType || "standard";
      state.awaitingLocation = true;
      if (state.serviceType === "serenade") {
        await addBotMessage(config.strings.serenadeLocationPrompt);
      } else {
        await addBotMessage(config.strings.locationPrompt);
      }
    }

    function updateLanguageToggle() {
      if (!langToggle) return;
      const nextLang = state.userLanguage === "es" ? "EN" : "ES";
      langToggle.textContent = nextLang;
      langToggle.setAttribute(
        "aria-label",
        state.userLanguage === "es" ? "Switch language to English" : "Cambiar idioma a espanol"
      );
    }

    function setLanguage(lang, force = false) {
      state.userLanguage = lang === "es" ? "es" : "en";
      state.forceLanguage = force;
      updateLanguageToggle();
    }

    async function handleUserMessage(message) {
      const trimmed = message.trim();
      const lowered = trimmed.toLowerCase();
      if (!trimmed) return;

      if (/\b(espanol|espanol por favor|spanish)\b/.test(lowered)) {
        setLanguage("es", true);
        await addBotMessage({ en: "Language set to Spanish.", es: "Idioma cambiado a espanol." });
        return;
      }
      if (/\b(english|ingles)\b/.test(lowered)) {
        setLanguage("en", true);
        await addBotMessage({ en: "Language set to English.", es: "Idioma cambiado a ingles." });
        return;
      }

      if (!state.forceLanguage) {
        setLanguage(detectLanguage(trimmed), false);
      }

      if (state.awaitingLocation) {
        if (isNegative(lowered)) {
          await addBotMessage(config.strings.noProblem);
          resetQuoteState();
          return;
        }
        state.location = trimmed;
        state.awaitingLocation = false;
        if (state.serviceType === "serenade") {
          await fetchQuote();
          return;
        }
        state.awaitingHours = true;
        await addBotMessage(config.strings.hoursPrompt);
        return;
      }

      if (state.awaitingHours) {
        const hours = parseHours(trimmed);
        if (!hours) {
          await addBotMessage({
            en: "Please enter hours as a number. Example: 2 or 2.5.",
            es: "Escribe las horas como numero. Ejemplo: 2 o 2.5."
          });
          return;
        }
        state.hours = String(hours);
        state.awaitingHours = false;
        state.awaitingStartTime = true;
        await addBotMessage(config.strings.startTimePrompt);
        return;
      }

      if (state.awaitingStartTime) {
        if (!isNotSure(lowered)) {
          state.startTime = trimmed;
        }
        state.awaitingStartTime = false;
        await fetchQuote();
        return;
      }

      if (isGreeting(lowered)) {
        await addBotMessage(config.strings.greeting);
        return;
      }

      if (isThanks(lowered)) {
        await addBotMessage(config.strings.thanks);
        return;
      }

      if (isQuoteIntent(lowered)) {
        await startQuoteFlow(isSerenadeIntent(lowered) ? "serenade" : "standard");
        return;
      }

      const faqMatch = findFaqResponse(trimmed);
      if (faqMatch) {
        const responseText = localize(faqMatch.response);
        await addBotMessage(responseText, faqMatch.allowHtml === true);
        return;
      }

      await addBotMessage(config.strings.fallback);
    }

    function openChat() {
      container.classList.add("chatbot-open");
      panel.classList.add("active");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
      if (backdrop) backdrop.classList.add("active");
      document.body.classList.add("chatbot-open");
      input.focus();
    }

    function closeChat() {
      container.classList.remove("chatbot-open");
      panel.classList.remove("active");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      if (backdrop) backdrop.classList.remove("active");
      document.body.classList.remove("chatbot-open");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      addMessage(message, "user");
      input.value = "";
      await handleUserMessage(message);
    });

    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.addEventListener("click", () => {
        if (panel.classList.contains("active")) {
          closeChat();
          return;
        }
        openChat();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", closeChat);
    }

    if (backdrop) {
      backdrop.addEventListener("click", closeChat);
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel.classList.contains("active")) {
        closeChat();
      }
    });

    if (langToggle) {
      updateLanguageToggle();
      langToggle.addEventListener("click", async () => {
        const next = state.userLanguage === "es" ? "en" : "es";
        setLanguage(next, true);
        await addBotMessage(
          next === "es"
            ? { en: "Language set to Spanish.", es: "Idioma cambiado a espanol." }
            : { en: "Language set to English.", es: "Idioma cambiado a ingles." }
        );
      });
    }

    addBotMessage({
      en: `<div class="chatbot-greeting"><span class="chatbot-lang-badge">EN</span><span>${escapeHtml(
        config.strings.greeting.en
      )}</span></div>
           <div class="chatbot-greeting"><span class="chatbot-lang-badge">ES</span><span>${escapeHtml(
             config.strings.greeting.es
           )}</span></div>`,
      es: `<div class="chatbot-greeting"><span class="chatbot-lang-badge">EN</span><span>${escapeHtml(
        config.strings.greeting.en
      )}</span></div>
           <div class="chatbot-greeting"><span class="chatbot-lang-badge">ES</span><span>${escapeHtml(
             config.strings.greeting.es
           )}</span></div>`
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChatbot);
  } else {
    mountChatbot();
  }
})();
