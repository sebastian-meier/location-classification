let sql = require('spatialite'),
  fs = require('fs')

if(process.argv.length < 4){
  console.log('Please provide path to spatialite database and output path.')
  process.exit()
}

for(let i = 3; i<4; i++){
  if(process.argv[i].substr(-1,1) != '/'){ 
    process.argv[i] += '/' 
  }
}

//Check if output folder exists
if (!fs.existsSync(process.argv[3])) {
  fs.mkdirSync(process.argv[3]);
}

filters = false
if(process.argv[4]){
  filters = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'))
}

let queries = {
  location: "SELECT location_id, 'loc_'||location_id AS location_id_txt, fs_id, start_10_min, end_10_min, day_of_week, month, duration FROM location_events, locations WHERE location_id = locations.id"
}, query_count = 0, query_keys = []

let ki = 0
for(let key in queries){ query_keys[ki] = key; ki++ }

let db = new sql.Database(process.argv[2]+'.db', function(err){
  if(err) console.log(err);

  db.spatialite(function(err) {
    if(err) console.log(err);

    processQueries()

  })
})

function processQueries(){

  db.all(queries[query_keys[query_count]], function(err, rows){

    if(err) console.log(err)

    createOutputs(rows, '')

    //Filter if filters is active
    if(filters){
      let frows = []
      rows.forEach( r => {
        if(r.location_id in filters){
          r['type'] = filters[r.location_id].tag
          frows.push(r)
        }
      })
      createOutputs(frows, 'filter_')
    }

    query_count++
    if(query_count<query_keys.length){
      processQueries()
    }else{
      console.log('done')
    }
  })
}

function createOutputs(rows, ext){
  let head = ''

  for(let key in rows[0]){ if(head!=''){head+=','} head+=key }

  fs.writeFileSync(
    process.argv[3]+ext+query_keys[query_count]+'.csv', 
    head+array2csv(rows)
  )

  //Simulate training over time, by splitting into 10 pieces each file contains n/10 of the overall data
  for(let i = 1; i<=10; i++){
    let train = rows.slice(0,((rows.length/10*i)-1))
    fs.writeFileSync(
      process.argv[3]+ext+query_keys[query_count]+'_train_'+i+'.csv', 
      head+array2csv(train)
    )
  }

  //Limit to trip-groups which have at least n trips
  let event_counts = {}
  rows.forEach( r => {
    if(!(r.location_id in event_counts)){
      event_counts[r.location_id] = 0
    }
    event_counts[r.location_id]++
  })

  for(let i = 1; i<=10; i++){
    let limit = []
    rows.forEach( r => {
      if(event_counts[r.location_id] > i){
        limit.push(r)
      }
    })
    fs.writeFileSync(
      process.argv[3]+ext+query_keys[query_count]+'_limit_'+i+'.csv', 
      head+array2csv(limit)
    )
  }
}

/*Helper Functions*/

function add(a, b) {
  return a + b;
}

function array2csv(a){
  var r = '';
  a.forEach(function(d,i){
    r += '\n';
    r += array2csv_line(d);
  });
  return r;
}

function array2csv_line(l){
  var r = '';
  var i = 0;
  for(var key in l){
    if(i>0) r += ',';
    r += l[key];
    i++;
  }
  return r;
}