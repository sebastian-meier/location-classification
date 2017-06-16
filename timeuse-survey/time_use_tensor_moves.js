var type = parseInt(process.argv[2]); // 24 or 2
var name = process.argv[3];
var optimizer = process.argv[4]; //Ftrl, RMSProp, Adam, Adagrad, SGD, Momentum

console.log(type,name,optimizer)

    //file loading and saving
var fs = require('fs'),
  csv = require('fast-csv'),
  shuffle = require('shuffle-array'),

  //for binning
  d3 = require('d3'),

  //executing the tensor flow
  shell = require('shelljs');

var train_data = []
var moves_data = []
var moves_dict = []

csv
 .fromPath("./data/time-use"+((type === 24)?'-24':'')+".csv")
 .on("data", function(data){
      train_data.push(data)
 })
 .on("end", function(){
     getMoves();
 });

function getMoves(){
  csv
   .fromPath("./data/min_raw.csv")
   .on("data", function(data){
        moves_data.push(data)
   })
   .on("end", function(){
       getMovesDict();
   });
}

function getMovesDict(){
  csv
   .fromPath("./data/min_dict.csv")
   .on("data", function(data){
        moves_dict.push(data)
   })
   .on("end", function(){
       start();
   });
 }

 var ignore = {'NA':1, 'Shopping':1, 'Food':1, 'OtherHome':1, 'Leisure':1, 'Transit':1, 'Transport':1} //}, 'Transport':1

function start(){

  console.log('data loaded')

  //BUILD TRAIN AND TEST DATA

  train_data = train_data.filter(function(data){
    return !(data[data.length-1] in ignore)
  })

  shuffle(train_data)

  fs.writeFileSync('./data/tensor-time-use-train_wh.csv', 'start,end,duration,type'+'\n'+json2csv(train_data));

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

  fs.writeFileSync('./data/'+name+'_tensor-time-use-dict.json', JSON.stringify(label_keys, null, 4));
  fs.writeFileSync('./data/'+name+'_tensor-time-use-hist.json', JSON.stringify(hist, null, 4));

  var translate = {
    0:'Home',
    1:'Work',
    2:'Food',
    3:'Transit',
    4:'Shopping',
    5:'OtherHome'
  }

  var test_data = [], test_data_wh = [], max_size = 0

  moves_data.forEach(function(d){
    var arr = [], arr_wh = []
    if(parseInt(d[2]) > max_size){max_size = d[2]}
    var label = false
    d.forEach(function(dd, ii){
      if(ii<d.length-1){
        arr.push(parseInt(dd))
        arr_wh.push(parseInt(dd))
      }else{
        arr.push(label_keys[translate[dd]])
        arr_wh.push(translate[dd])
      }
    })
    if(!(arr_wh[arr_wh.length-1] in ignore)){
      test_data.push(arr)
      test_data_wh.push(arr_wh)
    }
  })

  fs.writeFileSync('./data/tensor-time-use-train.csv', json2csv(train_data));
  fs.writeFileSync('./data/tensor-time-use-test.csv', json2csv(test_data));
  fs.writeFileSync('./data/tensor-time-use-test_wh.csv', 'start,end,duration,type'+'\n'+json2csv(test_data_wh));

  var head = [[]];
  for(var i = 0; i<train_data[0].length; i++){
    if(i<train_data[0].length-1){
      head[0].push('ts_'+i);
    }else{
      head[0].push('Type');
    }
  }  

  fs.writeFileSync('./data/tensor-time-use-train-wh.csv', json2csv(head.concat(train_data)));
  fs.writeFileSync('./data/tensor-time-use-test-wh.csv', json2csv(head.concat(test_data)));

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
      columndefs += 'col_ts_'+i+' = tf.contrib.layers.sparse_column_with_integerized_feature("ts_'+i+'", bucket_size='+((i<train_data[0].length-2)?144:max_size)+')';
      columnfeatures += 'tf.contrib.layers.embedding_column(col_ts_'+i+', dimension='+((i<train_data[0].length-2)?144:max_size)+')'
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

  var feedback = shell.exec('python test_balanced_time_use_gen.py tensor-time-use-train.csv tensor-time-use-test.csv', {}).stdout; //, {silent:true}

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

  fs.writeFileSync('./data/'+name+'_tensor-time-use-return.txt', feedback);
  fs.writeFileSync('./data/'+name+'_tensor-time-use-eval.json', JSON.stringify(eval, null, 4));

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