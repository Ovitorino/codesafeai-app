import React, { useState, useEffect } from 'react';
import { Bot, AlertTriangle, History, CheckCircle, Lightbulb, Clipboard, TestTube2, BookOpen, Sparkles } from 'lucide-react';


const API_KEY = "AIzaSyBg60H90oIxmfu0AcpGnI7gioVXzsLl690";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// --- Componentes de UI reutilizáveis ---
const LoadingSpinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const CopyButton = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar texto: ', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <button onClick={handleCopy} className="absolute top-3 right-3 bg-gray-700 hover:bg-gray-600 p-2 rounded-md transition-colors">
      {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Clipboard className="w-5 h-5 text-gray-400" />}
    </button>
  );
};


// --- Componente Principal da Aplicação ---
export default function App() {
  // --- Estados do Componente ---
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [history, setHistory] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [unitTests, setUnitTests] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');
  const [error, setError] = useState('');


  // --- Efeitos ---
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('codeSafeAIHistory');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (err) {
      console.error("Falha ao carregar histórico:", err);
    }
  }, []);

  useEffect(() => {
    try {
      if (history.length > 0) {
        localStorage.setItem('codeSafeAIHistory', JSON.stringify(history));
      }
    } catch (err) {
      console.error("Falha ao salvar histórico:", err);
    }
  }, [history]);

  // --- Funções Auxiliares da API ---
  const callGeminiAPI = async (prompt) => {
    if (!API_KEY || API_KEY === "COLE_SUA_CHAVE_DE_API_AQUI") {
        throw new Error("Chave de API não configurada. Por favor, adicione sua chave de API do Gemini no topo do arquivo App.jsx.");
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error("Erro da API:", errorBody);
        throw new Error(`Erro na API: ${errorBody.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    throw new Error("Resposta da IA inválida ou vazia.");
  };

  // --- Funções de Detecção e Análise ---
  const detectBasicFlaws = (text) => {
    const flaws = [];
    const patterns = {
      'Uso de `eval()` perigoso detectado. Esta função pode executar código malicioso.': /eval\s*\(/i,
      '`SELECT *` pode impactar a performance e expor dados sensíveis. Especifique as colunas.': /SELECT\s+\*\s+FROM/i,
      'Uso de `alert()` pode ser indesejado em produção. Considere um sistema de notificações mais robusto.': /alert\s*\(/i,
      'Chaves de API ou senhas hardcoded detectadas. Use variáveis de ambiente.': /(api_key|password|secret|token)\s*=\s*['"][^'"]+['"]/i,
      'O uso de `innerHTML` pode abrir brechas para ataques de XSS. Prefira `innerText` ou sanitização.': /\.innerHTML\s*=/i,
      '`Math.random()` não é seguro para fins criptográficos. Use `crypto.getRandomValues()`.': /Math\.random/i,
    };
    for (const message in patterns) {
      if (patterns[message].test(text)) flaws.push(message);
    }
    return flaws;
  };
  
  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError('');
    setActiveTab('analysis');
    
    const basicAlerts = detectBasicFlaws(code);
    const prompt = `
      Você é um engenheiro de software sênior e especialista em segurança (CodeSafeAI).
      Analise o código ${language} abaixo.
      Retorne um objeto JSON com duas chaves: "suggestions" e "security_warnings".

      - "suggestions": Um array de strings com sugestões para melhorar a qualidade do código (performance, legibilidade, boas práticas, refatoração).
      - "security_warnings": Um array de strings com alertas de segurança que você identificar, além dos que já possam ter sido detectados.

      Seja específico, técnico e forneça o motivo de cada ponto. Não inclua alertas que já foram detectados localmente.

      Código para análise:
      \`\`\`${language}
      ${code}
      \`\`\`
    `;

    try {
      const rawText = await callGeminiAPI(prompt);
      const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
      const parsedJson = JSON.parse(jsonString);

      const finalResult = {
        suggestions: parsedJson.suggestions || [],
        security: [...new Set([...basicAlerts, ...(parsedJson.security_warnings || [])])],
        timestamp: new Date().toISOString(),
        code,
        language,
      };
      setAnalysisResult(finalResult);
      if (finalResult.suggestions.length > 0 || finalResult.security.length > 0) {
        setHistory(prev => [finalResult, ...prev].slice(0, 5));
      }
    } catch (err) {
      console.error("Erro ao analisar:", err);
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!code.trim()) return;
    setIsGeneratingTests(true);
    setUnitTests('');
    setError('');
    setActiveTab('tests');

    const testFramework = language === 'javascript' ? 'Jest' : language === 'python' ? 'Pytest' : 'um framework de teste popular';
    const prompt = `
      Você é um engenheiro de QA especialista em automação de testes.
      Sua tarefa é criar testes unitários para o seguinte código em ${language}, utilizando o framework ${testFramework}.
      - Cubra os principais cenários de sucesso (happy path).
      - Inclua casos de teste para cenários de erro ou valores inesperados (edge cases).
      - Organize os testes de forma clara e legível.
      - Retorne APENAS o bloco de código do teste, sem explicações adicionais.

      Código para testar:
      \`\`\`${language}
      ${code}
      \`\`\`
    `;

    try {
      const response = await callGeminiAPI(prompt);
      setUnitTests(response);
    } catch (err) {
      console.error("Erro ao gerar testes:", err);
      setError(err.message);
    } finally {
      setIsGeneratingTests(false);
    }
  };

  const handleExplainCode = async () => {
    if (!code.trim()) return;
    setIsExplaining(true);
    setExplanation('');
    setError('');
    setActiveTab('explanation');

    const prompt = `
      Assuma o papel de um professor de programação experiente ensinando um aluno iniciante.
      Explique o código (${language}) abaixo de forma extremamente clara, simples e didática, em português do Brasil.

      Siga esta estrutura:
      1.  **Objetivo Geral:** Comece com uma frase resumindo o que o código faz.
      2.  **Passo a Passo:** Explique a lógica linha por linha ou bloco por bloco, como se estivesse acompanhando a execução do código.
      3.  **Conceitos-Chave:** No final, liste e explique brevemente 1 ou 2 conceitos de programação importantes presentes no código (ex: "funções", "loops", "condicionais").

      Use markdown para formatar a resposta com títulos, listas e negrito para facilitar a leitura.

      Código para explicar:
      \`\`\`${language}
      ${code}
      \`\`\`
    `;
    
    try {
      const response = await callGeminiAPI(prompt);
      setExplanation(response);
    } catch (err) {
      console.error("Erro ao explicar código:", err);
      setError(err.message);
    } finally {
      setIsExplaining(false);
    }
  };
  
  const loadFromHistory = (item) => {
    setCode(item.code);
    setLanguage(item.language);
    setAnalysisResult(item);
    setUnitTests('');
    setExplanation('');
    setActiveTab('analysis');
    window.scrollTo(0, 0);
  };

  const isLoading = isAnalyzing || isGeneratingTests || isExplaining;
  const showResults = analysisResult || unitTests || explanation || error;

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen font-sans flex flex-col">
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Bot className="text-cyan-400 w-8 h-8" />
            <h1 className="text-2xl font-bold text-white tracking-tight">CodeSafe<span className="text-cyan-400">AI</span></h1>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 flex flex-col gap-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-white">Analisar Código</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="language-select" className="block text-sm font-medium text-gray-400 mb-1">Linguagem</label>
                  <select id="language-select" value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                    <option value="javascript">JavaScript</option><option value="python">Python</option><option value="java">Java</option><option value="csharp">C#</option><option value="php">PHP</option><option value="ruby">Ruby</option><option value="go">Go</option><option value="html">HTML</option><option value="css">CSS</option><option value="sql">SQL</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="code-textarea" className="block text-sm font-medium text-gray-400 mb-1">Seu Código</label>
                  <textarea id="code-textarea" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Cole seu trecho de código aqui..." className="w-full h-64 bg-gray-900 border border-gray-600 rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-y" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={handleAnalyze} disabled={isLoading || !code} className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center gap-2 transition-colors duration-200">
                    {isAnalyzing ? <><LoadingSpinner /> Analisando...</> : <><Bot size={18} /> Analisar Código</>}
                  </button>
                   <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleGenerateTests} disabled={isLoading || !code} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center gap-2 transition-colors duration-200 text-sm">
                      {isGeneratingTests ? <><LoadingSpinner /> Gerando...</> : <><Sparkles size={16} /> Gerar Testes</>}
                    </button>
                    <button onClick={handleExplainCode} disabled={isLoading || !code} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center gap-2 transition-colors duration-200 text-sm">
                      {isExplaining ? <><LoadingSpinner /> Explicando...</> : <><Sparkles size={16} /> Explicar Código</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {history.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white"><History size={20} /> Histórico Recente</h3>
                <div className="space-y-3">
                  {history.map((item, index) => (
                    <div key={index} onClick={() => loadFromHistory(item)} className="bg-gray-700/50 p-3 rounded-md border border-gray-600 hover:bg-gray-700 transition-colors duration-200 cursor-pointer">
                      <p className="text-sm text-gray-300 truncate font-mono"><span className="font-bold text-cyan-400">{item.language}:</span> {item.code.split('\n')[0]}</p>
                      <span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="lg:col-span-2 bg-gray-800 p-1 md:p-2 rounded-lg shadow-lg border border-gray-700 min-h-[500px]">
            {!showResults && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8 rounded-lg bg-gray-900/50">
                <Bot className="w-16 h-16 text-gray-500 mb-4" />
                <h3 className="text-xl font-semibold text-white">Bem-vindo ao CodeSafeAI</h3>
                <p className="mt-2 max-w-md">Cole seu código, analise, gere testes ou peça uma explicação detalhada com o poder da IA.</p>
              </div>
            )}
            
            {isLoading && !showResults && (
                 <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Sparkles className="w-16 h-16 text-cyan-500 animate-pulse" />
                    <p className="mt-4 text-lg">A IA está trabalhando no seu pedido...</p>
                </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center h-full text-center text-red-400 p-8">
                 <AlertTriangle className="w-16 h-16 mb-4" />
                 <h3 className="text-xl font-semibold text-white">Ocorreu um Erro</h3>
                 <p className="mt-2 max-w-md">{error}</p>
              </div>
            )}

            {showResults && !error && (
              <div className="flex flex-col h-full">
                <div className="flex border-b border-gray-700">
                  <TabButton icon={<Lightbulb size={16}/>} label="Análise" activeTab={activeTab} tabName="analysis" onClick={() => setActiveTab('analysis')} disabled={!analysisResult} />
                  <TabButton icon={<TestTube2 size={16}/>} label="Testes Unitários" activeTab={activeTab} tabName="tests" onClick={() => setActiveTab('tests')} disabled={!unitTests}/>
                  <TabButton icon={<BookOpen size={16}/>} label="Explicação" activeTab={activeTab} tabName="explanation" onClick={() => setActiveTab('explanation')} disabled={!explanation}/>
                </div>
                
                <div className="p-6 flex-grow overflow-y-auto">
                    {activeTab === 'analysis' && analysisResult && <AnalysisContent result={analysisResult} />}
                    {activeTab === 'tests' && unitTests && <CodeContent code={unitTests} language={language} />}
                    {activeTab === 'explanation' && explanation && <MarkdownContent content={explanation} />}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 mt-8">
        <div className="container mx-auto px-4 py-4 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} CodeSafeAI. Ferramenta para fins educacionais e de auxílio.</p>
        </div>
      </footer>
    </div>
  );
}

// --- Componentes de Conteúdo para as Abas ---
const TabButton = ({ icon, label, activeTab, tabName, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} className={`flex items-center gap-2 font-medium text-sm py-3 px-5 transition-colors ${activeTab === tabName ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'} disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent`}>
      {icon} {label}
    </button>
)

const AnalysisContent = ({ result }) => (
  <div className="space-y-8">
    <div>
      <h3 className="text-xl font-semibold mb-3 flex items-center gap-2 text-green-400"><Lightbulb />Sugestões de Melhoria</h3>
      {result.suggestions?.length > 0 ? (
        <ul className="space-y-3 list-inside">{result.suggestions.map((s, i) => <li key={i} className="bg-gray-900/70 p-4 rounded-md border-l-4 border-green-500 text-gray-300">{s}</li>)}</ul>
      ) : <p className="text-gray-400 bg-gray-900/70 p-4 rounded-md">Nenhuma sugestão de melhoria encontrada.</p>}
    </div>
    <div>
      <h3 className="text-xl font-semibold mb-3 flex items-center gap-2 text-yellow-400"><AlertTriangle />Alertas de Segurança</h3>
      {result.security?.length > 0 ? (
        <ul className="space-y-3 list-inside">{result.security.map((s, i) => <li key={i} className="bg-gray-900/70 p-4 rounded-md border-l-4 border-yellow-500 text-gray-300">{s}</li>)}</ul>
      ) : <p className="text-gray-400 bg-gray-900/70 p-4 rounded-md">Nenhum alerta de segurança detectado.</p>}
    </div>
  </div>
);

const CodeContent = ({ code, language }) => {
    const codeBlocks = code.match(/```(?:\w+)?\n([\s\S]+?)\n```/g);
    const displayedCode = codeBlocks ? codeBlocks.map(block => block.replace(/```(?:\w+)?\n|```/g, '')).join('\n---\n') : code;

    return (
        <div className="relative">
            <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm font-mono text-gray-200">
                <code>{displayedCode}</code>
            </pre>
            <CopyButton textToCopy={displayedCode} />
        </div>
    );
};

const MarkdownContent = ({ content }) => {
    const formattedContent = content
        .replace(/```(?:\w+)?\n([\s\S]+?)\n```/g, (match, p1) => `<pre class="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm font-mono my-4">${p1.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`)
        .replace(/`([^`]+)`/g, `<code class="bg-gray-700 text-cyan-400 rounded px-1 py-0.5 font-mono text-sm">${'$1'}</code>`)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^(#+)\s(.*)/gm, (match, p1, p2) => `<h${p1.length + 1} class="text-white font-bold mt-6 mb-2">${p2}</h${p1.length + 1}>`)
        .replace(/^- (.*)/gm, '<li class="ml-6">$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc mb-4">$1</ul>');

    return (
        <div className="relative">
            <div className="prose prose-invert max-w-none text-gray-300" dangerouslySetInnerHTML={{ __html: formattedContent }} />
            <CopyButton textToCopy={content} />
        </div>
    );
};
