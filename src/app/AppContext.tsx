import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type {
  AuthSession,
  LoginCredentials,
  RegistrationInput,
  RegistrationResponse,
} from '../domain/auth'
import type {
  AppState,
  BrandProfile,
  BrandWorkspace,
  PostDraft,
} from '../domain/models'
import { authApi, type AuthGateway } from '../features/auth/authApi'
import {
  ApiPostFlowRepository,
  type PostFlowDataRepository,
} from '../services/postFlowRepository'
import {
  ApiError,
  SESSION_EXPIRED_EVENT,
  SESSION_EXPIRED_MESSAGE,
} from '../services/apiClient'

type AppAction =
  | { type: 'AUTH_CHECKING' }
  | { type: 'AUTHENTICATED'; payload: AuthSession }
  | { type: 'AUTH_ANONYMOUS'; payload?: string }
  | { type: 'WORKSPACES_LOADED'; payload: BrandWorkspace[] }
  | { type: 'WORKSPACES_LOAD_FAILED' }
  | {
      type: 'SELECT_WORKSPACE'
      payload: { workspace: BrandWorkspace; brand: BrandProfile | null }
    }
  | {
      type: 'DATABASE_CONNECTED'
      payload: { brand: BrandProfile | null; drafts: PostDraft[] }
    }
  | { type: 'DATABASE_ERROR'; payload: string }
  | { type: 'SAVE_BRAND'; payload: BrandProfile }
  | { type: 'ADD_DRAFT'; payload: PostDraft }
  | { type: 'ADD_DRAFTS'; payload: PostDraft[] }
  | { type: 'UPDATE_DRAFT'; payload: PostDraft }
  | { type: 'REFRESH_DRAFTS'; payload: PostDraft[] }
  | { type: 'REMOVE_DRAFT'; payload: string }

interface AppContextValue extends AppState {
  billingWorkspaceId: string | null
  hasActivePlan: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  recoverPassword: (email: string) => Promise<string>
  register: (input: RegistrationInput) => Promise<RegistrationResponse>
  refreshSession: () => Promise<AuthSession | null>
  selectWorkspace: (workspaceId: string) => Promise<void>
  createWorkspace: (brand: BrandProfile) => Promise<BrandWorkspace>
  saveBrand: (brand: BrandProfile) => Promise<void>
  addDraft: (draft: PostDraft) => Promise<void>
  addDrafts: (drafts: PostDraft[]) => Promise<PostDraft[]>
  addDraftForWorkspace: (workspaceId: string, draft: PostDraft) => Promise<void>
  addDraftsForWorkspace: (
    workspaceId: string,
    drafts: PostDraft[],
    billingWorkspaceId?: string,
  ) => Promise<PostDraft[]>
  refreshDraftImageUrl: (draftId: string) => Promise<string | null>
  saveDraftImage: (
    draftId: string,
    imageUrl: string,
    workspaceId?: string,
    billingWorkspaceId?: string,
  ) => Promise<PostDraft>
  updateDraft: (draft: PostDraft) => Promise<void>
  /** Recarrega os posts do workspace ativo sem alterar marca nem status de conexão. */
  refreshDrafts: () => Promise<void>
  removeDraft: (id: string) => Promise<void>
}

interface AppProviderProps {
  children: ReactNode
  authGateway?: AuthGateway
  repository?: PostFlowDataRepository
}

