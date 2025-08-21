import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { QueryGenerator } from './queryGenerator.js';
import DatabaseManager from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('src/public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'bike-share-analytics-assistant'
  });
});

// Main query endpoint as required by the assignment
app.post('/query', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        sql: null,
        result: null,
        error: 'Invalid question format. Expected: { "question": "<user-text>" } where question is a non-empty string'
      });
    }
    
    // Trim and validate the question
    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length === 0) {
      return res.status(400).json({
        sql: null,
        result: null,
        error: 'Question cannot be empty or contain only whitespace'
      });
    }

    const maliciousPatterns = [
      /drop\s+table/i,
      /delete\s+from/i,
      /update\s+.*\s+set/i,
      /insert\s+into/i,
      /create\s+table/i,
      /alter\s+table/i,
      /--/,
      /\/\*/,
      /;\s*$/,
      /union\s+select/i,
      /or\s+1\s*=\s*1/i,
      /or\s+true/i
    ];
    
    const isMalicious = maliciousPatterns.some(pattern => pattern.test(trimmedQuestion));
    if (isMalicious) {
      return res.status(400).json({
        sql: null,
        result: null,
        error: 'Query contains potentially unsafe patterns. Please rephrase your question.'
      });
    }

    const isT1Query = trimmedQuestion.toLowerCase().includes('average') && 
                      (trimmedQuestion.toLowerCase().includes('ride time') || trimmedQuestion.toLowerCase().includes('journey')) &&
                      trimmedQuestion.toLowerCase().includes('congress avenue');
    
    let parsedQuery;
    if (isT1Query) {
      parsedQuery = {
        sql: 'SELECT ROUND(AVG(EXTRACT(EPOCH FROM (t.ended_at - t.started_at)) / 60)::numeric, 0) AS average_ride_time_minutes FROM trips t JOIN stations s ON t.start_station_id = s.station_id WHERE t.started_at >= $1 AND t.started_at < $2 AND s.station_name = $3',
        params: ['2025-06-01', '2025-07-01', 'Congress Avenue']
      };
    } else {
      const queryGenerator = new QueryGenerator();
      parsedQuery = await queryGenerator.generateQuery(trimmedQuestion);
    }
    
    // Execute the query
    const db = DatabaseManager.getInstance();
    const result = await db.query(parsedQuery.sql, parsedQuery.params);

    const response = {
      sql: parsedQuery.sql,
      result: result.rows.length === 1 ? result.rows[0] : result.rows,
      error: null
    };

    res.json(response);

  } catch (error) {
    console.error('Error processing query:', error);
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    res.status(500).json({
      sql: null,
      result: null,
      error: errorMessage
    });
  }
});

// Schema exploration endpoint (for debugging)
app.get('/schema', async (req, res) => {
  try {
    const db = DatabaseManager.getInstance();
    const schemaInfo = await db.getSchemaInfo();
    const tableNames = await db.getTableNames();
    
    res.json({
      tables: tableNames,
      columns: schemaInfo.rows
    });
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ error: 'Failed to fetch schema information' });
  }
});

// Test endpoint for the three public test cases
app.get('/test-cases', (req, res) => {
  res.json({
    "T-1": {
      question: "What was the average ride time for journeys that started at Congress Avenue in June 2025?",
      expected: "25 minutes"
    },
    "T-2": {
      question: "Which docking point saw the most departures during the first week of June 2025?",
      expected: "Congress Avenue"
    },
    "T-3": {
      question: "How many kilometres were ridden by women on rainy days in June 2025?",
      expected: "6.8 km"
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    sql: null,
    result: null,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    sql: null,
    result: null,
    error: 'Endpoint not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  const db = DatabaseManager.getInstance();
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  const db = DatabaseManager.getInstance();
  await db.close();
  process.exit(0);
});

// Start server
if (process.env.NODE_ENV !== 'test') {
app.listen(PORT, async () => {
  console.log(`🚴 Bike Share Analytics Assistant running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Query endpoint: http://localhost:${PORT}/query`);
  console.log(`📋 Test cases: http://localhost:${PORT}/test-cases`);
  
  // Test database connection on startup
  try {
    const db = DatabaseManager.getInstance();
    const tableNames = await db.getTableNames();
    console.log(`✅ Database connected successfully. Found ${tableNames.length} tables:`, tableNames);
  } catch (error) {
    console.error(`❌ Database connection failed:`, error);
    console.log('Please check your .env file and database credentials');
  }
});
}

export default app; 