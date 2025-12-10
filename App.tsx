import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Send, Menu, Mic, Paperclip, Loader2, Zap, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import MermaidDiagram from './components/MermaidDiagram';
import { sendMessageToGemini, initializeChat, restoreChatSession } from './services/geminiService';
import { AppContextState, ChatMessage, MessageRole, SensorDataPoint, ChatSession } from './types';

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

  // Load history from LocalStorage when user logs in
  const loadHistory = (user: string) => {
    const key = `agrismart_history_${user}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed: ChatSession[] = JSON.parse(stored);
        // Date strings need to be converted back to Date objects
        const hydrated = parsed.map(s => ({
          ...s,
          messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
        })).sort((a, b) => b.lastModified - a.lastModified); // Sort by new
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
    
    // If we have an active session ID, update it
    if (currentSessionId) {
      const idx = updatedSessions.findIndex(s => s.id === currentSessionId);
      if (idx !== -1) {
        updatedSessions[idx] = {
          ...updatedSessions[idx],
          messages: newMessages,
          lastModified: now,
          // Update title if it's still the default "New Chat" and we have a user message
          title: (updatedSessions[idx].title === "新任务" && newMessages.length > 1) 
            ? (newMessages.find(m => m.role === MessageRole.USER)?.text.slice(0, 15) || "新任务") + "..."
            : updatedSessions[idx].title
        };
      }
    } else {
      // Create new session if none exists (shouldn't happen with correct flow, but safe fallback)
      const newId = Date.now().toString();
      const firstUserMsg = newMessages.find(m => m.role === MessageRole.USER)?.text || "新任务";
      const newSession: ChatSession = {
        id: newId,
        title: firstUserMsg.slice(0, 15) + (firstUserMsg.length > 15 ? "..." : ""),
        messages: newMessages,
        lastModified: now
      };
      updatedSessions = [newSession, ...updatedSessions];
      setCurrentSessionId(newId);
    }
    
    // Sort by most recent
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
      handleNewChat(); // Start with a fresh screen or welcome message
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setSessions([]);
    setMessages([]);
    setCurrentSessionId(null);
  };

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const initialMsg: ChatMessage = {
      role: MessageRole.MODEL,
      text: `你好 ${username}！我是**农机智脑**。\n\n已为您开启新的作业对话。请问是关于农机调度、故障维修，还是传感器数据分析？`,
      timestamp: new Date()
    };
    
    const newSession: ChatSession = {
      id: newId,
      title: "新任务",
      messages: [initialMsg],
      lastModified: Date.now()
    };

    setMessages([initialMsg]);
    setCurrentSessionId(newId);
    
    // Pre-save the new empty session so it appears in list immediately
    const newSessions = [newSession, ...sessions];
    setSessions(newSessions);
    saveHistoryToStorage(newSessions);

    initializeChat(); // Reset AI Service memory
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    restoreChatSession(session.messages); // Sync AI Service memory
    
    // Mobile: close sidebar on selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent triggering select
    if (window.confirm("确定要删除这条对话记录吗？")) {
      const updated = sessions.filter(s => s.id !== sessionId);
      setSessions(updated);
      saveHistoryToStorage(updated);
      
      // If we deleted the active one, start new
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
    updateCurrentSession(newMessages); // Save user msg
    
    setInput('');
    setIsLoading(true);

    try {
      // Direct text response (Markdown format)
      const responseText = await sendMessageToGemini(userMsg.text);
      
      const modelMsg: ChatMessage = {
        role: MessageRole.MODEL,
        text: responseText,
        timestamp: new Date()
      };
      
      const finalMessages = [...newMessages, modelMsg];
      setMessages(finalMessages);
      updateCurrentSession(finalMessages); // Save bot msg

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
    // Optional: Notify in chat
    const msg: ChatMessage = {
      role: MessageRole.MODEL,
      text: `✅ 已成功接收文件 **${fileName}**。右侧面板已生成振动信号分析图谱。`,
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

  // --- Premium Login View ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
        {/* Cinematic Background */}
        <div className="absolute inset-0 bg-slate-900">
           <img 
             src="https://images.unsplash.com/photo-1625246333195-581e050710fc?q=80&w=2070&auto=format&fit=crop" 
             className="w-full h-full object-cover opacity-40 mix-blend-overlay"
             alt="Smart Farming" 
           />
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/30"></div>
        </div>

        {/* Glass Card */}
        <div className="glass-panel w-full max-w-md p-8 rounded-3xl relative z-10 shadow-2xl animate-fade-in border border-white/10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20 transform rotate-[-6deg] hover:rotate-0 transition-transform duration-500 border border-white/20">
              <svg className="w-10 h-10 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
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
               <h2 className="font-bold text-slate-800 text-lg">农机智能助手</h2>
               <div className="flex items-center gap-1.5">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                 <p className="text-xs text-slate-400">系统在线 - 随时响应</p>
               </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-600 rounded-full border border-indigo-100 shadow-sm">
            <Zap size={14} className="fill-indigo-500 text-indigo-500" />
            <span>AI 模型已增强</span>
          </div>
        </header>

        {/* Chat Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-hide bg-[#f8fafc]">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex w-full animate-fade-in ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`} style={{animationDelay: '0ms'}}>
              {/* Avatar for Bot */}
              {msg.role === MessageRole.MODEL && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-md mr-3 flex-shrink-0 mt-1">
                  <Sparkles size={16} />
                </div>
              )}

              <div 
                className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-6 py-5 shadow-sm relative ${
                  msg.role === MessageRole.USER 
                    ? 'bg-gradient-to-br from-emerald-600 to-green-700 text-white rounded-tr-none shadow-emerald-200' 
                    : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-slate-200/50'
                }`}
              >
                {/* Custom Styling for Tables in Markdown */}
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
                      // Custom link styling
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
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                 </div>
                 <span className="text-sm text-slate-500 font-medium">正在分析数据...</span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white/90 backdrop-blur-md border-t border-slate-100">
          <div className="max-w-4xl mx-auto relative flex items-center gap-3">
             <div className="flex-1 relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="输入问题 (农机推荐、排期、故障咨询)..."
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
          <div className="text-center mt-3">
            <p className="text-[10px] text-slate-300">AI 生成内容可能包含错误，请结合实际农情判断。</p>
          </div>
        </div>
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