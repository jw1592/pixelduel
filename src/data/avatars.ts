export interface Avatar {
  id: string
  name: string
  path: string
}

export const AVATARS: Avatar[] = [
  { id: 'steve',      name: 'Steve',        path: '/avatars/steve.png' },
  { id: 'creeper1',   name: 'Creeper',      path: '/avatars/creeper1.png' },
  { id: 'creeper2',   name: 'Creeper Dark', path: '/avatars/creeper2.png' },
  { id: 'enderman',   name: 'Enderman',     path: '/avatars/enderman.png' },
  { id: 'spider',     name: 'Spider',       path: '/avatars/spider.png' },
  { id: 'pig',        name: 'Pig',          path: '/avatars/pig.png' },
  { id: 'cow',        name: 'Cow',          path: '/avatars/cow.png' },
  { id: 'sheep',      name: 'Sheep',        path: '/avatars/sheep.png' },
  { id: 'sheep-dyed', name: 'Blue Sheep',   path: '/avatars/sheep-dyed.png' },
  { id: 'zombie',     name: 'Zombie',       path: '/avatars/zombie.png' },
  { id: 'skeleton',   name: 'Skeleton',     path: '/avatars/skeleton.png' },
  { id: 'villager',   name: 'Villager',     path: '/avatars/villager.png' },
]
