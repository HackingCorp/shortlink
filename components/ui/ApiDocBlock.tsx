'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

type ApiDocBlockProps = {
  title: string;
  description: string;
  method: 'GET' | 'POST' | 'DELETE';
  endpoint: string;
  body?: Record<string, any>;
};

export function ApiDocBlock({ title, description, method, endpoint, body }: ApiDocBlockProps) {
  const [copied, setCopied] = useState(false);
  
  const fullEndpoint = `${window.location.origin}${endpoint}`;

  const codeString = `curl -X ${method} "${fullEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: VOTRE_CLE_API" ${body ? `\\
  -d '${JSON.stringify(body, null, 2)}'` : ''}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    toast.success("Exemple de code copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const getMethodColor = () => {
    switch (method) {
      case 'POST': return 'bg-green-100 text-green-800';
      case 'GET': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      
      <div className="mt-4 flex items-center space-x-3">
        <span className={`px-3 py-1 text-sm font-bold rounded-full ${getMethodColor()}`}>{method}</span>
        <code className="text-sm font-mono bg-gray-100 p-2 rounded-md text-gray-700">{endpoint}</code>
      </div>

      <div className="mt-4 relative bg-gray-900 text-white rounded-lg p-4 font-mono text-sm">
        <button onClick={handleCopy} className="absolute top-3 right-3 p-1.5 bg-gray-700 rounded-md hover:bg-gray-600">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
        <pre><code className="language-bash">{codeString}</code></pre>
      </div>

      {body && (
        <div className="mt-4">
            <h4 className="font-semibold text-sm">Corps de la requête (Body) :</h4>
            <div className="mt-2 bg-gray-50 p-4 rounded-lg text-sm">
                <pre><code>{JSON.stringify(body, null, 2)}</code></pre>
            </div>
        </div>
      )}
    </div>
  );
}