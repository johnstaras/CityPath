const profileRepo = require('../repositories/profileRepository');

async function getUserProfile(userId) {
  const [profile, mobilityProfiles] = await Promise.all([
    profileRepo.getProfile(userId),
    profileRepo.getMobilityProfiles(userId),
  ]);

  return {
    ageGroup: profile?.ageGroup || null,
    mobilityProfiles: mobilityProfiles.map(mp => mp.mobilityProfile),
  };
}

// Mobility profile ids that do not exist in the database. Pure over its input
// apart from the one lookup, so the rule is testable with a stubbed repository.
async function findUnknownMobilityProfileIds(ids) {
  const unique = [...new Set(ids.map(Number))];
  if (unique.length === 0) return [];
  const existing = new Set(await profileRepo.findMobilityProfileIds(unique));
  return unique.filter(id => !existing.has(id));
}

async function updateProfile(userId, { ageGroup, mobilityProfileIds }) {
  let ids;
  // Any array (including []) replaces the selection — an empty array must be
  // able to clear all profiles, not silently no-op.
  if (Array.isArray(mobilityProfileIds)) {
    ids = [...new Set(mobilityProfileIds.map(Number))];
    const unknown = await findUnknownMobilityProfileIds(ids);
    if (unknown.length > 0) {
      throw Object.assign(new Error(`Unknown mobility profile id(s): ${unknown.join(', ')}`), {
        code: 'INVALID_MOBILITY_PROFILE',
        status: 400,
      });
    }
  }
  await profileRepo.saveProfile(userId, { ageGroup, mobilityProfileIds: ids });
  return getUserProfile(userId);
}

async function getStats(userId) {
  return profileRepo.getStats(userId);
}

module.exports = { getUserProfile, updateProfile, getStats, findUnknownMobilityProfileIds };
