"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Activity, Zap, MessageSquare, ExternalLink, CalendarCheck, Layers } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef } from "react";
import type { ToolUIPart, UIMessage } from "ai";
import { DefaultChatTransport } from "ai";

// Extract network statistics from AI responses
function extractNetworkStats(content: string | undefined) {
  if (!content) return undefined;

  const streetMatch = content.match(/(\d{1,3}(?:,\d{3})*) streets/);
  const laneMatch = content.match(/(\d{1,3}(?:,\d{3})*) lanes/);
  const intersectionMatch = content.match(/(\d{1,3}(?:,\d{3})*) intersections/);

  if (streetMatch || laneMatch || intersectionMatch) {
    return {
      streets: streetMatch ? parseInt(streetMatch[1].replace(/,/g, '')) : 0,
      lanes: laneMatch ? parseInt(laneMatch[1].replace(/,/g, '')) : 0,
      intersections: intersectionMatch ? parseInt(intersectionMatch[1].replace(/,/g, '')) : 0,
    };
  }
  return undefined;
}

const SUGGESTED_COMMANDS = [
  { icon: MapPin, text: "Transform entire network with superblocks", level: "Macro", levelColor: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { icon: Activity, text: "Create a cycling corridor", level: "Meso", levelColor: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { icon: Zap, text: "Add EV charging infrastructure", level: "Micro", levelColor: "bg-green-500/20 text-green-400 border-green-500/30" },
];

const EXPLORATION_COMMANDS = [
  { icon: MapPin, text: "Where did you make changes?", level: "Explore", levelColor: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { icon: Layers, text: "Show me the transformed areas", level: "Navigate", levelColor: "bg-green-500/20 text-green-400 border-green-500/30" },
  { icon: Activity, text: "What's different from before?", level: "Analysis", levelColor: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
];

interface ChatInterfaceProps {
  onMapChange?: (mapName: string) => void;
  onCameraUpdate?: (cameraData: any) => void;
}

export function ChatInterface({ onMapChange, onCameraUpdate }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [pendingMessage, setPendingMessage] = useState<UIMessage | null>(null);
  const processedToolOutputs = useRef<Set<string>>(new Set());
  const [promptCount, setPromptCount] = useState(0);
  const [promptLimit, setPromptLimit] = useState(5);
  const [betaBookingEnabled, setBetaBookingEnabled] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Check URL parameters for beta booking feature
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Check if beta feature is disabled
    const betaParam = params.get('beta');
    if (betaParam === 'off') {
      setBetaBookingEnabled(false);
    }

    // Read custom limit from URL (default 4)
    const limitParam = params.get('limit');
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        setPromptLimit(limit);
      }
    }
  }, []);

  // Start countdown when limit is reached
  useEffect(() => {
    if (betaBookingEnabled && promptCount >= promptLimit && countdown === null) {
      setCountdown(15); // Start 15-second countdown
    }
  }, [promptCount, promptLimit, betaBookingEnabled, countdown]);

  // Countdown timer and auto-redirect
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      window.location.href = 'https://goneon.city/after_prompting';
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    id: 'goneon-chat',
  });

  // Add initial welcome message on mount
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: '👋 I\'m **N!**, goNEON\'s AI agent. I help you complete urban planning tasks in **weeks instead of years**.\n\nI work across three levels:\n\n- **Macro**: City-wide mobility concepts\n- **Meso**: Corridor studies and route planning\n- **Micro**: Street space details (parking, charging stations)\n\nTry the suggestions below or ask me anything!',
            }
          ],
        }
      ]);
    }
  }, []);

  const handleSubmit = (message: PromptInputMessage, event: any) => {
    event.preventDefault();
    const hasText = Boolean(message.text?.trim());
    const isLoading = status === 'streaming' || status === 'submitted';
    if (!hasText || isLoading) return;

    // Check if limit is reached (if beta booking is enabled)
    if (betaBookingEnabled && promptCount >= promptLimit) {
      return; // Don't allow more prompts
    }

    // Add optimistic message immediately
    setPendingMessage({
      id: `pending-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text: message.text || '' }]
    });

    // Send message using the AI SDK v5 pattern (ONCE, outside setState)
    sendMessage({ text: message.text || '' });

    // Clear input
    setInput('');

    // Increment prompt count AFTER sending (if beta booking is enabled)
    if (betaBookingEnabled) {
      setPromptCount(prev => prev + 1);
    }
  };

  // Clear pending message when actual message arrives
  useEffect(() => {
    if (messages.length > 1 && pendingMessage) {
      setPendingMessage(null);
    }
  }, [messages, pendingMessage]);

  // Process tool outputs for map and camera updates (once per tool output)
  useEffect(() => {
    messages.forEach((message) => {
      const allParts = message.parts as Array<any>;
      const toolParts = allParts?.filter(
        (part) => part.type?.startsWith('tool-')
      ) as ToolUIPart[] | undefined;

      toolParts?.forEach((toolPart) => {
        // Create a unique ID for this tool output
        const toolOutputId = `${message.id}-${toolPart.type}`;

        // Only process if we haven't seen this output before and it's available
        if (
          toolPart.state === 'output-available' &&
          toolPart.output &&
          !processedToolOutputs.current.has(toolOutputId)
        ) {
          // Mark as processed
          processedToolOutputs.current.add(toolOutputId);

          // Parse the output
          const output = typeof toolPart.output === 'string'
            ? JSON.parse(toolPart.output)
            : toolPart.output;

          // Handle map changes - support both legacy string format and new MapState format
          if (output.mapState && onMapChange) {
            // New format: MapState with base network + overlays
            onMapChange(output.mapState);
          } else if (output.map && onMapChange) {
            // Legacy format: just a map name string (for MACRO/MESO)
            onMapChange(output.map);
          }

          // Handle camera updates for jump_to_location
          if (output.action === 'jump_to_location' && output.camera && onCameraUpdate) {
            onCameraUpdate(output.camera);
          }

          // Handle redirects for beta booking
          if (output.redirect_url) {
            window.location.href = output.redirect_url;
          }
        }
      });
    });
  }, [messages, onMapChange, onCameraUpdate]);

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Chat Header */}
      <div className="flex-shrink-0 border-b border-white/10 p-6">
        <h2 className="text-2xl font-bold text-white">N! Agent Chat</h2>
      </div>

      {/* Chat Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <Conversation className="flex-1 min-h-0">
          <ConversationContent>
            {messages.length === 0 && !pendingMessage ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="Welcome to N!"
                description="Complete urban planning tasks in weeks instead of years. Try Macro, Meso, or Micro level prompts below."
              />
            ) : (
              <>
                {messages.map((message) => {
                // Extract all text content for stats calculation
                const textParts = message.parts?.filter((part: any) => part.type === 'text') as Array<{ type: 'text'; text: string }> | undefined;
                const allTextContent = textParts?.map(part => part.text).join('');

                const stats = extractNetworkStats(allTextContent);

                return (
                  <Message from={message.role} key={message.id}>
                    <MessageContent className="text-base leading-relaxed">
                      {/* Render parts in their original order */}
                      {message.parts?.map((part: any, idx) => {
                        // Handle text parts
                        if (part.type === 'text') {
                          return <Response key={idx}>{part.text}</Response>;
                        }

                        // Handle tool parts (tool-call, tool-result, etc.)
                        if (part.type?.startsWith('tool-')) {
                          const toolPart = part as ToolUIPart;
                          return (
                            <div key={idx} className="my-3">
                              <Tool defaultOpen={false} className="bg-black border-secondary/30">
                                <ToolHeader
                                  type={toolPart.type}
                                  state={toolPart.state}
                                  title={toolPart.type.replace('tool-', '').replace(/_/g, ' ')}
                                />
                                <ToolContent>
                                  <ToolInput input={toolPart.input} />
                                  {(toolPart.state === 'output-available' || toolPart.state === 'output-error') && (
                                    <ToolOutput
                                      output={toolPart.output}
                                      errorText={toolPart.errorText}
                                    />
                                  )}
                                </ToolContent>
                              </Tool>
                            </div>
                          );
                        }

                        // Ignore other part types for now
                        return null;
                      })}

                      {/* Render stats badges at the end */}
                      {stats && (
                        <div className="mt-3 flex gap-2">
                          {stats.streets > 0 && (
                            <Badge variant="secondary" className="text-sm bg-secondary/20 text-secondary border-secondary/30">
                              {stats.streets.toLocaleString()} streets
                            </Badge>
                          )}
                          {stats.lanes > 0 && (
                            <Badge variant="secondary" className="text-sm bg-secondary/20 text-secondary border-secondary/30">
                              {stats.lanes.toLocaleString()} lanes
                            </Badge>
                          )}
                          {stats.intersections > 0 && (
                            <Badge variant="secondary" className="text-sm bg-secondary/20 text-secondary border-secondary/30">
                              {stats.intersections.toLocaleString()} intersections
                            </Badge>
                          )}
                        </div>
                      )}
                    </MessageContent>
                  </Message>
                );
              })}
                {/* Render pending message immediately */}
                {pendingMessage && (
                  <Message from={pendingMessage.role} key={pendingMessage.id}>
                    <MessageContent className="text-base leading-relaxed">
                      <Response>{(pendingMessage.parts[0] as any)?.text}</Response>
                    </MessageContent>
                  </Message>
                )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Exploration Suggestions - Show for messages 1-2 */}
        {promptCount >= 1 && promptCount < 3 && (!betaBookingEnabled || promptCount < promptLimit) && (
          <div className="flex-shrink-0 border-t border-white/10 p-6">
            <p className="text-sm text-gray-400 mb-3">Explore your transformation:</p>
            <div className="flex overflow-x-auto scrollbar-hide gap-2 snap-x snap-mandatory pb-2 -mx-2 px-2">
              {EXPLORATION_COMMANDS.map((cmd, index) => (
                <Suggestion
                  key={index}
                  onClick={() => handleSuggestion(cmd.text)}
                  suggestion={cmd.text}
                  variant="ghost"
                  className="flex-shrink-0 w-72 justify-start text-sm h-12 text-gray-300 hover:text-white hover:bg-white/5 border border-white/20 hover:border-white/40 rounded-lg px-4 snap-start"
                >
                  <cmd.icon className="h-4 w-4 mr-3 text-secondary flex-shrink-0" />
                  <Badge variant="outline" className={`mr-3 text-xs border ${cmd.levelColor} flex-shrink-0`}>
                    {cmd.level}
                  </Badge>
                  <span className="truncate">{cmd.text}</span>
                </Suggestion>
              ))}
            </div>
          </div>
        )}

        {/* Booking Call Suggestion - Show after 3 messages (1 transform + 2 questions) */}
        {promptCount >= 3 && (!betaBookingEnabled || promptCount < promptLimit) && (
          <div className="flex-shrink-0 border-t border-white/10 p-6">
            <p className="text-sm text-gray-400 mb-3">Interested in more?</p>
            <Suggestion
              onClick={() => handleSuggestion("I want to book a call for my city")}
              suggestion="I want to book a call for my city"
              variant="ghost"
              className="w-full justify-start text-sm h-12 text-white hover:text-white hover:bg-primary/20 border border-primary/30 hover:border-primary/60 rounded-lg px-4 bg-primary/10"
            >
              <CalendarCheck className="h-4 w-4 mr-3 text-primary flex-shrink-0" />
              <Badge variant="outline" className="mr-3 text-xs border bg-primary/20 text-primary border-primary/30 flex-shrink-0">
                Sales
              </Badge>
              <span className="truncate">I want to book a call for my city</span>
            </Suggestion>
          </div>
        )}

        {/* Initial Suggested Commands - Only show when no user messages yet */}
        {promptCount === 0 && (
          <div className="flex-shrink-0 border-t border-white/10 p-6">
            <p className="text-sm text-gray-400 mb-3">Try these commands:</p>
            <div className="flex overflow-x-auto scrollbar-hide gap-2 snap-x snap-mandatory pb-2 -mx-2 px-2">
              {SUGGESTED_COMMANDS.map((cmd, index) => (
              <Suggestion
                key={index}
                onClick={() => handleSuggestion(cmd.text)}
                suggestion={cmd.text}
                variant="ghost"
                className="flex-shrink-0 w-80 justify-start text-sm h-12 text-gray-300 hover:text-white hover:bg-white/5 border border-white/20 hover:border-white/40 rounded-lg px-4 snap-start"
              >
                <cmd.icon className="h-4 w-4 mr-3 text-secondary flex-shrink-0" />
                <Badge variant="outline" className={`mr-3 text-xs border ${cmd.levelColor} flex-shrink-0`}>
                  {cmd.level}
                </Badge>
                <span className="truncate">{cmd.text}</span>
              </Suggestion>
            ))}
            </div>
          </div>
        )}

        {/* Input or Demo Limit Reached */}
        <div className="flex-shrink-0 border-t border-white/10 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              Error: {error.message}. Please check your OpenAI API key in .env.local
            </div>
          )}

          {/* Show limit reached UI if limit is reached and beta booking is enabled */}
          {betaBookingEnabled && promptCount >= promptLimit ? (
            <div className="w-full p-6 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Demo Limit Reached!</h3>
                <p className="text-gray-300 mb-4">
                  You've explored {promptLimit} prompts. Ready to see what goNEON can do for your city?
                </p>
                {countdown !== null && (
                  <p className="text-sm text-gray-400 mb-4">
                    Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}...
                  </p>
                )}
                <Button
                  onClick={() => window.location.href = 'https://goneon.city/after_prompting'}
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-3 text-lg"
                >
                  Book a Beta Demo Call
                  <ExternalLink className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          ) : (
            <PromptInput onSubmit={handleSubmit} className="w-full">
              <PromptInputBody>
                <PromptInputTextarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me to create or modify a street network..."
                  className="text-base bg-black border-white/20 text-white placeholder:text-gray-400 focus:border-primary/50 focus:ring-primary/20 min-h-12"
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  {/* Empty for now, but can add action buttons here later */}
                </PromptInputTools>
                <PromptInputSubmit
                  status={status === 'streaming' || status === 'submitted' ? 'streaming' : 'ready'}
                  disabled={!input?.trim() || status === 'streaming' || status === 'submitted'}
                  className="bg-primary hover:bg-primary/90 text-white h-10 w-10"
                />
              </PromptInputFooter>
            </PromptInput>
          )}
        </div>
      </div>
    </div>
  );
}

// Custom styles for goNEON branding
// The AI Elements components will inherit our global CSS variables