let fs = require('fs'),
  d3 = require('d3'),
  shuffle = require('shuffle-array'),
  csv = require('fast-csv'),
  shell = require('shelljs')

if(process.argv.length < 5){
  console.log('Please provide path to the data folder and output path and test type.')
  process.exit()
}

for(let i = 2; i<4; i++){
  if(process.argv[i].substr(-1,1) != '/'){ 
    process.argv[i] += '/' 
  }
}

//Check if output folder exists
if (!fs.existsSync(process.argv[3])) {
  fs.mkdirSync(process.argv[3]);
}

let optimizer = 'Adam'
if(process.argv[5]){
  optimizer = process.argv[5] //Ftrl, RMSProp, Adam, Adagrad, SGD, Momentum
}

let train_data = []

let test_type = '',
  type_n = process.argv[4].split('-')

switch(type_n[0]){
  case 'all':
    test_type = 'location'
  break;
  case 'all_limit':
    test_type = 'location_limit_'+type_n[1]
  break;
  case 'all_train':
    test_type = 'location_train_'+type_n[1]
  break;
  case 'filter':
    test_type = 'filter_location'
  break;
  case 'filter_limit':
    test_type = 'filter_limit_'+type_n[1]
  break;
  case 'filter_train':
    test_type = 'filter_train_'+type_n[1]
  break;
  default:
    console.log('unrecognised test type')
    process.exit()
  break;
}

csv
 .fromPath(process.argv[2]+test_type+".csv")
 .on("data", function(data){
      train_data.push(data)
 })
 .on("end", function(){
     start()
 })

let ignore = {'NA':1}
let columns = ['start_10_min','end_10_min','duration','day_of_week','location_id']
let cat = {'day_of_week':1,'start_10_min':1,'end_10_min':1,'location_id':1}
let continous = {}
let target = 'duration', target_col = 2
let csv_columns = {
  location_id:0,
  location_id_txt:1,
  fs_id:2,
  start_10_min:3,
  end_10_min:4,
  day_of_week:5,
  month:6,
  duration:7
}

