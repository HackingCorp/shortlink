'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface LineChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  tooltipLabel?: string;
  strokeColor?: string;
}

export function LineChartComponent({
  data,
  xKey,
  yKey,
  xAxisLabel,
  yAxisLabel,
  tooltipLabel = 'Valeur',
  strokeColor = '#8884d8',
}: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Aucune donnée disponible</p>
      </div>
    );
  }

  // Formater les données pour le graphique
  const formatXAxis = (tick: string) => {
    if (!tick) return '';
    const date = new Date(tick);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  // Formater les tooltips
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-sm">
          <p className="font-medium">{formatXAxis(label)}</p>
          <p className="text-sm">
            {tooltipLabel}: <span className="font-semibold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 20,
          left: yAxisLabel ? -10 : -30,
          bottom: xAxisLabel ? 15 : 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey={xKey}
          tickFormatter={formatXAxis}
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          height={40}
          label={xAxisLabel ? {
            value: xAxisLabel,
            position: 'insideBottom',
            offset: -10,
            fontSize: 12,
          } : undefined}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          label={yAxisLabel ? {
            value: yAxisLabel,
            angle: -90,
            position: 'insideLeft',
            offset: 10,
            fontSize: 12,
          } : undefined}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={strokeColor}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
