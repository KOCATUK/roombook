import type { Room } from '../types'

export const ROOMS: Room[] = [
  {
    id: 'baikal',
    name: 'Байкал',
    floor: 3,
    capacity: 8,
    equipment: ['projector', 'whiteboard', 'videoConference'],
  },
  {
    id: 'elbrus',
    name: 'Эльбрус',
    floor: 5,
    capacity: 4,
    equipment: ['whiteboard'],
  },
  {
    id: 'volga',
    name: 'Волга',
    floor: 2,
    capacity: 12,
    equipment: ['projector', 'videoConference'],
  },
]
