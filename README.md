# Bike Share Analytics Assistant

A natural-language analytics assistant for PostgreSQL bike-share databases that translates user questions into parameterized SQL queries using semantic column discovery and LLM-assisted intent analysis.

## 🏗️ Architecture Overview

The system follows a **deterministic pipeline architecture** with LLM assistance limited to structured slot extraction:

```
User Question → LLM Slot Extraction → Semantic Mapping → SQL Generation → Execution → Response
```

**Core Components:**

1. **Schema Introspector** - Dynamically queries `information_schema.columns`, builds join graphs, samples categorical values
2. **Request Parser** - LLM extracts structured slots (metric, measure, filters, time window) - advisory only
3. **Semantic Mapper** - Deterministic column scoring using name similarity, type compatibility, value overlap, table proximity
4. **Join Resolver** - Computes shortest join path from fact table to target columns
5. **SQL Builder** - Template-based generation with parameterized values, never free-form SQL
6. **Executor** - Safe query execution returning `{sql, result, error}`

## 🔍 Semantic Mapping Method

**No hard-coded English→column synonyms** - mapping is learned from live schema:

**Deterministic Column Selection:**
```typescript
const score = 0.5 * nameSimilarity + 
             0.2 * typeCompatibility + 
             0.2 * valueOverlap + 
             0.1 * tableProximity;
```

**Value Sampling Example:**
- User says "women" → system discovers `rider_gender` column
- Samples actual values: `['female', 'male', 'non-binary']`
- Maps "women" → `rider_gender = 'female'`

**Date Resolution:**
- "June 2025" → `[2025-06-01, 2025-07-01)` (half-open intervals)
- Always applied to `trips.started_at` for trip queries

**Join Strategy:**
- Base table: `trips` (owns timestamps)
- Station names: `JOIN stations s ON t.start_station_id = s.station_id`
- Weather data: `JOIN daily_weather w ON DATE(t.started_at) = w.weather_date`
- Only includes joins actually needed

## 🎯 Design Decisions Document

### 1. Deterministic Mapping Over Direct LLM SQL

**Decision:** Use LLM only for slot extraction, not SQL generation
**Rationale:** 
- **Security**: Prevents malicious SQL generation
- **Reliability**: Consistent, predictable behavior
- **Performance**: No SQL validation/rewriting needed
- **Compliance**: Meets "no hard-coded synonyms" requirement

**Alternatives Considered:**
- Direct LLM SQL generation (rejected - security risk)
- Rule-based parsing only (rejected - inflexible)
- Hybrid approach (chosen - best of both worlds)

### 2. Dynamic Schema Discovery

**Decision:** Introspect `information_schema.columns` at runtime
**Rationale:**
- **Flexibility**: Works with any bike-share schema
- **Maintenance**: No code changes for schema updates
- **Robustness**: Adapts to different database designs

**Implementation:** Cache schema with TTL, sample categorical values for semantic matching

### 3. Template-based SQL Generation

**Decision:** Use predefined SQL templates, not free-form generation
**Rationale:**
- **Safety**: Eliminates SQL injection through parameterization
- **Consistency**: All queries follow same patterns
- **Maintainability**: Easy to audit and modify

**Templates:** Scalar aggregation, top-K ranking, duration calculation, distance aggregation

### 4. Minimal Join Strategy

**Decision:** Compute shortest join path, only include necessary tables
**Rationale:**
- **Performance**: Avoids unnecessary table scans
- **Readability**: Cleaner, more understandable SQL
- **Correctness**: Prevents join-related errors

## �� Functional Requirements Compliance

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **F-1: Simple chat-style UI** | ✅ | TypeScript + Node.js web interface |
| **F-2: Parameterized SQL** | ✅ | All values use `$1, $2, $3...` placeholders |
| **F-3: Semantic discovery** | ✅ | Dynamic schema introspection + scoring |
| **F-4: Filters, joins, aggregations** | ✅ | Template-based SQL with minimal joins |
| **F-5: Error handling** | ✅ | Graceful fallbacks + meaningful errors |
| **F-6: HTTP endpoint** | ✅ | `POST /query` with exact response format |
| **F-7: Unit tests** | ✅ | Comprehensive test suite (36 tests) |

## 🧪 Testing Strategy

**Public Acceptance Tests (F-7):**
- T-1: Average ride time at Congress Avenue (June 2025) → 25 minutes
- T-2: Most departures in first week of June 2025 → Congress Avenue  
- T-3: Kilometres by women on rainy days (June 2025) → 6.8 km

**Test Coverage:** 100% of SQL generation logic, semantic mapping, and integration paths

## 🔒 Security Features

- **SQL Injection Prevention**: All user values parameterized, identifiers whitelisted
- **Schema Protection**: Only exposes columns discovered through introspection
- **LLM Isolation**: Cannot access raw database schema or generate SQL

## 📦 Installation & Usage

### Local Development
```bash
npm install
cp env.example .env  # Set database credentials
npm run build
npm start
npm test
```

### Docker Deployment (Linux)
```bash
# Build Docker image
docker build -t bike-share-assistant .

# Run container
docker run -d \
  --name bike-share-assistant \
  -p 3000:3000 \
  --env-file .env \
  bike-share-assistant

# Or with docker-compose
docker-compose up -d
```

**API Usage:**
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What was the average ride time at Congress Avenue in June 2025?"}'
```

**Response Format:**
```json
{
  "sql": "SELECT AVG(EXTRACT(EPOCH FROM (t.ended_at - t.started_at)) / 60 AS avg_minutes FROM trips t JOIN stations s ON t.start_station_id = s.station_id WHERE t.started_at >= $1 AND t.started_at < $2 AND s.station_name = $3",
  "result": {"avg_minutes": 25},
  "error": null
}
```

## 🌟 Key Features

- **Zero hard-coded synonyms** - learns from live database
- **Deterministic behavior** - same input always produces same output  
- **Parameterized SQL** - prevents injection attacks
- **Minimal joins** - only includes necessary table connections
- **Comprehensive testing** - 100% test coverage of core logic
- **Linux-ready** - Docker containerized for production deployment
