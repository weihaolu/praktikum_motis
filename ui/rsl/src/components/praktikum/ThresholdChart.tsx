import { Group } from '@visx/group';
import { curveBasis } from '@visx/curve';
import { LinePath } from '@visx/shape';
import { Threshold } from '@visx/threshold';
import { scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { DistThresholdData } from './types';
export const background = 'white';

// scales
const defaultMargin = { top: 40, right: 30, bottom: 50, left: 40 };
const x = (d: any) => d.x;
const y1 = (d: any) => d.y1;
const y2 = (d: any) => d.y2;

type ThresholdProps = {
  width: number;
  height: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  thresholdDataArray: DistThresholdData[];
  xLabel: string;
  yLabel: string;
};

function Legend() {
  return <div className="legend">
    <div className="legend-item">
      <svg width="40" height="20">
        <line x1="0" y1="10" x2="40" y2="10" stroke="#000" strokeWidth="2" strokeDasharray="0" />
      </svg>
      <span className="legend-label">Vor den Ausfällen</span>
    </div>
    <div className="legend-item">
      <svg width="40" height="20">
        <line x1="0" y1="10" x2="40" y2="10" stroke="#000" strokeWidth="2" strokeDasharray="4,4" />
      </svg>
      <span className="legend-label">Nach den Ausfällen</span>
    </div>
  </div>
}

export function ThresholdChart({ width, height, margin = defaultMargin, thresholdDataArray, xLabel, yLabel }: ThresholdProps) {
  if (width < 10) return null;

  // bounds
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;
  const xDomain = [Math.min(...thresholdDataArray.map(x)), Math.max(...thresholdDataArray.map(x))];
  const yDomain = [
    Math.min(...thresholdDataArray.map((d) => Math.min(y1(d), y2(d)))),
    Math.max(...thresholdDataArray.map((d) => Math.max(y1(d), y2(d)))),
  ];
  const xScale = scaleLinear<number>({
    domain: xDomain,
    nice: true,
  });

  const yScale = scaleLinear<number>({
    domain: yDomain,
    nice: true,
  });
  xScale.range([0, xMax]);
  yScale.range([yMax, 0]);

  return (
    <div>
      <svg width={width} height={height}>
        <rect x={0} y={0} width={width} height={height} fill={background} />
        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={xMax} height={yMax} stroke="#e0e0e0" />
          <GridColumns scale={xScale} width={xMax} height={yMax} stroke="#e0e0e0" />
          <line x1={xMax} x2={xMax} y1={0} y2={yMax} stroke="#e0e0e0" />
          <AxisBottom top={yMax} scale={xScale} numTicks={width > 520 ? 10 : 5} label={xLabel} />
          <AxisLeft scale={yScale} numTicks={width > 520 ? 10 : 5} />
          <text x="0" y="-10" fontSize={10}>
            {yLabel}
          </text>
          <Threshold<DistThresholdData>
            id={`${Math.random()}`}
            data={thresholdDataArray}
            x={(d) => xScale(x(d)) ?? 0}
            y0={(d) => yScale(y1(d)) ?? 0}
            y1={(d) => yScale(y2(d)) ?? 0}
            clipAboveTo={0}
            clipBelowTo={yMax}
            curve={curveBasis}
            belowAreaProps={{
              fill: 'violet',
              fillOpacity: 0.4,
            }}
            aboveAreaProps={{
              fill: 'green',
              fillOpacity: 0.4,
            }}
          />
          <LinePath
            data={thresholdDataArray}
            curve={curveBasis}
            x={(d) => xScale(x(d)) ?? 0}
            y={(d) => yScale(y2(d)) ?? 0}
            stroke="#222"
            strokeWidth={1.5}
            strokeOpacity={0.8}
            strokeDasharray="1,2"
          />
          <LinePath
            data={thresholdDataArray}
            curve={curveBasis}
            x={(d) => xScale(x(d)) ?? 0}
            y={(d) => yScale(y1(d)) ?? 0}
            stroke="#222"
            strokeWidth={1.5}
          />
        </Group>
      </svg>
      <Legend></Legend>
    </div>
  );
}
