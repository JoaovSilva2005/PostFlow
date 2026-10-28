import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Send } from 'lucide-react'
import { Link } from 'react-router'
import type { PostDraft } from '../../domain/models'
import type {
  SocialProviderId,
  TikTokCreatorInfo,
} from '../../../shared/domain/socialPublishing'
import { useApp } from '../../app/AppContext'
import { Button } from '../../components/ui/Button'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import { socialApi } from './socialApi'
import styles from './social.module.css'

interface Props {
  draft: PostDraft
  hasUnsavedChanges: boolean
}
interface Outcome {
  provider: string
  status: string
  label?: string
  message: string
}

export function DraftPublishingPanel({ draft, hasUnsavedChanges }: Props) {
  const { currentWorkspace } = useApp()
  const canPublish = ['owner', 'admin', 'editor'].includes(
    currentWorkspace?.role ?? '',
  )
  const [connections, setConnections] = useState<
    Awaited<ReturnType<typeof socialApi.overview>>['connections']
  >([])
  const [demoMode, setDemoMode] = useState(false)
  const [hasUnavailableSetup, setHasUnavailableSetup] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [creatorInfo, setCreatorInfo] = useState<
    Record<string, TikTokCreatorInfo>
  >({})
  const [privacy, setPrivacy] = useState<Record<string, string>>({})
  const [aiDisclosure, setAiDisclosure] = useState<
    Record<string, '' | 'yes' | 'no'>
  >({})
  const [consent, setConsent] = useState(false)
  const [brandContentToggle, setBrandContentToggle] = useState(false)
  const [brandOrganicToggle, setBrandOrganicToggle] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const isStatic = !draft.format || draft.format === 'static'
  const draftProvider = socialProviderForPlatform(draft.platform)

  useEffect(() => {
    if (!currentWorkspace) return
    let active = true
    setSelected([])
    socialApi
      .overview(currentWorkspace.id)
      .then((overview) => {
        if (active) {
          setDemoMode(overview.demoMode)
          const configured = overview.providers.filter(
            (provider) =>
              provider.configured && provider.formats.includes('static'),
          )
          setHasUnavailableSetup(
            overview.connections.some(
              (connection) =>
                connection.status === 'connected' &&
                connection.provider === draftProvider &&
                !configured.some(
                  (provider) => provider.id === connection.provider,
                ),
            ),
          )
          setConnections(
            overview.connections.filter(
              (item) =>
                item.status === 'connected' &&
                item.provider === draftProvider &&
                configured.some((provider) => provider.id === item.provider),
            ),
          )
        }
      })
      .catch(() => {
        if (active) {
          setConnections([])
          setError('Não foi possível verificar as redes conectadas.')
        }
      })
    return () => {
      active = false
    }
  }, [currentWorkspace?.id, draft.platform])

  async function toggleConnection(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    )
    setError('')
    setNotice('')
    setOutcomes([])
    const connection = connections.find((item) => item.id === id)
    if (
      checked &&
      connection?.provider === 'tiktok' &&
      currentWorkspace &&
      !creatorInfo[id]
    ) {
      try {
        const info = await socialApi.creatorInfo(currentWorkspace.id, id)
        setCreatorInfo((current) => ({ ...current, [id]: info }))
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível consultar as opções da conta TikTok.',
        )
        setSelected((current) => current.filter((value) => value !== id))
      }
    }
  }

  async function publish() {
    if (
      !currentWorkspace ||
      !consent ||
      !selected.length ||
      !isStatic ||
      hasUnsavedChanges ||
      !draft.imageUrl
    )
      return
    if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) {
      setError('Escolha um horário futuro ou use publicar agora.')
      return
    }
    const tiktokConnection = selected
      .map((id) => connections.find((item) => item.id === id))
      .find((item) => item?.provider === 'tiktok')
    if (
      tiktokConnection &&
      (!privacy[tiktokConnection.id] ||
        aiDisclosure[tiktokConnection.id] === undefined ||
        aiDisclosure[tiktokConnection.id] === '')
    ) {
      setError(
        'Escolha manualmente a privacidade e informe se a mídia foi gerada por IA para o TikTok.',
      )
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    setOutcomes([])
    const results = await Promise.all(
      selected.map(async (connectionId): Promise<Outcome> => {
        const connection = connections.find((item) => item.id === connectionId)!
        const info = creatorInfo[connectionId]
        try {
          const publication = await socialApi.publish(currentWorkspace.id, {
            draftId: draft.id,
            connectionId,
            expectedDraft: {
              title: draft.title,
              caption: draft.caption,
              hashtags: draft.hashtags,
              imageUrl: draft.imageUrl!,
            },
            ...(scheduledAt
              ? { scheduledAt: new Date(scheduledAt).toISOString() }
              : {}),
            consent: true,
            ...(connection.provider === 'tiktok'
              ? {
                  tiktok: {
                    privacyLevel: privacy[connectionId],
                    disableComment: info?.commentDisabled ?? false,
                    isAiGenerated: aiDisclosure[connectionId] === 'yes',
                    brandContentToggle,
                    brandOrganicToggle,
                  },
                }
              : {}),
          })
          return {
            provider: connection.displayName,
            status: publication.status,
            label:
              publication.status === 'published' && publication.simulated
                ? 'Publicado (simulado)'
                : undefined,
            message: `Solicitação registrada: ${publication.status}.`,
          }
        } catch (cause) {
          return {
            provider: connection.displayName,
            status: 'failed',
            message:
              cause instanceof Error
                ? cause.message
                : 'Falha ao registrar a publicação.',
          }
        }
      }),
    )
    setOutcomes(results)
    const accepted = results.filter(
      (result) => result.status !== 'failed',
    ).length
    if (accepted === results.length)
      setNotice(
        scheduledAt
          ? 'Solicitações agendadas. Elas serão publicadas pelo servidor no horário escolhido.'
          : 'Solicitações enfileiradas. Acompanhe a confirmação da rede em Integrações; a situação da agenda é um controle manual.',
      )
    else if (accepted > 0)
      setNotice(
        `${accepted} de ${results.length} destinos aceitos; confira o resultado de cada rede.`,
      )
    else
      setError(
        'Nenhum destino aceitou a solicitação. Confira os erros por rede.',
      )
    setConsent(false)
    setBusy(false)
  }

  return (
    <section
      className={styles.publishPanel}
      aria-labelledby={`publish-${draft.id}`}
    >
      <div className={styles.publishTitle}>
        <div>
          <h3 id={`publish-${draft.id}`}>Publicar nas redes</h3>
          <p>
            Prévia da versão salva do rascunho; cada destino recebe uma
            solicitação independente.
          </p>
        </div>
        <Send size={18} />
      </div>
      {!isStatic && (
        <p className={styles.warning}>
          Este post é{' '}
          {draft.format === 'carousel' ? 'um carrossel' : 'um Reels/vídeo'}.
          Publicação de imagem estática não é compatível com este formato.
        </p>
      )}
      {isStatic && !draft.imageUrl && (
        <p className={styles.warning}>
          Gere e salve uma imagem antes de publicar este formato.
        </p>
      )}
      {hasUnsavedChanges && (
        <p className={styles.warning}>
          Salve as alterações do rascunho antes de publicar. A prévia precisa
          corresponder à versão persistida.
        </p>
      )}
      <div className={styles.preview}>
        <strong>{draft.title}</strong>
        <div>
          {draft.imageUrl ? (
            <img
              src={draft.imageUrl}
              alt="Prévia da imagem que será publicada"
            />
          ) : (
            <span>Imagem não disponível</span>
          )}
        </div>
        <p>{draft.caption}</p>
        {draft.hashtags.length > 0 && <small>{draft.hashtags.join(' ')}</small>}
      </div>
      {!canPublish && (
        <p className={styles.warning}>
          Seu papel permite consultar esta prévia, mas não solicitar
          publicações.
        </p>
      )}
      {connections.length === 0 ? (
        <p className={styles.empty}>
          {hasUnavailableSetup
            ? 'Há contas conectadas cuja configuração da API ainda não permite publicar. '
            : draftProvider
              ? `Nenhuma conta ${providerLabel(draftProvider)} pronta para publicar. Configure uma rede em `
              : 'A publicação direta não está disponível para esta rede. Consulte as opções em '}
          <Link to="/integrations">Integrações</Link>.
        </p>
      ) : (
        <fieldset className={styles.destinationList}>
          <legend>Destinos</legend>
          {connections.map((connection) => (
            <label key={connection.id}>
              <input
                type="checkbox"
                checked={selected.includes(connection.id)}
                disabled={busy || !isStatic || !canPublish}
                onChange={(event) =>
                  void toggleConnection(connection.id, event.target.checked)
                }
              />
              <SocialPlatformIcon
                platform={providerLabel(connection.provider)}
                size={18}
              />
              <span>{connection.displayName}</span>
            </label>
          ))}
        </fieldset>
      )}
      {selected.some(
        (id) =>
          connections.find((item) => item.id === id)?.provider === 'tiktok',
      ) &&
        selected
          .filter(
            (id) =>
              connections.find((item) => item.id === id)?.provider === 'tiktok',
          )
          .map((id) => (
            <fieldset className={styles.ttOptions} key={id}>
              <legend>
                TikTok · {creatorInfo[id]?.creatorNickname ?? 'Conta'}
              </legend>
              {creatorInfo[id] ? (
                <>
                  <label>
                    Privacidade
                    <select
                      value={privacy[id] ?? ''}
                      onChange={(event) =>
                        setPrivacy((value) => ({
                          ...value,
                          [id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecione uma opção</option>
                      {creatorInfo[id].privacyLevelOptions.map((option) => (
                        <option value={option} key={option}>
                          {privacyLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Esta mídia foi gerada por IA?
                    <select
                      value={aiDisclosure[id] ?? ''}
                      onChange={(event) =>
                        setAiDisclosure((value) => ({
                          ...value,
                          [id]: event.target.value as '' | 'yes' | 'no',
                        }))
                      }
                    >
                      <option value="">Escolha uma resposta</option>
                      <option value="yes">
                        Sim, sinalizar mídia gerada por IA
                      </option>
                      <option value="no">Não</option>
                    </select>
                  </label>
                  <p>
                    Comentários:{' '}
                    {creatorInfo[id].commentDisabled
                      ? 'desativados pela conta'
                      : 'configuração informada pela rede'}{' '}
                    · Dueto e Stitch indisponíveis para este envio de imagem.
                  </p>
                </>
              ) : (
                <p role="status">Consultando as opções atuais da conta…</p>
              )}
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={brandContentToggle}
                  onChange={(event) =>
                    setBrandContentToggle(event.target.checked)
                  }
                />
                Este post promove outra marca ou produto (conteúdo de marca)
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={brandOrganicToggle}
                  onChange={(event) =>
                    setBrandOrganicToggle(event.target.checked)
                  }
                />
                Este post promove minha própria marca ou negócio
              </label>
            </fieldset>
          ))}
      <label className={styles.scheduleChoice}>
        <span>
          <Clock3 size={15} /> Agendar (opcional)
        </span>
        <input
          type="datetime-local"
          value={scheduledAt}
          min={localDateTimeMin()}
          onChange={(event) => setScheduledAt(event.target.value)}
          disabled={!canPublish || busy}
        />
        <small>
          Horário deste computador (
          {Intl.DateTimeFormat().resolvedOptions().timeZone}). Deixe vazio para
          solicitar publicação agora.
        </small>
      </label>
      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          disabled={!canPublish || busy}
        />
        <span>
          Confirmo a publicação desta prévia nas contas selecionadas e autorizo
          o envio da imagem e legenda às respectivas redes.
        </span>
      </label>
      <Button
        onClick={() => void publish()}
        disabled={
          !canPublish ||
          busy ||
          !consent ||
          !selected.length ||
          !isStatic ||
          hasUnsavedChanges ||
          !draft.imageUrl ||
          selected.some(
            (id) =>
              connections.find((item) => item.id === id)?.provider ===
                'tiktok' &&
              (!creatorInfo[id] || !privacy[id] || !aiDisclosure[id]),
          )
        }
      >
        {busy
          ? 'Registrando solicitações…'
          : scheduledAt
            ? 'Agendar publicação'
            : 'Publicar agora'}
      </Button>
      {demoMode && (
        <p className={styles.demoNotice} role="status">
          Modo demonstração: nada é enviado às redes sociais.
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          <CheckCircle2 size={15} /> {notice}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {outcomes.length > 0 && (
        <ul className={styles.outcomes}>
          {outcomes.map((result) => (
            <li key={result.provider}>
              <strong>
                {result.provider} · {result.label ?? result.status}
              </strong>
              <span>{result.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function privacyLabel(value: string) {
  return (
    (
      {
        PUBLIC_TO_EVERYONE: 'Público',
        MUTUAL_FOLLOW_FRIENDS: 'Amigos',
        FOLLOWER_OF_CREATOR: 'Seguidores',
        SELF_ONLY: 'Somente eu',
      } as Record<string, string>
    )[value] ?? value
  )
}
function providerLabel(provider: string) {
  return (
    (
      {
        facebook: 'Facebook',
        instagram: 'Instagram',
        linkedin: 'LinkedIn',
        tiktok: 'TikTok',
      } as Record<string, string>
    )[provider] ?? provider
  )
}
function socialProviderForPlatform(platform: string): SocialProviderId | null {
  const normalized = platform.trim().toLocaleLowerCase('pt-BR')
  if (normalized === 'facebook') return 'facebook'
  if (normalized === 'instagram') return 'instagram'
  if (normalized === 'linkedin') return 'linkedin'
  if (normalized === 'tiktok') return 'tiktok'
  return null
}
function localDateTimeMin() {
  const d = new Date(Date.now() + 60_000)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
