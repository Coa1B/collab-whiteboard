const { MemoryBoardStore } = require('../src/store/memoryStore');
const { runStoreContract } = require('./storeContract');

describe('MemoryBoardStore', () => {
  runStoreContract(async (options) => new MemoryBoardStore(options));
});