function createInitialState(): AppState {
  return {
    authError: null,
    authStatus: 'checking',
    authUser: null,
    currentWorkspace: null,
    availableWorkspaces: [],
    workspacesLoaded: false,
    workspaceLoadVersion: 0,
    billingWorkspaceId: null,
    platformRole: null,
    billingStatus: 'none',
    isAuthenticated: false,
    brand: null,
    drafts: [],
    databaseStatus: 'connecting',
    databaseError: null,
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'AUTH_CHECKING':
      return { ...state, authError: null, authStatus: 'checking' }
    case 'AUTHENTICATED':
      return {
        ...state,
        authError: null,
        authStatus: 'authenticated',
        authUser: action.payload.user,
        currentWorkspace:
          state.authUser?.id === action.payload.user.id
            ? (state.currentWorkspace ?? action.payload.workspace)
            : action.payload.workspace,
        availableWorkspaces: [],
        workspacesLoaded: false,
        workspaceLoadVersion: state.workspaceLoadVersion + 1,
        platformRole: action.payload.platformRole,
        billingStatus: action.payload.billingStatus,
        billingWorkspaceId: action.payload.billingWorkspaceId ?? null,
        isAuthenticated: true,
      }
    case 'AUTH_ANONYMOUS':
      return {
        ...state,
        authError: action.payload ?? null,
        authStatus: 'anonymous',
        authUser: null,
        currentWorkspace: null,
        availableWorkspaces: [],
        workspacesLoaded: false,
        workspaceLoadVersion: state.workspaceLoadVersion + 1,
        platformRole: null,
        billingStatus: 'none',
        billingWorkspaceId: null,
        isAuthenticated: false,
      }
    case 'WORKSPACES_LOADED': {
      const active = state.currentWorkspace
        ? action.payload.find(({ id }) => id === state.currentWorkspace?.id)
        : null
      return {
        ...state,
        availableWorkspaces: action.payload,
        workspacesLoaded: true,
        billingWorkspaceId:
          (state.billingWorkspaceId &&
          action.payload.some(({ id }) => id === state.billingWorkspaceId)
            ? state.billingWorkspaceId
            : action.payload.find(({ billingStatus }) =>
                hasActiveBillingStatus(billingStatus),
              )?.id) ?? null,
        brand: active?.brand ?? state.brand,
        billingStatus: active?.billingStatus ?? state.billingStatus,
      }
    }
    case 'WORKSPACES_LOAD_FAILED':
      return { ...state, workspacesLoaded: true }
    case 'SELECT_WORKSPACE':
      return {
        ...state,
        currentWorkspace: action.payload.workspace,
        billingStatus: action.payload.workspace.billingStatus,
        billingWorkspaceId: hasActiveBillingStatus(
          action.payload.workspace.billingStatus,
        )
          ? action.payload.workspace.id
          : state.billingWorkspaceId,
        brand: action.payload.brand,
        drafts: [],
        databaseStatus: 'connecting',
        databaseError: null,
      }
    case 'DATABASE_CONNECTED':
      return {
        ...state,
        ...action.payload,
        databaseStatus: 'connected',
        databaseError: null,
      }
    case 'DATABASE_ERROR':
      return {
        ...state,
        databaseStatus: 'error',
        databaseError: action.payload,
      }
    case 'SAVE_BRAND':
      return {
        ...state,
        brand: action.payload,
        availableWorkspaces: state.availableWorkspaces.map((workspace) =>
          workspace.id === state.currentWorkspace?.id
            ? { ...workspace, brand: action.payload }
            : workspace,
        ),
        databaseError: null,
      }
    case 'ADD_DRAFT':
      return {
        ...state,
        drafts: [...state.drafts, action.payload],
        databaseError: null,
      }
    case 'ADD_DRAFTS':
      return {
        ...state,
        drafts: [...state.drafts, ...action.payload],
        databaseError: null,
      }
    case 'UPDATE_DRAFT':
      return {
        ...state,
        drafts: state.drafts.map((draft) =>
          draft.id === action.payload.id ? action.payload : draft,
        ),
        databaseError: null,
      }
    case 'REFRESH_DRAFTS':
      return {
        ...state,
        drafts: mergeRefreshedDrafts(state.drafts, action.payload),
      }
    case 'REMOVE_DRAFT':
      return {
        ...state,
        drafts: state.drafts.filter((draft) => draft.id !== action.payload),
        databaseError: null,
      }
  }
}

function sameDraftContent(left: PostDraft, right: PostDraft) {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Mantém a identidade dos posts que não mudaram (evita reiniciar editores
 * abertos) e preserva a URL assinada da imagem já carregada, que muda a cada
 * listagem sem que a imagem tenha mudado.
 */
function mergeRefreshedDrafts(current: PostDraft[], incoming: PostDraft[]) {
  const currentById = new Map(current.map((draft) => [draft.id, draft]))
  let changed = incoming.length !== current.length
  const merged = incoming.map((draft, index) => {
    const previous = currentById.get(draft.id)
    if (!previous) {
      changed = true
      return draft
    }
    const candidate =
      previous.imageUrl && draft.imageAvailable
        ? { ...draft, imageUrl: previous.imageUrl }
        : draft
    if (sameDraftContent(previous, candidate)) {
      if (current[index] !== previous) changed = true
      return previous
    }
    changed = true
    return candidate
  })
  return changed ? merged : current
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Não foi possível acessar o banco de dados.'
}

function authenticationError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Não foi possível autenticar agora.'
}

function hasActiveBillingStatus(status: BrandWorkspace['billingStatus']) {
  return status === 'active' || status === 'trialing'
}

