
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from 'next/server';
import { executePythonCode } from '../../../utils/executePython'; // Updated import with relative path
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { getChart } from '../../../utils/chartUtils';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "learnlm-1.5-pro-experimental" });

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
};

const SYSTEM_PROMPT = "You are a helpful math tutor who can explain mathematical concepts clearly. Always format mathematical expressions using LaTeX notation (enclosed in $ signs for inline math and $$ for display math). Be concise but thorough in your explanations.";

const toolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "runPython",
        description: "Executes Python code provided by the user.",
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Python code to execute.",
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
    ],
  },
];

const tutorModel = genAI.getGenerativeModel({
  model: "learnlm-1.5-pro-experimental",
  tools: toolDeclarations,
});

const chillModel = genAI.getGenerativeModel({
  model: "learnlm-1.5-pro-experimental",
  tools: toolDeclarations,
});

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    
    const chat = model.startChat({
      generationConfig,
    });

    // Send system prompt first
    await chat.sendMessage([{ text: SYSTEM_PROMPT }]);
    
    // Send user message
    const result = await chat.sendMessage([{ text: messages[messages.length - 1].content }]);
    const text = result.response.text();

    for (const candidate of result.response.candidates) {
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          const items = part.functionCall.args;
          const args = Object
            .keys(items)
            .map((data) => [data, items[data]])
            .map(([key, value]) => `${key}:${value}`)
            .join(', ');
          console.log(`${part.functionCall.name}(${args})`);
          
          if (part.functionCall.name === "runPython") {
            const { code } = items;
            try {
              const data = await executePythonCode(code); // Call the utility function

              if (data.output) {
                return NextResponse.json({ response: data.output });
              } else {
                return NextResponse.json({ response: `Error: ${data.error}` }, { status: 400 });
              }
            } catch (err) {
              console.error('Execution Error:', err);
              return NextResponse.json({ response: 'Error executing Python code.' }, { status: 500 });
            }
          }

          if (part.functionCall.name === "getChart") {
            const { type, data, labels } = items;
            try {
              const chartData = await getChart(type, data, labels);
              return NextResponse.json({ response: { chart: chartData } });
            } catch (err) {
              console.error('Chart generation Error:', err);
              return NextResponse.json({ response: 'Error generating chart.' }, { status: 500 });
            }
          }
        }
      }
    }

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// Implement the getChart function to return chart data
async function getChart(type: string, data: number[], labels: string[]): Promise<ChartConfiguration> {
  return {
    type: type as 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Generated Chart',
          data,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
        },
      },
    },
  };
}