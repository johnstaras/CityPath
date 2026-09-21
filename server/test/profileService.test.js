const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Fake Prisma for the real repository: operations are plain markers, and the
// test checks they reach ONE $transaction call.
const databasePath = path.join(__dirname, '..', 'config', 'database.js');
const transactions = [];
const fakePrisma = {
  mobilityProfile: {
    findMany: async ({ where }) => where.id.in.filter(id => [1, 2, 3, 4, 5].includes(id)).map(id => ({ id })),
  },
  userProfile: {
    upsert: args => ({ op: 'upsertProfile', args }),
    findUnique: async () => ({ ageGroup: '65+' }),
  },
  userMobilityProfile: {
    deleteMany: args => ({ op: 'deleteMobility', args }),
    createMany: args => ({ op: 'createMobility', args }),
    findMany: async () => [],
  },
  $transaction: async ops => { transactions.push(ops); return ops; },
};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: fakePrisma };

const profileService = require('../services/profileService');

test('unknown mobility profile ids are reported', async () => {
  assert.deepEqual(await profileService.findUnknownMobilityProfileIds([1, 99, 99, 4]), [99]);
  assert.deepEqual(await profileService.findUnknownMobilityProfileIds([]), []);
});

test('an unknown id rejects the update with a 400-coded error and writes nothing', async () => {
  transactions.length = 0;
  await assert.rejects(
    profileService.updateProfile('u1', { ageGroup: '65+', mobilityProfileIds: [2, 42] }),
    { code: 'INVALID_MOBILITY_PROFILE', status: 400 },
  );
  assert.equal(transactions.length, 0);
});

test('age group and mobility selection are saved in a single transaction', async () => {
  transactions.length = 0;
  await profileService.updateProfile('u1', { ageGroup: '65+', mobilityProfileIds: [2, 2, 4] });
  assert.equal(transactions.length, 1);
  const ops = transactions[0].map(o => o.op);
  assert.deepEqual(ops, ['upsertProfile', 'deleteMobility', 'createMobility']);
  assert.deepEqual(
    transactions[0][2].args.data,
    [{ userId: 'u1', mobilityProfileId: 2 }, { userId: 'u1', mobilityProfileId: 4 }],
  );
});

test('an empty selection clears the mobility profiles', async () => {
  transactions.length = 0;
  await profileService.updateProfile('u1', { mobilityProfileIds: [] });
  assert.deepEqual(transactions[0].map(o => o.op), ['deleteMobility']);
});
