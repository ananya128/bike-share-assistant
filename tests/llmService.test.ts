import LLMService from '../src/llmService';

describe('LLMService', () => {
  let llmService: LLMService;

  beforeEach(() => {
    llmService = new LLMService();
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(llmService).toBeDefined();
      expect(llmService).toBeInstanceOf(LLMService);
    });
  });

  describe('analyzeQuestion', () => {
    it('should return analysis object', async () => {
      const mockSchema = [
        { table_name: 'trips', column_name: 'started_at', data_type: 'timestamp' }
      ];

      const result = await llmService.analyzeQuestion('test question', mockSchema);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });
});
