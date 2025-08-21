import { jest } from '@jest/globals';
import { SemanticMapper } from '../src/semanticMapper';
import DatabaseManager from '../src/database';

// Mock the DatabaseManager
jest.mock('../src/database');

describe('SemanticMapper', () => {
  let semanticMapper: SemanticMapper;
  let mockDatabaseManager: jest.Mocked<DatabaseManager>;

  const mockSchema = [
    {
      table_name: 'trips',
      column_name: 'started_at',
      data_type: 'timestamp'
    },
    {
      table_name: 'trips',
      column_name: 'ended_at',
      data_type: 'timestamp'
    },
    {
      table_name: 'stations',
      column_name: 'station_name',
      data_type: 'character varying'
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock database manager
    mockDatabaseManager = {
      getSchemaInfo: jest.fn(),
      getTableNames: jest.fn(),
      query: jest.fn(),
      close: jest.fn()
    } as any;

    // Mock the getInstance method
    (DatabaseManager.getInstance as jest.Mock).mockReturnValue(mockDatabaseManager);

    semanticMapper = new SemanticMapper();
  });

  describe('mapUserQueryToSchema', () => {
    it('should return empty results for invalid input', async () => {
      const result = await semanticMapper.mapUserQueryToSchema('');
      expect(result.tables).toEqual([]);
      expect(result.suggestedColumns).toEqual([]);
    });

    it('should return empty results for null input', async () => {
      const result = await semanticMapper.mapUserQueryToSchema(null as any);
      expect(result.tables).toEqual([]);
      expect(result.suggestedColumns).toEqual([]);
    });

    it('should map user query to schema deterministically', async () => {
      mockDatabaseManager.getSchemaInfo.mockResolvedValue({ rows: mockSchema });

      const result = await semanticMapper.mapUserQueryToSchema('What is the average ride time?');

      expect(result.tables).toHaveLength(2);
      expect(result.suggestedColumns).toHaveLength(3);
      
      // Should find trips table (contains time-related columns)
      const tripsTable = result.tables.find((t: any) => t.tableName === 'trips');
      expect(tripsTable).toBeDefined();
      expect(tripsTable!.score).toBeGreaterThan(0);
    });

    it('should score columns based on user text content', async () => {
      mockDatabaseManager.getSchemaInfo.mockResolvedValue({ rows: mockSchema });

      const result = await semanticMapper.mapUserQueryToSchema('How many trips started at Congress Avenue?');

      // Should find station_name column (contains 'name')
      const stationNameCol = result.suggestedColumns.find((c: any) => c.columnName === 'station_name');
      expect(stationNameCol).toBeDefined();
      expect(stationNameCol!.score).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      mockDatabaseManager.getSchemaInfo.mockRejectedValue(new Error('Database error'));

      const result = await semanticMapper.mapUserQueryToSchema('test question');
      expect(result.tables).toEqual([]);
      expect(result.suggestedColumns).toEqual([]);
    });
  });

  describe('getRelevantTables', () => {
    it('should return relevant tables based on scoring', async () => {
      mockDatabaseManager.getSchemaInfo.mockResolvedValue({ rows: mockSchema });

      const tables = await semanticMapper.getRelevantTables({ tables: [] });
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBe(0);
    });
  });
});
