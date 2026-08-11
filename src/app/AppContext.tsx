import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { AppState, BrandProfile, PostDraft } from '../domain/models'
import { AppStorage } from '../services/appStorage'

type AppAction =
  | { type: 'SET_SESSION'; payload: boolean }
  | { type: 'SAVE_BRAND'; payload: BrandProfile }
  | { type: 'ADD_DRAFT'; payload: PostDraft }
  | { type: 'UPDATE_DRAFT'; payload: PostDraft }
  | { type: 'REMOVE_DRAFT'; payload: string }

interface AppContextValue extends AppState {
  login: () => void
  logout: () => void
  saveBrand: (brand: BrandProfile) => void
  addDraft: (draft: PostDraft) => void
  updateDraft: (draft: PostDraft) => void
  removeDraft: (id: string) => void
}

function createInitialState(): AppState {
  return {
    isAuthenticated: AppStorage.loadSession(),
    brand: AppStorage.loadBrand(),
    drafts: AppStorage.loadDrafts(),
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, isAuthenticated: action.payload }
    case 'SAVE_BRAND':
      return { ...state, brand: action.payload }
    case 'ADD_DRAFT':
      return { ...state, drafts: [...state.drafts, action.payload] }
    case 'UPDATE_DRAFT':
      return {
        ...state,
        drafts: state.drafts.map((draft) =>
          draft.id === action.payload.id ? action.payload : draft,
        ),
      }
    case 'REMOVE_DRAFT':
      return {
        ...state,
        drafts: state.drafts.filter((draft) => draft.id !== action.payload),
      }
  }
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    createInitialState,
  )

  useEffect(() => {
    AppStorage.saveSession(state.isAuthenticated)
  }, [state.isAuthenticated])

  useEffect(() => {
    if (state.brand) {
      AppStorage.saveBrand(state.brand)
    }
  }, [state.brand])

  useEffect(() => {
    AppStorage.saveDrafts(state.drafts)
  }, [state.drafts])

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      login: () => dispatch({ type: 'SET_SESSION', payload: true }),
      logout: () => dispatch({ type: 'SET_SESSION', payload: false }),
      saveBrand: (brand) => dispatch({ type: 'SAVE_BRAND', payload: brand }),
      addDraft: (draft) => dispatch({ type: 'ADD_DRAFT', payload: draft }),
      updateDraft: (draft) =>
        dispatch({ type: 'UPDATE_DRAFT', payload: draft }),
      removeDraft: (id) => dispatch({ type: 'REMOVE_DRAFT', payload: id }),
    }),
    [state],
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
