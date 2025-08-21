import { QueryGenerator } from '../src/queryGenerator';
import { SemanticMapper } from '../src/semanticMapper';
import DatabaseManager from '../src/database';

// Mock the database module
jest.mock('../src/database');

describe('Integration Tests', () => {
  let queryGenerator: QueryGenerator;
  let mockDb: jest.Mocked<DatabaseManager>;
  let mockSemanticMapper: jest.Mocked<SemanticMapper>;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      getSchemaInfo: jest.fn(),
      getTableNames: jest.fn(),
      getColumnInfo: jest.fn(),
      query: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    // Create mock semantic mapper
    mockSemanticMapper = {
      mapUserQueryToSchema: jest.fn(),
      getRelevantTables: jest.fn(),
    } as any;

    // Create query generator instance
    queryGenerator = new QueryGenerator();

    // Inject mocks
    (queryGenerator as any).semanticMapper = mockSemanticMapper;
  });

  describe('T-1: Average ride time at Congress Avenue in June 2025', () => {
    it('should generate correct SQL for average ride time query', async () => {
      const question = 'What was the average ride time for journeys that started at Congress Avenue in June 2025?';
      
      mockSemanticMapper.mapUserQueryToSchema.mockResolvedValue({
        tables: [
          { tableName: 'trips', score: 0.9 },
          { tableName: 'stations', score: 0.8 }
        ],
        suggestedColumns: [
          {
            columnName: 'started_at',
            tableName: 'trips',
            score: 0.9,
            dataType: 'timestamp'
          },
          {
            columnName: 'ended_at',
            tableName: 'trips',
            score: 0.9,
            dataType: 'timestamp'
          },
          {
            columnName: 'station_name',
            tableName: 'stations',
            score: 0.8,
            dataType: 'character varying'
          }
        ],
        llmAnalysis: {
          intent: 'Extract bike share data based on user criteria',
          queryType: 'scalar_aggregation',
          suggestedTables: ['trips', 'stations'],
          suggestedColumns: ['started_at', 'ended_at', 'station_name'],
          filters: {
            dateRange: 'June 2025',
            stationFilter: 'Congress Avenue'
          },
          aggregations: {
            function: 'AVG',
            target: 'ride_time'
          },
          grouping: 'count',
          groupingDimensions: []
        }
      });

      const result = await queryGenerator.generateQuery(question);
      
      expect(result.sql).toContain('AVG(EXTRACT(EPOCH FROM (t.ended_at - t.started_at)) / 60');
      expect(result.sql).toContain('s.station_name = $3');
      expect(result.sql).toBeTruthy();
      expect(result.params).toBeDefined();
      expect(result.tables).toBeDefined();
    });
  });

  describe('T-2: Station with most departures in first week of June 2025', () => {
    it('should generate correct SQL for ranking query', async () => {
      const question = 'Which docking point saw the most departures during the first week of June 2025?';
      
      mockSemanticMapper.mapUserQueryToSchema.mockResolvedValue({
        tables: [
          { tableName: 'trips', score: 0.9 },
          { tableName: 'stations', score: 0.8 }
        ],
        suggestedColumns: [
          {
            columnName: 'started_at',
            tableName: 'trips',
            score: 0.9,
            dataType: 'timestamp'
          },
          {
            columnName: 'station_name',
            tableName: 'stations',
            score: 0.8,
            dataType: 'character varying'
          }
        ],
        llmAnalysis: {
          intent: 'Extract bike share data based on user criteria',
          queryType: 'ranking_by_group',
          suggestedTables: ['trips', 'stations'],
          suggestedColumns: ['started_at', 'station_name'],
          filters: {
            dateRange: 'first week of June 2025'
          },
          aggregations: {
            function: 'COUNT',
            target: 'departures'
          },
          grouping: 'count',
          groupingDimensions: ['station']
        }
      });

      const result = await queryGenerator.generateQuery(question);
      
      expect(result.sql).toContain('GROUP BY s.station_name');
      expect(result.sql).toContain('ORDER BY departure_count DESC');
      expect(result.sql).toContain('LIMIT 1');
      expect(result.sql).toBeTruthy();
      expect(result.params).toBeDefined();
      expect(result.tables).toBeDefined();
    });
  });

  describe('T-3: Kilometres by women on rainy days in June 2025', () => {
    it('should generate correct SQL for distance aggregation', async () => {
      const question = 'How many kilometres were ridden by women on rainy days in June 2025?';
      
      mockSemanticMapper.mapUserQueryToSchema.mockResolvedValue({
        tables: [
          { tableName: 'trips', score: 0.9 },
          { tableName: 'daily_weather', score: 0.7 }
        ],
        suggestedColumns: [
          {
            columnName: 'trip_distance_km',
            tableName: 'trips',
            score: 0.9,
            dataType: 'numeric'
          },
          {
            columnName: 'rider_gender',
            tableName: 'trips',
            score: 0.8,
            dataType: 'character varying'
          },
          {
            columnName: 'precipitation_mm',
            tableName: 'daily_weather',
            score: 0.7,
            dataType: 'numeric'
          }
        ],
        llmAnalysis: {
          intent: 'Extract bike share data based on user criteria',
          queryType: 'scalar_aggregation',
          suggestedTables: ['trips', 'daily_weather'],
          suggestedColumns: ['trip_distance_km', 'rider_gender', 'precipitation_mm'],
          filters: {
            dateRange: 'June 2025',
            genderFilter: 'female',
            weatherFilter: 'rainy'
          },
          aggregations: {
            function: 'SUM',
            target: 'trip_distance_km'
          },
          grouping: 'count',
          groupingDimensions: []
        }
      });

      const result = await queryGenerator.generateQuery(question);
      
      expect(result.sql).toContain('SUM(t.trip_distance_km)');
      expect(result.sql).toContain('precipitation_mm >');
      expect(result.sql).toBeTruthy();
      expect(result.params).toBeDefined();
      expect(result.tables).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty mapping gracefully', async () => {
      const question = 'Invalid question';
      
      mockSemanticMapper.mapUserQueryToSchema.mockResolvedValue({
        tables: [],
        suggestedColumns: [],
        llmAnalysis: {
          intent: 'Unknown intent',
          queryType: 'filtered_lookup',
          suggestedTables: [],
          suggestedColumns: [],
          filters: {},
          aggregations: {
            function: 'COUNT',
            target: 'unknown'
          },
          grouping: 'unknown',
          groupingDimensions: []
        }
      });

      await expect(queryGenerator.generateQuery(question)).rejects.toThrow('No relevant tables found for the query');
    });
  });
}); 