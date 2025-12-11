import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Send, Menu, Mic, Paperclip, Loader2, Zap, Sparkles, Tractor, CalendarClock, Stethoscope, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import MermaidDiagram from './components/MermaidDiagram';
import { sendMessageToGemini, initializeChat, restoreChatSession } from './services/geminiService';
import { AppContextState, ChatMessage, MessageRole, SensorDataPoint, ChatSession, ChatMode } from './types';

const App: React.FC = () => {
  // --- Auth State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  // --- Chat State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Mode State ---
  const [activeMode, setActiveMode] = useState<ChatMode | null>(null);

  // --- History State ---
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // --- Right Panel State (File Data) ---
  const [appState, setAppState] = useState<AppContextState>({
    isDataLoaded: false,
    fileName: null,
    sensorData: []
  });

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- History Management Logic ---

  const loadHistory = (user: string) => {
    const key = `agrismart_history_${user}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed: ChatSession[] = JSON.parse(stored);
        const hydrated = parsed.map(s => ({
          ...s,
          messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
        })).sort((a, b) => b.lastModified - a.lastModified);
        setSessions(hydrated);
      } catch (e) {
        console.error("Failed to parse history", e);
        setSessions([]);
      }
    } else {
      setSessions([]);
    }
  };

  const saveHistoryToStorage = (updatedSessions: ChatSession[]) => {
    const key = `agrismart_history_${username}`;
    localStorage.setItem(key, JSON.stringify(updatedSessions));
  };

  const updateCurrentSession = (newMessages: ChatMessage[]) => {
    if (!username) return;

    let updatedSessions = [...sessions];
    const now = Date.now();
    
    if (currentSessionId) {
      const idx = updatedSessions.findIndex(s => s.id === currentSessionId);
      if (idx !== -1) {
        updatedSessions[idx] = {
          ...updatedSessions[idx],
          messages: newMessages,
          lastModified: now,
          title: (updatedSessions[idx].title === "新任务" && newMessages.length > 1) 
            ? (newMessages.find(m => m.role === MessageRole.USER)?.text.slice(0, 15) || "新任务") + "..."
            : updatedSessions[idx].title
        };
      }
    } else {
      // This case is rare now because session is created on mode selection
      const newId = Date.now().toString();
      const newSession: ChatSession = {
        id: newId,
        title: "新任务",
        mode: activeMode || 'operations',
        messages: newMessages,
        lastModified: now
      };
      updatedSessions = [newSession, ...updatedSessions];
      setCurrentSessionId(newId);
    }
    
    updatedSessions.sort((a, b) => b.lastModified - a.lastModified);
    setSessions(updatedSessions);
    saveHistoryToStorage(updatedSessions);
  };

  // --- Handlers ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setIsLoggedIn(true);
      loadHistory(username.trim());
      // Don't auto-start chat, allow user to pick mode
      setMessages([]);
      setActiveMode(null);
      setCurrentSessionId(null);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setSessions([]);
    setMessages([]);
    setCurrentSessionId(null);
    setActiveMode(null);
  };

  const handleNewChat = () => {
    // Reset to mode selection screen
    setMessages([]);
    setCurrentSessionId(null);
    setActiveMode(null);
    initializeChat();
  };

  const handleModeSelect = (mode: ChatMode) => {
    setActiveMode(mode);
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    
    let welcomeText = "";
    
    if (mode === 'operations') {
      welcomeText = `### 🚜 农机运营选型助手\n\n我是您的选型专家。请告诉我您的需求，我将为您推荐最匹配的农机设备。\n\n**建议输入格式：**\n> “我在**黑龙江**，主要种植**玉米**，作业面积约**5000亩**。想购买一台适合深翻作业的拖拉机，预算在**150-200万**之间。”`;
    } else if (mode === 'scheduling') {
      welcomeText = `### 🗓️ 智能作业调度中心\n\n请输入您的作业任务和资源情况，我将为您生成最优排期计划和甘特图。\n\n**建议输入格式：**\n> “我有**3个地块**共1200亩小麦需要收割。目前有**2台收割机**（每台效率80亩/天）。要求**5天内**完工，请帮我安排作业计划。”`;
    } else if (mode === 'diagnosis') {
      welcomeText = `### 🩺 农机故障智能诊断\n\n请描述农机的异常现象，或者在右侧上传传感器数据文件，我将为您分析故障原因。\n\n**建议输入格式：**\n> “**约翰迪尔8R**拖拉机，在重负荷耕作时**发动机声音异常**，且伴有**高频振动**，请分析可能原因和维修建议。”`;
    }

    const initialMsg: ChatMessage = {
      role: MessageRole.MODEL,
      text: welcomeText,
      timestamp: new Date()
    };

    const newMessages = [initialMsg];
    setMessages(newMessages);

    // Create session immediately
    const newSession: ChatSession = {
      id: newId,
      title: "新任务",
      mode: mode,
      messages: newMessages,
      lastModified: Date.now()
    };
    
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    saveHistoryToStorage(updatedSessions);
    
    initializeChat();
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setActiveMode(session.mode || 'operations'); // fallback for old history
    restoreChatSession(session.messages);
    
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (window.confirm("确定要删除这条对话记录吗？")) {
      const updated = sessions.filter(s => s.id !== sessionId);
      setSessions(updated);
      saveHistoryToStorage(updated);
      
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: MessageRole.USER,
      text: input,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    updateCurrentSession(newMessages);
    
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await sendMessageToGemini(userMsg.text);
      
      const modelMsg: ChatMessage = {
        role: MessageRole.MODEL,
        text: responseText,
        timestamp: new Date()
      };
      
      const finalMessages = [...newMessages, modelMsg];
      setMessages(finalMessages);
      updateCurrentSession(finalMessages);

    } catch (error) {
      setMessages(prev => [...prev, {
        role: MessageRole.MODEL,
        text: "遇到连接错误，请重试。",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Right Panel Handlers ---
  const handleDataUpload = (fileName: string, data: SensorDataPoint[]) => {
    setAppState({
      isDataLoaded: true,
      fileName: fileName,
      sensorData: data
    });
    
    // Auto-switch to diagnosis if not already
    if (activeMode !== 'diagnosis') {
        if (!currentSessionId) {
            handleModeSelect('diagnosis');
        } else {
            // Just notify user
        }
    }

    const msg: ChatMessage = {
      role: MessageRole.MODEL,
      text: `✅ 已成功接收文件 **${fileName}**。振动图谱已生成。\n\n**当前处于故障诊断模式**，您可以问我：“根据刚刚上传的数据，分析设备的健康状态。”`,
      timestamp: new Date()
    };
    const newMessages = [...messages, msg];
    setMessages(newMessages);
    updateCurrentSession(newMessages);
  };

  const handleClearData = () => {
    setAppState({
      isDataLoaded: false,
      fileName: null,
      sensorData: []
    });
  };

  // --- Login View (Unchanged) ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
        <div className="absolute inset-0 bg-slate-900">
           <img 
             src="https://images.unsplash.com/photo-1625246333195-581e050710fc?q=80&w=2070&auto=format&fit=crop" 
             className="w-full h-full object-cover opacity-40 mix-blend-overlay"
             alt="Smart Farming" 
           />
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/30"></div>
        </div>

        <div className="glass-panel w-full max-w-md p-8 rounded-3xl relative z-10 shadow-2xl animate-fade-in border border-white/10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20 transform rotate-[-6deg] hover:rotate-0 transition-transform duration-500 border border-white/20">
              <Tractor className="w-10 h-10 text-white drop-shadow-md" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">AgriSmart <span className="text-emerald-600">Pro</span></h1>
            <p className="text-slate-600 mt-2 font-medium">农机智能运维与数据分析平台</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">用户名 / 账号</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-white/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all placeholder-slate-400 text-slate-800 font-medium"
                placeholder="请输入您的称呼 (如：张师傅)"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-emerald-600/30 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
            >
              <span>进入工作台</span>
              <Send size={18} />
            </button>
            <p className="text-center text-xs text-slate-400 mt-4">
               AgriSmart Intelligent Operations System v2.0
            </p>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Layout ---
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onNewChat={handleNewChat} 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        username={username}
        onLogout={handleLogout}
      />

      {/* Center Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white/80 relative shadow-2xl z-10 rounded-l-3xl overflow-hidden border-l border-white/50 backdrop-blur-sm mr-0 md:mr-0">
        
        {/* Modern Header */}
        <header className="h-20 border-b border-slate-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-500 transition-all hover:text-emerald-600"
            >
              <Menu size={22} />
            </button>
            <div>
               <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                 {activeMode === 'operations' && <Tractor size={18} className="text-emerald-500" />}
                 {activeMode === 'scheduling' && <CalendarClock size={18} className="text-blue-500" />}
                 {activeMode === 'diagnosis' && <Stethoscope size={18} className="text-amber-500" />}
                 {activeMode === 'operations' ? '农机运营选型' : activeMode === 'scheduling' ? '作业调度排期' : activeMode === 'diagnosis' ? '农机故障诊断' : '农机智能助手'}
               </h2>
               <div className="flex items-center gap-1.5">
                 <span className={`w-2 h-2 rounded-full animate-pulse ${activeMode ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                 <p className="text-xs text-slate-400">
                    {activeMode ? '专业模式已激活' : '请选择功能模块'}
                 </p>
               </div>
            </div>
          </div>
          {activeMode && (
             <div className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-slate-50 text-slate-500 rounded-full border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-100 transition-colors" onClick={handleNewChat}>
               <span>切换模式</span>
               <ArrowRight size={12} />
             </div>
          )}
        </header>

        {/* MODE SELECTION SCREEN (When no mode is active) */}
        {!activeMode && (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center animate-fade-in">
             <div className="text-center mb-10 max-w-lg">
                <h1 className="text-3xl font-bold text-slate-800 mb-3">您好，{username}</h1>
                <p className="text-slate-500 text-lg">请选择您今天要处理的业务类型</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
                {/* Card 1: Operations */}
                <div 
                  onClick={() => handleModeSelect('operations')}
                  className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-lg hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col items-center text-center hover:-translate-y-1"
                >
                   <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                   <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4 group-hover:bg-emerald-500 transition-colors duration-300">
                      <Tractor className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors" />
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 mb-2">农机运营 (选型)</h3>
                   <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      基于作业面积、作物类型及预算，智能推荐最匹配的农机设备型号与配置。
                   </p>
                   <div className="mt-auto w-full bg-slate-50 py-3 rounded-xl text-xs font-mono text-slate-400 border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-100 transition-all">
                      "推荐5000亩玉米地收割机..."
                   </div>
                </div>

                {/* Card 2: Scheduling */}
                <div 
                  onClick={() => handleModeSelect('scheduling')}
                  className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-lg hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col items-center text-center hover:-translate-y-1"
                >
                   <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                   <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors duration-300">
                      <CalendarClock className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 mb-2">作业调度 (排期)</h3>
                   <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      输入地块任务与可用农机资源，生成最优作业甘特图与时间规划方案。
                   </p>
                   <div className="mt-auto w-full bg-slate-50 py-3 rounded-xl text-xs font-mono text-slate-400 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-100 transition-all">
                      "安排3台车收割1200亩..."
                   </div>
                </div>

                {/* Card 3: Diagnosis */}
                <div 
                  onClick={() => handleModeSelect('diagnosis')}
                  className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-lg hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col items-center text-center hover:-translate-y-1"
                >
                   <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                   <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4 group-hover:bg-amber-500 transition-colors duration-300">
                      <Stethoscope className="w-8 h-8 text-amber-600 group-hover:text-white transition-colors" />
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 mb-2">农机故障诊断</h3>
                   <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      通过现象描述或传感器数据文件，分析故障原因并提供专业维修建议。
                   </p>
                   <div className="mt-auto w-full bg-slate-50 py-3 rounded-xl text-xs font-mono text-slate-400 border border-slate-100 group-hover:bg-amber-50 group-hover:text-amber-700 group-hover:border-amber-100 transition-all">
                      "发动机异响且振动剧烈..."
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Chat Content (Only visible when mode is active) */}
        {activeMode && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-hide bg-[#f8fafc]">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex w-full animate-fade-in ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`} style={{animationDelay: '0ms'}}>
                {/* Avatar for Bot */}
                {msg.role === MessageRole.MODEL && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md mr-3 flex-shrink-0 mt-1 bg-gradient-to-br ${
                    activeMode === 'operations' ? 'from-emerald-500 to-green-600' : 
                    activeMode === 'scheduling' ? 'from-blue-500 to-indigo-600' :
                    'from-amber-500 to-orange-600'
                  }`}>
                    {activeMode === 'operations' ? <Tractor size={16} /> : 
                     activeMode === 'scheduling' ? <CalendarClock size={16} /> :
                     <Stethoscope size={16} />}
                  </div>
                )}

                <div 
                  className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-6 py-5 shadow-sm relative ${
                    msg.role === MessageRole.USER 
                      ? 'bg-gradient-to-br from-emerald-600 to-green-700 text-white rounded-tr-none shadow-emerald-200' 
                      : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-slate-200/50'
                  }`}
                >
                  <div className={`prose prose-sm max-w-none ${msg.role === MessageRole.USER ? 'prose-invert' : ''} prose-headings:font-bold prose-h3:text-lg prose-table:border-collapse prose-th:bg-slate-50/50 prose-th:p-3 prose-td:p-3 prose-td:border prose-td:border-slate-100`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code(props) {
                          const {children, className, node, ...rest} = props;
                          const match = /language-(\w+)/.exec(className || '');
                          if (match && match[1] === 'mermaid') {
                            return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
                          }
                          return <code {...rest} className={`${className} ${msg.role === MessageRole.USER ? 'bg-white/20' : 'bg-slate-100'} px-1 py-0.5 rounded text-xs`}>{children}</code>;
                        },
                        a: ({node, ...props}) => <a {...props} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" />
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                  <div className={`text-[10px] mt-3 font-medium ${msg.role === MessageRole.USER ? 'text-emerald-100/70' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
               <div className="flex justify-start w-full pl-11">
                 <div className="bg-white rounded-2xl rounded-tl-none px-6 py-4 border border-slate-100 shadow-sm flex items-center gap-3">
                   <div className="flex gap-1">
                      <span className={`w-2 h-2 rounded-full animate-bounce ${activeMode === 'scheduling' ? 'bg-blue-500' : activeMode === 'diagnosis' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{animationDelay: '0ms'}}></span>
                      <span className={`w-2 h-2 rounded-full animate-bounce ${activeMode === 'scheduling' ? 'bg-blue-500' : activeMode === 'diagnosis' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{animationDelay: '150ms'}}></span>
                      <span className={`w-2 h-2 rounded-full animate-bounce ${activeMode === 'scheduling' ? 'bg-blue-500' : activeMode === 'diagnosis' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{animationDelay: '300ms'}}></span>
                   </div>
                   <span className="text-sm text-slate-500 font-medium">AI 正在思考方案...</span>
                 </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area (Only visible when mode is active) */}
        {activeMode && (
          <div className="p-6 bg-white/90 backdrop-blur-md border-t border-slate-100">
            <div className="max-w-4xl mx-auto relative flex items-center gap-3">
               <div className="flex-1 relative group">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={
                      activeMode === 'operations' ? "输入：地点、作物、面积、预算..." :
                      activeMode === 'scheduling' ? "输入：地块任务量、可用农机数、工期要求..." :
                      "输入：故障现象、异响位置、或上传数据..."
                    }
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white border border-slate-200 focus:border-emerald-500 transition-all shadow-inner"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2 text-slate-400">
                     <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><Mic size={18} /></button>
                     <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><Paperclip size={18} /></button>
                  </div>
               </div>
               <button 
                 onClick={handleSend}
                 disabled={isLoading || !input.trim()}
                 className={`p-4 rounded-2xl shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                   input.trim() && !isLoading 
                     ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-emerald-500/30' 
                     : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                 }`}
               >
                 <Send size={20} className={input.trim() ? 'translate-x-0.5' : ''} />
               </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Data Analysis */}
      <div className="hidden lg:block z-0">
         <RightPanel 
           state={appState} 
           onDataUpload={handleDataUpload}
           onClearData={handleClearData}
         />
      </div>

    </div>
  );
};

export default App;