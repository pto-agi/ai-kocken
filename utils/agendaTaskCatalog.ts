type TemplateLite = {
  id: string;
  title: string;
  schedule_days: string[] | null;
  sort_order: number | null;
  input_type: string | null;
  estimated_minutes?: number | null;
};

type CustomTaskLite = {
  id: string;
  report_date: string;
  title: string;
  estimated_minutes: number | null;
  is_active: boolean;
};

type TaskRemovalLite = {
  user_id: string;
  report_date: string;
  task_id: string;
  is_removed: boolean;
};

export type AgendaCatalogItem = {
  id: string;
  title: string;
  inputType: 'none' | 'count' | 'text';
  sortOrder: number;
  count: null;
  estimatedMinutes: number | null;
};

export const buildAgendaItemsForDate = (input: {
  dateKey: string;
  dayCode: string;
  templates: TemplateLite[];
  customTasks: CustomTaskLite[];
  currentUserId?: string;
  removals?: TaskRemovalLite[];
}): AgendaCatalogItem[] => {
  const removalSet = new Set(
    (input.removals || [])
      .filter((row) => (
        row.is_removed &&
        row.report_date === input.dateKey &&
        (!input.currentUserId || row.user_id === input.currentUserId)
      ))
      .map((row) => row.task_id)
  );

  const templateItems: AgendaCatalogItem[] = input.templates
    .filter((template) => (template.schedule_days || []).includes(input.dayCode))
    .filter((template) => !removalSet.has(template.id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((template) => ({
      id: template.id,
      title: template.title,
      inputType: (template.input_type as AgendaCatalogItem['inputType']) || 'none',
      sortOrder: template.sort_order ?? 0,
      count: null,
      estimatedMinutes: template.estimated_minutes ?? null
    }));

  const customItems: AgendaCatalogItem[] = input.customTasks
    .filter((task) => task.is_active && task.report_date === input.dateKey)
    .map((task, index) => ({
      id: `custom:${task.id}`,
      title: task.title,
      inputType: 'none',
      sortOrder: 10000 + index,
      count: null,
      estimatedMinutes: task.estimated_minutes ?? null
    }));

  return [...templateItems, ...customItems];
};
