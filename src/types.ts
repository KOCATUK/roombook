export type Equipment = 'projector' | 'whiteboard' | 'videoConference'

export interface Room {
  id: string
  name: string
  floor: number
  /** Вместимость, человек */
  capacity: number
  equipment: Equipment[]
  /** Комната занята прямо сейчас */
  isOccupied: boolean
}
