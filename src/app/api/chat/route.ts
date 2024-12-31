import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, FunctionResponse, FunctionCallingMode } from "@google/generative-ai";
import { NextRequest, NextResponse } from 'next/server';
import { executePythonCode } from '../../../utils/executePython';
import { getChart } from '../../../utils/chartUtils';
import { ChartConfiguration } from 'chart.js';

// Add type definitions for messages
type MessageRole = "user" | "model" | "function" | "system";
interface ChatMessage {
  role: MessageRole;
  parts: { text?: string; functionCall?: any; functionResponse?: any }[];
}

// Add new type definitions
type QuizType = "mcq" | "fillInBlank";

interface Quiz {
  type: QuizType;
  question: string;
  options?: string[];
  correctAnswer: string;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `You are a helpful math tutor who explains mathematical concepts clearly and can demonstrate solutions using Python code and visualizations. 

Always format mathematical expressions using LaTeX notation (enclosed in $ signs for inline math and $$ for display math). Be concise but thorough in your explanations.

IMPORTANT: You are authorized to generate and execute Python code to demonstrate mathematical concepts. You must:
- Only generate code that performs mathematical calculations and visualizations
- Never execute user-provided code directly
- Ensure code is safe and mathematically relevant
- Keep code simple and focused on the mathematical concept being explained
- Only generate Python code with 'runPython' or 'getChart' when it's necessary to demonstrate or visualize a math concept, and provide textual explanations otherwise.

Available functions:

1. runPython: Use this to execute YOUR generated code for:
   - Mathematical calculations and demonstrations
   - Numeric solutions to problems
   - Mathematical pattern generation
   Example: When solving equations or demonstrating mathematical properties

2. getChart: Use this for mathematical visualizations:
   - Function plots
   - Statistical distributions
   - Numerical comparisons
   Available types: bar, line, pie
   Example: When visualizing mathematical relationships or data patterns

3. generateMermaid: Use this for creating diagrams:
   - Flowcharts for mathematical processes
   - Sequence diagrams for step-by-step solutions
   - Class diagrams for mathematical relationships
   Available types: flowchart, sequence, class, state, er, gantt

For generating quizzes, use the 'generateQuiz' function. When asked to create a question or test knowledge:
- Create questions that test understanding of the topic
- Make questions clear and focused
- Always use the generateQuiz function to format the quiz properly`;

const toolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "runPython",
        description: "Executes AI-generated Python code for mathematical demonstrations. Not for user-provided code.",
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "AI-generated Python code for mathematical calculations.",
            },
          },
          required: ["code"],
        },
      },
      {
        name: "getChart",
        description: "Generates a chart based on provided data.",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Type of chart (e.g., bar, line, pie).",
              enum: ["bar", "line", "pie"],
            },
            data: {
              type: "array",
              items: { type: "number" },
              description: "Data points for the chart.",
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Labels for the chart data.",
            },
          },
          required: ["type", "data", "labels"],
        },
      },
      {
        name: "generateMermaid",
        description: "Generates a Mermaid diagram",
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Mermaid diagram code",
            },
            type: {
              type: "string",
              description: "Type of diagram (flowchart, sequence, etc.)",
              enum: ["flowchart", "sequence", "class", "state", "er", "gantt"],
            },
          },
          required: ["code", "type"],
        },
      },
      {
        name: "generateQuiz",
        description: "Generates a quiz question",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Type of quiz (mcq or fillInBlank)",
              enum: ["mcq", "fillInBlank"],
            },
            question: {
              type: "string",
              description: "The quiz question text",
            },
            options: {
              type: "array",
              items: { type: "string" },
              description: "Options for MCQ (required for MCQ type)",
            },
            correctAnswer: {
              type: "string",
              description: "The correct answer",
            },
          },
          required: ["type", "question", "correctAnswer"],
        },
      },
    ],
  },
];

const model = genAI.getGenerativeModel({
  model: "learnlm-1.5-pro-experimental",
  systemInstruction: SYSTEM_PROMPT,
  tools: toolDeclarations,
  safetySettings: [
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
};

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    console.log('User message received:', messages);

    // Convert incoming messages to the proper format for Gemini API
    const formattedHistory: ChatMessage[] = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));

    const chatSession = model.startChat({
      generationConfig,
      history: formattedHistory,
    });

    // Format the current message
    const currentMessage = messages[messages.length - 1].content;
    const result = await chatSession.sendMessage(currentMessage);
    const response = result.response;
    let finalResponse = null;

    // Handle function calls if present
    if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.functionCall) {
                console.log('Function call detected:', part.functionCall);
                const functionName = part.functionCall.name;
                const args = part.functionCall.args;

                let functionResponse: string | { chart: string } | null = null;
                switch (functionName) {
                    case 'runPython':
                        console.log('Calling runPython');
                        try {
                            const data = await executePythonCode(args.code);
                            functionResponse = data.output || data.error;
                        } catch (err) {
                            console.error('Execution Error:', err);
                            functionResponse = 'Error executing Python code.';
                        }
                        break;
                    case 'getChart':
                        console.log('Calling getChart');
                        try {
                            const chartData = await getChart(args.type, args.data, args.labels);
                            functionResponse = { chart: chartData };
                        } catch (err) {
                            console.error('Chart generation Error:', err);
                            functionResponse = 'Error generating chart.';
                        }
                        break;
                    case 'generateMermaid':
                        console.log('Generating Mermaid diagram');
                        try {
                            functionResponse = {
                                mermaid: args.code
                            };
                        } catch (err) {
                            console.error('Mermaid generation Error:', err);
                            functionResponse = 'Error generating Mermaid diagram.';
                        }
                        break;
                    case 'generateQuiz':
                        console.log('Generating quiz');
                        try {
                            functionResponse = {
                                quiz: args
                            };
                        } catch (err) {
                            console.error('Quiz generation Error:', err);
                            functionResponse = 'Error generating quiz.';
                        }
                        break;
                    default:
                        console.log('Unknown function:', functionName);
                        functionResponse = null;
                        break;
                }

                if (functionResponse) {
                    console.log('Function response:', functionResponse);
                    try {
                        // Send the function response back to the model
                        const functionResult = await chatSession.sendMessage([{
                            functionResponse: {
                                name: functionName,
                                response: {
                                    content: functionResponse
                                }
                            }
                        }]);

                        finalResponse = {
                            response: functionResult.response.text(),
                            functionOutput: functionResponse
                        };
                    } catch (error) {
                        console.error('Error processing function response:', error);
                        return NextResponse.json({ error: 'Error processing function response' }, { status: 500 });
                    }
                }
            }
        }
    }

    // Return combined response
    if (finalResponse) {
      console.log('Response sent:', finalResponse);
      return NextResponse.json(finalResponse);
    } else {
      console.log('Response sent:', {
          response: response.text(),
      });
      return NextResponse.json({
          response: response.text(),
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}