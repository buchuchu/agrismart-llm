import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { Activity, Calendar, Tractor, AlertTriangle } from 'lucide-react';
import { AppContextState } from '../types';

interface RightPanelProps {
  state: AppContextState;
  setActivePanel: (panel: 'machinery' | 'schedule' | 'sensor') => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ state, setActivePanel }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock for sensor panel simulation
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const renderMachinery = () => (
    <div className="animate-fade-in">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
        <Tractor className="text-green-600" /> Recommended Machinery
      </h3>
      {state.machinerySpec ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-32 bg-slate-100 flex items-center justify-center text-slate-400">
             {/* Placeholder image logic */}
             <img src={`https://picsum.photos/400/200?random=1`} alt="Tractor" className="w-full h-full object-cover" />
          </div>
          <div className="p-5">
            <h4 className="text-xl font-bold text-slate-900 mb-1">{state.machinerySpec.brand} {state.machinerySpec.model}</h4>
            <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full mb-4">
              {state.machinerySpec.type}
            </span>
            
            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 text-sm">Horsepower</span>
                <span className="font-medium text-slate-800">{state.machinerySpec.horsepower}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 text-sm">Working Width</span>
                <span className="font-medium text-slate-800">{state.machinerySpec.width}</span>
              </div>
              <div>
                <span className="text-slate-500 text-sm block mb-1">Recommendation Reason</span>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {state.machinerySpec.suitableFor}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <p className="text-slate-500">No machinery selected yet.</p>
          <p className="text-xs text-slate-400 mt-2">Ask the chat to recommend a machine based on your field conditions.</p>
        </div>
      )}
    </div>
  );

  const renderSchedule = () => (
    <div className="animate-fade-in h-full flex flex-col">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
        <Calendar className="text-blue-600" /> Operations Schedule
      </h3>
      
      {state.schedule.length > 0 ? (
        <div className="flex-1 overflow-y-auto pr-2">
           <div className="space-y-4">
             {state.schedule.map((task) => (
               <div key={task.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
                 <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.status === 'Completed' ? 'bg-green-500' : task.status === 'In Progress' ? 'bg-blue-500' : 'bg-orange-400'}`}></div>
                 <div className="flex justify-between items-start mb-2">
                   <div>
                     <h4 className="font-bold text-slate-800">{task.taskName}</h4>
                     <p className="text-xs text-slate-500">{task.machine}</p>
                   </div>
                   <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${task.status === 'Completed' ? 'bg-green-100 text-green-700' : task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                     {task.status}
                   </span>
                 </div>
                 <div className="flex items-center gap-4 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                    <div>
                      <span className="block text-slate-400">Start</span>
                      {task.startDate}
                    </div>
                    <div>
                      <span className="block text-slate-400">Duration</span>
                      {task.durationDays} Days
                    </div>
                 </div>
               </div>
             ))}
           </div>
           
           {/* Simple Gantt Visualization */}
           <div className="mt-6 bg-white p-4 rounded-lg border border-slate-200">
             <h4 className="text-sm font-semibold mb-3">Timeline View</h4>
             <div className="space-y-2">
               {state.schedule.map((task, idx) => (
                 <div key={task.id} className="flex items-center gap-2">
                   <div className="w-20 text-xs truncate text-slate-500">{task.taskName}</div>
                   <div className="flex-1 bg-slate-100 h-6 rounded-full relative overflow-hidden">
                     <div 
                        className={`absolute top-0 bottom-0 rounded-full opacity-80 ${idx % 2 === 0 ? 'bg-blue-500' : 'bg-green-500'}`}
                        style={{ 
                          left: `${Math.random() * 20}%`, // Mock positioning for demo
                          width: `${Math.max(20, Math.random() * 60)}%` 
                        }} 
                     />
                   </div>
                 </div>
               ))}
             </div>
           </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <p className="text-slate-500">No active schedules.</p>
          <p className="text-xs text-slate-400 mt-2">Ask to "create a harvest schedule" to generate one.</p>
        </div>
      )}
    </div>
  );

  const renderSensor = () => (
    <div className="animate-fade-in h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
          <Activity className="text-red-500" /> Sensor Diagnostics
        </h3>
        <span className="text-xs font-mono bg-slate-900 text-green-400 px-2 py-1 rounded">
          LIVE {currentTime.toLocaleTimeString()}
        </span>
      </div>

      <div className="bg-slate-900 rounded-xl p-4 mb-4 shadow-lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-2 bg-slate-800 rounded-lg">
            <span className="text-slate-400 text-xs uppercase block mb-1">Vibration (RMS)</span>
            <span className="text-2xl font-mono text-white">
              {state.sensorData.length > 0 ? state.sensorData[state.sensorData.length - 1].vibration.toFixed(1) : '0.0'}
            </span>
            <span className="text-xs text-slate-500 ml-1">mm/s</span>
          </div>
          <div className="text-center p-2 bg-slate-800 rounded-lg">
             <span className="text-slate-400 text-xs uppercase block mb-1">Temp</span>
             <span className="text-2xl font-mono text-white">
               {state.sensorData.length > 0 ? state.sensorData[state.sensorData.length - 1].temperature.toFixed(1) : '0.0'}
             </span>
             <span className="text-xs text-slate-500 ml-1">°C</span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 p-2 shadow-sm min-h-[200px]">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 pl-2">Vibration Analysis</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={state.sensorData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 25]} width={30} tick={{fontSize: 10}} />
            <RechartsTooltip />
            <Line 
              type="monotone" 
              dataKey="vibration" 
              stroke="#ef4444" 
              strokeWidth={2} 
              dot={false} 
              isAnimationActive={false} // Better performance for realtime
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 className="flex items-center gap-2 text-sm font-bold text-yellow-800 mb-2">
          <AlertTriangle size={16} /> Diagnostic Insight
        </h4>
        <p className="text-xs text-yellow-900">
          {state.sensorData.length > 0 && state.sensorData[state.sensorData.length - 1].vibration > 15 
            ? "CRITICAL: High vibration detected. Potential bearing failure on output shaft. Recommend immediate shutdown."
            : "System operating within normal parameters. Routine maintenance scheduled for 200 hours."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-slate-50 border-l border-slate-200 flex flex-col w-full md:w-[400px]">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        <button 
          onClick={() => setActivePanel('machinery')}
          className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors border-b-2 ${state.activePanel === 'machinery' ? 'border-green-600 text-green-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <Tractor size={16} /> <span className="hidden sm:inline">Specs</span>
        </button>
        <button 
          onClick={() => setActivePanel('schedule')}
          className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors border-b-2 ${state.activePanel === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <Calendar size={16} /> <span className="hidden sm:inline">Plan</span>
        </button>
        <button 
          onClick={() => setActivePanel('sensor')}
          className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors border-b-2 ${state.activePanel === 'sensor' ? 'border-red-500 text-red-500' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <Activity size={16} /> <span className="hidden sm:inline">Sensor</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-hidden">
        {state.activePanel === 'machinery' && renderMachinery()}
        {state.activePanel === 'schedule' && renderSchedule()}
        {state.activePanel === 'sensor' && renderSensor()}
      </div>
    </div>
  );
};

export default RightPanel;
