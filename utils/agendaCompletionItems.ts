type InsertPayload = {
  user_id: string;
  report_date: string;
  task_id: string;
  completed_at: string;
  completed_by: string;
  source: 'staff' | 'manager';
};

type CompletionAction =
  | { type: 'insert'; payload: InsertPayload }
  | { type: 'delete'; selector: { user_id: string; report_date: string; task_id: string } };

type Input = {
  wasChecked: boolean;
  userId: string;
  reportDate: string;
  taskId: string;
  source?: 'staff' | 'manager';
};

export const buildCompletionItemAction = (input: Input): CompletionAction => {
  if (input.wasChecked) {
    return {
      type: 'delete',
      selector: { user_id: input.userId, report_date: input.reportDate, task_id: input.taskId }
    };
  }

  return {
    type: 'insert',
    payload: {
      user_id: input.userId,
      report_date: input.reportDate,
      task_id: input.taskId,
      completed_at: new Date().toISOString(),
      completed_by: input.userId,
      source: input.source ?? 'staff'
    }
  };
};
