import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  Flame,
  Activity,
  ShieldCheck,
  Maximize2,
  Info,
  Sparkles,
} from 'lucide-react';
import { SAMetricPoint } from '../../../optimization/simulatedAnnealing/types';
import { cn } from '../../../lib/utils';

interface SAConvergenceChartProps {
  metrics: SAMetricPoint[];
  title?: string;
  subtitle?: string;
  initialCost?: number;
  finalCost?: number;
  runtimeMs?: number;
}

export const SAConvergenceChart: React.FC<SAConvergenceChartProps> = ({
  metrics,
  title = 'Kurva Konvergensi Simulated Annealing',
  subtitle = 'Visualisasi penurunan fungsi objektif (cost), temperatur pendinginan, dan eliminasi bentrok keras',
  initialCost,
  finalCost,
  runtimeMs,
}) => {
  const [activeTab, setActiveTab] = useState<'COST' | 'TEMPERATURE' | 'ACCEPTANCE' | 'CONFLICTS'>('COST');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const dataPoints = useMemo(() => {
    if (!metrics || metrics.length === 0) return [];
    return metrics;
  }, [metrics]);

  // Chart dimensions & scaling
  const width = 800;
  const height = 280;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const n = dataPoints.length;

  // Compute domains based on active tab
  const domain = useMemo(() => {
    if (n === 0) return { minY: 0, maxY: 100, minX: 0, maxX: 100 };

    const minX = dataPoints[0].iteration;
    const maxX = dataPoints[n - 1].iteration || 1;

    let minY = 0;
    let maxY = 100;

    if (activeTab === 'COST') {
      const allCosts = dataPoints.flatMap((d) => [d.currentCost, d.bestCost]);
      minY = 0;
      maxY = Math.max(...allCosts, 100);
    } else if (activeTab === 'TEMPERATURE') {
      const allTemps = dataPoints.map((d) => d.temperature);
      minY = 0;
      maxY = Math.max(...allTemps, 1);
    } else if (activeTab === 'ACCEPTANCE') {
      minY = 0;
      maxY = 100;
    } else if (activeTab === 'CONFLICTS') {
      const allHC = dataPoints.map((d) => d.hardConflictsCount);
      minY = 0;
      maxY = Math.max(...allHC, 5);
    }

    return { minY, maxY: maxY * 1.05, minX, maxX };
  }, [dataPoints, activeTab, n]);

  // Point to SVG coordinate mapping
  const getX = (iter: number) => {
    if (domain.maxX === domain.minX) return padLeft;
    return padLeft + ((iter - domain.minX) / (domain.maxX - domain.minX)) * chartW;
  };

  const getY = (val: number) => {
    if (domain.maxY === domain.minY) return padTop + chartH / 2;
    const ratio = (val - domain.minY) / (domain.maxY - domain.minY);
    return padTop + chartH - ratio * chartH;
  };

  // Generate SVG Path definitions
  const bestCostPath = useMemo(() => {
    if (n === 0) return '';
    return dataPoints
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.iteration).toFixed(1)} ${getY(d.bestCost).toFixed(1)}`)
      .join(' ');
  }, [dataPoints, domain]);

  const currentCostPath = useMemo(() => {
    if (n === 0) return '';
    return dataPoints
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.iteration).toFixed(1)} ${getY(d.currentCost).toFixed(1)}`)
      .join(' ');
  }, [dataPoints, domain]);

  const bestCostAreaPath = useMemo(() => {
    if (n === 0) return '';
    const baseLineY = padTop + chartH;
    const line = dataPoints
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.iteration).toFixed(1)} ${getY(d.bestCost).toFixed(1)}`)
      .join(' ');
    const firstX = getX(dataPoints[0].iteration).toFixed(1);
    const lastX = getX(dataPoints[n - 1].iteration).toFixed(1);
    return `${line} L ${lastX} ${baseLineY} L ${firstX} ${baseLineY} Z`;
  }, [dataPoints, domain]);

  const tempPath = useMemo(() => {
    if (n === 0) return '';
    return dataPoints
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.iteration).toFixed(1)} ${getY(d.temperature).toFixed(1)}`)
      .join(' ');
  }, [dataPoints, domain]);

  const conflictsPath = useMemo(() => {
    if (n === 0) return '';
    return dataPoints
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.iteration).toFixed(1)} ${getY(d.hardConflictsCount).toFixed(1)}`)
      .join(' ');
  }, [dataPoints, domain]);

  const acceptancePath = useMemo(() => {
    if (n === 0) return '';
    return dataPoints
      .map((d, i) => {
        const rate = d.iteration > 0 ? (d.acceptedMoves / d.iteration) * 100 : 100;
        return `${i === 0 ? 'M' : 'L'} ${getX(d.iteration).toFixed(1)} ${getY(rate).toFixed(1)}`;
      })
      .join(' ');
  }, [dataPoints, domain]);

  // Y-Axis Ticks
  const yTicks = useMemo(() => {
    const ticks = [];
    const count = 5;
    for (let i = 0; i <= count; i++) {
      const val = domain.minY + (i / count) * (domain.maxY - domain.minY);
      ticks.push({
        val,
        y: getY(val),
        label:
          activeTab === 'TEMPERATURE'
            ? val.toFixed(1)
            : activeTab === 'ACCEPTANCE'
            ? `${Math.round(val)}%`
            : val >= 1000
            ? `${(val / 1000).toFixed(1)}k`
            : Math.round(val).toString(),
      });
    }
    return ticks;
  }, [domain, activeTab]);

  // X-Axis Ticks
  const xTicks = useMemo(() => {
    const ticks = [];
    const count = 5;
    for (let i = 0; i <= count; i++) {
      const iter = Math.round(domain.minX + (i / count) * (domain.maxX - domain.minX));
      ticks.push({
        iter,
        x: getX(iter),
        label: `${iter.toLocaleString()}`,
      });
    }
    return ticks;
  }, [domain]);

  const hoveredPoint = hoverIndex !== null && dataPoints[hoverIndex] ? dataPoints[hoverIndex] : null;

  if (n === 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center">
        <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-pulse" />
        <p className="text-sm font-semibold text-slate-700">Belum Ada Data Metrik Konvergensi</p>
        <p className="text-xs text-slate-500 mt-1">
          Jalankan eksperimen Simulated Annealing untuk merekam data kurva konvergensi secara real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {runtimeMs !== undefined && (
              <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Runtime: {runtimeMs} ms
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('COST')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              activeTab === 'COST'
                ? 'bg-white text-blue-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Objective Cost
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CONFLICTS')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              activeTab === 'CONFLICTS'
                ? 'bg-white text-rose-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Hard Conflicts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TEMPERATURE')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              activeTab === 'TEMPERATURE'
                ? 'bg-white text-amber-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Flame className="w-3.5 h-3.5" />
            Temperatur (T)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ACCEPTANCE')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              activeTab === 'ACCEPTANCE'
                ? 'bg-white text-emerald-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            Acceptance Rate
          </button>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * width;
            if (mouseX >= padLeft && mouseX <= width - padRight) {
              const ratio = (mouseX - padLeft) / chartW;
              const targetIter = domain.minX + ratio * (domain.maxX - domain.minX);
              // Find closest data point
              let closestIdx = 0;
              let minDiff = Infinity;
              dataPoints.forEach((d, idx) => {
                const diff = Math.abs(d.iteration - targetIter);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestIdx = idx;
                }
              });
              setHoverIndex(closestIdx);
            } else {
              setHoverIndex(null);
            }
          }}
        >
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {yTicks.map((t, idx) => (
            <g key={`y-${idx}`}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={width - padRight}
                y2={t.y}
                stroke="#f1f5f9"
                strokeDasharray={idx === 0 ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={t.y + 3.5}
                fill="#94a3b8"
                fontSize="10"
                textAnchor="end"
                fontFamily="system-ui"
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Grid lines (vertical) */}
          {xTicks.map((t, idx) => (
            <g key={`x-${idx}`}>
              <line
                x1={t.x}
                y1={padTop}
                x2={t.x}
                y2={padTop + chartH}
                stroke="#f8fafc"
                strokeWidth="1"
              />
              <text
                x={t.x}
                y={padTop + chartH + 18}
                fill="#94a3b8"
                fontSize="10"
                textAnchor="middle"
                fontFamily="system-ui"
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Active Curves Rendering */}
          {activeTab === 'COST' && (
            <>
              {/* Current Cost (Stochastic Search exploration) */}
              <path
                d={currentCostPath}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1"
                strokeOpacity="0.5"
                strokeDasharray="2 2"
              />
              {/* Best Cost Area Fill */}
              <path d={bestCostAreaPath} fill="url(#costGradient)" />
              {/* Best Cost Line */}
              <path
                d={bestCostPath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {activeTab === 'TEMPERATURE' && (
            <path
              d={tempPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {activeTab === 'CONFLICTS' && (
            <path
              d={conflictsPath}
              fill="none"
              stroke="#e11d48"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {activeTab === 'ACCEPTANCE' && (
            <path
              d={acceptancePath}
              fill="none"
              stroke="#059669"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover Crosshair & Dot */}
          {hoveredPoint && (
            <g>
              <line
                x1={getX(hoveredPoint.iteration)}
                y1={padTop}
                x2={getX(hoveredPoint.iteration)}
                y2={padTop + chartH}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={getX(hoveredPoint.iteration)}
                cy={
                  activeTab === 'COST'
                    ? getY(hoveredPoint.bestCost)
                    : activeTab === 'TEMPERATURE'
                    ? getY(hoveredPoint.temperature)
                    : activeTab === 'CONFLICTS'
                    ? getY(hoveredPoint.hardConflictsCount)
                    : getY(
                        hoveredPoint.iteration > 0
                          ? (hoveredPoint.acceptedMoves / hoveredPoint.iteration) * 100
                          : 100
                      )
                }
                r="5"
                fill={
                  activeTab === 'COST'
                    ? '#2563eb'
                    : activeTab === 'TEMPERATURE'
                    ? '#f59e0b'
                    : activeTab === 'CONFLICTS'
                    ? '#e11d48'
                    : '#059669'
                }
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Axis Labels */}
          <text
            x={width / 2}
            y={height - 5}
            fill="#64748b"
            fontSize="10.5"
            textAnchor="middle"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            Iterasi (Iteration Count)
          </text>
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute top-2 right-4 bg-slate-900/90 text-white rounded-xl px-3 py-2 text-xs shadow-lg backdrop-blur-xs pointer-events-none z-10 border border-slate-700/50"
          >
            <div className="font-bold text-blue-300 border-b border-slate-700 pb-1 mb-1">
              Iterasi: {hoveredPoint.iteration.toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-2xs">
              <span className="text-slate-400">Best Cost:</span>
              <span className="font-semibold text-right">{Math.round(hoveredPoint.bestCost).toLocaleString()}</span>

              <span className="text-slate-400">Current Cost:</span>
              <span className="font-semibold text-right">{Math.round(hoveredPoint.currentCost).toLocaleString()}</span>

              <span className="text-slate-400">Temperatur (T):</span>
              <span className="font-semibold text-right">{hoveredPoint.temperature.toFixed(4)}</span>

              <span className="text-slate-400">Hard Conflict:</span>
              <span className={cn('font-semibold text-right', hoveredPoint.hardConflictsCount === 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {hoveredPoint.hardConflictsCount}
              </span>

              <span className="text-slate-400">Accepted Moves:</span>
              <span className="font-semibold text-right">{hoveredPoint.acceptedMoves.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend & Summary Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          {activeTab === 'COST' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                <span className="text-slate-600 font-medium">Solusi Terbaik Global (Best Solution)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-slate-400 inline-block border-t border-dashed border-slate-400" />
                <span className="text-slate-500 font-medium">Fluktuasi Pencarian Metropolis</span>
              </div>
            </>
          )}

          {activeTab === 'CONFLICTS' && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" />
              <span className="text-slate-600 font-medium">Pelanggaran Hard Constraint (0 = Feasible)</span>
            </div>
          )}

          {activeTab === 'TEMPERATURE' && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="text-slate-600 font-medium">Penurunan Suhu Eksponensial (T_k = T_0 * alpha^k)</span>
            </div>
          )}

          {activeTab === 'ACCEPTANCE' && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
              <span className="text-slate-600 font-medium">Rasio Penerimaan Solusi Baru (%)</span>
            </div>
          )}
        </div>

        {initialCost !== undefined && finalCost !== undefined && (
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span>Awal: {initialCost.toLocaleString()}</span>
            <span>→</span>
            <span className="text-blue-600">Akhir: {finalCost.toLocaleString()}</span>
            {initialCost > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-3xs font-black">
                ↓ {Math.round(((initialCost - finalCost) / initialCost) * 100 * 10) / 10}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
