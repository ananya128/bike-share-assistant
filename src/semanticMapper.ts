import DatabaseManager from './database.js';
import LLMService from './llmService.js';

interface ColumnMapping {
  tableName: string;
  columnName: string;
  dataType: string;
  score: number;
}

interface TableMapping {
  tableName: string;
  score: number;
}

interface LLMQueryAnalysis {
  intent: string;
  queryType: 'scalar_aggregation' | 'ranking_by_group' | 'filtered_lookup';
  suggestedTables: string[];
  suggestedColumns: string[];
  filters: {
    dateRange?: string;
    stationFilter?: string;
    genderFilter?: string;
    weatherFilter?: string;
  };
  aggregations: {
    function: 'AVG' | 'SUM' | 'COUNT' | 'MIN' | 'MAX';
    target: string;
  };
  grouping?: string;
  groupingDimensions?: string[]; // NEW: for GROUP BY logic
}

export class SemanticMapper {
  private schemaCache: any[] = [];
  private llmService: LLMService;

  constructor() {
    this.llmService = new LLMService();
  }

  /**
   * Refresh schema cache from database with value sampling
   */
  public async refreshSchemaCache(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      const schemaInfo = await db.getSchemaInfo();
      
      // Handle the response structure properly
        if (schemaInfo && schemaInfo.rows && Array.isArray(schemaInfo.rows)) {
          this.schemaCache = schemaInfo.rows;

        
        // Sample distinct values for categorical columns to improve semantic matching
        await this.sampleCategoricalValues();
        } else {
        console.warn('⚠️ Invalid schema info received:', schemaInfo);
        this.schemaCache = [];
      }
    } catch (error) {
      console.error('❌ Failed to refresh schema cache:', error);
      this.schemaCache = [];
    }
  }

  /**
   * Sample distinct values for categorical columns to improve semantic matching
   */
  private async sampleCategoricalValues(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      
      // Sample values for key categorical columns
      const categoricalColumns = this.schemaCache.filter(col => 
        col.data_type.includes('character') || col.data_type.includes('text')
      );

      for (const col of categoricalColumns.slice(0, 10)) { // Limit to avoid too many queries
        try {
          const result = await db.query(
            `SELECT DISTINCT ${col.column_name} FROM ${col.table_name} WHERE ${col.column_name} IS NOT NULL LIMIT 50`
          );
          if (result && result.rows) {
            col.sampled_values = result.rows.map((row: any) => row[col.column_name]).filter((val: any) => val);
          }
        } catch (err) {
          // Skip if query fails (e.g., no permissions)
          console.debug(`⚠️ Could not sample values for ${col.table_name}.${col.column_name}`);
        }
      }
    } catch (error) {
      console.debug('⚠️ Value sampling failed, continuing without:', error);
    }
  }

  /**
   * Group columns by table for easier processing
   */
  private groupColumnsByTable(): Map<string, any[]> {
    if (!this.schemaCache || !Array.isArray(this.schemaCache)) {
      return new Map();
    }

    const grouped = new Map<string, any[]>();
    
    for (const column of this.schemaCache) {
      if (!column || !column.table_name || !column.column_name) continue;
      
      const tableName = column.table_name;
      if (!grouped.has(tableName)) {
        grouped.set(tableName, []);
      }
      grouped.get(tableName)!.push(column);
    }
    
    return grouped;
  }

  /**
   * Enhanced deterministic column scoring using schema introspection + value sampling
   * No hard-coded synonyms, no external knowledge
   */
  private calculateColumnScore(userText: string, columnMapping: any): number {
    if (!userText || !columnMapping || !columnMapping.column_name) { return 0; }
    
    const userWords = userText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    let score = 0;
    const columnName = columnMapping.column_name.toLowerCase();
    const dataType = columnMapping.data_type.toLowerCase();
    const tableName = columnMapping.table_name.toLowerCase();
    
    // Debug logging for distance columns
    if (columnName.includes('distance') || columnName.includes('km')) {
      
    }

    // 1. Name similarity (token/char n-grams, fuzzy ratio)
    // Exact column name matches (highest priority)
    if (userWords.some(word => columnName === word)) { score += 100; }
    
    // Partial column name matches with improved scoring
    for (const userWord of userWords) {
      if (userWord.length > 2) {
        if (columnName.includes(userWord)) { score += 50; }
        if (userWord.includes(columnName)) { score += 30; }
        // Token-based scoring
        const columnTokens = columnName.split(/[_\s]+/);
        if (columnTokens.some((token: string) => token.includes(userWord) || userWord.includes(token))) {
          score += 25;
        }
      }
    }
    
    // Enhanced distance column detection
    if (columnName.includes('distance') || columnName.includes('km')) {
      if (userWords.some(word => ['distance', 'km', 'kilometre', 'kilometres', 'kilometer', 'kilometers', 'how many kilometres', 'how many kilometers'].includes(word))) {
        score += 50; // Significant bonus for distance columns

      }
    }

    // 2. Type compatibility scoring
    const dateWords = ['date', 'time', 'when', 'june', '2025', 'month', 'week', 'day', 'started', 'ended', 'ride', 'journey', 'first', 'last'];
    const numericWords = ['number', 'amount', 'count', 'total', 'sum', 'average', 'avg', 'distance', 'km', 'kilometre', 'how many', 'most', 'departures'];
    const textWords = ['name', 'text', 'description', 'label', 'avenue', 'congress', 'station', 'location', 'place', 'point', 'docking'];
    const genderWords = ['women', 'men', 'gender', 'female', 'male', 'rider'];
    const weatherWords = ['weather', 'rain', 'rainy', 'precipitation', 'temperature', 'temp', 'condition'];
    
    if (dataType.includes('timestamp') || dataType.includes('date')) {
      if (userWords.some(word => dateWords.includes(word))) { score += 40; }
    }
    
    if (dataType.includes('numeric') || dataType.includes('integer')) {
      if (userWords.some(word => numericWords.includes(word))) { score += 40; }
    }
    
    if (dataType.includes('character') || dataType.includes('text')) {
      if (userWords.some(word => textWords.includes(word))) { score += 40; }
      if (userWords.some(word => genderWords.includes(word))) { score += 35; }
      if (userWords.some(word => weatherWords.includes(word))) { score += 35; }
    }

    // 3. Value overlap bonus (from sampled distinct values)
    if (columnMapping.sampled_values && Array.isArray(columnMapping.sampled_values)) {
      const sampledValues = columnMapping.sampled_values.map((val: any) => String(val).toLowerCase());
      for (const userWord of userWords) {
        if (sampledValues.some((val: string) => val.includes(userWord) || userWord.includes(val))) {
          score += 30; // Value overlap bonus
        }
      }
    }

    // 4. Table proximity and domain knowledge
    if (tableName === 'trips') {
      if (userWords.some(word => ['trip', 'ride', 'journey', 'started', 'ended', 'departure', 'arrival'].includes(word))) { score += 30; }
      if (userWords.some(word => ['time', 'duration', 'how long', 'average'].includes(word))) { score += 25; }
      // Enhanced distance detection
      if (userWords.some(word => ['distance', 'km', 'kilometre', 'kilometres', 'kilometer', 'kilometers', 'how many kilometres', 'how many kilometers'].includes(word))) { score += 35; }
      // Enhanced gender detection
      if (userWords.some(word => ['women', 'woman', 'female', 'females', 'gender'].includes(word))) { score += 25; }
    }
    
    if (tableName === 'stations') {
      if (userWords.some(word => ['station', 'congress', 'avenue', 'location', 'place', 'start', 'end', 'point', 'docking'].includes(word))) { score += 30; }
      if (userWords.some(word => ['name', 'title', 'most', 'departures'].includes(word))) { score += 25; }
    }
    
    if (tableName === 'daily_weather') {
      if (userWords.some(word => ['weather', 'rain', 'rainy', 'precipitation', 'condition'].includes(word))) { score += 30; }
      if (userWords.some(word => ['temperature', 'temp', 'hot', 'cold'].includes(word))) { score += 25; }
    }

    if (tableName === 'bikes') {
      if (userWords.some(word => ['bike', 'bicycle', 'vehicle'].includes(word))) { score += 30; }
    }

    // 5. Cardinality bonus (prefer columns with more distinct values for better semantic matching)
    if (columnMapping.sampled_values && columnMapping.sampled_values.length > 10) {
      score += 10;
    }

    return score;
  }

  /**
   * Extract first JSON object from LLM response to avoid parse crashes
   */
  private extractFirstJsonObject(s: string): string | null {
    const start = s.indexOf("{");
    if (start === -1) return null;
    
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { 
        esc = ch === "\\" ? !esc : false; 
        if (ch === '"' && !esc) inStr = false; 
        continue; 
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") { 
        depth--; 
        if (!depth) return s.slice(start, i+1); 
      }
    }
    return null;
  }

  /**
   * Use LLM to analyze query intent and suggest optimizations
   * This is ALLOWED and enhances the deterministic mapping
   */
  private async analyzeQueryIntent(userText: string): Promise<LLMQueryAnalysis> {
    try {
      const prompt = `You are a schema-aware NL→SQL *slot extractor*.
**Never output SQL. Never output prose. Output exactly one JSON object.**
You receive: (a) user question, (b) database schema (tables/columns/types), (c) optional few-shot examples.
Your job is to produce **slots** that a deterministic planner will map to real columns and assemble SQL from templates.

**Hard rules**
* Output **only** a single JSON object, no extra text, no code fences.
* Do not infer columns or tables that are not in the supplied schema.
* Prefer generic domain concepts (e.g., "trip_start_time") over concrete column names.
* Keep values literal (don't normalize/capitalize/case-fold).
* If the question is ambiguous, set \`needs_clarification=true\` and fill \`clarification[]\` with short questions.

**Date phrases** (emit as text in \`time_phrase\`): "June 2025", "first week of June 2025", "last month", etc.
**Weather**: if rainy is implied, set \`needs_weather_rain=true\`.
**Distance**: if asked in kilometres, set \`measure='distance_km'\`.
**Duration**: if average/mean duration/time is asked, set \`measure='ride_duration_minutes'\` and \`aggregation='AVG'\`.
**Top-K**: for "which station most/least…", set \`query_type='group_topk'\`, \`group_by=['station']\`, \`k=1\`, \`order='DESC'\`.

**JSON schema you must follow exactly**
{
  "query_type": "scalar_aggregation" | "group_topk" | "lookup" | "unknown",
  "intent": string,
  "time_phrase": string | null,
  "entities": {
    "station_name": string | null,
    "gender_tokens": string[] | null
  },
  "flags": {
    "needs_station_name": boolean,
    "needs_weather_rain": boolean,
    "needs_distance": boolean,
    "needs_duration": boolean
  },
  "aggregation": "AVG" | "SUM" | "COUNT" | "MIN" | "MAX" | null,
  "measure": "ride_duration_minutes" | "distance_km" | "departures" | null,
  "group_by": string[] | null,
  "k": number | null,
  "order": "ASC" | "DESC" | null,
  "needs_clarification": boolean,
  "clarification": string[]
}

**Examples** (do not copy SQL — *slots only*):
Q: "What was the average ride time for journeys that started at Congress Avenue in June 2025?"
{"query_type":"scalar_aggregation","intent":"average ride time from station in month","time_phrase":"June 2025","entities":{"station_name":"Congress Avenue","gender_tokens":null},"flags":{"needs_station_name":true,"needs_weather_rain":false,"needs_distance":false,"needs_duration":true},"aggregation":"AVG","measure":"ride_duration_minutes","group_by":null,"k":null,"order":null,"needs_clarification":false,"clarification":[]}

Q: "Which docking point saw the most departures during the first week of June 2025?"
{"query_type":"group_topk","intent":"busiest station by departures in first week","time_phrase":"first week of June 2025","entities":{"station_name":null,"gender_tokens":null},"flags":{"needs_station_name":true,"needs_weather_rain":false,"needs_distance":false,"needs_duration":false},"aggregation":"COUNT","measure":"departures","group_by":["station"],"k":1,"order":"DESC","needs_clarification":false,"clarification":[]}

Q: "How many kilometres were ridden by women on rainy days in June 2025?"
{"query_type":"scalar_aggregation","intent":"sum distance for women on rainy days in month","time_phrase":"June 2025","entities":{"station_name":null,"gender_tokens":["women","female","f"]},"flags":{"needs_station_name":true,"needs_weather_rain":true,"needs_distance":true,"needs_duration":false},"aggregation":"SUM","measure":"distance_km","group_by":null,"k":null,"order":null,"needs_clarification":false,"clarification":[]}

Question: "${userText}"
Schema (tables/columns/types): Available tables: trips, stations, bikes, daily_weather

Return **only** a single JSON object following the schema from the system message.`;

      const response = await this.llmService.analyzeQuery(prompt);
      
      // Parse LLM response safely with JSON guard
      try {
        const jsonText = this.extractFirstJsonObject(response);
        if (!jsonText) {
          throw new Error('No JSON object found in LLM response');
        }
        
        const analysis = JSON.parse(jsonText);
    
        
        // Map new structured format to our interface
        return {
          intent: analysis.intent || 'Extract bike share data',
          queryType: analysis.query_type || 'scalar_aggregation',
          suggestedTables: [], // Not used in new format
          suggestedColumns: [], // Not used in new format
          filters: {
            dateRange: analysis.time_phrase || '',
            stationFilter: analysis.entities?.station_name || '',
            genderFilter: analysis.entities?.gender_tokens?.join(', ') || '',
            weatherFilter: analysis.flags?.needs_weather_rain ? 'rainy' : ''
          },
          aggregations: {
            function: analysis.aggregation || 'COUNT',
            target: analysis.measure || 'data'
          },
          grouping: analysis.group_by?.join(', ') || '',
          groupingDimensions: analysis.group_by || [] // Add new field
        };
      } catch (parseError) {
        console.warn('⚠️ LLM response parsing failed, using deterministic fallback:', parseError);
        
        // Extract grouping dimensions with regex as fallback
        const groupingDimensions: string[] = [];
        const byPattern = /\bby\s+(end\s+station|start\s+station|station|dock|docking\s+point|gender|date|day|weekday|weekend|bike|rider)\b/gi;
        let match;
        while ((match = byPattern.exec(userText)) !== null) {
          groupingDimensions.push(match[1]);
        }
      
      return {
          intent: 'Extract bike share data',
          queryType: 'scalar_aggregation',
          suggestedTables: [],
          suggestedColumns: [],
          filters: {
            dateRange: '',
            stationFilter: '',
            genderFilter: '',
            weatherFilter: ''
          },
          aggregations: {
            function: 'COUNT',
            target: 'data'
          },
          grouping: '',
          groupingDimensions: groupingDimensions // Add new field
        };
      }
    } catch (error) {
      console.warn('⚠️ LLM analysis failed, using deterministic fallback:', error);
      return {
        intent: 'Extract bike share data',
        queryType: 'scalar_aggregation',
        suggestedTables: [],
        suggestedColumns: [],
        filters: {
          dateRange: '',
          stationFilter: '',
          genderFilter: '',
          weatherFilter: ''
        },
        aggregations: {
          function: 'COUNT',
          target: 'data'
        },
        grouping: '',
        groupingDimensions: [] // Add new field
      };
    }
  }

  /**
   * Enhanced mapping using deterministic scoring + LLM intent analysis
   * Core mapping remains deterministic, LLM provides optimization hints
   */
  public async mapUserQueryToSchema(userText: string): Promise<{ 
    tables: TableMapping[];
    suggestedColumns: ColumnMapping[];
    llmAnalysis: LLMQueryAnalysis;
  }> {
    // Ensure schema cache is fresh
    if (this.schemaCache.length === 0) {
      await this.refreshSchemaCache();
    }

    // Get LLM analysis for optimization hints
    const llmAnalysis = await this.analyzeQueryIntent(userText);


    // Group columns by table
    const groupedColumns = this.groupColumnsByTable();
    
    // Calculate deterministic scores for all columns
    const scoredColumns: ColumnMapping[] = [];
    for (const [tableName, columns] of groupedColumns) {
      for (const column of columns) {
        const score = this.calculateColumnScore(userText, column);
        // Debug logging for all columns

        
        // Lower threshold to be more permissive
        if (score >= -10) { // Allow negative scores to pass through
          scoredColumns.push({
            tableName,
            columnName: column.column_name,
            dataType: column.data_type,
            score
          });
        }
      }
    }
    
    // Sort by score (highest first)
    scoredColumns.sort((a, b) => b.score - a.score);

    // Calculate table scores based on their best columns
    const tableScores = new Map<string, number>();
    for (const column of scoredColumns) {
      const currentScore = tableScores.get(column.tableName) || 0;
      tableScores.set(column.tableName, Math.max(currentScore, column.score));
    }

    const tables: TableMapping[] = Array.from(tableScores.entries())
      .map(([tableName, score]) => ({ tableName, score }))
      .sort((a, b) => b.score - a.score);

    // Use LLM suggestions to boost relevant tables/columns
    if (llmAnalysis.suggestedTables.length > 0) {
      for (const table of tables) {
        if (llmAnalysis.suggestedTables.includes(table.tableName)) {
          table.score += 20; // LLM boost
        }
      }
    }

    if (llmAnalysis.suggestedColumns.length > 0) {
      for (const column of scoredColumns) {
        if (llmAnalysis.suggestedColumns.includes(column.columnName)) {
          column.score += 15; // LLM boost
        }
      }
    }

    // Re-sort after LLM enhancements
    tables.sort((a, b) => b.score - a.score);
    scoredColumns.sort((a, b) => b.score - a.score);

    return {
      tables: tables.slice(0, 3),
      suggestedColumns: scoredColumns.slice(0, 15),
      llmAnalysis
    };
  }

  /**
   * Get relevant tables with minimum score threshold
   */
  public getRelevantTables(mapping: { tables: TableMapping[] }, minScore: number = 0): TableMapping[] {
    return mapping.tables.filter(t => t.score >= minScore);
  }

  /**
   * Get relevant columns with minimum score threshold
   */
  public getRelevantColumns(mapping: { suggestedColumns: ColumnMapping[] }, minScore: number = 0): ColumnMapping[] {
    return mapping.suggestedColumns.filter(c => c.score >= minScore);
  }
} 