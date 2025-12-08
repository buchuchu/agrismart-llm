import React from 'react';
import { History, PlusCircle, Settings, LogOut, User, Tractor } from 'lucide-react';

interface SidebarProps {
  onNewChat: () => void;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ onNewChat, isOpen }) => {
  return (
    <div className={`${isOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden bg-slate-900 text-white flex flex-col border-r border-slate-700 h-full flex-shrink-0 relative`}>
      <div className="p-4 border-b border-slate-700 flex items-center gap-2">
        <div className="bg-green-600 p-2 rounded-lg">
          <Tractor size={24} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">AgriSmart</h1>
          <p className="text-xs text-slate-400">Intelligent Ops</p>
        </div>
      </div>

      <div className="p-4">
        <button 
          onClick={onNewChat}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <PlusCircle size={18} />
          New Diagnosis
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">History</h3>
          <ul className="space-y-1">
            <li className="px-3 py-2 hover:bg-slate-800 rounded cursor-pointer text-sm truncate flex items-center gap-2 text-slate-300">
              <History size={14} /> 
              Corn Harvest Schedule
            </li>
            <li className="px-3 py-2 hover:bg-slate-800 rounded cursor-pointer text-sm truncate flex items-center gap-2 text-slate-300">
              <History size={14} /> 
              John Deere 8R Specs
            </li>
            <li className="px-3 py-2 hover:bg-slate-800 rounded cursor-pointer text-sm truncate flex items-center gap-2 text-slate-300">
              <History size={14} /> 
              Hydraulic Pump Noise
            </li>
          </ul>
        </div>
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <User size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Farmer Joe</p>
            <p className="text-xs text-slate-400 truncate">Premium Plan</p>
          </div>
        </div>
        <div className="flex gap-2 text-slate-400">
          <button className="p-2 hover:text-white hover:bg-slate-800 rounded"><Settings size={18} /></button>
          <button className="p-2 hover:text-white hover:bg-slate-800 rounded"><LogOut size={18} /></button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
