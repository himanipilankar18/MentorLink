const Community = require('../models/Community');

function isExternalUser(user) {
  return String(user?.userType || '').toUpperCase() === 'EXTERNAL';
}

function isAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

function isOwnerOrAdmin(community, user) {
  return isAdmin(user) || String(community?.creatorId || '') === String(user?._id || '');
}

function hasCommunityFlag(community, user) {
  if (isExternalUser(user)) return community?.allowExternal === true;
  return community?.allowInternal !== false;
}

function canAccessCommunity(community, user) {
  if (!community || community.isActive === false || !user) return false;
  return isOwnerOrAdmin(community, user)
    || (!isExternalUser(user) && community.isModerator(user._id))
    || hasCommunityFlag(community, user);
}

function visibilityQuery(user) {
  if (isAdmin(user)) return {};
  const field = isExternalUser(user) ? 'allowExternal' : 'allowInternal';
  return {
    $or: [
      ...(isExternalUser(user) ? [{ [field]: true }] : [
        { [field]: true },
        { [field]: { $exists: false } },
      ]),
      { creatorId: user._id },
      ...(!isExternalUser(user) ? [{
        members: {
          $elemMatch: {
            userId: user._id,
            role: { $in: ['moderator', 'admin'] },
          },
        },
      }] : []),
    ],
  };
}

async function getAccessibleCommunity(id, user) {
  const community = await Community.findOne({ _id: id, isActive: true });
  if (!canAccessCommunity(community, user)) return null;
  return community;
}

function denyCommunity(res) {
  return res.status(404).json({
    success: false,
    message: 'Community not found',
  });
}

module.exports = {
  isExternalUser,
  isOwnerOrAdmin,
  canAccessCommunity,
  visibilityQuery,
  getAccessibleCommunity,
  denyCommunity,
};
