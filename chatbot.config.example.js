window.ChatbotConfig = {
  title: "Your Business Assistant",
  logoSrc: "",
  apiBase: "",
  standalone: false,
  widgetButtonText: "Get a Quote",
  links: {
    contactUrl: "/contact.html",
    bookingUrl: "/booking.html"
  },
  quoteKeywords: [
    "quote",
    "estimate",
    "pricing",
    "price",
    "cost",
    "rate",
    "how much",
    "presupuesto",
    "precio"
  ],
  serenadeKeywords: ["serenade", "small package"],
  faqEntries: [
    {
      keywords: ["services", "what do you offer", "servicios"],
      response: {
        en: "We provide live music for private and corporate events.",
        es: "Ofrecemos musica en vivo para eventos privados y corporativos."
      }
    },
    {
      keywords: ["hours", "open", "horario"],
      response: {
        en: "We answer inquiries daily from 9am to 8pm.",
        es: "Respondemos consultas diariamente de 9am a 8pm."
      }
    },
    {
      keywords: ["book", "booking", "reservar", "reserva"],
      response: {
        en: "You can submit your request from our booking page.",
        es: "Puedes enviar tu solicitud desde nuestra pagina de reservas."
      }
    }
  ],
  strings: {
    greeting: {
      en: "Hi! Ask me a question or request a quote.",
      es: "Hola! Hazme una pregunta o solicita un estimado."
    }
  }
};
