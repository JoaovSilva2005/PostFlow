import type { SocialProviderId } from '../../../shared/domain/socialPublishing'

export interface IntegrationDefinition {
  id: string
  name: string
  description: string
  accountLabel: string
  provider?: SocialProviderId
  documentation: string
}

// Only entries with a provider have implemented OAuth/publishing adapters.
// Catalog entries never create accounts or imply a working connection.
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
    id: 'x',
    name: 'X / Twitter',
    accountLabel: '',
    description:
      'Um destino para os conteúdos da sua marca no X. A conexão ainda precisa ser implementada e depende de acesso à API.',
    documentation: 'https://docs.x.com/x-api/introduction',
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
  {
    id: 'canva',
    name: 'Canva',
    accountLabel: '',
    description:
      'Uma opção para trazer designs e materiais da sua marca para o PostFlow. A conexão com o Canva ainda não foi implementada.',
    documentation: 'https://www.canva.dev/docs/apps/rest-apis/',
  },
  {
    id: 'threads',
    name: 'Threads',
    accountLabel: '',
    description:
      'Uma opção para compartilhar os conteúdos da sua marca no Threads. A conexão ainda precisa ser implementada.',
    documentation: 'https://developers.facebook.com/docs/threads/',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    accountLabel: '',
    description:
      'Uma opção para organizar conteúdo visual em Pins e pastas. A conexão com o Pinterest ainda não foi implementada.',
    documentation: 'https://developers.pinterest.com/docs/api/v5/introduction/',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    accountLabel: '',
    description:
      'Uma opção para os vídeos do seu canal. A conexão e o envio de arquivos de vídeo ainda precisam ser implementados.',
    documentation: 'https://developers.google.com/youtube/v3',
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    accountLabel: '',
    description:
      'Uma opção para publicar artigos no site da sua marca. A conexão com o WordPress ainda não foi implementada.',
    documentation: 'https://developer.wordpress.org/rest-api/',
  },
]
