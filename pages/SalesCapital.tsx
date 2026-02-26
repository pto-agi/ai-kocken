import React, { useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Flame,
  Briefcase,
  Target,
  Sparkles,
  TrendingUp,
  Wallet
} from 'lucide-react';

const formatCurrency = (value: number) => (
  value.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' SEK'
);

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const monthLabels = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const monthlyValues = [
  420000, 455000, 498000, 512000, 538000, 565000, 601000, 588000, 624000, 671000, 642000, 708000
];

const SalesCapital: React.FC = () => {
  const monthSeries = useMemo(() => {
    const now = new Date();
    const series: Array<{ label: string; value: number }> = [];
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${monthLabels[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
      const value = monthlyValues[11 - i] ?? 0;
      series.push({ label, value });
    }
    return series;
  }, []);

  const currentMonth = monthSeries[monthSeries.length - 1]?.value || 0;
  const previousMonth = monthSeries[monthSeries.length - 2]?.value || 1;
  const growth = ((currentMonth - previousMonth) / previousMonth) * 100;

  const salesGoal = 780000;
  const goalProgress = Math.min(1, currentMonth / salesGoal);
  const cashCollected = 512000;
  const outstanding = 186000;
  const avgOrder = 13850;
  const conversion = 24.6;
  const newDeals = 46;

  const kpis = [
    {
      title: 'Månadens försäljning',
      value: formatCurrency(currentMonth),
      delta: formatPercent(growth),
      positive: growth >= 0,
      icon: TrendingUp
    },
    {
      title: 'Måluppfyllnad',
      value: formatPercent(goalProgress * 100),
      delta: `${formatCurrency(salesGoal)} mål`,
      positive: goalProgress >= 0.7,
      icon: Target
    },
    {
      title: 'Nya affärer',
      value: `${newDeals} st`,
      delta: '+8% volym',
      positive: true,
      icon: BadgeCheck
    },
    {
      title: 'Konvertering',
      value: formatPercent(conversion),
      delta: '+2.1% p',
      positive: true,
      icon: Sparkles
    },
    {
      title: 'Snittorder',
      value: formatCurrency(avgOrder),
      delta: '+6% värde',
      positive: true,
      icon: Briefcase
    },
    {
      title: 'Inbetalt',
      value: formatCurrency(cashCollected),
      delta: `${formatCurrency(outstanding)} kvar`,
      positive: cashCollected >= outstanding,
      icon: Wallet
    }
  ];

  const pipelineStages = [
    { label: 'Nya leads', value: 142, tone: 'bg-[#a0c81d]' },
    { label: 'Kvalade', value: 86, tone: 'bg-[#88b226]' },
    { label: 'Offert', value: 52, tone: 'bg-[#6f9a1f]' },
    { label: 'Förhandling', value: 28, tone: 'bg-[#5c7a12]' },
    { label: 'Vunna', value: 19, tone: 'bg-[#3d5b0c]' }
  ];

  const momentumNotes = [
    'Högsta månad hittills. Fortsätt hålla tempot i säljcykeln.',
    'Fler kvalade leads än plan → prioritera snabba avslut.',
    'Snittorder upp 6% – värdeargumenten biter.'
  ];

  const dailyMoves = [
    'Boka 3 kvalade möten innan lunch.',
    'Följ upp 10 heta leads med konkret nästa steg.',
    'Skicka 2 skarpa offertuppföljningar.',
    'Stäng 1 affär genom tydlig tidslinje.',
    'Planera morgondagens topp 3 säljmål.'
  ];

  const topDeals = [
    { name: 'Klientpaket Premium', value: 186000, trend: '+18%' },
    { name: 'Uppföljning 12v', value: 132000, trend: '+11%' },
    { name: 'Teamavtal företag', value: 98000, trend: '+6%' },
    { name: 'Kosttillskott bundle', value: 74000, trend: '+9%' },
    { name: 'VIP-Coaching', value: 61000, trend: '+4%' }
  ];

  const maxMonth = Math.max(...monthSeries.map((item) => item.value));

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-24 pt-24 px-4 md:px-8">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-15%] right-[-10%] w-[700px] h-[700px] bg-[#a0c81d]/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-none">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#a0c81d]/15 border border-[#a0c81d]/40 flex items-center justify-center text-[#5c7a12]">
                <BarChart3 className="w-6 h-6" />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Power Dashboard</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#3D3D3D]">Sälj & Kapital</h1>
            <p className="text-[#6B6158] mt-3 max-w-2xl">
              Full översikt över försäljning, momentum och kassaflöde. Driv beteenden som ökar intäkter och
              konvertering varje dag.
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-md border border-[#DAD1C5] rounded-2xl px-6 py-4 shadow-[0_16px_40px_rgba(61,61,61,0.12)]">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Månadsmål</p>
            <div className="mt-3 text-2xl font-black text-[#3D3D3D]">{formatCurrency(salesGoal)}</div>
            <div className="mt-2 h-2 rounded-full bg-[#F6F1E7]">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#a0c81d] to-[#5c7a12]"
                style={{ width: `${Math.round(goalProgress * 100)}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-[#6B6158]">{formatPercent(goalProgress * 100)} uppnått</div>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
          {kpis.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white/80 backdrop-blur-md border border-[#DAD1C5] rounded-2xl p-5 shadow-[0_16px_40px_rgba(61,61,61,0.12)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">
                    {item.title}
                  </span>
                  <span className="w-9 h-9 rounded-xl bg-[#a0c81d]/10 border border-[#a0c81d]/30 flex items-center justify-center text-[#5c7a12]">
                    <Icon className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-[#3D3D3D]">{item.value}</div>
                <div className={`mt-2 text-xs font-bold flex items-center gap-1 ${item.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {item.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {item.delta}
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[2.2fr,1fr] gap-6 mb-10">
          <div className="bg-white/80 backdrop-blur-md border border-[#DAD1C5] rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(61,61,61,0.14)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Månadsförsäljning</p>
                <h2 className="text-xl font-black text-[#3D3D3D]">Senaste 12 månaderna</h2>
              </div>
              <span className="text-xs text-[#6B6158]">Uppdaterad idag</span>
            </div>

            <div className="mt-6 flex items-end gap-3 h-52">
              {monthSeries.map((item) => {
                const height = Math.round((item.value / maxMonth) * 100);
                return (
                  <div key={item.label} className="flex flex-col items-center gap-2 flex-1">
                    <div
                      className="w-full rounded-2xl bg-gradient-to-t from-[#5c7a12] via-[#a0c81d] to-[#d7e7a3] shadow-[0_10px_25px_rgba(92,122,18,0.2)]"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Trend</p>
                <p className="mt-1 font-bold text-[#3D3D3D]">{formatPercent(growth)} mot föregående månad</p>
              </div>
              <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Högsta månad</p>
                <p className="mt-1 font-bold text-[#3D3D3D]">{formatCurrency(maxMonth)}</p>
              </div>
              <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Snitt</p>
                <p className="mt-1 font-bold text-[#3D3D3D]">
                  {formatCurrency(Math.round(monthSeries.reduce((sum, item) => sum + item.value, 0) / monthSeries.length))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-[#DAD1C5] rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(61,61,61,0.14)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Pipeline</p>
                <h2 className="text-xl font-black text-[#3D3D3D]">Aktiva steg</h2>
              </div>
              <span className="text-xs text-[#6B6158]">Totalt 327 leads</span>
            </div>

            <div className="mt-6 space-y-4">
              {pipelineStages.map((stage) => (
                <div key={stage.label}>
                  <div className="flex items-center justify-between text-xs font-bold text-[#6B6158]">
                    <span>{stage.label}</span>
                    <span>{stage.value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#F6F1E7]">
                    <div
                      className={`h-2 rounded-full ${stage.tone}`}
                      style={{ width: `${Math.min(100, stage.value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3 text-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Fokus nu</p>
              <p className="mt-1 font-semibold text-[#3D3D3D]">Flytta 10 offers till förhandling denna vecka.</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.4fr,1fr] gap-6 mb-10">
          <div className="bg-white/80 backdrop-blur-md border border-[#DAD1C5] rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(61,61,61,0.14)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Topplista</p>
                <h2 className="text-xl font-black text-[#3D3D3D]">Starkast intäktskällor</h2>
              </div>
              <span className="text-xs text-[#6B6158]">Hittills denna månad</span>
            </div>

            <div className="mt-6 space-y-3">
              {topDeals.map((deal) => (
                <div key={deal.name} className="flex items-center justify-between rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#3D3D3D]">{deal.name}</p>
                    <p className="text-xs text-[#8A8177]">{deal.trend} mot förra månaden</p>
                  </div>
                  <div className="text-sm font-black text-[#3D3D3D]">{formatCurrency(deal.value)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-[#DAD1C5] rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(61,61,61,0.14)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Motivation</p>
                <h2 className="text-xl font-black text-[#3D3D3D]">Momentum i teamet</h2>
              </div>
              <Flame className="w-5 h-5 text-[#a0c81d]" />
            </div>

            <div className="mt-6 space-y-3">
              {momentumNotes.map((note) => (
                <div key={note} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3 text-sm text-[#3D3D3D]">
                  {note}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-[#E6E1D8] bg-white px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Dagliga power moves</p>
              <ul className="mt-3 space-y-2 text-sm text-[#3D3D3D]">
                {dailyMoves.map((move) => (
                  <li key={move} className="flex items-start gap-2">
                    <span className="mt-1 w-2 h-2 rounded-full bg-[#a0c81d]" />
                    <span>{move}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-md border border-[#DAD1C5] rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(61,61,61,0.14)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Kapitalfokus</p>
                <h2 className="text-xl font-black text-[#3D3D3D]">Kassaflöde & trygghet</h2>
              </div>
              <Wallet className="w-5 h-5 text-[#5c7a12]" />
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Inbetalt</p>
                <p className="mt-1 text-lg font-black text-[#3D3D3D]">{formatCurrency(cashCollected)}</p>
              </div>
              <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Fakturor kvar</p>
                <p className="mt-1 text-lg font-black text-[#3D3D3D]">{formatCurrency(outstanding)}</p>
              </div>
              <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Runway</p>
                <p className="mt-1 text-lg font-black text-[#3D3D3D]">5.8 månader</p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-[#E6E1D8] bg-white px-4 py-3 text-sm text-[#3D3D3D]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Kapitalnotis</p>
              <p className="mt-2">Prioritera snabb fakturering på nya affärer för att öka cashflow +12% denna månad.</p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-[#DAD1C5] rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(61,61,61,0.14)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Team energy</p>
                <h2 className="text-xl font-black text-[#3D3D3D]">Säljtempo</h2>
              </div>
              <Flame className="w-5 h-5 text-[#a0c81d]" />
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Aktivitet idag</p>
                <p className="mt-1 text-lg font-black text-[#3D3D3D]">86% av dagsmål</p>
              </div>
              <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Streak</p>
                <p className="mt-1 text-lg font-black text-[#3D3D3D]">12 dagar i rad</p>
              </div>
              <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Power fokus</p>
                <p className="mt-1 text-lg font-black text-[#3D3D3D]">Snabba avslut</p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-[#E6E1D8] bg-white px-4 py-3 text-sm text-[#3D3D3D]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Coach-notis</p>
              <p className="mt-2">Håll timeboxing på uppföljningarna för att maximera avslut per timme.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export { SalesCapital };
