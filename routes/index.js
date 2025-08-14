const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: '연예인 헤어스타일 합성기' });
});
//
module.exports = router;