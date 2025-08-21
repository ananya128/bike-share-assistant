import dotenv from 'dotenv';

dotenv.config();

interface LLMResponse {
  tables: string[];
  columns: string[];
  intent: string;
  filters: Array<{ column: string; operator: string; value: any }>;
  aggregations: Array<{ function: string; column: string; alias?: string }>;
  reasoning: string;
}

class LLMService {
  private apiKey: string | undefined;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
    this.model = process.env.GROQ_MODEL || 'llama3-8b-8192';
  }

  /**
   * Analyze user question and extract database query intent
   */
  public async analyzeQuestion(question: string, schema: any[]): Promise<LLMResponse> {
    if (!this.apiKey) {
      console.log('⚠️ No Groq API key found, using fallback analysis');
      return this.fallbackAnalysis(question, schema);
    }

    try {
      const prompt = this.buildAnalysisPrompt(question, schema);
      const response = await this.callGroq(prompt);
      return this.parseLLMResponse(response);
    } catch (error) {
      console.error('❌ Groq API analysis failed, using fallback:', error);
      return this.fallbackAnalysis(question, schema);
    }
  }

  /**
   * Simple query analysis method for semantic mapping enhancement
   */
  public async analyzeQuery(userText: string): Promise<string> {
    try {
      const prompt = `Analyze this bike share query and provide structured insights:

Query: "${userText}"

Provide a JSON response with:
- intent: What the user wants to know
- suggestedTables: Which tables are most relevant
- suggestedColumns: Which columns are most relevant  
- filters: What filters should be applied
- aggregations: What aggregations are needed
- reasoning: Brief explanation of your analysis

Focus on bike share domain knowledge and SQL best practices.`;

      return await this.callGroq(prompt);
    } catch (error) {
      console.error('❌ Query analysis failed:', error);
      throw error;
    }
  }

  /**
   * Build a comprehensive prompt for the LLM
   */
  private buildAnalysisPrompt(question: string, schema: any[]): string {
    const schemaInfo = this.formatSchemaForLLM(schema);
    
    return `You are a database query analyzer for a bike-share system. Analyze the user question and provide structured information.

Database Schema:
${schemaInfo}

User Question: "${question}"

Please analyze this question and provide a JSON response with the following structure:
{
  "tables": ["list", "of", "relevant", "tables"],
  "columns": ["list", "of", "relevant", "columns"],
  "intent": "brief description of what the user wants",
  "filters": [
    {"column": "column_name", "operator": "=", "value": "example_value"}
  ],
  "aggregations": [
    {"function": "AVG", "column": "column_name", "alias": "alias_name"}
  ],
  "reasoning": "explanation of your analysis"
}

Focus on:
- Which tables are needed (trips, stations, daily_weather, bikes)
- Which columns are relevant
- What filters should be applied
- What aggregations are needed
- Handle date expressions like "June 2025", "first week of June 2025"
- Handle location references like "Congress Avenue"
- Handle gender references like "women", "men"
- Handle weather conditions like "rainy days"

Response (JSON only):`;
  }

  /**
   * Format schema information for LLM consumption
   */
  private formatSchemaForLLM(schema: any[]): string {
    const tableGroups: Record<string, any[]> = {};
    
    for (const column of schema) {
      if (!tableGroups[column.table_name]) {
        tableGroups[column.table_name] = [];
      }
      tableGroups[column.table_name].push(column);
    }

    let schemaText = '';
    for (const [tableName, columns] of Object.entries(tableGroups)) {
      schemaText += `\nTable: ${tableName}\n`;
      for (const column of columns) {
        schemaText += `  - ${column.column_name} (${column.data_type})\n`;
      }
    }
    
    return schemaText;
  }

  /**
   * Call Groq API
   */
  private async callGroq(prompt: string): Promise<string> {
    try {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful database query analyzer. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
        stream: false
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from Groq API');
      }
      
    return data.choices[0].message.content;
    } catch (error) {
      console.error('❌ Error calling Groq API:', error);
      throw error;
    }
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string): LLMResponse {
    try {
      // Clean the response - remove any markdown formatting
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and provide defaults for missing fields
      return {
        tables: Array.isArray(parsed.tables) ? parsed.tables : [],
        columns: Array.isArray(parsed.columns) ? parsed.columns : [],
        intent: parsed.intent || 'Extract bike share data based on user criteria',
        filters: Array.isArray(parsed.filters) ? parsed.filters : [],
        aggregations: Array.isArray(parsed.aggregations) ? parsed.aggregations : [],
        reasoning: parsed.reasoning || 'LLM analysis completed'
      };
    } catch (error) {
      console.error('❌ Failed to parse LLM response:', error);
      console.error('Raw response:', response);
      throw new Error('Invalid LLM response format');
    }
  }

  /**
   * Fallback analysis when LLM is not available
   */
  private fallbackAnalysis(question: string, schema: any[]): LLMResponse {
    const lowerQuestion = question.toLowerCase();
    
    // Simple keyword-based analysis
    const tables: string[] = [];
    const columns: string[] = [];
    const filters: Array<{ column: string; operator: string; value: any }> = [];
    const aggregations: Array<{ function: string; column: string; alias?: string }> = [];
    
    // Table detection
    if (lowerQuestion.includes('ride') || lowerQuestion.includes('trip') || lowerQuestion.includes('journey')) {
      tables.push('trips');
    }
    if (lowerQuestion.includes('station') || lowerQuestion.includes('congress') || lowerQuestion.includes('avenue')) {
      tables.push('stations');
    }
    if (lowerQuestion.includes('weather') || lowerQuestion.includes('rain') || lowerQuestion.includes('rainy')) {
      tables.push('daily_weather');
    }
    
    // Column detection
    if (lowerQuestion.includes('time') || lowerQuestion.includes('june') || lowerQuestion.includes('2025')) {
      columns.push('started_at', 'ended_at');
    }
    if (lowerQuestion.includes('distance') || lowerQuestion.includes('kilometre')) {
      columns.push('trip_distance_km');
    }
    if (lowerQuestion.includes('gender') || lowerQuestion.includes('women') || lowerQuestion.includes('men')) {
      columns.push('rider_gender');
    }
    if (lowerQuestion.includes('station') || lowerQuestion.includes('congress')) {
      columns.push('station_name', 'start_station_id');
    }
    
    // Aggregation detection
    if (lowerQuestion.includes('average') || lowerQuestion.includes('avg')) {
      aggregations.push({ function: 'AVG', column: 'trip_distance_km', alias: 'average_distance' });
    }
    if (lowerQuestion.includes('count') || lowerQuestion.includes('how many')) {
      aggregations.push({ function: 'COUNT', column: '*', alias: 'count' });
    }
    
    return {
      tables,
      columns,
      intent: 'Extract bike share data based on user criteria',
      filters,
      aggregations,
      reasoning: 'Fallback keyword-based analysis'
    };
  }
}

export default LLMService; 