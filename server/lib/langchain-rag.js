/**
 * LIV8 Command Center - LangChain RAG Module
 * Implements Retrieval Augmented Generation for intelligent ticket assistance
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import * as db from './database.js';
import { v4 as uuidv4 } from 'uuid';

// LLM instances
let claudeModel = null;
let openaiModel = null;
let currentModel = null;

// Simple in-memory vector store (using cosine similarity)
let vectorStore = [];

/**
 * Initialize LangChain with AI providers
 */
export function initLangChain(config = {}) {
  const anthropicKey = config.anthropicKey || process.env.ANTHROPIC_API_KEY;
  const openaiKey = config.openaiKey || process.env.OPENAI_API_KEY;

  if (anthropicKey) {
    claudeModel = new ChatAnthropic({
      anthropicApiKey: anthropicKey,
      modelName: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      maxTokens: 2048
    });
    console.log('LangChain: Claude model initialized');
  }

  if (openaiKey) {
    openaiModel = new ChatOpenAI({
      openAIApiKey: openaiKey,
      modelName: process.env.GPT_MODEL || 'gpt-4o',
      maxTokens: 2048
    });
    console.log('LangChain: OpenAI model initialized');
  }

  // Set default model
  currentModel = claudeModel || openaiModel;

  // Load existing embeddings from database
  loadVectorStore();

  return {
    claude: !!claudeModel,
    openai: !!openaiModel,
    hasModel: !!currentModel
  };
}

/**
 * Switch the active LangChain model
 */
export function switchLangChainModel(provider) {
  if (provider === 'openai' && openaiModel) {
    currentModel = openaiModel;
    return true;
  }
  if (provider === 'claude' && claudeModel) {
    currentModel = claudeModel;
    return true;
  }
  return false;
}

/**
 * Simple text embedding using TF-IDF-like approach
 * (For production, use OpenAI embeddings or similar)
 */
function createSimpleEmbedding(text) {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  // Create a simple word frequency vector
  const wordFreq = {};
  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }

  return wordFreq;
}

/**
 * Calculate cosine similarity between two word frequency vectors
 */
function cosineSimilarity(vec1, vec2) {
  const allWords = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const word of allWords) {
    const v1 = vec1[word] || 0;
    const v2 = vec2[word] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }

  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * Load vector store from database
 */
function loadVectorStore() {
  try {
    const embeddings = db.getEmbeddingsBySource('knowledge_base');
    vectorStore = embeddings.map(e => ({
      id: e.id,
      content: e.content,
      embedding: JSON.parse(e.embedding),
      metadata: JSON.parse(e.metadata || '{}'),
      sourceId: e.source_id
    }));
    console.log(`LangChain: Loaded ${vectorStore.length} embeddings from database`);
  } catch (e) {
    console.log('LangChain: Starting with empty vector store');
    vectorStore = [];
  }
}

/**
 * Add document to vector store
 */
export function addDocument(content, metadata = {}, sourceId = null) {
  const id = uuidv4();
  const embedding = createSimpleEmbedding(content);

  vectorStore.push({
    id,
    content,
    embedding,
    metadata,
    sourceId
  });

  // Persist to database
  try {
    db.storeEmbedding(id, content, embedding, metadata, 'knowledge_base', sourceId);
  } catch (e) {
    console.log('Failed to persist embedding:', e.message);
  }

  return id;
}

/**
 * Add ticket to knowledge base with embedding
 */
export function indexTicketForRAG(ticket, resolution = '') {
  const content = `
Ticket: ${ticket.subject}
Description: ${ticket.description_text || ticket.description || ''}
Resolution: ${resolution}
  `.trim();

  const metadata = {
    ticketId: ticket.id || ticket.freshdesk_id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    indexedAt: new Date().toISOString()
  };

  return addDocument(content, metadata, ticket.id || ticket.freshdesk_id);
}

/**
 * Search similar documents using vector similarity
 */
