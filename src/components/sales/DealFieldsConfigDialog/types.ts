export interface FieldConfig {
  id: string;
  name: string;
  field_type: string;
  show_in_deals: boolean;
  display_order: number;
  folder_id: string | null;
}

export interface FolderConfig {
  id: string;
  name: string;
  display_order: number;
  is_expanded: boolean;
}

export interface DragItem {
  id: string;
  type: "field" | "folder";
}
