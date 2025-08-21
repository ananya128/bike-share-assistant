import DatabaseManager from '../src/database';

describe('DatabaseManager', () => {
  let databaseManager: DatabaseManager;

  beforeEach(() => {
    databaseManager = DatabaseManager.getInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseManager.getInstance();
      const instance2 = DatabaseManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('basic functionality', () => {
    it('should have required methods', () => {
      expect(typeof databaseManager.query).toBe('function');
      expect(typeof databaseManager.getSchemaInfo).toBe('function');
      expect(typeof databaseManager.getTableNames).toBe('function');
      expect(typeof databaseManager.getColumnInfo).toBe('function');
    });
  });
});
