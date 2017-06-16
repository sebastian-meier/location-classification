const v8 = require('v8')
v8.setFlagsFromString('--max_old_space_size=4096')
v8.setFlagsFromString('--max_executable_size=4096')

var convnetjs = require('convnetjs'),
  csv = require('fast-csv'),
  fs = require('fs'),
  shuffle = require('shuffle-array');
 
var opts = {}; // options struct
opts.train_ratio = 0.7;
opts.num_folds = 10; // number of folds to eval per candidate
opts.num_candidates = 10; // number of candidates to eval in parallel
opts.num_epochs = 50; // epochs to make through data per fold
// below, train_data is a list of input Vols and train_labels is a 
// list of integer correct labels (in 0...K).
var magicNet;

var temp_data = []

var train_data = [], train_labels = [], label_keys = {}, label_id = 0;

csv
 .fromPath("./train_10.csv")
 .on("data", function(data){
      temp_data.push(data)
 })
 .on("end", function(){
     start();
 });

var test_data = [], test_labels = [], man_test = true

function start(){
  shuffle(temp_data)

  temp_data.forEach(function(data){
    //expects, last column to be the label
    var train_data_vol = []
    data.forEach(function(d,i){
      if(i<(data.length-1)){
        train_data_vol.push(d)
      }
    })
   train_data.push(new convnetjs.Vol(train_data_vol));

   if(!(data[data.length-1] in label_keys)){
    label_keys[data[data.length-1]] = label_id
    label_id++
   }
   train_labels.push([label_keys[data[data.length-1]]]);
  })

  console.log(label_keys)

  if(!man_test){
    var limit = train_data.length*0.1 // 10% for testing
    while(test_data.length < limit){
      var r = Math.round(Math.random()*(train_data.length-1))
      test_data.push(train_data[r])
      test_labels.push(train_labels[r])
      train_data.splice(r,1)
      train_labels.splice(r,1)
    }
  }

  magicNet = new convnetjs.MagicNet(train_data, train_labels, opts);
  magicNet.onFinishBatch(finishedBatch); // example of setting callback for events
   
  // start training magicNet. Every step() call all candidates train on one example
  setInterval(function(){ magicNet.step(); }, 0);
}
 
// once at least one batch of candidates is evaluated on all folds we can do prediction!
function finishedBatch() {
  // prediction example. xout is Vol of scores
  // there is also predict_soft(), which returns the full score volume for all labels
  
  if(man_test){
    var test = [
      [23.0,2.0,4.0,7.0,461.0,0],
      [19.0,2.0,1.0,16.0,2666.0,0],
      [12.0,5.0,3.0,17.0,298.0,1],
      [16.0,5.0,10.0,19.0,221.0,1],
      [8.0,1.0,1.0,17.0,526.0,1],
      [11.0,1.0,2.0,18.0,371.0,1],
      [15.0,2.0,1.0,18.0,176.0,2],
      [17.0,5.0,1.0,17.0,5.0,3],
      [19.0,0.0,3.0,19.0,17.0,4],
      [15.0,0.0,5.0,10.0,2564.0,5],
      [22.0,3.0,5.0,0.0,100.0,5],
      [22.0,3.0,5.0,0.0,100.0,5],
      [20.0,2.0,3.0,13.0,1020.0,6],
      [18.0,0.0,3.0,10.0,2401.0,7],
      [16.0,1.0,7.0,16.0,26.0,8]
    ];

    test_data = []
    test_labels = []
    test.forEach(function(d){
      var arr = []
      d.forEach(function(dd,i){
        if(i<d.length-1){
          arr.push(dd)
        }
      })
      test_data.push(new convnetjs.Vol(arr))
      test_labels.push([d[d.length-1]])
    })
  }

  test_data.forEach(function(d,i){
    console.log(test_labels[i], magicNet.predict(new convnetjs.Vol(d)));
  });

  fs.writeFileSync('magicNet_export.json',JSON.stringify(magicNet.toJSON()))

  console.log('done');

  process.exit()
}