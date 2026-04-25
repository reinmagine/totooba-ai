import { useState, useRef, useEffect } from 'react';
import { createAgentChatSession, executeMockTool } from './agent';
import { ShieldCheck, ShieldAlert, Send, Loader2, Bot, User, Search } from 'lucide-react';
import './index.css';

type Message = {
  role: 'user' | 'model' | 'system';
  content: string;
  isVerifying?: boolean;
  verdict?: 'TOTOO' | 'BUDOL' | 'PEKE' | null;
};

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: 'Mabuhay! Ako si TotooBa.AI, ang iyong personal na Anti-Scam at Fact-Checking Agent. Magpadala ng text, link, o chismis para ma-verify natin kung ito ba ay BUDOL, PEKE, o TOTOO.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize chat session on mount
    try {
      const session = createAgentChatSession();
      setChatSession(session);
    } catch (e) {
      console.error("Failed to initialize chat session", e);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatSession) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setIsLoading(true);

    try {
      let result = await chatSession.sendMessage(userText);
      let response = result.response;

      // Check if the model decided to call tools
      let calls = response.functionCalls ? response.functionCalls() : [];
      while (calls && calls.length > 0) {
        const call = calls[0]; // Process first tool call
        
        // Show scanning state
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: `🔎 Kino-crosscheck sa database gamit ang tool: ${call.name}...`,
          isVerifying: true 
        }]);

        // Execute tool
        const toolResult = await executeMockTool(call.name, call.args);
        
        // Send tool result back to model
        result = await chatSession.sendMessage([{
          functionResponse: {
            name: call.name,
            response: toolResult
          }
        }]);
        
        response = result.response;
        calls = response.functionCalls ? response.functionCalls() : [];
        
        // Remove the scanning message
        setMessages(prev => prev.filter(m => !m.isVerifying));
      }

      const text = response.text();
      
      // Try to parse verdict for UI coloring
      let verdict: Message['verdict'] = null;
      if (text.includes("BUDOL")) verdict = 'BUDOL';
      else if (text.includes("PEKE")) verdict = 'PEKE';
      else if (text.includes("TOTOO")) verdict = 'TOTOO';

      setMessages(prev => [...prev, { role: 'model', content: text, verdict }]);
      
    } catch (error) {
      console.error("Error communicating with Agent:", error);
      setMessages(prev => [...prev, { role: 'model', content: 'Oops! May error sa system natin. Siguraduhin na tama ang API Key sa .env.local file.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderVerdictIcon = (verdict: Message['verdict']) => {
    if (verdict === 'BUDOL' || verdict === 'PEKE') return <ShieldAlert className="text-red-500" size={24} />;
    if (verdict === 'TOTOO') return <ShieldCheck className="text-green-500" size={24} />;
    return <Bot size={24} className="text-blue-400" />;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <ShieldCheck className="text-emerald-400" size={32} />
          <div>
            <h1>TotooBa.AI</h1>
            <p>Anti-Budol & Fact-Check Agent</p>
          </div>
        </div>
      </header>

      <main className="chat-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message-wrapper ${msg.role}`}>
            {msg.role === 'model' && (
              <div className="avatar model-avatar">
                {renderVerdictIcon(msg.verdict)}
              </div>
            )}
            {msg.role === 'user' && (
              <div className="avatar user-avatar">
                <User size={20} />
              </div>
            )}
            
            <div className={`message-bubble ${msg.role} ${msg.verdict ? msg.verdict.toLowerCase() : ''}`}>
              {msg.role === 'system' ? (
                <div className="system-message">
                  <Search className="spin" size={16} />
                  <span>{msg.content}</span>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              )}
            </div>
          </div>
        ))}
        {isLoading && !messages.some(m => m.isVerifying) && (
          <div className="message-wrapper model">
             <div className="avatar model-avatar">
               <Bot size={24} className="text-blue-400" />
             </div>
             <div className="message-bubble typing">
               <Loader2 className="spin" size={20} />
               <span>Si TotooBa ay nag-iisip...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="input-area">
        <div className="input-wrapper">
          <textarea 
            placeholder="I-paste ang kahina-hinalang text, link, o balita dito..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
          />
          <button onClick={handleSend} disabled={isLoading || !input.trim()}>
            <Send size={20} />
          </button>
        </div>
        <div className="suggestions">
          <span onClick={() => setInput("Pahingi po ng OTP nyo para ma-secure ang GCash nyo.")}>Subukan: GCash Scam</span>
          <span onClick={() => setInput("Sabi sa FB may lockdown daw sa buong Manila bukas?")}>Subukan: Fake News</span>
          <span onClick={() => setInput("Kunin ang iyong libreng DSWD ayuda dito: http://dswd.ayuda-claim.ph")}>Subukan: Phishing Link</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
