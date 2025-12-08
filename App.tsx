import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Send, Menu, Mic, Paperclip, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import { sendMessageToGemini, extractDataFromResponse, initializeChat } from './services/geminiService';
import { AppContextState, ChatMessage, MessageRole, SensorDataPoint } from './types';

const App: React.FC = () => {
  // --- Auth State (Mock) ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  // --- App Logic State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Dashboard Data State ---
  const [appState, setAppState] = useState<AppContextState>({
    machinerySpec: null,
    schedule: [],
    sensorData: [], // Initial mock data will be added via effect
    activePanel: 'machinery' // Default view
  });

  // --- Initialization ---
  useEffect(() => {
    // Fill sensor data with some initial random values
    const initialSensorData: SensorDataPoint[] = [];
    let now = new Date();
    for (let i = 0; i < 20; i++) {
      initialSensorData.push({
        time: new Date(now.getTime() - (20 - i) * 1000).toLocaleTimeString(),
        vibration: 2 + Math.random() * 3,
        temperature: 60 + Math.random() * 5
      });
    }
    setAppState(prev => ({ ...prev, sensorData: initialSensorData }));
  }, []);

  // --- Real-time Sensor Simulation Effect ---
  useEffect(() => {
    if (!isLoggedIn) return;
    
    // Simulate incoming sensor data every 2 seconds
    const interval = setInterval(() => {
      setAppState(prev => {
        const lastVal = prev.sensorData[prev.sensorData.length - 1];
        // Random walk
        let newVib = lastVal.vibration + (Math.random() - 0.5) * 2;
        newVib = Math.max(0, Math.min(25, newVib)); // Clamp
        
        const newTemp = lastVal.temperature + (Math.random() - 0.5);

        const newPoint: SensorDataPoint = {
          time: new Date().toLocaleTimeString(),
          vibration: newVib,
          temperature: newTemp
        };

        const newData = [...prev.sensorData.slice(1), newPoint]; // Keep fixed window size
        return { ...prev, sensorData: newData };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setIsLoggedIn(true);
      // Initialize Gemini Chat Session on login
      initializeChat();
      // Add welcome message
      setMessages([{
        role: MessageRole.MODEL,
        text: `Hello ${username}! I am AgriSmart. \n\nI can help you with:\n1. **Machinery Selection** based on your field data.\n2. **Operations Scheduling** for dispatch.\n3. **Sensor Diagnostics** & maintenance advice.\n\nHow can I help you today?`,
        timestamp: new Date()
      }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: MessageRole.USER,
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Get raw text response
      const rawResponse = await sendMessageToGemini(userMsg.text);
      
      // 2. Parse for special JSON blocks (Machinery or Schedule)
      const { machinery, schedule, cleanText } = extractDataFromResponse(rawResponse);

      // 3. Update Dashboard State if data found
      if (machinery) {
        setAppState(prev => ({ ...prev, machinerySpec: machinery, activePanel: 'machinery' }));
      }
      if (schedule) {
        setAppState(prev => ({ ...prev, schedule: schedule, activePanel: 'schedule' }));
      }
      // If user mentions "sensor" or "vibration", switch to sensor view automatically
      if (userMsg.text.toLowerCase().includes('sensor') || userMsg.text.toLowerCase().includes('vibration')) {
        setAppState(prev => ({ ...prev, activePanel: 'sensor' }));
      }

      // 4. Add Model Message
      const modelMsg: ChatMessage = {
        role: MessageRole.MODEL,
        text: cleanText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, modelMsg]);

    } catch (error) {
      setMessages(prev => [...prev, {
        role: MessageRole.MODEL,
        text: "I encountered a connection error. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([{
      role: MessageRole.MODEL,
      text: "Starting a new session. What's on your mind?",
      timestamp: new Date()
    }]);
    initializeChat();
  };

  // --- Render Login Screen ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1625246333195-581e050710fc?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="bg-green-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform -rotate-6">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-slate-800">AgriSmart Login</h1>
            <p className="text-slate-500 mt-2">Enter your credentials to access the LLM.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                placeholder="Enter your name"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Access System
            </button>
          </form>
          <div className="mt-6 text-center text-xs text-slate-400">
            Powered by Gemini API • Agricultural Intelligence
          </div>
        </div>
      </div>
    );
  }

  // --- Render Main App ---
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      
      {/* 1. Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onNewChat={handleNewChat} 
      />

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-4 bg-white z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h2 className="font-semibold text-slate-800">Operational Assistant</h2>
          </div>
          <div className="text-xs font-medium px-3 py-1 bg-green-100 text-green-700 rounded-full">
            Model: Gemini 2.5 Flash
          </div>
        </header>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex w-full ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 shadow-sm ${
                  msg.role === MessageRole.USER 
                    ? 'bg-slate-800 text-white rounded-tr-none' 
                    : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                }`}
              >
                {/* Render Markdown for AI responses */}
                <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
                <div className={`text-[10px] mt-2 opacity-70 ${msg.role === MessageRole.USER ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start w-full">
               <div className="bg-slate-100 rounded-2xl rounded-tl-none px-5 py-4 border border-slate-200 flex items-center gap-2">
                 <Loader2 className="animate-spin text-green-600" size={18} />
                 <span className="text-sm text-slate-500">AgriSmart is thinking...</span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="max-w-3xl mx-auto relative flex items-center gap-2">
             <button className="p-3 text-slate-400 hover:text-green-600 hover:bg-slate-100 rounded-full transition-colors">
               <Paperclip size={20} />
             </button>
             <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about machinery specs, scheduling, or diagnostics..."
                  className="w-full bg-slate-100 text-slate-900 placeholder-slate-500 rounded-full py-3 px-5 pr-12 focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-transparent focus:border-green-500 transition-all shadow-inner"
                />
             </div>
             <button className="p-3 text-slate-400 hover:text-green-600 hover:bg-slate-100 rounded-full transition-colors">
               <Mic size={20} />
             </button>
             <button 
               onClick={handleSend}
               disabled={isLoading || !input.trim()}
               className={`p-3 rounded-full shadow-md transition-all ${
                 input.trim() && !isLoading 
                   ? 'bg-green-600 text-white hover:bg-green-700 hover:scale-105' 
                   : 'bg-slate-200 text-slate-400 cursor-not-allowed'
               }`}
             >
               <Send size={20} />
             </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] text-slate-400">
              AgriSmart can make mistakes. Please verify important operational data.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Right Panel (Dashboard) */}
      <div className="hidden lg:block border-l border-slate-200 h-full bg-slate-50 shadow-xl z-20">
         <RightPanel state={appState} setActivePanel={(p) => setAppState(prev => ({...prev, activePanel: p}))} />
      </div>

    </div>
  );
};

export default App;
