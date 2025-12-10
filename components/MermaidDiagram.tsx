import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid settings with new Emerald theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    fontFamily: 'Inter',
    primaryColor: '#10b981', // emerald-500
    primaryTextColor: '#fff',
    primaryBorderColor: '#059669',
    lineColor: '#059669',
    secondaryColor: '#ecfdf5', // emerald-50
    tertiaryColor: '#fff',
    
    // Gantt specific
    titleColor: '#334155',
    sectionBkgColor: '#f1f5f9',
    altSectionBkgColor: '#ffffff',
    sectionBkgColor2: '#f1f5f9',
    taskBorderColor: '#10b981',
    taskBkgColor: '#10b981',
    activeTaskBorderColor: '#3b82f6',
    activeTaskBkgColor: '#3b82f6',
    gridColor: '#e2e8f0',
    doneTaskBkgColor: '#94a3b8',
    doneTaskBorderColor: '#64748b'
  },
  gantt: {
    barHeight: 32,
    barGap: 8,
    fontSize: 13,
    leftPadding: 100,
    numberSectionStyles: 3
  }
});

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderChart = async () => {
      // Clear previous error
      setError(null);
      
      try {
        // Generate a unique ID for this render cycle
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Attempt to render
        // Note: mermaid.render returns a promise resolving to { svg } in v10+
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (err: any) {
        console.error("Mermaid Render Error:", err);
        setError("无法渲染图表: 代码格式可能有误");
      }
    };

    if (chart) {
      renderChart();
    }
  }, [chart]);

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 font-mono shadow-sm">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="animate-pulse bg-slate-50 border border-slate-100 h-24 w-full rounded-xl flex items-center justify-center">
         <span className="text-slate-300 text-xs">生成图表中...</span>
      </div>
    );
  }

  return (
    <div 
      className="mermaid-wrapper bg-white p-5 rounded-xl border border-slate-100 shadow-lg shadow-slate-200/50 my-6 overflow-x-auto flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default MermaidDiagram;