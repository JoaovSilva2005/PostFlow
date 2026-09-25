import { HttpError } from '../shared/HttpError.js'
import type {
  ContentQuotaService,
  ContentQuotaUnits,
} from '../modules/content/contentQuota.js'

interface Reservation {
  workspaceId: string
  units: ContentQuotaUnits
}

export class InMemoryContentQuotaService implements ContentQuotaService {
  private readonly textLimit: number
  private readonly imageLimit: number
  private sequence = 0
  private readonly reservations = new Map<string, Reservation>()
  private readonly usage = new Map<
    string,
    { text: number; image: number; textReserved: number; imageReserved: number }
  >()

  constructor(limits = { text: 100, image: 30 }) {
    this.textLimit = limits.text
    this.imageLimit = limits.image
  }

  async reserve(workspaceId: string, units: ContentQuotaUnits) {
    const usage = this.usage.get(workspaceId) ?? {
      text: 0,
      image: 0,
      textReserved: 0,
      imageReserved: 0,
    }

    if (usage.text + usage.textReserved + units.text > this.textLimit) {
      throw new HttpError(429, 'Limite de textos atingido.')
    }
    if (usage.image + usage.imageReserved + units.image > this.imageLimit) {
      throw new HttpError(429, 'Limite de imagens atingido.')
    }

    usage.textReserved += units.text
    usage.imageReserved += units.image
    this.usage.set(workspaceId, usage)
    const reservationId = `reservation-${++this.sequence}`
    this.reservations.set(reservationId, { workspaceId, units })
    return reservationId
  }

  async settle(reservationId: string, succeeded: boolean) {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) throw new Error('Reserva desconhecida.')

    const usage = this.usage.get(reservation.workspaceId)!
    usage.textReserved -= reservation.units.text
    usage.imageReserved -= reservation.units.image
    if (succeeded) {
      usage.text += reservation.units.text
      usage.image += reservation.units.image
    }
    this.reservations.delete(reservationId)
  }

  getUsage(workspaceId = 'test-workspace') {
    return (
      this.usage.get(workspaceId) ?? {
        text: 0,
        image: 0,
        textReserved: 0,
        imageReserved: 0,
      }
    )
  }
}
