/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPS_SCRIPT_URL?: string
  readonly VITE_WHATSAPP_LOJA?: string
  readonly VITE_PIX_CHAVE?: string
  readonly VITE_PIX_NOME?: string
  readonly VITE_PIX_CIDADE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
