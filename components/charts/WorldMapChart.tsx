'use client';

import React, { memo, useState, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { normalizeCountryName, groupClicksByCountry } from '@/lib/countryMappings';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface MapChartProps {
  data: { name: string; clicks: number }[];
}

const WorldMapChartComponent = ({ data }: MapChartProps) => {
  const [tooltip, setTooltip] = useState({ show: false, content: '', x: 0, y: 0 });
  
  // Créer une map des clics par pays normalisé
  const dataMap = useMemo(() => groupClicksByCountry(data), [data]);

  // Log pour le débogage
  console.log('Données brutes:', data);
  console.log('Données normalisées:', Object.fromEntries(dataMap));

  return (
    <div className="relative border border-gray-200 rounded-lg h-[500px] w-full">
      <ComposableMap 
        projectionConfig={{ scale: 147 }}
        className="w-full h-full"
      >
        <ZoomableGroup center={[0, 20]}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map(geo => {
                const countryName = geo.properties.name;
                const clicks = dataMap.get(countryName) || 0;
                const hasClicks = clicks > 0;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => {
                      setTooltip({
                        show: true,
                        content: `${countryName}: ${clicks} clic(s)`,
                        x: 0, // Mise à jour par onMouseMove
                        y: 0
                      });
                    }}
                    onMouseMove={(e) => {
                      const container = e.currentTarget.closest('.relative');
                      if (container) {
                        const rect = container.getBoundingClientRect();
                        setTooltip(prev => ({
                          ...prev,
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top
                        }));
                      }
                    }}
                    onMouseLeave={() => {
                      setTooltip(prev => ({ ...prev, show: false }));
                    }}
                    style={{
                      default: {
                        fill: hasClicks ? '#ef4444' : '#E9EAEA',
                        outline: 'none',
                        transition: 'fill 0.2s',
                      },
                      hover: {
                        fill: hasClicks ? '#dc2626' : '#d1d5db',
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: {
                        fill: hasClicks ? '#b91c1c' : '#9ca3af',
                        outline: 'none',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Infobulle personnalisée */}
      {tooltip.show && (
        <div 
          className="absolute bg-gray-900 text-white text-sm py-1 px-2 rounded pointer-events-none z-10 whitespace-nowrap shadow-lg"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y + 10}px`,
            transform: 'translateY(-50%)',
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export const WorldMapChart = memo(WorldMapChartComponent);
