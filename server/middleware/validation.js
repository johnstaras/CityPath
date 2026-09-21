const { body, validationResult } = require('express-validator');
const { findUnknownMobilityProfileIds } = require('../services/profileService');

const validateProfileUpdate = [
  body('ageGroup')
    .optional()
    .isString()
    .withMessage('ageGroup must be a string'),
  body('mobilityProfileIds')
    .optional()
    .isArray()
    .withMessage('mobilityProfileIds must be an array'),
  body('mobilityProfileIds.*')
    .optional()
    .isInt()
    .withMessage('Each mobilityProfileId must be an integer'),
  // Ids must exist: answered here as a 400, because profileController reports
  // every service error as a 500. The service repeats the check before saving.
  body('mobilityProfileIds')
    .optional()
    .custom(async ids => {
      if (!Array.isArray(ids) || !ids.every(id => Number.isInteger(Number(id)))) return true;
      const unknown = await findUnknownMobilityProfileIds(ids);
      if (unknown.length > 0) {
        throw new Error(`Unknown mobility profile id(s): ${unknown.join(', ')}`);
      }
      return true;
    }),
];

const validateRating = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('rating must be an integer between 1 and 5'),
  body('accessibilityRating')
    .isInt({ min: 1, max: 5 })
    .withMessage('accessibilityRating must be an integer between 1 and 5'),
  body('comment')
    .optional()
    .isString()
    .withMessage('comment must be a string'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = {
  validateProfileUpdate,
  validateRating,
  handleValidationErrors,
};
