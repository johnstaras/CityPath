const router = require('express').Router();
const { googleLogin, refresh, logout } = require('../controllers/authController');

router.post('/google', googleLogin);
router.post('/refresh', refresh);
// No authMiddleware: logout accepts the refresh token in the body, so it still
// revokes it when the access token has already expired. The controller uses a
// valid access token when one is present.
router.post('/logout', logout);

module.exports = router;
