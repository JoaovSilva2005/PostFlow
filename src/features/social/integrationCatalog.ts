import type { SocialProviderId } from '../../../shared/domain/socialPublishing'

export interface IntegrationDefinition {
  id: string
  name: string
  description: string
  accountLabel: string
  provider: SocialProviderId
  documentation: string
}

// Only networks with implemented OAuth/publishing adapters belong here.
// Availability still depends on the server's real provider configuration.
export const integrationCatalog: IntegrationDefinition[] = [
  {
    id: 'facebook',
    provider: 'facebook',
    name: 'Facebook',
    accountLabel: 'Páginas conectadas',
    description:
      'Publique na Página do Facebook da sua marca. A conexão utiliza uma Página administrada por você, e não o perfil pessoal.',
    documentation: 'https://developers.facebook.com/apps/',
  },
  {
    id: 'instagram',
    provider: 'instagram',
    name: 'Instagram',
    accountLabel: 'Contas conectadas',
    description:
      'Conecte uma conta profissional do Instagram, Empresa ou Criador, para publicar as imagens e legendas da sua agenda.',
    documentation: 'https://developers.facebook.com/apps/',
  },
  {
    id: 'linkedin',
    provider: 'linkedin',
    name: 'LinkedIn',
    accountLabel: 'Perfis conectados',
    description:
      'Compartilhe conteúdo no seu perfil pessoal do LinkedIn. A conexão com Páginas de empresas ainda não está disponível.',
    documentation: 'https://www.linkedin.com/developers/apps',
  },
  {
    id: 'tiktok',
    provider: 'tiktok',
    name: 'TikTok',
    accountLabel: 'Contas conectadas',
    description:
      'Conecte sua conta para publicar fotos. A ativação depende da aprovação do aplicativo e da verificação do domínio de mídia.',
    documentation: 'https://developers.tiktok.com/apps/',
  },
]
