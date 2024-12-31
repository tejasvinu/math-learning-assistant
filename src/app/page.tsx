'use client';

import { useState, useEffect, useRef } from "react";
import dynamic from 'next/dynamic';
import { MathJaxContext } from 'better-react-mathjax';
import { BrainCircuit, Paperclip, Mic } from 'lucide-react';
import {
  CopyIcon,
  CornerDownLeft,
  RefreshCcw,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ChatBubble,
  ChatBubbleAction,
  ChatBubbleAvatar,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import remarkGfm from "remark-gfm";
import CodeDisplayBlock from "@/components/code-display-block";
import 'chart.js/auto';
import { Chart } from 'react-chartjs-2';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const MathJax = dynamic(() => import('better-react-mathjax').then(mod => mod.MathJax), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-24 rounded" />,
});

const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-full rounded" />,
});

const Mermaid = dynamic(() => import('react-mermaid2'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-24 w-full rounded" />,
});

const ChatAiIcons = [
  {
    icon: CopyIcon,
    label: "Copy",
  },
  {
    icon: RefreshCcw,
    label: "Refresh",
  },
  {
    icon: Volume2,
    label: "Volume",
  },
];

const config = {
  loader: { load: ["input/asciimath", "output/chtml", "[tex]/html"] },
  tex: {
    inlineMath: [["$", "$"]],
    displayMath: [["$$", "$$"]],
    packages: { "[+]": ["html"] }
  }
};

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string; functionOutput?: any }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizAnswer, setQuizAnswer] = useState('');

  const messagesRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsGenerating(true);
    setIsLoading(true);

    const userMessage = { role: 'user', content: input };
    console.log('User message:', userMessage);
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await response.json();
      const assistantMessage = { role: 'assistant', content: data.response, functionOutput: data.functionOutput };
      console.log('Assistant message:', assistantMessage);
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      // Optionally show error message to user
      const errorMessage = { role: 'assistant', content: 'Sorry, I encountered an error processing your request.' };
      console.log('Error message:', errorMessage);
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  const reload = async () => {
    if (messages.length === 0) return;
    
    setIsGenerating(true);
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    
    if (lastUserMessage) {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [lastUserMessage] }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch response');
        }

        const data = await response.json();
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { 
            role: 'assistant', 
            content: data.response 
          };
          return newMessages;
        });
      } catch (error) {
        console.error('Error:', error);
      }
    }
    setIsGenerating(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating || isLoading || !input) return;
      setIsGenerating(true);
      onSubmit(e);
    }
  };

  const handleActionClick = async (action, messageIndex) => {
    if (action === "Refresh") {
      setIsGenerating(true);
      try {
        await reload();
      } finally {
        setIsGenerating(false);
      }
    }

    if (action === "Copy") {
      const message = messages[messageIndex];
      if (message && message.role === "assistant") {
        navigator.clipboard.writeText(message.content);
      }
    }
  };

  const handleQuizSubmit = async () => {
    if (!activeQuiz || !quizAnswer) return;

    const userMessage = {
      role: 'user',
      content: `My answer to the quiz "${activeQuiz.question}" is: ${quizAnswer}`,
      isQuizAnswer: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) throw new Error('Failed to fetch response');

      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        functionOutput: data.functionOutput
      }]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsGenerating(false);
      setActiveQuiz(null);
      setQuizAnswer('');
    }
  };

  const QuizComponent = ({ quiz }) => {
    if (!quiz) return null;

    return (
      <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold mb-3">{quiz.question}</h3>
        {quiz.type === 'mcq' ? (
          <RadioGroup value={quizAnswer} onValueChange={setQuizAnswer}>
            {quiz.options.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`option-${idx}`} />
                <Label htmlFor={`option-${idx}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        ) : (
          <Input
            type="text"
            placeholder="Type your answer..."
            value={quizAnswer}
            onChange={(e) => setQuizAnswer(e.target.value)}
            className="mt-2"
          />
        )}
        <Button
          onClick={handleQuizSubmit}
          className="mt-4"
          disabled={!quizAnswer}
        >
          Submit Answer
        </Button>
      </div>
    );
  };

  const MessageContent = ({ content, functionOutput }) => {
    useEffect(() => {
      if (functionOutput?.quiz) {
        setActiveQuiz(functionOutput.quiz);
      }
    }, [functionOutput]);

    return (
      <MathJax dynamic>
        {typeof content === 'string' ? (
          content.split("```").map((part, index) => {
            if (index % 2 === 0) {
              return (
                <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
                  {part.replace(/\$(.*?)\$/g, (_, math) => `$${math}$`)}
                </ReactMarkdown>
              );
            } else {
              if (part.trim().startsWith('mermaid')) {
                return (
                  <div key={index} className="my-4">
                    <Mermaid chart={part.replace('mermaid\n', '')} />
                  </div>
                );
              }
              return (
                <pre className="whitespace-pre-wrap pt-2" key={index}>
                  <CodeDisplayBlock code={part} lang="" />
                </pre>
              );
            }
          })
        ) : (
          <div>
            {/* Handle non-string content */}
          </div>
        )}
        {functionOutput && (
          <>
            {functionOutput.chart && (
              <Chart
                type={functionOutput.chart.type}
                data={functionOutput.chart.data}
                options={functionOutput.chart.options}
                className="mt-2"
              />
            )}
            {functionOutput.mermaid && (
              <div className="my-4">
                <Mermaid chart={functionOutput.mermaid} />
              </div>
            )}
            {functionOutput.quiz && <QuizComponent quiz={functionOutput.quiz} />}
          </>
        )}
      </MathJax>
    );
  };

  const ChatBubbleMessage = ({ children }) => (
    <div>
      {children}
    </div>
  );

  return (
    <MathJaxContext config={config}>
      <main className="flex h-screen w-full flex-col items-center mx-auto py-6">
        <ChatMessageList ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <BrainCircuit className="w-16 h-16 text-blue-500 mb-4" />
              <h1 className="text-2xl font-bold mb-2">Welcome to Math Chat</h1>
              <p className="text-gray-500 dark:text-gray-400">
                Ask any math question and I'll help you understand it!
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              console.log(`Message ${index}:`, message);
              return (
                <ChatBubble
                  key={index}
                  variant={message.role === "user" ? "sent" : "received"}
                >
                  <ChatBubbleAvatar
                    src=""
                    fallback={message.role === "user" ? "👨🏽" : "🤖"}
                  />
                  <ChatBubbleMessage>
                    <MessageContent content={message.content} functionOutput={message.functionOutput} />
                    {message.role === "assistant" && messages.length - 1 === index && (
                      <div className="flex items-center mt-1.5 gap-1">
                        {!isGenerating && (
                          <>
                            {ChatAiIcons.map((icon, iconIndex) => {
                              const Icon = icon.icon;
                              return (
                                <ChatBubbleAction
                                  variant="outline"
                                  className="size-5"
                                  key={iconIndex}
                                  icon={<Icon className="size-3" />}
                                  onClick={() => handleActionClick(icon.label, index)}
                                />
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </ChatBubbleMessage>
                </ChatBubble>
              );
            })
          )}
          {isGenerating && (
            <ChatBubble variant="received">
              <ChatBubbleAvatar src="" fallback="🤖" />
              <ChatBubbleMessage isLoading />
            </ChatBubble>
          )}
        </ChatMessageList>

        <div className="w-full px-4">
          <form
            ref={formRef}
            onSubmit={onSubmit}
            className="relative rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
          >
            <ChatInput
              value={input}
              onKeyDown={onKeyDown}
              onChange={handleInputChange}
              placeholder="Ask any math question..."
              className="min-h-12 resize-none rounded-lg bg-background border-0 p-3 shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center p-3 pt-0">
              <Button variant="ghost" size="icon">
                <Paperclip className="size-4" />
                <span className="sr-only">Attach file</span>
              </Button>
              <Button variant="ghost" size="icon">
                <Mic className="size-4" />
                <span className="sr-only">Use Microphone</span>
              </Button>
              <Button
                disabled={!input || isLoading}
                type="submit"
                size="sm"
                className="ml-auto gap-1.5"
              >
                Send Message
                <CornerDownLeft className="size-3.5" />
              </Button>
            </div>
          </form>
        </div>
      </main>
    </MathJaxContext>
  );
}