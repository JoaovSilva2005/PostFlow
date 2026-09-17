export type SubscriptionStatus =
  'trialing' | 'active' | 'past_due' | 'cancelled'
export type InvoiceStatus = 'pending' | 'paid' | 'void'

export interface PlanLimits {
  text: number
  image: number
}

export interface BillingPlan {
  id: string
  code: string
  name: string
  price: number
  limits: PlanLimits
}

export interface SubscriptionSummary {
  id: string
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
}

export interface UsageSummary {
  period: string
  textUsed: number
  imageUsed: number
}

export interface AcademicReceipt {
  reference: string
  taxRate: number
  taxAmount: number
  netAmount: number
  issuedAt: string
  legalValidity: 'academic_only'
}

export interface BillingInvoice {
  id: string
  number: string
  amount: number
  status: InvoiceStatus
  dueDate: string
  paidAt: string | null
  receipt: AcademicReceipt | null
}

export interface BillingOverview {
  workspaceId: string
  demoMode: boolean
  plan: BillingPlan | null
  subscription: SubscriptionSummary | null
  usage: UsageSummary
}
