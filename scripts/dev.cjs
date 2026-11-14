const {createLocalServer}=require('../lib/local-server.cjs');
const server=createLocalServer();
server.listen(3000,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:3000 (environment values are not logged)'));