function billingWorkspaceIdFor(state: AppState) {
  if (state.billingWorkspaceId) return state.billingWorkspaceId

  const currentWorkspace = state.currentWorkspace
  if (currentWorkspace) {
    const current = state.availableWorkspaces.find(
      ({ id }) => id === currentWorkspace.id,
    )
    if (current && hasActiveBillingStatus(current.billingStatus)) {
      return currentWorkspace.id
    }
  }

  return (
    state.availableWorkspaces.find(({ billingStatus }) =>
      hasActiveBillingStatus(billingStatus),
    )?.id ?? null
  )
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({
  children,
  authGateway = authApi,
  repository = ApiPostFlowRepository,
}: AppProviderProps) {
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    createInitialState,
  )
  const authOperation = useRef(0)
  const draftMutations = useRef({ started: 0, inflight: 0 })
  const currentWorkspaceIdRef = useRef<string | null>(null)
  currentWorkspaceIdRef.current = state.currentWorkspace?.id ?? null

  useEffect(() => {
    const handleExpiredSession = () => {
      authOperation.current += 1
      dispatch({
        type: 'AUTH_ANONYMOUS',
        payload: SESSION_EXPIRED_MESSAGE,
      })
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession)
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession)
    }
  }, [])

  useEffect(() => {
    let isActive = true
    const operation = authOperation.current

    authGateway
      .currentUser()
      .then((session) => {
        if (!isActive || operation !== authOperation.current) return

        dispatch(
          session
            ? { type: 'AUTHENTICATED', payload: session }
            : { type: 'AUTH_ANONYMOUS' },
        )
      })
      .catch((error: unknown) => {
        if (isActive && operation === authOperation.current) {
          dispatch({
            type: 'AUTH_ANONYMOUS',
            payload: authenticationError(error),
          })
        }
      })

    return () => {
      isActive = false
    }
  }, [authGateway])

  useEffect(() => {
    let isActive = true
    if (state.authStatus !== 'authenticated') {
      return () => {
        isActive = false
      }
    }
    if (!repository.listWorkspaces) {
      dispatch({ type: 'WORKSPACES_LOADED', payload: [] })
      return () => {
        isActive = false
      }
    }
    repository
      .listWorkspaces()
      .then((workspaces) => {
        if (isActive)
          dispatch({ type: 'WORKSPACES_LOADED', payload: workspaces })
      })
      .catch((error: unknown) => {
        if (isActive) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          dispatch({ type: 'WORKSPACES_LOAD_FAILED' })
        }
      })
    return () => {
      isActive = false
    }
  }, [repository, state.authStatus, state.workspaceLoadVersion])

  useEffect(() => {
    let isActive = true

    if (state.authStatus !== 'authenticated') {
      return () => {
        isActive = false
      }
    }

    if (!state.workspacesLoaded) {
      return () => {
        isActive = false
      }
    }

    if (!state.currentWorkspace) {
      dispatch({
        type: 'DATABASE_CONNECTED',
        payload: { brand: null, drafts: [] },
      })
      return () => {
        isActive = false
      }
    }

    const billingWorkspaceId = billingWorkspaceIdFor(state)
    const hasActivePlan = Boolean(billingWorkspaceId)
    if (!hasActivePlan && state.platformRole !== 'platform_owner') {
      dispatch({
        type: 'DATABASE_CONNECTED',
        payload: { brand: null, drafts: [] },
      })
      return () => {
        isActive = false
      }
    }

    repository
      .load(state.currentWorkspace.id, billingWorkspaceId ?? undefined)
      .then((data) => {
        if (isActive) {
          dispatch({ type: 'DATABASE_CONNECTED', payload: data })
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
        }
      })

    return () => {
      isActive = false
    }
  }, [
    repository,
    state.authStatus,
    state.billingStatus,
    state.currentWorkspace,
    state.availableWorkspaces,
    state.workspacesLoaded,
    state.platformRole,
  ])

  const value = useMemo<AppContextValue>(() => {
    async function trackDraftMutation<T>(operation: () => Promise<T>) {
      draftMutations.current.started += 1
      draftMutations.current.inflight += 1
      try {
        return await operation()
      } finally {
        draftMutations.current.inflight -= 1
        draftMutations.current.started += 1
      }
    }

    return {
      ...state,
      billingWorkspaceId: billingWorkspaceIdFor(state),
      hasActivePlan:
        Boolean(billingWorkspaceIdFor(state)) ||
        state.platformRole === 'platform_owner',
      login: async (credentials) => {
        authOperation.current += 1
        dispatch({ type: 'AUTH_CHECKING' })

        try {
          const session = await authGateway.login(credentials)
          dispatch({ type: 'AUTHENTICATED', payload: session })
        } catch (error) {
          dispatch({
            type: 'AUTH_ANONYMOUS',
            payload: authenticationError(error),
          })
          throw error
        }
      },
      logout: async () => {
        authOperation.current += 1
        try {
          await authGateway.logout()
        } finally {
          dispatch({ type: 'AUTH_ANONYMOUS' })
        }
      },
      recoverPassword: (email) => authGateway.recoverPassword(email),
      register: async (input) => {
        authOperation.current += 1
        dispatch({ type: 'AUTH_CHECKING' })

        try {
          const result = await authGateway.register(input)
          if (result.requiresEmailConfirmation) {
            dispatch({ type: 'AUTH_ANONYMOUS' })
          } else {
            const session = await authGateway.currentUser()
            dispatch(
              session
                ? { type: 'AUTHENTICATED', payload: session }
                : { type: 'AUTH_ANONYMOUS' },
            )
          }
          return result
        } catch (error) {
          dispatch({
            type: 'AUTH_ANONYMOUS',
            payload: authenticationError(error),
          })
          throw error
        }
      },
      refreshSession: async () => {
        const session = await authGateway.currentUser()
        dispatch(
          session
            ? { type: 'AUTHENTICATED', payload: session }
            : { type: 'AUTH_ANONYMOUS' },
        )
        return session
      },
      selectWorkspace: async (workspaceId) => {
        const workspace = state.availableWorkspaces.find(
          ({ id }) => id === workspaceId,
        )
        if (!workspace) throw new Error('Marca não encontrada ou sem acesso.')
        dispatch({
          type: 'SELECT_WORKSPACE',
          payload: { workspace, brand: workspace.brand },
        })
      },
      createWorkspace: async (nextBrand) => {
        if (!repository.createWorkspace)
          throw new Error('Criação de marca indisponível.')
        try {
          const created = await repository.createWorkspace(nextBrand)
          dispatch({
            type: 'WORKSPACES_LOADED',
            payload: [...state.availableWorkspaces, created],
          })
          dispatch({
            type: 'SELECT_WORKSPACE',
            payload: { workspace: created, brand: created.brand },
          })
          return created
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      saveBrand: async (brand) => {
        if (!state.currentWorkspace) throw new Error('Nenhum workspace ativo.')
        try {
          const savedBrand = await repository.saveBrand(
            state.currentWorkspace.id,
            brand,
            billingWorkspaceIdFor(state) ?? undefined,
          )
          dispatch({ type: 'SAVE_BRAND', payload: savedBrand })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      addDraft: (draft) =>
        trackDraftMutation(async () => {
          if (!state.currentWorkspace)
            throw new Error('Nenhum workspace ativo.')
          try {
            const createdDraft = await repository.createDraft(
              state.currentWorkspace.id,
              draft,
              billingWorkspaceIdFor(state) ?? undefined,
            )
            dispatch({ type: 'ADD_DRAFT', payload: createdDraft })
          } catch (error) {
            dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
            throw error
          }
        }),
      addDraftForWorkspace: (workspaceId, draft) =>
        trackDraftMutation(async () => {
          try {
            const createdDraft = await repository.createDraft(
              workspaceId,
              draft,
              billingWorkspaceIdFor(state) ?? undefined,
            )
            if (state.currentWorkspace?.id === workspaceId)
              dispatch({ type: 'ADD_DRAFT', payload: createdDraft })
          } catch (error) {
            dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
            throw error
          }
        }),
      addDraftsForWorkspace: (workspaceId, drafts, billingWorkspaceId) =>
        trackDraftMutation(async () => {
          try {
            const createdDrafts = repository.createDrafts
              ? await repository.createDrafts(
                  workspaceId,
                  drafts,
                  billingWorkspaceId ??
                    billingWorkspaceIdFor(state) ??
                    undefined,
                )
              : await Promise.all(
                  drafts.map((draft) =>
                    repository.createDraft(
                      workspaceId,
                      draft,
                      billingWorkspaceId ??
                        billingWorkspaceIdFor(state) ??
                        undefined,
                    ),
                  ),
                )
            if (state.currentWorkspace?.id === workspaceId)
              dispatch({ type: 'ADD_DRAFTS', payload: createdDrafts })
            return createdDrafts
          } catch (error) {
            dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
            throw error
          }
        }),
      addDrafts: (drafts) =>
        trackDraftMutation(async () => {
          if (!state.currentWorkspace)
            throw new Error('Nenhum workspace ativo.')
          try {
            const createdDrafts = repository.createDrafts
              ? await repository.createDrafts(
                  state.currentWorkspace.id,
                  drafts,
                  billingWorkspaceIdFor(state) ?? undefined,
                )
              : await Promise.all(
                  drafts.map((draft) =>
                    repository.createDraft(
                      state.currentWorkspace!.id,
                      draft,
                      billingWorkspaceIdFor(state) ?? undefined,
                    ),
                  ),
                )
            dispatch({ type: 'ADD_DRAFTS', payload: createdDrafts })
            return createdDrafts
          } catch (error) {
            dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
            throw error
          }
        }),
      refreshDraftImageUrl: async (draftId) => {
        const workspaceId = state.currentWorkspace?.id
        if (!workspaceId || !repository.refreshDraftImageUrl) return null
        const imageUrl = await repository.refreshDraftImageUrl(
          workspaceId,
          draftId,
          billingWorkspaceIdFor(state) ?? undefined,
        )
        if (imageUrl) {
          const draft = state.drafts.find((item) => item.id === draftId)
          if (draft) {
            dispatch({
              type: 'UPDATE_DRAFT',
              payload: { ...draft, imageUrl, imageAvailable: true },
            })
          }
        }
        return imageUrl
      },
      saveDraftImage: (
        draftId,
        imageUrl,
        requestedWorkspaceId,
        billingWorkspaceId,
      ) =>
        trackDraftMutation(async () => {
          const workspaceId = requestedWorkspaceId ?? state.currentWorkspace?.id
          if (!workspaceId || !repository.saveDraftImage) {
            throw new Error('Não foi possível salvar a imagem neste workspace.')
          }
          try {
            const updatedDraft = await repository.saveDraftImage(
              workspaceId,
              draftId,
              imageUrl,
              billingWorkspaceId ?? billingWorkspaceIdFor(state) ?? undefined,
            )
            if (state.currentWorkspace?.id === workspaceId) {
              dispatch({ type: 'UPDATE_DRAFT', payload: updatedDraft })
            }
            return updatedDraft
          } catch (error) {
            dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
            throw error
          }
        }),
      updateDraft: (draft) =>
        trackDraftMutation(async () => {
          if (!state.currentWorkspace)
            throw new Error('Nenhum workspace ativo.')
          try {
            const updatedDraft = await repository.updateDraft(
              state.currentWorkspace.id,
              draft,
              billingWorkspaceIdFor(state) ?? undefined,
            )
            dispatch({ type: 'UPDATE_DRAFT', payload: updatedDraft })
          } catch (error) {
            // Regras de negócio (400/409) são mostradas no diálogo; não devem
            // derrubar o indicador global de conexão.
            const isBusinessRule =
              error instanceof ApiError &&
              (error.status === 400 || error.status === 409)
            if (!isBusinessRule) {
              dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
            }
            throw error
          }
        }),
      refreshDrafts: async () => {
        const workspace = state.currentWorkspace
        if (!workspace || state.databaseStatus !== 'connected') return
        if (draftMutations.current.inflight > 0) return
        const startedAt = draftMutations.current.started
        const billingWorkspaceId = billingWorkspaceIdFor(state) ?? undefined
        if (!billingWorkspaceId && state.platformRole !== 'platform_owner') {
          return
        }
        try {
          const data = await repository.load(workspace.id, billingWorkspaceId)
          // Descarta a resposta se o usuário mudou de marca ou alterou posts
          // enquanto a listagem estava a caminho (evita sobrescrever dados novos).
          if (
            currentWorkspaceIdRef.current !== workspace.id ||
            draftMutations.current.inflight > 0 ||
            draftMutations.current.started !== startedAt
          ) {
            return
          }
          dispatch({ type: 'REFRESH_DRAFTS', payload: data.drafts })
        } catch {
          // A atualização automática é silenciosa; a próxima tentativa corrige.
        }
      },
      removeDraft: (id) =>
        trackDraftMutation(async () => {
          if (!state.currentWorkspace)
            throw new Error('Nenhum workspace ativo.')
          try {
            await repository.deleteDraft(
              state.currentWorkspace.id,
              id,
              billingWorkspaceIdFor(state) ?? undefined,
            )
            dispatch({ type: 'REMOVE_DRAFT', payload: id })
          } catch (error) {
            dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
            throw error
          }
        }),
    }
  }, [authGateway, repository, state])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useApp deve ser usado dentro de AppProvider')
  }

  return context
}
