import type { ReactNode } from 'react'

// 线性图标，统一 24 网格、1.8 线宽，颜色跟随 currentColor
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const svg = (d: ReactNode) => () => <svg viewBox="0 0 24 24" {...P} aria-hidden="true">{d}</svg>

export const IconBook = svg(<><path d="M4 18.5V5.5A2.5 2.5 0 0 1 6.5 3H20v13H6.5A2.5 2.5 0 0 0 4 18.5z" /><path d="M4 18.5A2.5 2.5 0 0 0 6.5 21H20v-5" /><path d="M8 8h8M8 12h5" /></>)
export const IconPulse = svg(<><path d="M3 12h4l2-5 4 10 2-5h6" /></>)
export const IconChat = svg(<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>)
export const IconCamera = svg(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>)
export const IconList = svg(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>)
export const IconSpark = svg(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>)
export const IconAlert = svg(<><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17v.5" /></>)
export const IconGift = svg(<><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 4s0 4 4 4zm0 0s1.5-5 4-4 0 4-4 4z" /></>)
export const IconPin = svg(<><path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>)
export const IconDownload = svg(<><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></>)
export const IconCheck = svg(<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>)
export const IconBack = svg(<path d="m15 5-7 7 7 7" />)
export const IconArrow = svg(<path d="m9 5 7 7-7 7" />)
