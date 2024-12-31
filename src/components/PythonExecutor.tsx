
import { useState } from 'react';

export default function PythonExecutor() {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const executeCode = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/execute-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      setOutput(data.output || data.error);
    } catch (error) {
      setOutput('Error executing code');
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full h-48 p-2 border rounded"
        placeholder="Enter Python code here..."
      />
      <button
        onClick={executeCode}
        disabled={loading}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
      >
        {loading ? 'Running...' : 'Run Code'}
      </button>
      {output && (
        <pre className="mt-4 p-4 bg-gray-100 rounded">
          {output}
        </pre>
      )}
    </div>
  );
}