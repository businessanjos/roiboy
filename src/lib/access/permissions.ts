// Permission constants live outside hooks/config to avoid circular imports.
export const PERMISSIONS = {
  CLIENTS_VIEW: "clients.view",
  CLIENTS_EDIT: "clients.edit",
  CLIENTS_DELETE: "clients.delete",
  TEAM_VIEW: "team.view",
  TEAM_EDIT: "team.edit",
  TEAM_EDIT_CX: "team.edit_cx",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",
  REPORTS_VIEW: "reports.view",
  EVENTS_VIEW: "events.view",
  EVENTS_EDIT: "events.edit",
  FORMS_VIEW: "forms.view",
  FORMS_EDIT: "forms.edit",
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_EDIT: "products.edit",
  ROYZAPP_ACCESS: "royzapp.access",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];