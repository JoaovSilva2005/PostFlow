import { createApp } from '../server/app'

// A Vercel mantém esta instância entre invocações quando possível.
// As rotas continuam centralizadas em server/app.ts para que o ambiente
// local e o deploy utilizem exatamente a mesma API Express.
const app = createApp()

export default app
