export const PUBLISH_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  PRIVATE: 'PRIVATE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type PublishStatus = typeof PUBLISH_STATUS[keyof typeof PUBLISH_STATUS];

export const PUBLISH_STATUS_LABELS = {
  [PUBLISH_STATUS.DRAFT]: 'Черновик',
  [PUBLISH_STATUS.PUBLISHED]: 'Опубликован',
  [PUBLISH_STATUS.PRIVATE]: 'Приватный',
  [PUBLISH_STATUS.ARCHIVED]: 'Архивный',
} as const;

export const PUBLISH_STATUS_DESCRIPTIONS = {
  [PUBLISH_STATUS.DRAFT]: 'В работе, не виден пользователям',
  [PUBLISH_STATUS.PUBLISHED]: 'Опубликован и виден пользователям',
  [PUBLISH_STATUS.PRIVATE]: 'Готов, но скрыт от пользователей',
  [PUBLISH_STATUS.ARCHIVED]: 'Архивная запись, не отображается',
} as const;

export const PUBLIC_STATUSES = [PUBLISH_STATUS.PUBLISHED] as const;
export const ADMIN_VISIBLE_STATUSES = [
  PUBLISH_STATUS.DRAFT,
  PUBLISH_STATUS.PUBLISHED,
  PUBLISH_STATUS.PRIVATE,
  PUBLISH_STATUS.ARCHIVED,
] as const;