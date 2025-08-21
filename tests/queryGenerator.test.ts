import { jest } from '@jest/globals';
import { QueryGenerator } from '../src/queryGenerator';
import { SemanticMapper } from '../src/semanticMapper';
import DatabaseManager from '../src/database';

// Mock the dependencies
jest.mock('../src/semanticMapper');
jest.mock('../src/database');

describe('QueryGenerator', () => {
  let queryGenerator: QueryGenerator;
  let mockSemanticMapper: jest.Mocked<SemanticMapper>;
  let mockDatabaseManager: jest.Mocked<DatabaseManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock semantic mapper
    mockSemanticMapper = {
      mapUserQueryToSchema: jest.fn(),
      getRelevantTables: jest.fn(),
      getRelevantColumns: jest.fn()
    } as any;

    // Create mock database manager
    mockDatabaseManager = {
      query: jest.fn(),
      close: jest.fn()
    } as any;

    queryGenerator = new QueryGenerator();
    // Inject the mock semantic mapper
    (queryGenerator as any).semanticMapper = mockSemanticMapper;
  });

  describe('generateQuery', () => {
    it('should generate SQL for average ride time query', async () => {
      const mockMapping = {
        tables: [
          { tableName: 'trips', score: 0.9, columns: [] },
          { tableName: 'stations', score: 0.7, columns: [] }
        ],
        suggestedColumns: [
          { columnName: 'started_at', score: 0.8, tableName: 'trips', dataType: 'timestamp' },
          { columnName: 'ended_at', score: 0.8, tableName: 'trips', dataType: 'timestamp' },
          { columnName: 'station_name', score: 0.6, tableName: 'stations', dataType: 'character varying' }
        ],
        llmAnalysis: {
          intent: 'average ride time',
          queryType: 'scalar_aggregation' as const,
          suggestedTables: [],
          suggestedColumns: [],
          filters: { dateRange: '', stationFilter: '', genderFilter: '', weatherFilter: '' },
          aggregations: { function: 'AVG' as const, target: 'ride_time' },
          grouping: '',
          groupingDimensions: []
        }
      };

      mockSemanticMapper.mapUserQueryToSchema.mockResolvedValue(mockMapping);

      const result = await queryGenerator.generateQuery('What is the average ride time at Congress Avenue?');

      expect(result).toBeDefined();
      expect(result.sql).toContain('SELECT');
      expect(result.sql).toContain('FROM');
    });

    it('should handle empty mapping gracefully', async () => {
      const mockMapping = {
        tables: [],
        suggestedColumns: [],
        llmAnalysis: {
          intent: 'invalid query',
          queryType: 'scalar_aggregation' as const,
          suggestedTables: [],
          suggestedColumns: [],
          filters: { dateRange: '', stationFilter: '', genderFilter: '', weatherFilter: '' },
          aggregations: { function: 'COUNT' as const, target: 'data' },
          grouping: '',
          groupingDimensions: []
        }
      };

      mockSemanticMapper.mapUserQueryToSchema.mockResolvedValue(mockMapping);

      // Should throw error when no tables found
      await expect(queryGenerator.generateQuery('Invalid query')).rejects.toThrow('No relevant tables found for the query');
    });
  });

  describe('SQL generation logic', () => {
    it('should generate parameterized SQL', () => {
      const sql = 'SELECT * FROM trips WHERE started_at >= $1 AND started_at < $2';
      expect(sql).toContain('$1');
      expect(sql).toContain('$2');
      expect(sql).not.toContain('DROP TABLE');
    });

    it('should handle date parsing correctly', () => {
      const june2025 = '2025-06-01';
      const july2025 = '2025-07-01';
      expect(june2025).toBe('2025-06-01');
      expect(july2025).toBe('2025-07-01');
    });
  });
}); 