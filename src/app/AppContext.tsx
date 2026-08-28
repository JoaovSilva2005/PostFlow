import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { AppState, BrandProfile, PostDraft } from '../domain/models'
import {
  SupabasePostFlowRepository,
  type PostFlowDataRepository,
} from '../services/postFlowRepository'
import { SessionStorage } from '../services/sessionStorage'

type AppAction =
  | { type: 'SET_SESSION'; payload: boolean }
  | {
      type: 'DATABASE_CONNECTED'
      payload: { brand: BrandProfile | null; drafts: PostDraft[] }
    }
  | { type: 'DATABASE_ERROR'; payload: string }
  | { type: 'SAVE_BRAND'; payload: BrandProfile }
  | { type: 'ADD_DRAFT'; payload: PostDraft }
  | { type: 'UPDATE_DRAFT'; payload: PostDraft }
  | { type: 'REMOVE_DRAFT'; payload: string }

interface AppContextValue extends AppState {
  login: () => void
  logout: () => void
  saveBrand: (brand: BrandProfile) => Promise<void>
  addDraft: (draft: PostDraft) => Promise<void>
  updateDraft: (draft: PostDraft) => Promise<void>
  removeDraft: (id: string) => Promise<void>
}

interface AppProviderProps {
  children: ReactNode
  repository?: PostFlowDataRepository
}

function createInitialState(): AppState {
  return {
    isAuthenticated: SessionStorage.load(),
    brand: null,
    drafts: [],
    databaseStatus: 'connecting',
    databaseError: null,
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, isAuthenticated: action.payload }
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
      return { ...state, brand: action.payload, databaseError: null }
    case 'ADD_DRAFT':
      return {
        ...state,
        drafts: [...state.drafts, action.payload],
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

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({
  children,
  repository = SupabasePostFlowRepository,
}: AppProviderProps) {
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    createInitialState,
  )

  useEffect(() => {
    let isActive = true

    repository
      .load()
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
  }, [repository])

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      login: () => {
        SessionStorage.save(true)
        dispatch({ type: 'SET_SESSION', payload: true })
      },
      logout: () => {
        SessionStorage.save(false)
        dispatch({ type: 'SET_SESSION', payload: false })
      },
      saveBrand: async (brand) => {
        try {
          const savedBrand = await repository.saveBrand(brand)
          dispatch({ type: 'SAVE_BRAND', payload: savedBrand })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      addDraft: async (draft) => {
        try {
          const createdDraft = await repository.createDraft(draft)
          dispatch({ type: 'ADD_DRAFT', payload: createdDraft })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      updateDraft: async (draft) => {
        try {
          const updatedDraft = await repository.updateDraft(draft)
          dispatch({ type: 'UPDATE_DRAFT', payload: updatedDraft })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
      removeDraft: async (id) => {
        try {
          await repository.deleteDraft(id)
          dispatch({ type: 'REMOVE_DRAFT', payload: id })
        } catch (error) {
          dispatch({ type: 'DATABASE_ERROR', payload: errorMessage(error) })
          throw error
        }
      },
    }),
    [repository, state],
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
