import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Plus, RefreshCcw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

type TodoistProject = {
  id: string;
  name: string;
  color?: string | null;
};

type TodoistSection = {
  id: string;
  name: string;
};

type TodoistTask = {
  id: string;
  content: string;
  project_id: string;
  section_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
  description: string | null;
  priority: number | null;
  due: string | null;
  created_at: string | null;
  url: string | null;
};

type TodoistSnapshot = {
  ok: boolean;
  project: TodoistProject;
  sections: TodoistSection[];
  tasks: TodoistTask[];
  synced_at: string;
};

const POLL_INTERVAL_MS = 45_000;

const formatTime = (value: string | null) => {
  if (!value) return 'okänd tid';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const IntranetTodoist: React.FC = () => {
  const { session } = useAuthStore();
  const accessToken = session?.access_token || '';
  const [snapshot, setSnapshot] = useState<TodoistSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskSectionId, setNewTaskSectionId] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);

  const fetchSnapshot = useCallback(
    async (silent = false) => {
      if (!accessToken) return;

      if (!silent) setIsLoading(true);
      if (silent) setIsRefreshing(true);
      setError(null);

      try {
        const response = await fetch('/api/todoist-staff-sync', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || `Kunde inte hämta Todoist-data (${response.status})`);
        }

        const data = (await response.json()) as TodoistSnapshot;
        setSnapshot(data);
      } catch (requestError: any) {
        setError(requestError?.message || 'Kunde inte hämta Todoist-data.');
      } finally {
        if (!silent) setIsLoading(false);
        if (silent) setIsRefreshing(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    fetchSnapshot(false);
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!accessToken) return;
    const interval = window.setInterval(() => {
      fetchSnapshot(true).catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [accessToken, fetchSnapshot]);

  const runAction = useCallback(
    async (busyKey: string, actionPayload: Record<string, unknown>) => {
      if (!accessToken) return;
      setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
      setError(null);
      try {
        const response = await fetch('/api/todoist-staff-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            ...actionPayload,
            include_snapshot: true,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || `Todoist-åtgärd misslyckades (${response.status})`);
        }

        const data = (await response.json()) as Partial<TodoistSnapshot> & { ok: boolean };
        if (data?.project && data?.sections && data?.tasks && data?.synced_at) {
          setSnapshot(data as TodoistSnapshot);
        } else {
          await fetchSnapshot(true);
        }
      } catch (actionError: any) {
        setError(actionError?.message || 'Todoist-åtgärd misslyckades.');
      } finally {
        setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
      }
    },
    [accessToken, fetchSnapshot]
  );

  const handleCreateTask = async () => {
    const content = newTaskContent.trim();
    if (!content) return;
    await runAction('create_task', {
      action: 'create_task',
      content,
      section_id: newTaskSectionId || null,
      project_id: snapshot?.project?.id || '',
    });
    setNewTaskContent('');
  };

  const handleToggleTask = async (task: TodoistTask) => {
    await runAction(`toggle:${task.id}`, {
      action: 'toggle_task_completion',
      id: task.id,
      completed: !task.is_completed,
    });
  };

  const handleMoveSection = async (taskId: string, sectionId: string) => {
    await runAction(`move:${taskId}`, {
      action: 'move_task_to_section',
      id: taskId,
      section_id: sectionId,
    });
  };

  const handleRenameTask = async (task: TodoistTask) => {
    const updatedContent = window.prompt('Uppdatera uppgift', task.content);
    if (!updatedContent) return;
    const trimmed = updatedContent.trim();
    if (!trimmed || trimmed === task.content) return;
    await runAction(`update:${task.id}`, {
      action: 'update_task',
      id: task.id,
      content: trimmed,
    });
  };

  const groupedOpenTasks = useMemo(() => {
    const sections = snapshot?.sections || [];
    const openTasks = (snapshot?.tasks || []).filter((task) => !task.is_completed);

    const sectionGroups = sections.map((section) => ({
      id: section.id,
      name: section.name,
      tasks: openTasks.filter((task) => task.section_id === section.id),
    }));

    const unsectionedTasks = openTasks.filter((task) => !task.section_id);
    return {
      sectionGroups,
      unsectionedTasks,
    };
  }, [snapshot?.sections, snapshot?.tasks]);

  const completedTasks = useMemo(
    () => (snapshot?.tasks || []).filter((task) => task.is_completed),
    [snapshot?.tasks]
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        <div className="rounded-3xl border border-[#D7D0C5] bg-white p-8 flex items-center justify-center gap-3 text-[#3D3D3D]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-semibold">Laddar Todoist-spegel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-6">
      <section className="rounded-3xl border border-[#D7D0C5] bg-white p-6 md:p-8 shadow-[0_18px_45px_rgba(61,61,61,0.06)]">
        <div className="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.24em] uppercase text-[#7C6F61]">Staff + Manager</p>
            <h1 className="text-2xl md:text-3xl font-black text-[#111111] mt-1">Todoist: {snapshot?.project?.name || 'Ärenden'}</h1>
            <p className="text-sm text-[#514A43] mt-2">
              Live-spegel av projektet och sektionerna i Todoist. Kryss i Todoist uppdateras här via polling, och ändringar här skrivs tillbaka direkt.
            </p>
            <p className="text-xs font-semibold text-[#7C6F61] mt-2">
              Senast synkad: {formatTime(snapshot?.synced_at || null)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchSnapshot(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-[#3D3D3D] text-white px-4 py-2.5 text-sm font-bold hover:bg-[#272727] disabled:opacity-60"
          >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-[#F4C6C6] bg-[#FFF5F5] px-4 py-3 text-sm font-semibold text-[#9B2C2C]">
            {error}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[#D7D0C5] bg-white p-6 md:p-8">
        <p className="text-xs font-black tracking-[0.22em] uppercase text-[#7C6F61]">Ny uppgift</p>
        <div className="mt-3 grid md:grid-cols-[1fr_260px_auto] gap-3">
          <input
            value={newTaskContent}
            onChange={(event) => setNewTaskContent(event.target.value)}
            placeholder="Skriv ny Todoist-uppgift..."
            className="rounded-xl border border-[#D8D2C8] px-4 py-3 text-sm font-medium text-[#1F1F1F] bg-white"
          />
          <select
            value={newTaskSectionId}
            onChange={(event) => setNewTaskSectionId(event.target.value)}
            className="rounded-xl border border-[#D8D2C8] px-4 py-3 text-sm font-medium text-[#1F1F1F] bg-white"
          >
            <option value="">Utan sektion</option>
            {(snapshot?.sections || []).map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateTask}
            disabled={!newTaskContent.trim() || !!actionBusy.create_task}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#A0C81D] text-[#223300] px-4 py-3 text-sm font-black disabled:opacity-60"
          >
            {actionBusy.create_task ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Skapa
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-[#D7D0C5] bg-white p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black tracking-[0.22em] uppercase text-[#7C6F61]">Öppna uppgifter</p>
          <div className="text-sm font-semibold text-[#514A43]">
            {(snapshot?.tasks || []).filter((task) => !task.is_completed).length} aktiva
          </div>
        </div>

        {groupedOpenTasks.sectionGroups.map((group) => (
          <div key={group.id} className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#111111]">{group.name}</h2>
            {group.tasks.length === 0 ? (
              <div className="text-sm text-[#6B6158]">Inga aktiva uppgifter i sektionen.</div>
            ) : (
              <div className="space-y-2">
                {group.tasks.map((task) => (
                  <article key={task.id} className="rounded-2xl border border-[#E5DED2] bg-[#FAF8F4] p-4">
                    <div className="flex flex-wrap gap-3 items-start justify-between">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        disabled={!!actionBusy[`toggle:${task.id}`]}
                        className="inline-flex items-start gap-2 text-left flex-1 min-w-[220px]"
                      >
                        <Circle className="w-5 h-5 text-[#3D3D3D] mt-0.5" />
                        <span className="text-sm font-semibold text-[#111111]">{task.content}</span>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleRenameTask(task)}
                          disabled={!!actionBusy[`update:${task.id}`]}
                          className="rounded-lg border border-[#D7D0C5] px-3 py-1.5 text-xs font-bold text-[#3D3D3D] bg-white"
                        >
                          Redigera
                        </button>
                        <select
                          value={task.section_id || ''}
                          onChange={(event) => {
                            const nextSectionId = event.target.value;
                            if (!nextSectionId || nextSectionId === task.section_id) return;
                            handleMoveSection(task.id, nextSectionId);
                          }}
                          disabled={!!actionBusy[`move:${task.id}`]}
                          className="rounded-lg border border-[#D7D0C5] px-3 py-1.5 text-xs font-bold text-[#3D3D3D] bg-white"
                        >
                          <option value="">Välj sektion...</option>
                          {(snapshot?.sections || []).map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#111111]">Utan sektion</h2>
          {groupedOpenTasks.unsectionedTasks.length === 0 ? (
            <div className="text-sm text-[#6B6158]">Inga osorterade uppgifter.</div>
          ) : (
            <div className="space-y-2">
              {groupedOpenTasks.unsectionedTasks.map((task) => (
                <article key={task.id} className="rounded-2xl border border-[#E5DED2] bg-[#FAF8F4] p-4">
                  <div className="flex flex-wrap gap-3 items-start justify-between">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      disabled={!!actionBusy[`toggle:${task.id}`]}
                      className="inline-flex items-start gap-2 text-left flex-1 min-w-[220px]"
                    >
                      <Circle className="w-5 h-5 text-[#3D3D3D] mt-0.5" />
                      <span className="text-sm font-semibold text-[#111111]">{task.content}</span>
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleRenameTask(task)}
                        disabled={!!actionBusy[`update:${task.id}`]}
                        className="rounded-lg border border-[#D7D0C5] px-3 py-1.5 text-xs font-bold text-[#3D3D3D] bg-white"
                      >
                        Redigera
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-[#D7D0C5] bg-white p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black tracking-[0.22em] uppercase text-[#7C6F61]">Klara uppgifter</p>
          <button
            type="button"
            onClick={() => setShowCompleted((prev) => !prev)}
            className="text-xs font-black uppercase tracking-[0.14em] text-[#3D3D3D]"
          >
            {showCompleted ? 'Dölj' : 'Visa'}
          </button>
        </div>
        {showCompleted && (
          <div className="space-y-2">
            {completedTasks.length === 0 && <div className="text-sm text-[#6B6158]">Inga klara uppgifter i intervallet.</div>}
            {completedTasks.map((task) => (
              <article key={task.id} className="rounded-2xl border border-[#E5DED2] bg-[#F7F8F4] p-4">
                <button
                  type="button"
                  onClick={() => handleToggleTask(task)}
                  disabled={!!actionBusy[`toggle:${task.id}`]}
                  className="inline-flex items-start gap-2 text-left w-full"
                >
                  <CheckCircle2 className="w-5 h-5 text-[#5D8A13] mt-0.5" />
                  <span className="text-sm font-semibold text-[#2D2D2D] line-through decoration-[#7C6F61]/70">{task.content}</span>
                </button>
                <p className="text-xs text-[#7C6F61] mt-2">Klarmarkerad: {formatTime(task.completed_at)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