export function searchSimilar(query, limit = 5, threshold = 0.1) {
  const queryEmbedding = createSimpleEmbedding(query);

  const scored = vectorStore.map(doc => ({
    ...doc,
    score: cosineSimilarity(queryEmbedding, doc.embedding)
  }));

  return scored
    .filter(doc => doc.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * RAG-enhanced ticket response generation
 */
export async function generateRAGResponse(ticket, options = {}) {
  if (!currentModel) {
    throw new Error('No LangChain model initialized');
  }

  // 1. Search for similar tickets
  const query = `${ticket.subject} ${ticket.description_text || ticket.description || ''}`;
  const similarDocs = searchSimilar(query, 3);

  // 2. Build context from similar documents
  let context = '';
  if (similarDocs.length > 0) {
    context = `
SIMILAR RESOLVED TICKETS FROM KNOWLEDGE BASE:
${similarDocs.map((doc, i) => `
${i + 1}. (Relevance: ${(doc.score * 100).toFixed(1)}%)
${doc.content}
`).join('\n')}
`;
  }

  // 3. Create prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
You are a professional support agent helping with a customer ticket.

${context ? 'Use the following similar resolved tickets as reference:' : ''}
{context}

CURRENT TICKET:
Subject: {subject}
Description: {description}
Customer: {customerName}

Generate a helpful, professional response. Be concise but thorough.
Sign off as: {agentName}

Response:
`);

  // 4. Create chain
  const chain = RunnableSequence.from([
    promptTemplate,
    currentModel,
    new StringOutputParser()
  ]);

  // 5. Run chain
  const response = await chain.invoke({
    context: context || 'No similar tickets found.',
    subject: ticket.subject,
    description: ticket.description_text || ticket.description || 'No description',
    customerName: ticket.requester?.name || ticket.requester_name || 'Customer',
    agentName: options.agentName || 'Support Team'
  });

  return {
    response,
    similarTickets: similarDocs.map(d => ({
      id: d.metadata.ticketId,
      subject: d.metadata.subject,
      score: d.score
    })),
    model: currentModel === claudeModel ? 'claude' : 'openai'
  };
}

/**
 * RAG-enhanced question answering about ticket history
 */
export async function askKnowledgeBase(question, options = {}) {
  if (!currentModel) {
    throw new Error('No LangChain model initialized');
  }

  // Search for relevant documents
  const relevantDocs = searchSimilar(question, 5);

  if (relevantDocs.length === 0) {
    return {
      answer: "I couldn't find any relevant information in the knowledge base.",
      sources: []
    };
  }

  // Build context
  const context = relevantDocs.map((doc, i) =>
    `Source ${i + 1} (Relevance: ${(doc.score * 100).toFixed(1)}%):\n${doc.content}`
  ).join('\n\n');

  // Create QA prompt
  const qaPrompt = PromptTemplate.fromTemplate(`
Based on the following knowledge base entries, answer the question.
If the answer is not in the provided context, say so.

KNOWLEDGE BASE:
{context}

QUESTION: {question}

ANSWER:
`);

  const chain = RunnableSequence.from([
    qaPrompt,
    currentModel,
    new StringOutputParser()
  ]);

  const answer = await chain.invoke({
    context,
    question
  });

  return {
    answer,
    sources: relevantDocs.map(d => ({
      ticketId: d.metadata.ticketId,
      subject: d.metadata.subject,
      relevance: d.score
    }))
  };
}

/**
 * Agent collaboration chain - allows agents to work together
 */
export async function runAgentChain(task, agents = [], options = {}) {
  if (!currentModel) {
    throw new Error('No LangChain model initialized');
  }

  const results = [];

  for (const agent of agents) {
    const agentPrompt = PromptTemplate.fromTemplate(`
You are {agentName}, a {agentRole}.

TASK: {task}

PREVIOUS AGENT OUTPUTS:
{previousOutputs}

Based on your expertise, provide your analysis or contribution to this task.
Be specific and actionable.

YOUR OUTPUT:
`);

    const chain = RunnableSequence.from([
      agentPrompt,
      currentModel,
      new StringOutputParser()
    ]);

    const previousOutputs = results.length > 0
      ? results.map(r => `${r.agent}: ${r.output}`).join('\n\n')
      : 'None - you are the first agent.';

    const output = await chain.invoke({
      agentName: agent.name,
      agentRole: agent.role,
      task,
      previousOutputs
    });

    results.push({
      agent: agent.name,
      role: agent.role,
      output
    });

    // Log interaction
    try {
      db.logAgentInteraction(agent.id, 'chain_task', { task, previousOutputs }, { output }, options.context || '', true);
    } catch (e) {}
  }

  return {
    task,
    results,
    summary: results.map(r => r.output).join('\n\n---\n\n')
  };
}

/**
 * Sync resolved tickets to knowledge base
 */
export async function syncKnowledgeBase() {
  try {
    // Get all resolved tickets from database
    const resolvedTickets = db.getTicketsByStatus([4, 5]); // Resolved, Closed

    let indexed = 0;
    for (const ticket of resolvedTickets) {
      // Check if already indexed
      const existing = vectorStore.find(v => v.sourceId === ticket.freshdesk_id);
      if (!existing) {
        indexTicketForRAG(ticket);
        indexed++;
      }
    }

    console.log(`LangChain: Indexed ${indexed} new tickets to knowledge base`);
    return { indexed, total: vectorStore.length };
  } catch (e) {
    console.error('Failed to sync knowledge base:', e.message);
    return { indexed: 0, total: vectorStore.length, error: e.message };
  }
}

/**
 * Get knowledge base stats
 */
export function getRAGStats() {
  return {
    totalDocuments: vectorStore.length,
    models: {
      claude: !!claudeModel,
      openai: !!openaiModel,
      current: currentModel === claudeModel ? 'claude' : currentModel === openaiModel ? 'openai' : 'none'
    }
  };
}

export default {
  initLangChain,
  switchLangChainModel,
  addDocument,
  indexTicketForRAG,
  searchSimilar,
  generateRAGResponse,
  askKnowledgeBase,
  runAgentChain,
  syncKnowledgeBase,
  getRAGStats
};
