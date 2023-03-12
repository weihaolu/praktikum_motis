
import { XYChart, BarSeries, Axis, Tooltip } from "@visx/xychart";
import React, { ReactNode, useContext, useState } from 'react';
import { PatternLines } from '@visx/pattern';
import { DataContext } from '@visx/xychart';
const patternId = 'xy-chart-pattern';
const accessors = {
    xAccessor: (d: any) => d.x,
    yAccessor: (d: any) => d.y,
};
const barSeriesKey = 'capacityIncrease';
const animationTrajectory = 'center';
function CustomChartBackground() {
    const { theme, margin, width, height, innerWidth, innerHeight } = useContext(DataContext);

    // early return values not available in context
    if (width == null || height == null || margin == null || theme == null) return null;

    return (
        <>
            <PatternLines
                id={patternId}
                width={16}
                height={16}
                orientation={['diagonal']}
                stroke={theme?.gridStyles?.stroke || ''}
                strokeWidth={1}
            />
            <rect x={0} y={0} width={width} height={height} fill={theme?.backgroundColor ?? '#fff'} />
            <rect
                x={margin.left}
                y={margin.top}
                width={innerWidth}
                height={innerHeight}
                fill={`url(#${patternId})`}
                fillOpacity={0.3}
            />
        </>
    );
}

interface CapacityChartProps {
    data: { x: string, y: number }[],
    width: number,
    height: number,
}
export const CpacityChart: React.FC<CapacityChartProps> = ({ data, width, height }) => {
    return (
        <XYChart
            xScale={{ type: 'band' }}
            yScale={{ type: 'linear' }}
            height={height}
            width={width}
        >
            <CustomChartBackground></CustomChartBackground>
            <BarSeries
                dataKey={barSeriesKey}
                data={data}
                xAccessor={accessors.xAccessor}
                yAccessor={accessors.yAccessor}
            />
            <Axis
                key={`time-axis-${animationTrajectory}-${false}`}
                orientation="bottom"
                numTicks={data.length}
                label="Auslastungserhöhung in %"
            />
            <Axis
                key={`temp-axis-${animationTrajectory}-${false}`}
                orientation="left"
                numTicks={4}
                label="Anzahl der Erhöhungen"
            />
            <Tooltip
                showVerticalCrosshair={true}
                snapTooltipToDatumX={true}
                snapTooltipToDatumY={true}
                // showDatumGlyph={true}
                showSeriesGlyphs={true}
                renderTooltip={({ tooltipData }) => {
                    const datum = tooltipData?.datumByKey[barSeriesKey]?.datum;
                    return (
                        <>
                            {accessors.yAccessor(datum)} Auslastungserhöhung von {accessors.xAccessor(datum)}%
                        </>
                    )
                }}
            />

        </XYChart>)




}

