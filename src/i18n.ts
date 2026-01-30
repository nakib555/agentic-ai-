import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, 
    },
    resources: {
      en: {
        translation: {
          sidebar: {
            newChat: "New Chat",
            settings: "Settings",
            search: "Search...",
            history: "History",
          },
          welcome: {
            title: "How can I help you?",
            subtitle: "Your intelligent companion for conversation and knowledge.",
          },
          settings: {
            title: "Settings",
            general: "General",
            appearance: "Appearance",
            model: "Model",
            language: "Language",
          },
          input: {
            placeholder: "Type a message...",
          }
        }
      },
      es: {
        translation: {
          sidebar: {
            newChat: "Nuevo Chat",
            settings: "Ajustes",
            search: "Buscar...",
            history: "Historial",
          },
          welcome: {
            title: "¿En qué puedo ayudarte?",
            subtitle: "Tu compañero inteligente para conversación y conocimiento.",
          },
          settings: {
            title: "Ajustes",
            general: "General",
            appearance: "Apariencia",
            model: "Modelo",
            language: "Idioma",
          },
          input: {
            placeholder: "Escribe un mensaje...",
          }
        }
      }
    }
  });

export default i18n;