function start(){
  console.log('data loaded')
  train_data = train_data.filter(function(data){
    return !(data[0] in ignore)
  })

  //drop not needed columns
  let t_train_data = []
  train_data.forEach((t,ti) => {
    if(ti>0){
      let obj = []
      columns.forEach( c => {
        obj.push(t[csv_columns[c]])
      })
      t_train_data.push(obj)
    }
  })
  train_data = t_train_data

  let target_keys = {}, target_key_count = 0
  train_data.forEach( t => {
    if(!(t[target_col] in target_keys)){
      target_keys[t[target_col]] = target_key_count
      target_key_count++
    }
    t[target_col] = target_keys[t[target_col]]
  })

  let hist = {}

  train_data.forEach( d => {
    d.forEach( (dd,ddi) => {
      if(!(columns[ddi] in hist)){
        hist[columns[ddi]] = {}
      }
      if(!(dd in hist[columns[ddi]])){
        hist[columns[ddi]][dd] = 0
      }
      hist[columns[ddi]][dd]++
    })
  })

  let hist_count = {}
  for(let ddi in hist){
    let c = 0
    for(let dd in hist[ddi]){
      c++
    }
    hist_count[ddi] = c
  }

  shuffle(train_data)

  let test_data = []

  let limit = train_data.length*0.1 // 10% for testing
  while(test_data.length < limit){
    let r = Math.round(Math.random()*(train_data.length-1))
    let robj = []
    for(let col in columns){
      //if(columns[col] != target){
        robj.push(train_data[r][col])
      //}
    }
    test_data.push(robj)
    train_data.splice(r,1)
  }

  fs.writeFileSync(process.argv[3]+'tensor-train.csv', json2csv(train_data))
  fs.writeFileSync(process.argv[3]+'tensor-test.csv', json2csv(test_data))

  var head = [columns];
  
  //fs.writeFileSync(process.argv[3]+'tensor-train-wh.csv', json2csv(head.concat(train_data)))
  //fs.writeFileSync(process.argv[3]+'tensor-test-wh.csv', json2csv(head.concat(test_data)))

  console.log('train/test build')

  //MODIFY PYTHON FILE

  var python = fs.readFileSync('./tensorflow_base.py', 'utf8')

  let columndefs = '',
    columnfeatures = '', ccolumns = [], catcolumns = []
    ci = 0
  for(let col in columns){
    if(columns[col] != target && !(columns[col] in continous)){
      if(ci>0){ columnfeatures += ','; columndefs += "\n"; }
      columndefs += 'col_'+columns[col]+' = tf.contrib.layers.sparse_column_with_integerized_feature("'+columns[col]+'", bucket_size='+(hist_count[columns[col]])+')';
      columnfeatures += 'tf.contrib.layers.embedding_column(col_'+columns[col]+', dimension='+(hist_count[columns[col]])+')'
      ci++
      catcolumns.push(columns[col])
    }else if((columns[col] in continous)){
      ccolumns.push(columns[col])
    }
  }

  var direct_test = []
  var direct_labels = []

  for(var i = 0; i<test_data.length; i++){
    var robj = [];
    for(let col in columns){
      if(columns[col] != target){
        robj.push(test_data[i][col])
      }else{
        direct_labels.push(test_data[i][col])
      }
    }
    direct_test.push(robj)
  }

  var new_python = python

  //The new samples need to be sourced from the moves files
  let tc_columns = []
  columns.forEach(c => {tc_columns.push(c)})
  tc_columns.splice(target_col,1)

  new_python = new_python.replace('%LABEL%', "'"+target+"'");
  new_python = new_python.replace('%NEW_SAMPLES%', JSON.stringify(direct_test));
  new_python = new_python.replace('%CATCOLUMNS%', JSON.stringify(catcolumns));
  new_python = new_python.replace('%CLASSES%', hist_count[target]);
  new_python = new_python.replace('%COLUMNS%', JSON.stringify(columns));
  new_python = new_python.replace('%CCOLUMNS%', JSON.stringify(ccolumns));
  new_python = new_python.replace('%COLUMNS%', JSON.stringify(tc_columns));
  new_python = new_python.replace('%OPTIMIZER%', optimizer); //Ftrl, RMSProp, Adam, Adagrad, SGD, Momentum
  new_python = new_python.replace('%HIDDENUNITS%', '10, 20, 10');
  new_python = new_python.replace('%COLUMNS%', JSON.stringify(tc_columns));
  new_python = new_python.replace('%COLUMNDEFS%', columndefs);
  new_python = new_python.replace('%COLUMNFEATURES%', columnfeatures);
  fs.writeFileSync(process.argv[3]+'tensorflow_base_gen.py', new_python);

  console.log('python build')

  //EXECUTE PYTHON FILE

  //Execute node.js under tensorflow activation
  //console.log(shell.exec('source ~/tensorflow/bin/activate'));

  var feedback = shell.exec('python '+process.argv[3]+'tensorflow_base_gen.py '+process.argv[3]+'tensor-train.csv '+process.argv[3]+'tensor-test.csv', {silent:(process.argv[6]&&process.argv[6]=='TRUE')?false:true}).stdout; //, {silent:true}

  var result = JSON.parse((('['+(feedback.split('['))[1]).replace(' ','')).trim());

  var accuracy = feedback.split('Accuracy:')[1].substring(0,7).trim()

  var eval = {overall:accuracy}

  r_label_keys = {}
  for(var key in hist[target]){
    eval[key] = {
      good:0,
      bad:0,
      //false positives
      fpos:0
    }
  }

  result.forEach(function(d,i){
    if(direct_labels[i] == d){
      eval[d].good++
    }else{
      eval[d].bad++
      eval[direct_labels[i]].fpos++
    }
  })

  fs.writeFileSync(process.argv[3]+'tensor-return.txt', feedback);
  fs.writeFileSync(process.argv[3]+'tensor-eval.json', JSON.stringify(eval, null, 4));

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