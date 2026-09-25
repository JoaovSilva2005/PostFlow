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

type AppAction =
  | { type: 'AUTH_CHECKING' }
  | { type: 'AUTHENTICATED'; payload: AuthSession }
  | { type: 'AUTH_ANONYMOUS'; payload?: string }
  | { type: 'WORKSPACES_LOADED'; payload: BrandWorkspace[] }
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
  | { type: 'REMOVE_DRAFT'; payload: string }

interface AppContextValue extends AppState {
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
  ) => Promise<PostDraft[]>
  refreshDraftImageUrl: (draftId: string) => Promise<string | null>
  saveDraftImage: (draftId: string, imageUrl: string) => Promise<PostDraft>
  updateDraft: (draft: PostDraft) => Promise<void>
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
        currentWorkspace: action.payload.workspace,
        availableWorkspaces: [],
        platformRole: action.payload.platformRole,
        billingStatus: action.payload.billingStatus,
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
        platformRole: null,
        billingStatus: 'none',
        isAuthenticated: false,
      }
    case 'WORKSPACES_LOADED': {
      const active = state.currentWorkspace
        ? action.payload.find(({ id }) => id === state.currentWorkspace?.id)
        : null
      return {
        ...state,
        availableWorkspaces: action.payload,
        brand: active?.brand ?? state.brand,
        billingStatus: active?.billingStatus ?? state.billingStatus,
      }
    }
    case 'SELECT_WORKSPACE':
      return {
        ...state,
        currentWorkspace: action.payload.workspace,
        billingStatus: action.payload.workspace.billingStatus,
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
    case 'REMOVE_DRAFT':
      return {
        ...state,
        drafts: state.drafts.filter((draft) => draft.id !== action.payload),
        databaseError: null,
      }
  }
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
    if (state.authStatus !== 'authenticated' || !repository.listWorkspaces) {
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
        if (isActive)
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
      })
    return () => {
      isActive = false
    }
  }, [repository, state.authStatus])

  useEffect(() => {
    let isActive = true

    if (state.authStatus !== 'authenticated') {
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

    const hasActivePlan =
      state.billingStatus === 'active' || state.billingStatus === 'trialing'
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
      .load(state.currentWorkspace.id)
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
    state.platformRole,
  ])

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
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
          )
          dispatch({ type: 'SAVE_BRAND', payload: savedBrand })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      addDraft: async (draft) => {
        if (!state.currentWorkspace) throw new Error('Nenhum workspace ativo.')
        try {
          const createdDraft = await repository.createDraft(
            state.currentWorkspace.id,
            draft,
          )
          dispatch({ type: 'ADD_DRAFT', payload: createdDraft })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      addDraftForWorkspace: async (workspaceId, draft) => {
        try {
          const createdDraft = await repository.createDraft(workspaceId, draft)
          if (state.currentWorkspace?.id === workspaceId)
            dispatch({ type: 'ADD_DRAFT', payload: createdDraft })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      addDraftsForWorkspace: async (workspaceId, drafts) => {
        try {
          const createdDrafts = repository.createDrafts
            ? await repository.createDrafts(workspaceId, drafts)
            : await Promise.all(
                drafts.map((draft) =>
                  repository.createDraft(workspaceId, draft),
                ),
              )
          if (state.currentWorkspace?.id === workspaceId)
            dispatch({ type: 'ADD_DRAFTS', payload: createdDrafts })
          return createdDrafts
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      addDrafts: async (drafts) => {
        if (!state.currentWorkspace) throw new Error('Nenhum workspace ativo.')
        try {
          const createdDrafts = repository.createDrafts
            ? await repository.createDrafts(state.currentWorkspace.id, drafts)
            : await Promise.all(
                drafts.map((draft) =>
                  repository.createDraft(state.currentWorkspace!.id, draft),
                ),
              )
          dispatch({ type: 'ADD_DRAFTS', payload: createdDrafts })
          return createdDrafts
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      refreshDraftImageUrl: async (draftId) => {
        const workspaceId = state.currentWorkspace?.id
        if (!workspaceId || !repository.refreshDraftImageUrl) return null
        const imageUrl = await repository.refreshDraftImageUrl(
          workspaceId,
          draftId,
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
      saveDraftImage: async (draftId, imageUrl) => {
        const workspaceId = state.currentWorkspace?.id
        if (!workspaceId || !repository.saveDraftImage) {
          throw new Error('Não foi possível salvar a imagem neste workspace.')
        }
        try {
          const updatedDraft = await repository.saveDraftImage(
            workspaceId,
            draftId,
            imageUrl,
          )
          dispatch({ type: 'UPDATE_DRAFT', payload: updatedDraft })
          return updatedDraft
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      updateDraft: async (draft) => {
        if (!state.currentWorkspace) throw new Error('Nenhum workspace ativo.')
        try {
          const updatedDraft = await repository.updateDraft(
            state.currentWorkspace.id,
            draft,
          )
          dispatch({ type: 'UPDATE_DRAFT', payload: updatedDraft })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      removeDraft: async (id) => {
        if (!state.currentWorkspace) throw new Error('Nenhum workspace ativo.')
        try {
          await repository.deleteDraft(state.currentWorkspace.id, id)
          dispatch({ type: 'REMOVE_DRAFT', payload: id })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
    }),
    [authGateway, repository, state],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useApp deve ser usado dentro de AppProvider')
  }

  return context
}
