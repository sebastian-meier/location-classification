var type = parseInt(process.argv[2]); // 24 or 2
var name = process.argv[3];
var optimizer = process.argv[4]; //Ftrl, RMSProp, Adam, Adagrad, SGD, Momentum

    //file loading and saving
var fs = require('fs'),
  csv = require('fast-csv'),
  shuffle = require('shuffle-array'),
  //for binning
  d3 = require('d3'),
  //executing the tensor flow
  shell = require('shelljs');

[3,5].forEach(i => {
  if(process.argv[i].substr(-1,1) != '/'){ 
    process.argv[i] += '/' 
  }
})

//Check if output folder exists
if (!fs.existsSync(process.argv[3])) {
  fs.mkdirSync(process.argv[3]);
}

var train_data = []

csv
 .fromPath(process.argv[5]+"time-use"+((type === 24)?'-24':'')+".csv")
 .on("data", function(data){
      train_data.push(data)
 })
 .on("end", function(){
     start();
 });

 var ignore = {'NA':1} //}, 'Transport':1

function start(){

  console.log('data loaded')

  //BUILD TRAIN AND TEST DATA

  train_data = train_data.filter(function(data){
    return !(data[data.length-1] in ignore)
  })

  shuffle(train_data)

  var label_keys = {}, label_id = 0, hist = {};

  train_data.forEach(function(data){
   if(!(data[data.length-1] in label_keys)){
    hist[data[data.length-1]] = 0
    label_keys[data[data.length-1]] = label_id
    label_id++
   }
   hist[data[data.length-1]]++
  })

  //switch labels to integers
  train_data.forEach(function(d){
    d.forEach(function(dd,ii){
      if(ii<d.length-1){
        dd = parseInt(dd)
      }
    })
    d[d.length-1] = label_keys[d[d.length-1]]
  })

  fs.writeFileSync(process.argv[3]+'tensor-time-use-dict.json', JSON.stringify(label_keys, null, 4));
  fs.writeFileSync(process.argv[3]+'tensor-time-use-hist.json', JSON.stringify(hist, null, 4));

  var test_data = []

  var limit = train_data.length*0.1 // 10% for testing
  while(test_data.length < limit){
    var r = Math.round(Math.random()*(train_data.length-1))
    test_data.push(train_data[r])
    train_data.splice(r,1)
  }

  fs.writeFileSync(process.argv[3]+'tensor-time-use-train.csv', json2csv(train_data));
  fs.writeFileSync(process.argv[3]+'tensor-time-use-test.csv', json2csv(test_data));

  var head = [[]];
  for(var i = 0; i<train_data[0].length; i++){
    if(i<train_data[0].length-1){
      head[0].push('ts_'+i);
    }else{
      head[0].push('Type');
    }
  }  

  fs.writeFileSync(process.argv[3]+'tensor-time-use-train-wh.csv', json2csv(head.concat(train_data)));
  fs.writeFileSync(process.argv[3]+'tensor-time-use-test-wh.csv', json2csv(head.concat(test_data)));

  console.log('train/test build')

  //MODIFY PYTHON FILE

  var python = fs.readFileSync('./test_balanced_time_use.py', 'utf8');

  var columns = '';
  var columndefs = '';
  var columnfeatures = '';
  for(var i = 0; i<train_data[0].length-1; i++){
    if(i>0){ columns += ','; columnfeatures += ','; columndefs += "\n"; }
    columns += '"ts_'+i+'"';
    if(type === 24){
      columndefs += 'col_ts_'+i+' = tf.contrib.layers.sparse_column_with_integerized_feature("ts_'+i+'", bucket_size=2)';
      columnfeatures += 'tf.contrib.layers.embedding_column(col_ts_'+i+', dimension=2)'
    }else{
      columndefs += 'col_ts_'+i+' = tf.contrib.layers.sparse_column_with_integerized_feature("ts_'+i+'", bucket_size=144)';
      columnfeatures += 'tf.contrib.layers.embedding_column(col_ts_'+i+', dimension=144)'
    }
  }

  var direct_test = []
  var direct_labels = []

  for(var i = 0; i<test_data.length; i++){
    var arr = [];
    for(var j = 0; j<test_data[i].length; j++){
      if(j<(test_data[i].length-1)){
        arr.push(parseInt(test_data[i][j]))
      }else{
        direct_labels.push(test_data[i][j])
      }
    }
    direct_test.push(arr)
  }

  var new_python = python

  //The new samples need to be sourced from the moves files

  new_python = new_python.replace('%NEW_SAMPLES%', JSON.stringify(direct_test));
  new_python = new_python.replace('%CLASSES%', label_id);
  new_python = new_python.replace('%COLUMNS%', columns);
  new_python = new_python.replace('%COLUMNS%', columns);
  new_python = new_python.replace('%OPTIMIZER%', optimizer); //Ftrl, RMSProp, Adam, Adagrad, SGD, Momentum
  new_python = new_python.replace('%HIDDENUNITS%', ((type === 24)?'100, 50, 10':'10, 20, 10'));
  new_python = new_python.replace('%COLUMNS%', columns);
  new_python = new_python.replace('%COLUMNDEFS%', columndefs);
  new_python = new_python.replace('%COLUMNFEATURES%', columnfeatures);
  fs.writeFileSync('./test_balanced_time_use_gen.py', new_python);

  console.log('python build')

  //EXECUTE PYTHON FILE

  //Execute node.js under tensorflow activation
  //console.log(shell.exec('source ~/tensorflow/bin/activate'));

  var feedback = shell.exec('python test_balanced_time_use_gen.py '+process.argv[3]+'tensor-time-use-train.csv '+process.argv[3]+'tensor-time-use-test.csv', {silent:(process.argv[6]&&process.argv[6]=='TRUE')?false:true}).stdout; //, {silent:true}

  var result = JSON.parse((('['+(feedback.split('['))[1]).replace(' ','')).trim());

  var accuracy = feedback.split('Accuracy:')[1].substring(0,7).trim()

  var eval = {overall:accuracy}

  r_label_keys = {}
  for(var key in label_keys){
    r_label_keys[label_keys[key]] = key
    eval[key] = {
      good:0,
      bad:0,
      //false positives
      fpos:0
    }
  }

  result.forEach(function(d,i){
    if(direct_labels[i] == d){
      eval[r_label_keys[d]].good++
    }else{
      eval[r_label_keys[d]].bad++
      eval[r_label_keys[direct_labels[i]]].fpos++
    }
  })

  fs.writeFileSync(process.argv[3]+'tensor-time-use-return.txt', feedback);
  fs.writeFileSync(process.argv[3]+'tensor-time-use-eval.json', JSON.stringify(eval, null, 4));

  console.log('DONE');

  process.exit();
}

function json2csv(json){
  var csv = ''
  json.forEach(function(d,i){
    if(i>0){
      csv += '\n'
    }
    d.forEach(function(dd,ii){
      if(ii>0){
        csv += ','
      }
      csv += dd
    })
  })
  return csv
}