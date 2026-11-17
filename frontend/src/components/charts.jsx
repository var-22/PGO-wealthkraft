import { useEffect, useId, useMemo, useRef, useState } from "react";
import { date as fmtDate } from "../format.js";

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function niceTicks(min, max, count = 3) {
  if (min === max) return [min];
  const step = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= step) || step;
  const ticks = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max + nice * 1e-6; v += nice) ticks.push(v);
  return ticks;
}

/**
 * A line chart over time. `series` is [{ name, color, points: [{ date, y }] }] sharing one date axis
 * and one y-scale; the first series may be drawn with a soft area under it. Dragging or hovering
 * shows a crosshair and the values on that date.
 */
export function LineChart({ series, height = 180, format, area = false, zeroLine = false, label, onActive, tip = true, endDot = false, endLabels = false }) {
  const [ref, width] = useWidth();
  const [active, setActiveIndex] = useState(null);
  // `onActive` lets the screen around the chart show the touched date's figures itself.
  const setActive = (index) => {
    setActiveIndex(index);
    onActive?.(index);
  };
  const areaId = `area-${useId().replace(/:/g, "")}`; // one gradient per chart, so two charts never share a fill
  // The right gutter holds the value labels, so they never sit on top of the line.
  // With `endLabels`, the scale moves to the left and each line's latest value is badged on the right.
  const pad = endLabels ? { top: 16, right: 74, bottom: 24, left: 42 } : { top: 10, right: 54, bottom: 22, left: 4 };
  const tickX = endLabels ? pad.left - 8 : width;

  const model = useMemo(() => {
    const dates = series[0]?.points.map((p) => p.date) || [];
    const values = series.flatMap((s) => s.points.map((p) => p.y)).filter((v) => typeof v === "number");
    if (dates.length < 2 || !values.length || !width) return null;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (zeroLine) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
    const span = max - min || Math.abs(max) || 1;
    min -= span * 0.06;
    max += span * 0.06;
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const x = (i) => pad.left + (i / (dates.length - 1)) * innerW;
    const y = (v) => pad.top + (1 - (v - min) / (max - min)) * innerH;
    const paths = series.map((s) => {
      let d = "";
      let open = false;
      s.points.forEach((p, i) => {
        if (typeof p.y !== "number") {
          open = false;
          return;
        }
        d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`;
        open = true;
      });
      return d;
    });
    return { dates, x, y, paths, ticks: niceTicks(min, max).filter((t) => t > min && t < max), innerW, baseY: pad.top + innerH };
  }, [series, width, height, zeroLine, endLabels]);

  // The badges at the line ends, nudged apart when two lines finish close together.
  const badges = useMemo(() => {
    if (!endLabels || !model) return [];
    const list = series
      .map((s, i) => {
        let last = s.points.length - 1;
        while (last >= 0 && typeof s.points[last].y !== "number") last -= 1;
        return last < 0 ? null : { name: s.name, color: s.color, solid: i === 0, text: format(s.points[last].y), y: model.y(s.points[last].y) };
      })
      .filter(Boolean)
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i += 1) if (list[i].y - list[i - 1].y < 26) list[i].y = list[i - 1].y + 26;
    return list;
  }, [endLabels, model, series, format]);

  // Five evenly spaced dates along the bottom when the scale is on the left.
  const dateTicks = endLabels && model ? [0, 0.25, 0.5, 0.75, 1].map((k) => Math.round(k * (model.dates.length - 1))) : [];

  function move(event) {
    if (!model) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - pad.left) / model.innerW;
    setActive(Math.max(0, Math.min(model.dates.length - 1, Math.round(ratio * (model.dates.length - 1)))));
  }

  const first = model?.dates[0];
  const last = model?.dates[model.dates.length - 1];
  const flip = active !== null && model && model.x(active) > width / 2;

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {model && (
        <>
          <svg width={width} height={height} role="img" aria-label={label} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setActive(null)} onPointerCancel={() => setActive(null)} onPointerUp={(e) => e.pointerType !== "mouse" && setActive(null)}>
            <defs>
              <linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={series[0].color} stopOpacity="0.22" />
                <stop offset="1" stopColor={series[0].color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {model.ticks.map((t) => (
              <g key={t}>
                <line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={model.y(t)} y2={model.y(t)} />
                <text className="chart-tick" x={tickX} y={model.y(t) + 4} textAnchor="end">{format(t, true)}</text>
              </g>
            ))}
            {zeroLine && !model.ticks.includes(0) && <text className="chart-tick" x={tickX} y={model.y(0) + 4} textAnchor="end">{format(0, true)}</text>}
            {zeroLine && <line className="chart-zero" x1={pad.left} x2={width - pad.right} y1={model.y(0)} y2={model.y(0)} />}
            {area && <path d={`${model.paths[0]}L${model.x(model.dates.length - 1)},${model.baseY}L${model.x(0)},${model.baseY}Z`} fill={`url(#${areaId})`} className="chart-area" />}
            {series.map((s, i) =>
              // A solid line draws itself in from the left; a dashed one keeps its dashes.
              s.dashed ? (
                <path key={s.name} d={model.paths[i]} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 4" />
              ) : (
                <path key={s.name} className="chart-line" pathLength="1" d={model.paths[i]} fill="none" stroke={s.color} strokeWidth="2.400" strokeLinejoin="round" strokeLinecap="round" />
              )
            )}
            {endDot && active === null && (() => {
              // A pulsing mark on the latest point of the first line.
              const pts = series[0].points;
              let last = pts.length - 1;
              while (last >= 0 && typeof pts[last].y !== "number") last -= 1;
              if (last < 0) return null;
              return (
                <g className="chart-end" style={{ color: series[0].color }}>
                  <circle className="chart-pulse" cx={model.x(last)} cy={model.y(pts[last].y)} r="5" fill="currentColor" />
                  <circle cx={model.x(last)} cy={model.y(pts[last].y)} r="4" fill="currentColor" />
                </g>
              );
            })()}
            {active !== null && (
              <>
                <line className="chart-cross" x1={model.x(active)} x2={model.x(active)} y1={pad.top} y2={model.baseY} />
                {series.map((s) =>
                  typeof s.points[active]?.y === "number" ? (
                    <circle key={s.name} className="chart-dot" cx={model.x(active)} cy={model.y(s.points[active].y)} r="4.5" fill={s.color} />
                  ) : null
                )}
              </>
            )}
            {active === null && badges.map((b) => (
              <g key={b.name} className="chart-badge" transform={`translate(${width - pad.right + 6}, ${b.y - 12})`}>
                <rect width={pad.right - 8} height="24" rx="8" fill={b.solid ? b.color : "var(--surface)"} stroke={b.color} strokeWidth="1.500" />
                <text x={(pad.right - 8) / 2} y="16.500" textAnchor="middle" fill={b.solid ? "#fff" : "var(--ink)"}>{b.text}</text>
              </g>
            ))}
            {endLabels ? (
              dateTicks.map((index, k) => (
                <text key={index} className="chart-tick" x={model.x(index)} y={height - 5} textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
                  {fmtDate(model.dates[index], { month: "short", year: "2-digit" }).replace(" ", " '")}
                </text>
              ))
            ) : (
              <>
                <text className="chart-tick" x={pad.left} y={height - 5}>{fmtDate(first, { month: "short", year: "numeric" })}</text>
                <text className="chart-tick" x={width - pad.right} y={height - 5} textAnchor="end">{fmtDate(last, { month: "short", year: "numeric" })}</text>
              </>
            )}
          </svg>
          {tip && active !== null && (
            <div className="chart-tip" style={flip ? { right: width - model.x(active) + 10 } : { left: model.x(active) + 10 }}>
              <div className="chart-tip-date">{fmtDate(model.dates[active])}</div>
              {series.map((s) => (
                <div key={s.name} className="chart-tip-row">
                  {series.length > 1 && <i style={{ background: s.color }} />}
                  {series.length > 1 && <span>{s.name}</span>}
                  <b>{typeof s.points[active]?.y === "number" ? format(s.points[active].y) : "—"}</b>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.name} className="legend-item">
          <i style={{ background: item.color }} className={item.dashed ? "dashed" : ""} />
          {item.name}
        </span>
      ))}
    </div>
  );
}

/** A tiny trend line for a list row: shape only, no axes. */
export function Sparkline({ points, width = 64, height = 26, className = "" }) {
  const values = points.map((p) => p.pct).filter((v) => typeof v === "number");
  if (values.length < 2) return <span className="spark-empty" style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join("");
  return (
    <svg className={`spark ${className}`} width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" strokeWidth="1.600" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Categorical slots, assigned in this fixed order and never reused; anything past six is "Other".
export const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];

export function toSlices(items) {
  const visible = items.slice(0, SLOTS.length).map((item, i) => ({ ...item, color: SLOTS[i] }));
  const rest = items.slice(SLOTS.length).reduce((sum, item) => sum + item.pct, 0);
  return rest > 0 ? [...visible, { name: "Other", pct: rest, color: "var(--series-other)" }] : visible;
}

export function Donut({ slices, size = 148, centerTop, centerBottom, active, onActive, label = "Allocation by category" }) {
  const r = size / 2 - 11;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((sum, s) => sum + s.pct, 0) || 1;
  const gap = slices.length > 1 ? 2.5 : 0;
  let offset = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={label}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((s) => {
            const length = (s.pct / total) * c;
            const dash = Math.max(length - gap, 0.5);
            const el = (
              <circle
                key={s.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={active === s.name ? 20 : 15}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                opacity={active && active !== s.name ? 0.35 : 1}
                onPointerEnter={() => onActive?.(s.name)}
                onPointerLeave={() => onActive?.(null)}
                onClick={() => onActive?.(active === s.name ? null : s.name)}
              />
            );
            offset += length;
            return el;
          })}
        </g>
      </svg>
      <div className="donut-center">
        <b>{centerTop}</b>
        <span>{centerBottom}</span>
      </div>
    </div>
  );
}
