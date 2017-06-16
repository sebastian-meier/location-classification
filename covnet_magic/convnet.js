var convnetjs = require('convnetjs'),
  fs = require('fs');
var magicNet = new convnetjs.MagicNet();
magicNet.fromJSON(JSON.parse(fs.readFileSync('./magicnet.json', 'utf8')));

var test = [
[23.0,2.0,4.0,7.0,461.0,0],
[19.0,2.0,1.0,16.0,2666.0,0],
[12.0,5.0,3.0,17.0,298.0,1],
[16.0,5.0,10.0,19.0,221.0,1],
[15.0,2.0,1.0,18.0,176.0,2],
[17.0,5.0,1.0,17.0,5.0,3],
[19.0,0.0,3.0,19.0,17.0,4],
[15.0,0.0,5.0,10.0,2564.0,5],
[22.0,3.0,5.0,0.0,100.0,5],
[20.0,2.0,3.0,13.0,1020.0,6],
[18.0,0.0,3.0,10.0,2401.0,7],
[16.0,1.0,7.0,16.0,26.0,8]
];

test.forEach(function(d,i){
  console.log(d[5], magicNet.predict(new convnetjs.Vol([d[0],d[1],d[2],d[3],d[4]])));
});
