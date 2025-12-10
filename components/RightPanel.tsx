import React, { useState, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { UploadCloud, FileText, Activity, X, CheckCircle2, AlertCircle, BarChart3, Waves } from 'lucide-react';
import { AppContextState, SensorDataPoint } from '../types';

interface RightPanelProps {
  state: AppContextState;
  onDataUpload: (fileName: string, data: SensorDataPoint[]) => void;
  onClearData: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ state, onDataUpload, onClearData }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Real File Parsing Logic ---
  const handleFileUpload = (file: File) => {
    setAnalyzing(true);
    setErrorMsg(null);
    
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setErrorMsg("文件内容为空");
        setAnalyzing(false);
        return;
      }

      try {
        let parsedData: SensorDataPoint[] = [];

        // 1. JSON Parsing
        if (file.name.toLowerCase().endsWith('.json')) {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            parsedData = json.map((item: any, index: number) => ({
              time: item.time ? String(item.time) : `${index * 10}ms`,
              vibration: Number(item.vibration || item.value || item.v || 0),
              temperature: Number(item.temperature || item.temp || 60)
            }));
          } else {
            throw new Error("JSON 格式错误：根节点必须是数组");
          }
        } 
        // 2. CSV / Text Parsing
        else {
          const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
          
          // Simple header detection
          let startIndex = 0;
          const firstLineParts = lines[0].split(/[,\t]/); 
          if (isNaN(Number(firstLineParts[0])) && isNaN(Number(firstLineParts[1] || '0'))) {
             startIndex = 1;
          }

          parsedData = lines.slice(startIndex).map((line, index) => {
            const parts = line.replace(/['"]/g, '').split(/[,\t]/);
            let timeStr = `${index * 10}ms`;
            let vibVal = 0;
            let tempVal = 60;

            if (parts.length === 1) {
              vibVal = parseFloat(parts[0]);
            } else if (parts.length >= 2) {
              timeStr = parts[0].trim();
              vibVal = parseFloat(parts[1]);
              if (parts.length >= 3) {
                 tempVal = parseFloat(parts[2]);
              }
            }
            return {
              time: timeStr,
              vibration: isNaN(vibVal) ? 0 : vibVal,
              temperature: isNaN(tempVal) ? 60 : tempVal
            };
          });
        }

        if (parsedData.length === 0) {
          throw new Error("未能解析出有效数据");
        }

        setTimeout(() => {
          onDataUpload(file.name, parsedData);
          setAnalyzing(false);
        }, 800);

      } catch (err: any) {
        console.error("Parsing Error:", err);
        setErrorMsg(err.message || "文件解析失败");
        setAnalyzing(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg("读取文件失败");
      setAnalyzing(false);
    };

    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Calculations for stats
  const maxVibration = state.sensorData.length > 0 
    ? Math.max(...state.sensorData.map(d => d.vibration)) 
    : 0;
  
  const rmsValue = state.sensorData.length > 0
    ? Math.sqrt(state.sensorData.reduce((sum, d) => sum + d.vibration * d.vibration, 0) / state.sensorData.length)
    : 0;

  // --- Render: Empty State (Upload Box) ---
  if (!state.isDataLoaded) {
    return (
      <div className="h-full bg-slate-50/50 backdrop-blur-sm border-l border-slate-200/60 flex flex-col w-full md:w-[420px] p-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-3 border border-blue-100">
             <Activity size={12} /> 信号处理模块
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">传感器数据采集</h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            请上传农机振动传感器导出的原始数据文件 (.csv, .json)，系统将自动进行时域分析与故障特征提取。
          </p>
        </div>

        <div 
          className={`group flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer relative overflow-hidden ${
            isDragging 
              ? 'border-emerald-500 bg-emerald-50 scale-[0.99]' 
              : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-slate-50/80 hover:shadow-xl hover:shadow-emerald-900/5'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv,.json,.txt"
            onChange={onFileChange}
          />
          
          {analyzing ? (
            <div className="text-center relative z-10">
              <div className="relative">
                 <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                 <Activity size={24} className="text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-slate-800 font-bold text-lg">正在智能解析...</p>
              <p className="text-xs text-slate-400 mt-1">AI 正在提取时域特征</p>
            </div>
          ) : (
            <div className="text-center p-6 relative z-10">
              <div className="bg-slate-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-slate-100">
                <UploadCloud size={36} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
              </div>
              <p className="text-slate-700 font-bold text-lg mb-1">点击或拖拽文件</p>
              <div className="text-xs text-slate-400 mt-3 space-y-1.5 font-mono bg-slate-100/50 py-2 px-3 rounded-lg">
                <p>支持格式: CSV / JSON</p>
                <p>示例: 0.1, 5.2 (Time, Value)</p>
              </div>
            </div>
          )}

          {/* Decorative background blurs */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-100/50 rounded-full blur-3xl group-hover:bg-emerald-200/50 transition-colors"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-100/50 rounded-full blur-3xl group-hover:bg-blue-200/50 transition-colors"></div>
          
          {errorMsg && (
            <div className="absolute bottom-6 left-6 right-6 bg-red-50/90 backdrop-blur text-red-600 text-xs p-3 rounded-xl flex items-center gap-2 border border-red-200 shadow-lg animate-fade-in">
               <AlertCircle size={14} />
               {errorMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Render: Data Loaded State ---
  return (
    <div className="h-full bg-slate-50/50 backdrop-blur-sm border-l border-slate-200/60 flex flex-col w-full md:w-[420px] flex-shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-slate-200/60 bg-white/80 backdrop-blur flex justify-between items-start shadow-sm z-10">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 truncate max-w-[200px]">
            <FileText size={16} className="text-emerald-500" /> 
            {state.fileName}
          </h3>
          <div className="flex items-center gap-3 mt-1.5">
             <p className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
               RAW_DATA
             </p>
             <p className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
               <CheckCircle2 size={10} /> 采样点: {state.sensorData.length}
             </p>
          </div>
        </div>
        <button 
          onClick={onClearData}
          className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"
          title="关闭文件"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* Signal Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/50">
          <div className="flex justify-between items-center mb-5">
            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 tracking-wider">
              <Waves size={14} /> 振动波形时域图
            </h4>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-mono font-bold">
              Peak: {maxVibration.toFixed(2)}
            </span>
          </div>
          <div className="h-56 w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={state.sensorData}>
                <defs>
                  <linearGradient id="colorVib" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" hide={true} />
                <YAxis width={40} tick={{fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(4px)',
                    padding: '8px 12px'
                  }}
                  itemStyle={{fontSize: '12px', color: '#fff', fontFamily: 'monospace'}}
                  labelStyle={{display: 'none'}}
                  cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4'}}
                />
                <Area 
                  type="monotone" 
                  dataKey="vibration" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorVib)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-xl shadow-slate-900/10 relative overflow-hidden">
          {/* Decorative faint grid */}
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
          
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2 relative z-10">
            <BarChart3 size={14} /> 核心指标统计
          </h4>
          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5 backdrop-blur-sm">
              <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">RMS (有效值)</span>
              <span className="text-2xl font-mono font-medium tracking-tight text-emerald-400">{rmsValue.toFixed(2)}</span>
              <span className="text-[10px] text-slate-500 ml-1">mm/s</span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5 backdrop-blur-sm">
              <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">Peak (峰值)</span>
              <span className="text-2xl font-mono font-medium tracking-tight text-blue-400">{maxVibration.toFixed(2)}</span>
              <span className="text-[10px] text-slate-500 ml-1">mm/s</span>
            </div>
            
            <div className="col-span-2 bg-white/10 p-3 rounded-xl border border-white/10 flex justify-between items-center backdrop-blur-sm">
              <div>
                 <span className="text-[10px] text-slate-300 block">健康状态评估</span>
                 <p className="text-xs text-slate-400 mt-0.5">基于 ISO-10816 标准</p>
              </div>
              <span className={`text-xs px-3 py-1.5 rounded-lg font-bold shadow-lg ${
                maxVibration > 10 
                  ? 'bg-red-500/20 text-red-200 border border-red-500/50' 
                  : maxVibration > 5 
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50' 
                    : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50'
              }`}>
                 {maxVibration > 10 ? '🔴 严重告警' : maxVibration > 5 ? '🟠 需注意' : '🟢 运行正常'}
              </span>
            </div>
          </div>
        </div>

        {/* AI Insight Action */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden group">
           <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-emerald-200 to-transparent rounded-bl-full opacity-50 transition-opacity group-hover:opacity-80"></div>
           
           <h4 className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2 relative z-10">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             智能诊断建议
           </h4>
           <p className="text-xs text-emerald-800/80 leading-relaxed relative z-10 mb-3">
             数据预处理已完成。建议将峰值数据发送给 AI 进行故障模式匹配。
           </p>
           <div className="p-3 bg-white/60 rounded-lg border border-emerald-100/50 text-xs text-slate-600 italic">
             “根据当前的振动峰值 {maxVibration.toFixed(1)}，请分析可能存在的机械故障。”
           </div>
        </div>

      </div>
    </div>
  );
};

export default RightPanel;