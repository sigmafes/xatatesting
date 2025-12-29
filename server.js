const express = require('express');
const path = require('path');
const app = express();

const staticDir = path.join(__dirname);
app.use(express.static(staticDir));

const port = process.env.PORT || 3000;
app.listen(port, ()=>{
  console.log('Server listening on port', port);
});
