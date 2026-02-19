import React from 'react';
import { FileText } from 'lucide-react';
import changelog from '../data/changelog.json';

type ChangelogEntry = {
  id: string;
  date: string;
  range: string | null;
  head: string;
  commit_count: number;
  commits: { hash: string; subject: string }[];
  files_changed: string[];
  stats: { files: number; insertions: number; deletions: number };
  title?: string;
  notes?: string;
  flows?: {
    name: string;
    entry_points: string[];
    steps: string[];
  }[];
};

type ChangelogData = {
  last_commit: string | null;
  entries: ChangelogEntry[];
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });

export const Changelog: React.FC = () => {
  const data = changelog as ChangelogData;

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-24 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-12%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[520px] h-[520px] bg-cyan-500/5 rounded-full blur-[110px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-[#E8F1D5]/80 backdrop-blur-xl rounded-[2.6rem] p-8 md:p-12 border border-[#E6E1D8] shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Systemlogg</p>
              <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] tracking-tight">Changelog</h1>
            </div>
          </div>

          <p className="text-[#6B6158] text-sm max-w-2xl">
            Samlad ändringslogg som uppdateras automatiskt vid push till GitHub.
          </p>

          <div className="mt-8 space-y-6">
            {data.entries.length === 0 ? (
              <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-6 text-sm text-[#8A8177]">
                Inga ändringar registrerade ännu.
              </div>
            ) : (
              data.entries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">{formatDateTime(entry.date)}</div>
                      <div className="text-lg font-black text-[#3D3D3D]">{entry.title || `${entry.commit_count} commits`}</div>
                      {entry.notes && (
                        <div className="text-xs text-[#6B6158] mt-1">{entry.notes}</div>
                      )}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">
                      HEAD: {entry.head.slice(0, 7)}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#6B6158]">
                    <div className="rounded-xl border border-[#E6E1D8] bg-white/70 px-3 py-2">
                      Filer ändrade: <span className="font-bold text-[#3D3D3D]">{entry.stats.files}</span>
                    </div>
                    <div className="rounded-xl border border-[#E6E1D8] bg-white/70 px-3 py-2">
                      Ins: <span className="font-bold text-[#3D3D3D]">{entry.stats.insertions}</span>
                    </div>
                    <div className="rounded-xl border border-[#E6E1D8] bg-white/70 px-3 py-2">
                      Del: <span className="font-bold text-[#3D3D3D]">{entry.stats.deletions}</span>
                    </div>
                  </div>

                  {entry.flows && entry.flows.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-[#E6E1D8] bg-white/70 p-4 text-xs text-[#6B6158]">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Flöden</div>
                      <div className="space-y-4">
                        {entry.flows.map((flow) => (
                          <div key={`${entry.id}-${flow.name}`} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                            <div className="text-sm font-black text-[#3D3D3D]">{flow.name}</div>
                            <div className="mt-1 text-[11px] text-[#8A8177]">
                              Ingångar: {flow.entry_points.join(', ')}
                            </div>
                            <div className="mt-2 space-y-1">
                              {flow.steps.map((step, idx) => (
                                <div key={`${entry.id}-${flow.name}-${idx}`}>
                                  {idx + 1}. {step}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#6B6158]">
                    <div className="rounded-xl border border-[#E6E1D8] bg-white/70 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Commits</div>
                      <div className="space-y-2">
                        {entry.commits.map((commit) => (
                          <div key={`${entry.id}-${commit.hash}`} className="flex items-start gap-2">
                            <span className="text-[#8A8177] font-bold">{commit.hash}</span>
                            <span>{commit.subject}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E6E1D8] bg-white/70 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Filer</div>
                      <div className="space-y-1">
                        {entry.files_changed.length === 0 ? (
                          <div>Inga filer listade.</div>
                        ) : (
                          entry.files_changed.map((file) => (
                            <div key={`${entry.id}-${file}`}>{file}</div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
