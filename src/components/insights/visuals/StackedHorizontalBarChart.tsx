import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";
import { FormatType, AppearanceConfig, COLOR_PALETTES, FONT_SCALE_MULTIPLIERS, DEFAULT_APPEARANCE } from "../visual-builder/types";
import { formatValueCompact } from "@/lib/formula-evaluator";
import { StackedDataPoint } from "@/hooks/useStackedVisualData";

interface StackedHorizontalBarChartProps {
  data: StackedDataPoint[];
  seriesKeys: string[];
  formatting: {
    type: FormatType;
    decimals: number;
  };
  appearance: AppearanceConfig;
  orientation?: 'horizontal' | 'vertical';
}

function getChartColors(palette: AppearanceConfig['colorPalette'] = 'professional'): string[] {
  const extended = [
    ...(COLOR_PALETTES[palette] || COLOR_PALETTES.professional),
    '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16',
    '#14b8a6', '#f43f5e', '#a855f7', '#eab308', '#6366f1',
  ];
  return extended;
}

const CustomTooltip = ({ active, payload, label, formatting, singleSeries }: any) => {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {!singleSeries && payload.map((entry: any, index: number) => (
        entry.value > 0 && (
          <div key={index} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">
              {formatValueCompact(entry.value, formatting.type)}
            </span>
          </div>
        )
      ))}
      <div className={`${singleSeries ? '' : 'border-t border-border mt-1 pt-1'} font-medium`}>
        {singleSeries ? '' : 'Total: '}{formatValueCompact(total, formatting.type)}
      </div>
    </div>
  );
};

const renderInsideLabel = (props: any, formatting: { type: FormatType }, fontMultiplier: number) => {
  const { x, y, width, height, value } = props;
  const minWidth = 35;
  const minHeight = 14;
  if (!value || value === 0 || width < minWidth || height < minHeight) return null;

  const baseFontSize = Math.round(10 * fontMultiplier);
  const effectiveFontSize = Math.min(baseFontSize, height - 2);

  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="white"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={effectiveFontSize}
      fontWeight={600}
    >
      {formatValueCompact(value, formatting.type)}
    </text>
  );
};

export function StackedHorizontalBarChart({
  data,
  seriesKeys,
  formatting,
  appearance,
  orientation = 'horizontal',
}: StackedHorizontalBarChartProps) {
  const safeFormatting = formatting || { type: 'number' as FormatType, decimals: 0 };
  const safeAppearance = appearance || DEFAULT_APPEARANCE;
  const colors = getChartColors(safeAppearance.colorPalette);
  const m = FONT_SCALE_MULTIPLIERS[safeAppearance.fontScale || 'normal'];

  if (!data || data.length === 0 || seriesKeys.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const isVertical = orientation === 'vertical';

  if (isVertical) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: Math.round(11 * m) }}
            className="text-muted-foreground"
            interval={0}
          />
          <YAxis
            tickFormatter={(value) => formatValueCompact(value, formatting.type)}
            tick={{ fontSize: Math.round(11 * m) }}
            className="text-muted-foreground"
          />
          <Tooltip content={<CustomTooltip formatting={safeFormatting} singleSeries={seriesKeys.length <= 1} />} />
          {seriesKeys.length >= 1 && (
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: Math.round(12 * m) }}
            />
          )}
          {seriesKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="stack"
              fill={colors[index % colors.length]}
              radius={index === seriesKeys.length - 1 ? [4, 4, 0, 0] : undefined}
            >
              {safeAppearance.showDataLabels && (
                <LabelList
                  dataKey={key}
                  content={(props: any) => renderInsideLabel(props, safeFormatting, m)}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Horizontal layout (original)
  const barHeight = 32;
  const minHeight = 300;
  const calculatedHeight = Math.max(minHeight, data.length * barHeight + 80);

  return (
    <ResponsiveContainer width="100%" height={calculatedHeight}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(value) => formatValueCompact(value, formatting.type)}
          tick={{ fontSize: Math.round(11 * m) }}
          className="text-muted-foreground"
        />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: Math.round(11 * m) }}
          className="text-muted-foreground"
          width={90}
          interval={0}
        />
        <Tooltip content={<CustomTooltip formatting={safeFormatting} singleSeries={seriesKeys.length <= 1} />} />
        {seriesKeys.length >= 1 && (
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: Math.round(12 * m) }}
          />
        )}
        {seriesKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="stack"
            fill={colors[index % colors.length]}
            radius={index === seriesKeys.length - 1 ? [0, 4, 4, 0] : undefined}
          >
            {safeAppearance.showDataLabels && (
              <LabelList
                dataKey={key}
                content={(props: any) => renderInsideLabel(props, safeFormatting, m)}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
