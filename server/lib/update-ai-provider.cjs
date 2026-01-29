const fs = require('fs');
let content = fs.readFileSync('ai-provider.js', 'utf8');

// Add Gemini initialization after OpenAI
if (!content.includes('Google (Gemini) client initialized')) {
  content = content.replace(
    /console\.log\('OpenAI \(GPT\) client initialized'\);\s*}/,
    `console.log('OpenAI (GPT) client initialized');
  }

  if (geminiKey) {
    geminiClient = new GoogleGenerativeAI(geminiKey);
    console.log('Google (Gemini) client initialized');
  }`
  );
}

// Update return to include gemini
if (!content.includes('gemini: !!geminiClient,')) {
  content = content.replace(
    'claude: !!anthropicClient,\n    openai: !!openaiClient,',
    'claude: !!anthropicClient,\n    openai: !!openaiClient,\n    gemini: !!geminiClient,'
  );
}

// Add Gemini check to switchProvider
if (!content.includes("provider === 'gemini' && !geminiClient")) {
  content = content.replace(
    "if (provider === 'claude' && !anthropicClient) {\n    throw new Error('Anthropic API key not configured');\n  }",
    `if (provider === 'claude' && !anthropicClient) {
    throw new Error('Anthropic API key not configured');
  }
  if (provider === 'gemini' && !geminiClient) {
    throw new Error('Gemini API key not configured');
  }`
  );
}

// Update getCurrentProvider available object
if (!content.includes('gemini: !!geminiClient\n    }')) {
  content = content.replace(
    'available: {\n      claude: !!anthropicClient,\n      openai: !!openaiClient\n    }',
    `available: {
      claude: !!anthropicClient,
      openai: !!openaiClient,
      gemini: !!geminiClient
    },
    hasKeys: {
      claude: !!storedKeys.anthropic,
      openai: !!storedKeys.openai,
      gemini: !!storedKeys.gemini
    }`
  );
}

// Add Gemini updateApiKey handler
if (!content.includes("provider === 'gemini'")) {
  content = content.replace(
    "return false;\n}\n\n/**\n * Main chat",
    `if (provider === 'gemini' || provider === 'google') {
    geminiClient = new GoogleGenerativeAI(apiKey);
    storedKeys.gemini = apiKey;
    try { setSetting('gemini_api_key', apiKey); } catch (e) {}
    console.log('Gemini API key updated');
    return true;
  }

  return false;
}

/**
 * Main chat`
  );
}

// Add Gemini to chat function
if (!content.includes("provider === 'gemini'")) {
  content = content.replace(
    "} else {\n      response = await chatWithClaude",
    `} else if (provider === 'gemini') {
      response = await chatWithGemini(messages, { model, maxTokens, temperature, systemPrompt });
      text = response.text || '';
    } else {
      response = await chatWithClaude`
  );
}

// Add chatWithGemini function before analyzeTicket
const geminiChatFunc = `
/**
 * Chat with Gemini (Google)
 */
async function chatWithGemini(messages, options) {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized. Add GEMINI_API_KEY to .env');
  }

  const model = geminiClient.getGenerativeModel({
    model: options.model || 'gemini-1.5-flash',
    generationConfig: {
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature
    }
  });

  const history = [];
  const systemContext = options.systemPrompt || '';

  for (const m of messages.slice(0, -1)) {
    history.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    });
  }

  const lastMessage = messages[messages.length - 1];
  let userMessage = lastMessage?.content || '';

  if (systemContext && history.length === 0) {
    userMessage = systemContext + '\n\n' + userMessage;
  }

  const chat = model.startChat({
    history: history.length > 0 ? history : undefined
  });

  const result = await chat.sendMessage(userMessage);
  const response = await result.response;

  return {
    text: response.text(),
    usage: {
      promptTokens: response.usageMetadata?.promptTokenCount,
      completionTokens: response.usageMetadata?.candidatesTokenCount,
      totalTokens: response.usageMetadata?.totalTokenCount
    }
  };
}

`;

if (!content.includes('chatWithGemini')) {
  content = content.replace(
    "/**\n * Analyze a support ticket\n */",
    geminiChatFunc + "/**\n * Analyze a support ticket\n */"
  );
}

// Update exports
if (!content.includes('getApiKeys')) {
  content = content.replace(
    'export default {\n  initAIProviders,',
    `export function getApiKeys() {
  const maskKey = (key) => {
    if (!key) return null;
    if (key.length < 12) return '****';
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
  };
  return {
    claude: maskKey(storedKeys.anthropic),
    openai: maskKey(storedKeys.openai),
    gemini: maskKey(storedKeys.gemini)
  };
}

export default {
  initAIProviders,
  getApiKeys,`
  );
}

fs.writeFileSync('ai-provider.js', content);
console.log('AI provider updated with Gemini support!');
