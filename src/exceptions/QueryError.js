class QueryError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'QueryError';
      this.code = code; // Optional custom error code
    }
  }
  